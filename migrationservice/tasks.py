import logging
import os
import shutil
import tempfile
import time
from datetime import datetime
from datetime import timezone as dt_timezone

from celery import chord
from celery import shared_task as task
from django.conf import settings
from django.conf.locale import LANG_INFO
from django.core.files import File
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from files import helpers
from files.models import (
    Category,
    EncodeProfile,
    Encoding,
    Language,
    Media,
    MediaPermission,
    Playlist,
    PlaylistMedia,
    Subtitle,
    Tag,
)
from files.models.utils import PREVIEW_PROFILE_NAME, generate_uid
from lti.models import LTIPlatform, LTIResourceLink
from rbac.models import RBACGroup, RBACMembership
from users.models import User

from .compose import (
    MAX_STREAMS,
    canvas_size,
    compose_side_by_side,
    layout_boxes,
    pick_flavor_for_width,
    stream_area,
)
from .models import MigrationRecord, MigrationService
from .providers import get_provider
from .providers.kaltura import (
    MEDIA_TYPE_IMAGE,
    ancestor_categories,
    category_title_and_description,
    category_type,
    is_ignored_category,
    is_importable_category,
    is_lms_course,
    match_flavors_to_profiles,
    media_state,
    mediacms_role,
    needs_rbac_group,
    parse_comma_list,
    sanitize_username,
    unique_category_title,
)
from .providers.youtube import pick_profile
from .scheduling import (
    QUIET_RECHECK_SECONDS,
    in_quiet_window,
    parse_scheduled_at,
    scheduled_at_text,
)

logger = logging.getLogger(__name__)

QUIET_LOG_MARKER = "inside the quiet hours window"


def record(service, object_type, source_id, status, log="", target=None):
    """Write the mapping row for one source object.

    update_or_create, so retrying a failed item replaces its record rather than
    tripping the unique constraint.
    """
    fields = {
        "status": status,
        "log": (log or "")[:500],
        "target_id": target.pk if target is not None else None,
    }

    row, _created = MigrationRecord.objects.update_or_create(
        service=service,
        object_type=object_type,
        source_id=str(source_id),
        defaults=fields,
    )
    return row


def unique_username(candidate):
    """A username not already taken, suffixed with a counter if needed"""
    if not User.objects.filter(username__iexact=candidate).exists():
        return candidate
    index = 2
    while True:
        suffixed = f"{candidate[:145]}-{index}"
        if not User.objects.filter(username__iexact=suffixed).exists():
            return suffixed
        index += 1


def import_user(service, provider, source_id):
    """Create or link the MediaCMS user for one source user, and record it"""
    options = service.get_options()
    payload = provider.fetch_user(source_id)

    email = (payload.get("email") or "").strip()
    username = sanitize_username(payload.get("id") or source_id)

    user = None
    if email:
        user = User.objects.filter(email__iexact=email).first()
    if user is None:
        # an account with an email of its own is a different person who merely collides
        # on the sanitised name
        candidate = User.objects.filter(username__iexact=username).first()
        if candidate is not None and not candidate.email:
            claimed = (
                MigrationRecord.objects.filter(
                    service__source_system=service.source_system,
                    object_type="user",
                    target_id=candidate.pk,
                    status="success",
                )
                .exclude(source_id=str(source_id))
                .exists()
            )
            if not claimed:
                user = candidate

    created = False
    if user is None:
        user = User(
            username=unique_username(username),
            email=email,
            name=payload.get("fullName") or payload.get("screenName") or username,
        )
        user.set_unusable_password()
        user._skip_admin_notification = True
        user.save()
        created = True

    if created:
        role = mediacms_role(payload.get("roleId"), payload.get("roleName"), options.get("role_map"))
        if role:
            # only for a mapped role: set_role_from_mapping resets everything on an unknown value
            user.set_role_from_mapping(role)

    action = "created" if created else "linked to existing user"
    record(service, "user", source_id, "success", f"{action} {user.username}", target=user)
    return user


def resolve_owner(service, provider, source_user_id):
    """The MediaCMS user a migrated media should belong to"""
    options = service.get_options()

    wants_real_owner = options.get("migrate_all_users", True) or options.get("create_users", False) or options.get("restrict_to_users", False)
    if wants_real_owner and source_user_id:
        try:
            return import_user(service, provider, source_user_id)
        except KeyError:
            logger.warning("migration %s: source user %s not found, using fallback", service.pk, source_user_id)
        except Exception as exc:  # noqa: BLE001 - fall back rather than lose the media
            logger.warning("migration %s: could not import user %s: %s", service.pk, source_user_id, exc)

    return fallback_owner(service)


def fallback_owner(service):
    """The account a media goes to when its own owner cannot be resolved.

    A named owner first, where the source offers one as a setting, then whoever set the
    migration up, then an administrator: a run never loses media for want of an owner.
    """
    options = service.get_options()
    named = options.get("fallback_username") if "fallback_username" in service.provider_class.default_options else ""
    candidates = [named, options.get("initiated_by"), "admin"]
    for username in candidates:
        if not username:
            continue
        found = User.objects.filter(username=username).first()
        if found is not None:
            return found

    administrator = User.objects.filter(is_superuser=True).order_by("pk").first()
    if administrator is None:
        raise ValueError("No fallback owner: name one, or give the portal an administrator")
    return administrator


CATEGORY_UID_MAX = 36
CATEGORY_TITLE_MAX = 100


def free_category_uid(source_id):
    """A uid for a new category, as close to the Kaltura id as the column allows.

    The Kaltura id as it stands, so the id in a MediaCMS URL can be pasted back into
    Kaltura. Only a preference: the column is unique portal wide and two installations
    number from the same pool, so a taken id falls back to a suffixed form.
    """
    uid = str(source_id)[:CATEGORY_UID_MAX]
    if not Category.objects.filter(uid=uid).exists():
        return uid
    for suffix in range(2, 1000):
        tail = f"-{suffix}"
        candidate = f"{uid[: CATEGORY_UID_MAX - len(tail)]}{tail}"
        if not Category.objects.filter(uid=candidate).exists():
            return candidate
    return generate_uid()


def rbac_group_uid(service, source_id, kind="category"):
    """Stable identifier for the RBAC group that mirrors one source object.

    Prefixed with source_system, which carries the partner id and host: two installations
    both number a category 42, and an unscoped uid would mix their members. The kind is in
    there too, since a category and a group may carry the same id.
    """
    return f"{service.source_system}:{kind}:{source_id}"[:255]


def unique_group_name(title, source_id, taken):
    """A free group name. RBACGroup.name is unique per identity provider"""
    name = (title or f"category-{source_id}")[:100]
    if name not in taken:
        return name
    for suffix in range(2, 100):
        tail = f" ({suffix})"
        candidate = f"{name[: 100 - len(tail)]}{tail}"
        if candidate not in taken:
            return candidate
    tail = f" {source_id}"
    return f"{name[: 100 - len(tail)]}{tail}"


def attach_rbac_group(service, provider, category, payload, source_id):
    """Carry a members-only source category's member list into an RBAC group.

    Keyed on a uid from the source system, so a re-run lands on the existing group.
    Members are added, never removed: access granted inside MediaCMS is not this
    migration's to take away.
    """
    uid = rbac_group_uid(service, source_id)
    group = RBACGroup.objects.filter(uid=uid, identity_provider=None).first()
    if group is None:
        taken = set(RBACGroup.objects.filter(identity_provider=None).values_list("name", flat=True))
        group = RBACGroup.objects.create(
            uid=uid,
            name=unique_group_name(category.title, source_id, taken),
            description=f"Members of {payload.get('fullName') or category.title}",
        )
    group.categories.add(category)

    members = provider.fetch_category_members(source_id)
    owner_id = str(payload.get("owner") or "").strip()
    if owner_id and not any(member["userId"] == owner_id for member in members):
        members.append({"userId": owner_id, "role": "manager"})

    added = 0
    for member in members:
        try:
            user = import_user(service, provider, member["userId"])
        except Exception as exc:  # noqa: BLE001 - one unknown member must not cost the others theirs
            service.append_log(f"category {source_id}: could not import member {member['userId']}: {exc}")
            continue
        if RBACMembership.objects.filter(user=user, rbac_group=group).exists():
            continue
        RBACMembership.objects.create(user=user, rbac_group=group, role=member["role"])
        added += 1

    service.append_log(f"category {source_id}: {added} members added to group {group.name}")
    return group


def import_group(service, provider, source_id):
    """Create or reuse the MediaCMS RBAC group for one Kaltura group.

    A Kaltura group is a named set of people and nothing else, so it grants nothing until
    somebody attaches it to a category. Still worth having: rebuilding a membership list
    by hand is the tedious work a migration is for.
    """
    if not getattr(settings, "USE_RBAC", False):
        record(service, "group", source_id, "skipped", "RBAC is switched off on this portal, so groups have nowhere to go")
        return None

    payload = provider.fetch_group(source_id)

    uid = rbac_group_uid(service, source_id, kind="group")
    group = RBACGroup.objects.filter(uid=uid, identity_provider=None).first()
    if group is None:
        taken = set(RBACGroup.objects.filter(identity_provider=None).values_list("name", flat=True))
        group = RBACGroup.objects.create(
            uid=uid,
            name=unique_group_name(payload.get("name") or source_id, source_id, taken),
            description=payload.get("description") or "",
        )

    added = 0
    for member in payload.get("members") or []:
        try:
            user = import_user(service, provider, member["userId"])
        except Exception as exc:  # noqa: BLE001 - one unknown member must not cost the others theirs
            service.append_log(f"group {source_id}: could not import member {member['userId']}: {exc}")
            continue
        if RBACMembership.objects.filter(user=user, rbac_group=group).exists():
            continue
        RBACMembership.objects.create(user=user, rbac_group=group, role=member["role"])
        added += 1

    record(service, "group", source_id, "success", f"created group {group.name} with {added} member(s)")
    return group


def attach_tags(media, titles, owner):
    """Attach tags to media, spelling each title the way Tag itself stores it.

    Tag.save() strips a title to alphanumerics and spaces, so a lookup by the raw text
    misses the row that holds it: "vice.com" finds nothing, then the insert lands on the
    existing "vicecom". It defeats get_or_create's own retry too.
    """
    for raw in titles:
        title = helpers.get_alphanumeric_and_spaces(str(raw or ""))[:100].strip()
        if not title:
            continue
        tag, _created = Tag.objects.get_or_create(title=title, defaults={"user": owner})
        media.tags.add(tag)


def import_youtube_video(service, provider, source_id):
    """Import one YouTube video.

    Its own importer rather than the portal shaped one: no owner to resolve, no category
    tree, no catalogue of renditions. The record is written before the download, as
    elsewhere, so a crash leaves a row the retry can discard rather than an orphan.
    """
    options = service.get_options()
    payload = provider.fetch_media(source_id)

    existing = MigrationRecord.objects.filter(service=service, object_type="media", source_id=str(source_id)).first()
    previous_media = existing.target() if existing else None
    if existing and existing.status in ("success", "skipped") and previous_media is not None:
        return previous_media
    if previous_media is not None:
        service.append_log(f"video {source_id}: discarding an incomplete media from an earlier attempt")
        previous_media.delete()

    owner = resolve_owner(service, provider, "")

    skip_transcoding = options.get("skip_transcoding", True)
    profiles = [profile for profile in EncodeProfile.objects.filter(active=True) if profile.resolution]

    wanted = sorted({profile.resolution for profile in profiles}, reverse=True) if skip_transcoding else []

    tmp_dir = tempfile.mkdtemp(prefix=f"youtube-{source_id}-")
    try:
        renditions = provider.download_renditions(source_id, tmp_dir, wanted)
        best_path, best_height = renditions[0]

        media = Media(user=owner, title=payload["title"][:100], description=payload["description"])
        if skip_transcoding:
            media._do_not_transcode = True
        media._skip_admin_notification = True

        with open(best_path, "rb") as handle:
            media.media_file.save(content=File(handle), name=f"{source_id}.mp4", save=False)
        media.save()
        record(service, "media", source_id, "success", f"imported {media.title}", target=media)

        if options.get("preserve_views"):
            media.views = payload["views"]
            media.save(update_fields=["views"])

        attach_tags(media, payload["tags"], owner)

        if skip_transcoding:
            encodings, filed = [], []
            for path, height in renditions:
                profile = pick_profile(height, profiles)
                if profile is None or any(existing.profile_id == profile.id for existing in encodings):
                    continue
                encodings.append(create_encoding(media, profile, path))
                filed.append(f"{height}p as {profile.name}")

            if encodings:
                finalise_encodings(media, encodings)
                service.append_log(f"video {source_id}: filed {', '.join(filed)}, nothing transcoded")
            else:
                service.append_log(f"video {source_id}: no profile at or below {best_height}p, leaving it to encode")
                media.encode(chunkize=False)

            ensure_preview(media)

        for caption in payload["captions"]:
            import_youtube_caption(service, provider, media, caption, tmp_dir)

        return media
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        provider.cleanup()


def import_panopto_user(service, provider, source_id):
    """Create or link the MediaCMS account for one Panopto user.

    The matching rules are the ones the other sources use, for the same reasons: an email
    is a person, and a username is only a person when the account it lands on has no email
    of its own. Roles are absent because Panopto exposes none through this API.
    """
    payload = provider.fetch_user(source_id)
    email = (payload.get("email") or "").strip()
    username = sanitize_username(payload.get("username") or payload.get("id") or source_id)

    user = None
    if email:
        user = User.objects.filter(email__iexact=email).first()
    if user is None:
        candidate = User.objects.filter(username__iexact=username).first()
        if candidate is not None and not candidate.email:
            claimed = (
                MigrationRecord.objects.filter(
                    service__source_system=service.source_system,
                    object_type="user",
                    target_id=candidate.pk,
                    status="success",
                )
                .exclude(source_id=str(source_id))
                .exists()
            )
            if not claimed:
                user = candidate

    created = False
    if user is None:
        user = User(username=unique_username(username), email=email, name=payload.get("fullName") or username)
        user.set_unusable_password()
        user._skip_admin_notification = True
        user.save()
        created = True
        if payload.get("role"):
            user.set_role_from_mapping(payload["role"])

    record(service, "user", source_id, "success", f"{'created' if created else 'linked to existing user'} {user.username}", target=user)
    return user


def panopto_owner_is_listed(provider, owner, listed):
    wanted = {value.lower() for value in parse_comma_list(listed)}
    if not wanted or not owner.get("id"):
        return False
    if {str(owner.get("id")).lower(), str(owner.get("username") or "").lower()} & wanted:
        return True
    try:
        user = provider.fetch_user(owner["id"])
    except Exception:  # noqa: BLE001
        return False
    return bool({str(user.get("username") or "").lower(), str(user.get("email") or "").lower()} & wanted)


def resolve_panopto_owner(service, provider, owner):
    """The MediaCMS user a migrated recording belongs to"""
    options = service.get_options()
    wants_real_owner = options.get("migrate_all_users", False) or options.get("create_users", True) or options.get("restrict_to_users", False)
    if wants_real_owner and owner.get("id"):
        try:
            return import_panopto_user(service, provider, owner["id"])
        except Exception as exc:  # noqa: BLE001 - fall back rather than lose the recording
            logger.warning("migration %s: could not import user %s: %s", service.pk, owner.get("id"), exc)

    return fallback_owner(service)


def unique_panopto_title(title, parent_name, taken):
    """A folder title not already in `taken`.

    Panopto names every personal folder "My Folder", so collisions are the normal case
    rather than the exception: the folder above it is what tells two apart, and a counter
    is the last resort.
    """
    if title not in taken:
        return title
    for candidate in [f"{title} ({parent_name})"] if parent_name else []:
        if candidate not in taken:
            return candidate[:CATEGORY_TITLE_MAX]
    index = 2
    while True:
        candidate = f"{title} ({index})"[:CATEGORY_TITLE_MAX]
        if candidate not in taken:
            return candidate
        index += 1


PANOPTO_RBAC_ROLES = {
    "viewer": "member",
    "creator": "contributor",
    "content organizer": "contributor",
    "caption requester": "contributor",
    "publisher": "manager",
    "analytics manager": "manager",
}

PANOPTO_SHARE_ROLES = {
    "viewer": "viewer",
    "creator": "editor",
    "content organizer": "editor",
    "caption requester": "editor",
    "publisher": "owner",
    "analytics manager": "owner",
}

RBAC_ROLE_RANK = ("member", "contributor", "manager")
SHARE_ROLE_RANK = ("viewer", "editor", "owner")


def panopto_people(service, provider, principals, role_map, rank):
    people = {}
    for principal in principals:
        role = role_map.get((principal.get("role") or "").strip().lower())
        if not role:
            continue
        if principal.get("type") == "User":
            user_ids = [principal["id"]]
        else:
            try:
                user_ids = provider.group_members(principal["id"])
            except Exception as exc:  # noqa: BLE001
                service.append_log(f"could not read the members of Panopto group {principal['id']}: {exc}")
                getattr(provider, "unreadable_groups", set()).add(principal["id"])
                continue
        for user_id in user_ids:
            try:
                user = import_panopto_user(service, provider, user_id)
            except Exception as exc:  # noqa: BLE001
                service.append_log(f"could not import Panopto user {user_id}: {exc}")
                continue
            if user not in people or rank.index(role) > rank.index(people[user]):
                people[user] = role
    return people


def grant_rbac_role(group, user, role):
    membership = RBACMembership.objects.filter(user=user, rbac_group=group).first()
    if membership is None:
        RBACMembership.objects.create(user=user, rbac_group=group, role=role)
    elif RBAC_ROLE_RANK.index(role) > RBAC_ROLE_RANK.index(membership.role):
        membership.role = role
        membership.save(update_fields=["role"])


def attach_panopto_group(service, provider, category, folder, access):
    folder_id = str(folder.get("id"))
    uid = rbac_group_uid(service, folder_id)
    group = RBACGroup.objects.filter(uid=uid, identity_provider=None).first()
    if group is None:
        taken = set(RBACGroup.objects.filter(identity_provider=None).values_list("name", flat=True))
        group = RBACGroup.objects.create(
            uid=uid,
            name=unique_group_name(category.title, folder_id, taken),
            description=f"Members of {(folder.get('fullName') or category.title).replace('>', ': ')}",
        )
    group.categories.add(category)

    people = panopto_people(service, provider, access.get("principals") or [], PANOPTO_RBAC_ROLES, RBAC_ROLE_RANK)
    for user, role in people.items():
        grant_rbac_role(group, user, role)
    service.append_log(f"folder {folder_id}: {len(people)} members in group {group.name}")
    return group


def configure_panopto_folder_access(service, provider, category, folder):
    access = provider.folder_access(str(folder.get("id")))
    if access.get("public"):
        return
    if not getattr(settings, "USE_RBAC", False):
        service.append_log(f"folder {folder.get('id')}: restricted in Panopto, but RBAC is off, so '{category.title}' is a plain category")
        return
    category.is_rbac_category = True
    category.is_lms_course = bool(access.get("lms"))
    category.save(update_fields=["is_rbac_category", "is_lms_course"])
    group = attach_panopto_group(service, provider, category, folder, access)

    platform = lti_platform_for(service)
    course_ids = access.get("lms_course_ids") or []
    if platform is not None and course_ids and provider.is_lms_course_folder(str(folder.get("id"))):
        attach_lti_course(service, category, platform, course_ids[0], label=category.title, rbac_group=group)


def import_panopto_folder(service, provider, source_id):
    provider.unreadable_groups = set()
    category = get_or_import_panopto_folder(service, provider, provider.fetch_category(source_id))
    if category is not None and provider.unreadable_groups:
        groups = ", ".join(sorted(provider.unreadable_groups))
        record(service, "category", source_id, "failed", f"members of Panopto group(s) {groups} could not be read, run the migration again to retry", target=category)
    return category


def get_or_import_panopto_folder(service, provider, folder):
    """The MediaCMS category for one Panopto folder, created if this run has not made it.

    Keyed on the Panopto folder id, which is a guid and fits the uid column exactly, so a
    re-run and a second migration of the same instance land on the same category.
    """
    folder_id = str(folder.get("id") or "")
    if not folder_id:
        return None

    existing = MigrationRecord.objects.filter(service=service, object_type="category", source_id=folder_id, status__in=("success", "skipped")).exclude(target_id=None).first()
    if existing:
        category = existing.target()
        if category is not None:
            return category

    retried = MigrationRecord.objects.filter(service=service, object_type="category", source_id=folder_id, status="failed").exclude(target_id=None).first()
    if retried is not None and retried.target() is not None:
        category = retried.target()
        record(service, "category", folder_id, "success", f"retried category {category.title}", target=category)
        configure_panopto_folder_access(service, provider, category, folder)
        return category

    claimed = Category.objects.filter(uid=folder_id[:CATEGORY_UID_MAX]).first()
    if claimed is not None:
        record(service, "category", folder_id, "success", f"reused existing category {claimed.title}", target=claimed)
        return claimed

    title = (folder.get("name") or folder_id)[:CATEGORY_TITLE_MAX]
    with transaction.atomic():
        taken = set(Category.objects.values_list("title", flat=True))
        category = Category.objects.create(
            uid=free_category_uid(folder_id),
            title=unique_panopto_title(title, folder.get("parentName") or "", taken),
            description=(folder.get("fullName") or "").replace(">", ": "),
            is_global=True,
        )
        record(service, "category", folder_id, "success", f"created category {category.title}", target=category)
    configure_panopto_folder_access(service, provider, category, folder)
    return category


def import_panopto_session(service, provider, source_id):
    """Import one Panopto recording.

    Its own importer rather than the portal shaped one: Panopto has no flavors to match,
    so what arrives is one mp4, the fields the API does offer, and the folder it came from.
    """
    options = service.get_options()
    payload = provider.fetch_media(source_id)
    if options.get("restrict_to_users") and not panopto_owner_is_listed(provider, payload.get("owner") or {}, options.get("source_user_ids")):
        record(service, "media", source_id, "skipped", "its owner is not one of the listed users")
        return None
    owner = resolve_panopto_owner(service, provider, payload.get("owner") or {})

    tmp_dir = tempfile.mkdtemp(prefix=f"panopto-{source_id[:8]}-")
    try:
        path = os.path.join(tmp_dir, f"{source_id}.mp4")
        started = time.monotonic()
        size = provider.download(payload["download_url"], path)
        throughput = _throughput(size, time.monotonic() - started)

        media = Media(user=owner, title=(payload.get("title") or source_id)[:CATEGORY_TITLE_MAX], description=payload.get("description") or "")
        media._skip_admin_notification = True
        with open(path, "rb") as handle:
            media.media_file.save(content=File(handle), name=f"{source_id}.mp4", save=False)
        media.save()
        record(service, "media", source_id, "success", f"imported {media.title} {throughput}".strip(), target=media)

        created_at = parse_datetime(payload.get("created_at") or "")
        if created_at:
            Media.objects.filter(pk=media.pk).update(add_date=created_at)
        if options.get("preserve_views", True) and payload.get("views"):
            Media.objects.filter(pk=media.pk).update(views=payload["views"])
        attach_tags(media, payload.get("tags") or [], media.user)

        folder = payload.get("folder") or {}
        folder_kind = payload.get("folder_kind") or "folder"
        access = payload.get("access") or {}
        folder_access = provider.folder_access(str(folder["id"])) if folder.get("id") else {}

        media.state = "public" if access.get("public") or folder_access.get("public") else "private"
        media.save(update_fields=["state", "listable"])

        if folder_kind == "folder":
            category = get_or_import_panopto_folder(service, provider, folder)
            if category:
                media.category.add(category)
                for group in category.rbac_groups.all():
                    grant_rbac_role(group, media.user, "contributor")

        principals = list(access.get("principals") or [])
        if folder_kind == "personal":
            principals += folder_access.get("principals") or []
        for user, permission in panopto_people(service, provider, principals, PANOPTO_SHARE_ROLES, SHARE_ROLE_RANK).items():
            if user != media.user:
                MediaPermission.objects.update_or_create(owner_user=media.user, user=user, media=media, defaults={"permission": permission})

        if options.get("import_captions", True):
            for caption in payload.get("captions") or []:
                import_panopto_caption(service, provider, media, caption, tmp_dir)

        return media
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def import_panopto_playlist(service, provider, source_id):
    payload = provider.fetch_playlist(source_id)

    existing = MigrationRecord.objects.filter(service=service, object_type="playlist", source_id=str(source_id), status__in=("success", "skipped")).exclude(target_id=None).first()
    if existing and existing.target() is not None:
        return existing.target()

    playlist = Playlist.objects.create(
        title=(payload.get("name") or f"playlist-{source_id}")[:100],
        description=payload.get("description") or "",
        user=resolve_panopto_owner(service, provider, payload.get("owner") or {}),
    )

    added, missing = 0, []
    for position, session_id in enumerate(payload.get("entry_ids") or [], start=1):
        row = MigrationRecord.objects.filter(service=service, object_type="media", source_id=session_id, status="success").exclude(target_id=None).first()
        media = row.target() if row else None
        if media is None:
            missing.append(session_id)
            continue
        PlaylistMedia.objects.get_or_create(playlist=playlist, media=media, defaults={"ordering": position})
        added += 1

    log = f"created playlist {playlist.title} with {added} media"
    if missing:
        log += f", {len(missing)} not migrated: {', '.join(missing[:5])}"
    record(service, "playlist", source_id, "success", log, target=playlist)
    return playlist


def import_panopto_caption(service, provider, media, caption, tmp_dir):
    """Attach the one caption file Panopto offers, if it offers one"""
    code = caption.get("language") or "en"
    try:
        language, _created = Language.objects.get_or_create(code=code, defaults={"title": LANG_INFO.get(code, {}).get("name") or code})
        path = os.path.join(tmp_dir, f"caption-{code}.srt")
        provider.download(caption["url"], path)

        subtitle = Subtitle(media=media, language=language, user=media.user)
        with open(path, "rb") as handle:
            subtitle.subtitle_file.save(content=File(handle), name=f"{media.friendly_token}-{code}.srt", save=False)
        subtitle.save()
        subtitle.convert_to_srt()

        record(service, "caption", f"{media.friendly_token}-{code}", "success", f"attached {code} caption to media {media.id}", target=subtitle)
        return subtitle
    except Exception as exc:  # noqa: BLE001 - a bad caption must not lose the recording
        service.append_log(f"recording {media.friendly_token}: {code} caption failed: {exc}")
        return None


def import_youtube_caption(service, provider, media, caption, tmp_dir):
    """Attach the English subtitle. Already WebVTT, so nothing is converted."""
    code = caption.get("language") or "en"
    try:
        language, _created = Language.objects.get_or_create(code=code, defaults={"title": code})
        path = os.path.join(tmp_dir, f"caption-{code}.vtt")
        provider.download(caption["url"], path)

        subtitle = Subtitle(media=media, language=language, user=media.user)
        with open(path, "rb") as handle:
            subtitle.subtitle_file.save(content=File(handle), name=f"{media.friendly_token}-{code}.vtt", save=False)
        subtitle.save()

        record(service, "caption", f"{media.friendly_token}-{code}", "success", f"attached {code} caption to media {media.id}", target=subtitle)
        return subtitle
    except Exception as exc:  # noqa: BLE001 - a bad caption must not lose the media
        service.append_log(f"video {media.friendly_token}: {code} caption failed: {exc}")
        return None


def import_playlist(service, provider, source_id):
    """Create or reuse the MediaCMS playlist for one Kaltura playlist.

    Runs after media, so most members are already mapped. One that is not is fetched with
    its owner: asking for playlists is asking for whole playlists, and a list with holes is
    worse than reaching a little wider than the user options asked for.
    """
    payload = provider.fetch_playlist(source_id)

    existing = MigrationRecord.objects.filter(service=service, object_type="playlist", source_id=str(source_id), status__in=("success", "skipped")).exclude(target_id=None).first()
    if existing:
        playlist = existing.target()
        if playlist is not None:
            return playlist

    owner = resolve_owner(service, provider, payload.get("owner"))

    playlist = Playlist.objects.create(
        title=(payload.get("name") or f"playlist-{source_id}")[:100],
        description=payload.get("description") or "",
        user=owner,
    )

    added, missing = 0, []
    for position, entry_id in enumerate(payload.get("entry_ids") or [], start=1):
        row = MigrationRecord.objects.filter(service=service, object_type="media", source_id=entry_id, status__in=("success", "skipped")).exclude(target_id=None).first()
        media = row.target() if row else None

        if media is None:
            try:
                media = import_media_entry(service, provider, entry_id)
            except Exception as exc:  # noqa: BLE001 - a gap in one playlist must not end the phase
                service.append_log(f"playlist {source_id}: could not import {entry_id}: {exc}")
                media = None

        if media is None:
            missing.append(entry_id)
            continue

        PlaylistMedia.objects.get_or_create(playlist=playlist, media=media, defaults={"ordering": position})
        added += 1

    log = f"created playlist {playlist.title} with {added} media"
    if missing:
        log += f", {len(missing)} not available at the source: {', '.join(missing[:5])}"
    record(service, "playlist", source_id, "success", log, target=playlist)
    return playlist


def lti_platform_for(service):
    """The LTI platform this migration wires its LMS courses to, or None"""
    platform_id = str(service.get_options().get("lti_platform_id") or "").strip()
    if not platform_id:
        return None
    if not getattr(settings, "USE_LTI", False):
        logger.info("migration %s: LTI is switched off, so courses are not wired to a platform", service.pk)
        return None

    return LTIPlatform.objects.filter(pk=platform_id).first()


def attach_lti_course(service, category, platform, context_id, label="", rbac_group=None):
    """Wire a migrated LMS course to the platform the course lives on.

    A launch finds its course through LTIResourceLink(platform, context_id), so writing
    that row is what stops the first launch building a second category beside this one.
    The category becomes an RBAC category with a group, which is the shape the LTI
    integration provisions and expects to add its enrolments to. That shape is the whole
    point, so with RBAC off there is nothing useful to build and nothing is touched.
    """
    if not getattr(settings, "USE_RBAC", False):
        service.append_log(f"course {category.title}: RBAC is switched off, so it is not wired to {platform.name}")
        return None

    link = LTIResourceLink.objects.filter(platform=platform, context_id=context_id).first()
    group = (link.rbac_group if link else None) or rbac_group
    if group is None:
        uid = rbac_group_uid(service, context_id, kind="lti")
        group = RBACGroup.objects.filter(uid=uid, identity_provider=None).first()
    if group is None:
        taken = set(RBACGroup.objects.filter(identity_provider=None).values_list("name", flat=True))
        group = RBACGroup.objects.create(
            uid=rbac_group_uid(service, context_id, kind="lti"),
            name=unique_group_name(f"{category.title} ({platform.name})", context_id, taken),
            description=f"LTI course group from {platform.name}",
        )
    group.categories.add(category)

    Category.objects.filter(pk=category.pk).update(is_rbac_category=True, lti_platform=platform, lti_context_id=context_id)
    category.refresh_from_db()

    if link is None:
        LTIResourceLink.objects.create(
            platform=platform,
            context_id=context_id,
            context_title=category.title,
            context_label=label[:100],
            resource_link_id=f"migrated_{context_id}",
            category=category,
            rbac_group=group,
        )
    elif link.category_id != category.pk or link.rbac_group_id != group.pk:
        link.category = category
        link.rbac_group = group
        link.save(update_fields=["category", "rbac_group"])

    service.append_log(f"course {category.title} wired to {platform.name}")
    return group


def wire_reused_course(service, provider, category, source_id):
    """Wire a course this migration already imported, when the platform was picked later"""
    if category.lti_platform_id:
        return
    platform = lti_platform_for(service)
    if platform is None:
        return

    payload = provider.fetch_category(source_id)
    if not is_lms_course(payload):
        return
    context_id = (payload.get("name") or "").strip()
    if not context_id:
        return

    if not category.is_lms_course:
        Category.objects.filter(pk=category.pk).update(is_lms_course=True)
        category.refresh_from_db()
    try:
        attach_lti_course(service, category, platform, context_id, label=payload.get("name") or "")
    except Exception as exc:  # noqa: BLE001 - the category itself is already sound
        service.append_log(f"category {source_id}: could not wire it to {platform.name}: {exc}")


def import_category(service, provider, source_id):
    """Create or reuse the MediaCMS category for one source category.

    A members-only category becomes an RBAC category with a group holding its members;
    everything else becomes a plain one and the media state carries what the source
    implied. One transaction, because the mapping row is written last: without it a
    failure part way would leave a Category nothing knows about and the retry would
    build a second.
    """
    existing = MigrationRecord.objects.filter(service=service, object_type="category", source_id=str(source_id), status__in=("success", "skipped")).exclude(target_id=None).first()
    if existing:
        category = existing.target()
        if category is not None:
            wire_reused_course(service, provider, category, source_id)
            return category

    payload = provider.fetch_category(source_id)
    lms_course = is_lms_course(payload)
    platform = lti_platform_for(service) if lms_course else None
    context_id = (payload.get("name") or "").strip()

    if platform is not None and context_id:
        link = LTIResourceLink.objects.filter(platform=platform, context_id=context_id).exclude(category=None).first()
        if link:
            record(service, "category", source_id, "success", f"reused the LTI course {link.category.title}", target=link.category)
            return link.category

    title, description = category_title_and_description(payload.get("fullName"), payload.get("courseName") or "")
    if not title:
        title = payload.get("name") or f"category-{source_id}"
        description = title

    claimed = Category.objects.filter(uid=str(source_id)[:CATEGORY_UID_MAX]).first()
    known_titles = [title, payload.get("name") or ""]
    if claimed is not None and any(name and (claimed.title == name or claimed.title.startswith(name + " (")) for name in known_titles):
        record(service, "category", source_id, "success", f"reused existing category {claimed.title}", target=claimed)
        if platform is not None and context_id and not claimed.lti_platform_id:
            try:
                attach_lti_course(service, claimed, platform, context_id, label=payload.get("name") or "")
            except Exception as exc:  # noqa: BLE001 - the category itself is already sound
                service.append_log(f"category {source_id}: could not wire it to {platform.name}: {exc}")
        return claimed

    kind = category_type(payload)
    # with RBAC off the category and its media still arrive; only the members are lost
    use_rbac = needs_rbac_group(payload) and getattr(settings, "USE_RBAC", False)

    with transaction.atomic():
        taken = set(Category.objects.values_list("title", flat=True))
        title = unique_category_title(title, payload.get("parentName") or "", taken)

        category = Category.objects.create(
            uid=free_category_uid(source_id),
            title=title,
            description=description,
            is_global=True,
            is_rbac_category=use_rbac,
            is_lms_course=lms_course,
        )

        log = f"created category {category.title} ({kind})"
        if lms_course:
            log = f"created LMS course {category.title} ({kind})"
        record(service, "category", source_id, "success", log, target=category)

    if use_rbac:
        try:
            attach_rbac_group(service, provider, category, payload, source_id)
        except Exception as exc:  # noqa: BLE001 - the category itself is already sound
            service.append_log(f"category {source_id}: could not transfer permissions: {exc}")

    if platform is not None and context_id:
        try:
            attach_lti_course(service, category, platform, context_id, label=payload.get("name") or "")
        except Exception as exc:  # noqa: BLE001 - the category itself is already sound
            service.append_log(f"category {source_id}: could not wire it to {platform.name}: {exc}")
    return category


def pick_original_flavor(flavors):
    """The flavor to use as Media.media_file.

    Installations often purge the source flavor, so fall back to the tallest ready one
    and let the caller log the substitution.
    """
    flavors = flavors or []
    for flavor in flavors:
        if flavor.get("isOriginal"):
            return flavor
    playable = [flavor for flavor in flavors if (flavor.get("fileExt") or "").lower() in ("mp4", "webm")]
    if playable:
        return max(playable, key=lambda flavor: flavor.get("height") or 0)
    return flavors[0] if flavors else None


def source_extension(entry, flavor):
    """The extension to store the downloaded file under.

    MediaCMS reads the file to decide media_type: a jpeg stored as .mp4 becomes a video
    that cannot play.
    """
    if flavor is not None:
        return (flavor.get("fileExt") or "mp4").lower()

    suffix = os.path.splitext(entry.get("name") or "")[1].lstrip(".").lower()
    if suffix.isalnum() and 1 < len(suffix) <= 5:
        return suffix
    return "jpg"


def get_or_import_category(service, provider, source_id):
    """The MediaCMS category for a source category id, importing it if needed"""
    row = MigrationRecord.objects.filter(service=service, object_type="category", source_id=str(source_id), status__in=("success", "skipped")).exclude(target_id=None).first()
    if row:
        category = row.target()
        if category is not None:
            return category
    try:
        return import_category(service, provider, str(source_id))
    except Exception as exc:  # noqa: BLE001 - a bad category must not lose the media
        service.append_log(f"could not import category {source_id}: {exc}")
        return None


def ensure_preview(media):
    """Produce the hover preview for a media whose transcoding was skipped.

    media_init only reaches the preview profile through encode(), so an import that skips
    transcoding gets sprites and no preview. chunkize off, because that branch dispatches
    a job per profile per chunk and one import can bury a worker.
    """
    if media.media_type != "video":
        return None

    profile = EncodeProfile.objects.filter(name=PREVIEW_PROFILE_NAME, active=True).first()
    if profile is None:
        return None
    if Encoding.objects.filter(media=media, profile=profile).exists():
        return None

    media.encode(profiles=[profile], chunkize=False)
    return profile


def create_encoding(media, profile, path):
    """Attach an already transcoded file to a media as a finished Encoding.

    Saved as pending first, since the post_save receiver only reacts to success and fail,
    then flipped with a queryset update, which fires no signals. That is what keeps
    create_hls from being launched once per flavor.
    """
    encoding = Encoding(media=media, profile=profile, status="pending", progress=0)
    with open(path, "rb") as handle:
        encoding.media_file.save(content=File(handle), name=os.path.basename(path), save=False)
    encoding.save()
    Encoding.objects.filter(pk=encoding.pk).update(status="success", progress=100)
    encoding.refresh_from_db()
    return encoding


def finalise_encodings(media, encodings):
    """Set the media's encoding status and trigger HLS packaging exactly once"""
    h264 = next((encoding for encoding in encodings if encoding.profile.codec == "h264"), None)
    if h264:
        media.post_encode_actions(encoding=h264, action="add")
    else:
        media.set_encoding_status()
        media.save(update_fields=["encoding_status", "listable"])


def attach_flavor_encodings(service, provider, media, flavors, original, original_path, tmp_dir, timings=None):
    """Download the transcoded flavors and attach them as MediaCMS encodings"""
    profiles = list(EncodeProfile.objects.filter(active=True))
    transcoded = [flavor for flavor in flavors if flavor.get("id") != (original or {}).get("id")]

    pairs = match_flavors_to_profiles(transcoded, profiles)
    matched_ids = {flavor.get("id") for flavor, _profile in pairs}
    for flavor in transcoded:
        if flavor.get("id") not in matched_ids:
            service.append_log(f"media {media.friendly_token}: no matching profile for flavor " f"{flavor.get('id')} at {flavor.get('height')}p, skipped")

    encodings = []
    for flavor, profile in pairs:
        path = flavor.get("_local_path") or os.path.join(tmp_dir, f"{flavor['id']}.{profile.extension}")
        started = time.monotonic()
        try:
            written = os.path.getsize(path) if flavor.get("_local_path") else provider.download_flavor(flavor, path)
        except Exception as exc:  # noqa: BLE001 - one bad flavor must not lose the media
            service.append_log(f"media {media.friendly_token}: flavor {flavor['id']} failed: {exc}")
            continue
        if timings is not None:
            timings.note(
                f"  flavor {profile.resolution}p download",
                time.monotonic() - started,
                _throughput(written, time.monotonic() - started),
            )
        attach_started = time.monotonic()
        encodings.append(create_encoding(media, profile, path))
        if timings is not None:
            timings.note(f"  flavor {profile.resolution}p attach", time.monotonic() - attach_started)

    # a media file is not a quality the player offers, so without this the original's
    # resolution is missing from the menu. Registered, not re-encoded: costs a second copy.
    extension = os.path.splitext(original_path)[1].lstrip(".").lower()
    taken = {encoding.profile_id for encoding in encodings}
    original_pair = match_flavors_to_profiles([{"id": "original", "height": media.video_height or 0, "fileExt": extension}], profiles)
    if original_pair and original_pair[0][1].pk not in taken:
        profile = original_pair[0][1]
        service.append_log(f"media {media.friendly_token}: the original is offered as {profile.resolution}p")
        encodings.append(create_encoding(media, profile, original_path))

    if not encodings:
        service.append_log(f"media {media.friendly_token}: no flavor and no active encode profile matches " f"extension '{extension}'; the media will not be listable until it is encoded")

    started = time.monotonic()
    finalise_encodings(media, encodings)
    ensure_preview(media)
    if timings is not None:
        timings.note("  finalise (queues HLS)", time.monotonic() - started)
    return encodings


def import_caption(service, provider, media, caption, tmp_dir):
    """Download one caption asset and attach it to a media as a WebVTT subtitle"""
    source_id = str(caption.get("id"))
    subtitle = None
    try:
        code = (caption.get("languageCode") or "en").strip() or "en"
        title = (caption.get("language") or code).strip() or code
        language, _created = Language.objects.get_or_create(code=code, defaults={"title": title})

        path = os.path.join(tmp_dir, f"caption-{source_id}.srt")
        provider.download_caption(caption, path)

        subtitle = Subtitle(media=media, language=language, user=media.user)
        with open(path, "rb") as handle:
            subtitle.subtitle_file.save(content=File(handle), name=f"{media.friendly_token}-{code}.srt", save=False)
        subtitle.save()
        subtitle.convert_to_srt()

        record(service, "caption", source_id, "success", f"attached {code} caption to media {media.id}", target=subtitle)
        return subtitle
    except Exception as exc:  # noqa: BLE001 - a bad caption must not lose the media
        if subtitle is not None and subtitle.pk:
            subtitle.delete()
        record(service, "caption", source_id, "failed", f"caption {source_id} failed: {exc}")
        service.append_log(f"media {media.friendly_token}: caption {source_id} failed: {exc}")
        return None


def apply_entry_metadata(service, provider, media, data):
    """Second pass over a freshly created media: state, views, date, tags, categories.

    A second save, because Media.save() overwrites state with the portal default on
    creation only.
    """
    options = service.get_options()
    entry = data.get("entry") or {}

    if options.get("preserve_views", True):
        media.views = entry.get("plays") or entry.get("views") or 0

    if entry.get("createdAt"):
        media.add_date = datetime.fromtimestamp(int(entry["createdAt"]), tz=dt_timezone.utc)

    if options.get("preserve_publish_state", True):
        published = data.get("published_categories")
        if published is None:
            published = data.get("categories") or []
        media.state = media_state(published, entry.get("displayInSearch"), entry.get("moderationStatus"))

    # a full save() would write stale columns over what media_init's tasks are filling in
    # concurrently, such as media.sprites
    media.save(update_fields=["views", "add_date", "state", "listable"])

    attach_tags(media, (entry.get("tags") or "").split(","), media.user)

    for source_category in data.get("categories") or []:
        source_category_id = source_category.get("id")
        full_name = source_category.get("fullName") or ""
        full_ids = source_category.get("fullIds") or ""
        if is_ignored_category(source_category):
            source_category_id = source_category.get("parentId")
            full_name = full_name.rsplit(">", 1)[0]
            full_ids = full_ids.rsplit(">", 1)[0]
            if not source_category_id or not provider.within_selection(full_name):
                continue
        elif not provider.worth_importing(source_category):
            continue
        category = get_or_import_category(service, provider, str(source_category_id))
        if category:
            media.category.add(category)
        if options.get("rollup_subcategories", True):
            attach_parent_categories(service, provider, media, full_name, full_ids)


def attach_parent_categories(service, provider, media, full_name, full_ids):
    """Attach the media to the categories its own category sits under.

    Kaltura counts a category's media across its whole subtree and MediaCMS categories are
    flat, so without this a parent shows fewer items than the source did.

    A private media is never rolled up into an RBAC category it was not already in: every
    member of that group would gain access to it, which the source did not grant.
    """
    for source_id, path in ancestor_categories(full_name, full_ids):
        if not is_importable_category(path) or not provider.within_selection(path):
            continue
        parent = get_or_import_category(service, provider, str(source_id))
        if parent is None:
            continue
        if parent.is_rbac_category and media.state == "private":
            service.append_log(f"media {media.friendly_token}: not rolled up into '{parent.title}', which is access controlled")
            continue
        media.category.add(parent)


class Timings:
    """Per step stopwatch for one media import.

    Detail to the worker log, one summary line per media to the migration log: 12,000
    entries times a dozen steps would bury everything else.
    """

    def __init__(self, source_id):
        self.source_id = source_id
        self.started = time.monotonic()
        self.steps = []

    def step(self, label):
        return _Step(self, label)

    def note(self, label, seconds, extra=""):
        self.steps.append((label, seconds, extra))
        logger.info("media %s: %s took %.1fs %s", self.source_id, label, seconds, extra)

    def summary(self):
        total = time.monotonic() - self.started
        parts = ", ".join(f"{label} {seconds:.1f}s{(' ' + extra) if extra else ''}" for label, seconds, extra in self.steps)
        return f"entry {self.source_id} took {total:.1f}s ({parts})"


class _Step:
    def __init__(self, timings, label):
        self.timings = timings
        self.label = label
        self.extra = ""

    def __enter__(self):
        self.started = time.monotonic()
        return self

    def __exit__(self, *exc):
        self.timings.note(self.label, time.monotonic() - self.started, self.extra)
        return False


def _throughput(size_bytes, seconds):
    if not size_bytes or seconds <= 0:
        return ""
    megabytes = size_bytes / (1024 * 1024)
    return f"({megabytes:.0f}MB at {megabytes / seconds:.1f}MB/s)"


STREAM_SOURCE_SUFFIX = ":stream"


def combine_streams(service, provider, source_id, data, children, tmp_dir, want_renditions):
    """Draw a multi stream recording as one picture, its streams side by side.

    Returns (original_flavor, flavors, extension) with a local path on each, or None when
    this entry is not a multi stream recording or its streams cannot be drawn together.
    With renditions wanted, every flavor of the biggest stream becomes one: each smaller
    stream is fetched once and drawn into its box on every rendition.
    """
    if not children:
        return None

    if len(children) + 1 > MAX_STREAMS:
        kept = children[: MAX_STREAMS - 1]
        left = ", ".join((child.get("entry") or {}).get("id") or "" for child in children[len(kept) :])
        service.append_log(f"entry {source_id}: {len(children) + 1} streams, combining the first {MAX_STREAMS} and leaving {left}")
        children = kept

    streams = children + [data]
    driver = max(children, key=lambda stream: stream_area(stream.get("entry") or {}))
    driver_original = pick_original_flavor(driver.get("flavors") or [])
    if driver_original is None:
        service.append_log(f"entry {source_id}: a stream has no downloadable flavor, importing it on its own")
        return None

    def canvas_height(flavor):
        return flavor.get("height") or (driver.get("entry") or {}).get("height") or 1080

    width, height = canvas_size(canvas_height(driver_original))
    boxes = layout_boxes(len(streams), width, height)
    fixed_paths = {}
    for index, stream in enumerate(streams):
        if stream is driver:
            continue
        flavor = pick_flavor_for_width(stream.get("flavors") or [], boxes[index][2])
        if flavor is None:
            service.append_log(f"entry {source_id}: a stream has no downloadable flavor, importing it on its own")
            return None
        fixed_paths[index] = os.path.join(tmp_dir, f"stream_{flavor['id']}.mp4")
        provider.download_flavor(flavor, fixed_paths[index])

    child_ids = ", ".join((child.get("entry") or {}).get("id") or "" for child in children)
    service.append_log(f"entry {source_id}: multi stream, {child_ids} side by side with {source_id}")

    def draw(flavor, name):
        source = os.path.join(tmp_dir, f"src_{flavor['id']}.mp4")
        provider.download_flavor(flavor, source)
        rung_width, rung_height = canvas_size(canvas_height(flavor))
        paths = [source if stream is driver else fixed_paths[index] for index, stream in enumerate(streams)]
        dest = os.path.join(tmp_dir, name)
        compose_side_by_side(paths, dest, rung_width, rung_height)
        if os.path.exists(source):
            os.remove(source)
        return dict(flavor, fileExt="mp4", width=rung_width, height=rung_height, _local_path=dest)

    try:
        original = draw(driver_original, f"{source_id}.mp4")
    except Exception as exc:  # noqa: BLE001
        service.append_log(f"entry {source_id}: could not combine the streams, importing it on its own: {exc}")
        return None

    composed = []
    if want_renditions:
        for flavor in driver.get("flavors") or []:
            if flavor.get("id") == driver_original.get("id") or (flavor.get("fileExt") or "").lower() not in ("mp4", "webm"):
                continue
            try:
                composed.append(draw(flavor, f"combined_{flavor['id']}.mp4"))
            except Exception as exc:  # noqa: BLE001 - one rung must not lose the media
                service.append_log(f"entry {source_id}: could not combine flavor {flavor.get('id')}: {exc}")

    return original, composed + [original], "mp4"


def import_stream_item(service, provider, key, stream, number, main, tmp_dir):
    existing = MigrationRecord.objects.filter(service=service, object_type="media", source_id=key).first()
    previous = existing.target() if existing else None
    if existing and existing.status in ("success", "skipped") and previous is not None:
        return previous
    if previous is not None:
        previous.delete()

    options = service.get_options()
    try:
        flavors = stream.get("flavors") or []
        original = pick_original_flavor(flavors)
        if original is None:
            raise ValueError("no downloadable flavor")
        extension = source_extension(stream.get("entry") or {}, original)
        path = os.path.join(tmp_dir, f"stream_original_{original['id']}.{extension}")
        provider.download_flavor(original, path)

        media = Media(user=main.user, title=f"{main.title[:88]} (stream {number})", description=main.description)
        if options.get("skip_transcoding", True):
            media._do_not_transcode = True
        media._skip_admin_notification = True
        with open(path, "rb") as handle:
            media.media_file.save(content=File(handle), name=f"{key.replace(STREAM_SOURCE_SUFFIX, '_stream')}.{extension}", save=False)
        media.save()
        record(service, "media", key, "failed", "import started", target=media)

        if media.media_type == "video" and options.get("skip_transcoding", True):
            attach_flavor_encodings(service, provider, media, flavors, original, path, tmp_dir)

        media.state = main.state
        media.add_date = main.add_date
        media.save(update_fields=["state", "add_date", "listable"])
    except Exception as exc:  # noqa: BLE001
        record(service, "media", key, "failed", f"stream {number} of media {main.friendly_token}: {exc}")
        service.append_log(f"media {main.friendly_token}: stream {number} ({key}) failed: {exc}")
        return None

    record(service, "media", key, "success", f"imported stream {number} of '{main.title}' as media {media.id}", target=media)
    return media


def import_media_entry(service, provider, source_id):
    """Import one source media entry into MediaCMS.

    No transaction on purpose: this downloads gigabytes, and holding one open that long
    is worse than the failure it would prevent. The mapping row is written as soon as the
    Media exists, so a retry can discard the half built one instead of orphaning it.
    """
    options = service.get_options()

    existing = MigrationRecord.objects.filter(service=service, object_type="media", source_id=str(source_id)).first()
    previous_media = existing.target() if existing else None
    if existing and existing.status in ("success", "skipped") and previous_media is not None:
        return previous_media
    if previous_media is not None:
        service.append_log(f"entry {source_id}: discarding an incomplete media from an earlier attempt")
        previous_media.delete()

    timings = Timings(source_id)

    with timings.step("metadata calls"):
        data = provider.fetch_media(source_id)
    entry = data.get("entry") or {}
    flavors = data.get("flavors") or []

    with timings.step("owner"):
        owner = resolve_owner(service, provider, entry.get("userId") or entry.get("creatorId") or "")

    original = pick_original_flavor(flavors)
    is_image = entry.get("mediaType") == MEDIA_TYPE_IMAGE and bool(entry.get("downloadUrl"))
    if original is None and not is_image:
        raise ValueError(f"entry {source_id} has no downloadable flavor")
    if original is not None and not original.get("isOriginal"):
        service.append_log(f"entry {source_id}: no source flavor, using flavor {original.get('id')} as the original")

    with tempfile.TemporaryDirectory(dir=settings.TEMP_DIRECTORY) as tmp_dir:
        combined = None
        children = []
        if not is_image:
            with timings.step("multi stream") as step:
                children = [provider.fetch_media(child["id"]) for child in provider.child_entries(source_id)]
                combined = combine_streams(service, provider, source_id, data, children, tmp_dir, options.get("skip_transcoding", True))
                step.extra = "(combined)" if combined else ("(not combined)" if children else "(single stream)")

        if combined is not None:
            original, flavors, extension = combined
            original_path = original["_local_path"]
        else:
            extension = source_extension(entry, original)
            original_path = os.path.join(tmp_dir, f"{source_id}.{extension}")
            with timings.step("download original") as step:
                if original is None:
                    service.append_log(f"entry {source_id}: image entry, downloading the entry file")
                    written = provider.download_entry(entry, original_path)
                else:
                    written = provider.download_flavor(original, original_path)
                step.extra = _throughput(written, time.monotonic() - step.started)

        media = Media(
            user=owner,
            title=(entry.get("name") or source_id)[:100],
            description=entry.get("description") or "",
        )
        if options.get("skip_transcoding", True):
            media._do_not_transcode = True
        media._skip_admin_notification = True
        with timings.step("store original"):
            with open(original_path, "rb") as handle:
                media.media_file.save(content=File(handle), name=f"{source_id}.{extension}", save=False)

        with timings.step("media_init (thumbnail + sprite)"):
            media.save()

        record(service, "media", source_id, "failed", "import started", target=media)

        if media.media_type == "video" and options.get("skip_transcoding", True):
            with timings.step("flavors") as step:
                encodings = attach_flavor_encodings(service, provider, media, flavors, original, original_path, tmp_dir, timings=timings)
                step.extra = f"({len(encodings)} attached)"

        if options.get("import_captions", True):
            captions = data.get("captions") or []
            if captions:
                with timings.step("captions") as step:
                    for caption in captions:
                        import_caption(service, provider, media, caption, tmp_dir)
                    step.extra = f"({len(captions)})"

        with timings.step("metadata + categories"):
            apply_entry_metadata(service, provider, media, data)

        if children:
            streams = [(f"{source_id}{STREAM_SOURCE_SUFFIX}" if combined is not None else None, data)]
            streams += [((child.get("entry") or {}).get("id"), child) for child in children]
            with timings.step("streams as media") as step:
                imported = [import_stream_item(service, provider, key, stream, number, media, tmp_dir) for number, (key, stream) in enumerate(streams, start=1) if key]
                step.extra = f"({len([item for item in imported if item is not None])} of {len(imported)})"

    service.append_log(timings.summary())
    media.refresh_from_db()
    record(service, "media", source_id, "success", f"imported '{media.title}' as media {media.id}", target=media)
    return media


PHASES = ["users", "groups", "categories", "media", "playlists"]

PHASE_OPTION = {"users": "migrate_all_users", "groups": "migrate_groups", "categories": None, "media": None, "playlists": "migrate_playlists"}

RECORD_TYPE = {"users": "user", "groups": "group", "categories": "category", "media": "media", "playlists": "playlist"}

IMPORTERS = {"users": import_user, "groups": import_group, "categories": import_category, "media": import_media_entry, "playlists": import_playlist}


PROVIDER_PHASES = {"youtube": ["media"], "panopto": ["users", "categories", "media", "playlists"]}

PROVIDER_IMPORTERS = {
    "youtube": {"media": import_youtube_video},
    "panopto": {"users": import_panopto_user, "categories": import_panopto_folder, "media": import_panopto_session, "playlists": import_panopto_playlist},
}


def phases_for(service):
    """The phases this migration walks, in order"""
    return PROVIDER_PHASES.get(service.provider, PHASES)


def importer_for(service, phase):
    """The function that imports one item of this phase for this migration's source"""
    return PROVIDER_IMPORTERS.get(service.provider, {}).get(phase) or IMPORTERS[phase]


def next_phase(phase, phases=None):
    """The phase after this one, or "done" """
    phases = phases or PHASES
    if phase not in phases:
        return "done"
    index = phases.index(phase)
    return phases[index + 1] if index + 1 < len(phases) else "done"


def first_enabled_phase(service, phase):
    """Advance past any phases the options switched off, or the source does not have"""
    options = service.get_options()
    phases = phases_for(service)
    if phase not in phases and phase != "done":
        phase = phases[0]
    while phase != "done":
        option = PHASE_OPTION.get(phase)
        if option is None or options.get(option, True):
            return phase
        phase = next_phase(phase, phases)
    return "done"


def _media_limit_reached(service):
    """Whether max_items has been hit. Applies to the media phase only."""
    max_items = service.get_options().get("max_items")
    if not max_items:
        return False
    handled = MigrationRecord.objects.filter(service=service, object_type="media").exclude(status="failed").count()
    return handled >= int(max_items)


# Every status transition below is a conditional queryset update, not a read-then-save:
# two admins clicking Start at once would otherwise both pass their guard.
STARTABLE = ("pending", "paused", "error", "aborted")
RERUNNABLE = ("success", "error", "aborted")


def record_discovery_totals(service, provider, force=False):
    """Ask the source how much there is, once, when a migration first starts.

    Best effort: a source that cannot answer leaves the bars without a denominator.
    Returns False only when it has ended the run itself, so the caller must not dispatch.
    """
    totals = dict(service.totals or {})
    if totals.get("media_discovered") and not force:
        return True

    try:
        result = provider.check_connection()
    except Exception as exc:  # noqa: BLE001 - informational only
        service.append_log(f"could not read source totals: {exc}")
        return True

    if not result.get("ok"):
        service.append_log(f"could not read source totals: {result.get('error')}")
        return True

    stats = result.get("stats") or {}
    per_user = stats.get("entries_per_user") or {}
    if per_user:
        summary = ", ".join(f"{user_id}: {count}" for user_id, count in per_user.items())
        service.append_log(f"restricted to {len(per_user)} user(s) - {summary}")
        empty = [user_id for user_id, count in per_user.items() if not count]
        if empty and len(empty) == len(per_user):
            # Kaltura answers an unknown user with zero rather than an error, so every id being
            # empty means a mistyped list far more often than empty accounts
            finish_migration(service, "error", f"no media found for any listed user: {', '.join(empty)}")
            return False
        if empty:
            service.append_log(f"warning: no media found for {', '.join(empty)}")

    totals["media_discovered"] = stats.get("entries", 0)
    service.totals = totals
    MigrationService.objects.filter(pk=service.pk).update(totals=totals)
    return True


def start_migration(service):
    """Move a migration into running and queue the orchestrator"""
    provider_class = service.provider_class
    if not getattr(provider_class, "can_import", True):
        raise ValueError(f"{provider_class.label} can be configured and tested, but importing from it is not built yet.")

    if service.status not in STARTABLE:
        if service.status in RERUNNABLE:
            raise ValueError(f"This migration has already finished as '{service.status}'. Run it again to sweep the source once more.")
        raise ValueError(f"Cannot start a migration that is '{service.status}'")

    now = timezone.now()
    claimed = MigrationService.objects.filter(pk=service.pk, status__in=STARTABLE).update(status="running", ended_at=None, last_activity=now)
    if not claimed:
        service.refresh_from_db()
        raise ValueError(f"Migration is already '{service.status}'")

    MigrationService.objects.filter(pk=service.pk, started_at__isnull=True).update(started_at=now)
    service.refresh_from_db()
    if not record_discovery_totals(service, get_provider(service)):
        return service
    service.append_log("migration started")

    run_migration.apply_async(args=[service.pk])
    return service


def restart_migration(service):
    """Walk a finished migration again, retrying whatever did not make it.

    The cursor is reset, so the source is swept from the beginning. Anything already
    imported costs one query and no download, so this is "retry the failures and pick up
    what is new" rather than a second full import.
    """
    provider_class = service.provider_class
    if not getattr(provider_class, "can_import", True):
        raise ValueError(f"{provider_class.label} can be configured and tested, but importing from it is not built yet.")

    now = timezone.now()
    claimed = MigrationService.objects.filter(pk=service.pk, status__in=RERUNNABLE).update(status="running", cursor={}, started_at=now, ended_at=None, last_activity=now)
    if not claimed:
        service.refresh_from_db()
        raise ValueError(f"Cannot re-run a migration that is '{service.status}'")

    service.refresh_from_db()
    if not record_discovery_totals(service, get_provider(service), force=True):
        return service
    service.append_log("re-run started, already imported items are skipped")

    run_migration.apply_async(args=[service.pk])
    return service


def pause_migration(service):
    """Ask a running migration to stop after the items already in flight"""
    paused = MigrationService.objects.filter(pk=service.pk, status="running").update(status="paused", last_activity=timezone.now())
    service.refresh_from_db()
    if not paused:
        raise ValueError(f"Cannot pause a migration that is '{service.status}'")
    service.append_log("migration paused")
    return service


def abort_migration(service):
    """Stop for good, keeping the cursor and everything already imported"""
    aborted = MigrationService.objects.filter(pk=service.pk, status__in=("running", "paused")).update(status="aborted", ended_at=timezone.now(), last_activity=timezone.now())
    service.refresh_from_db()
    if not aborted:
        raise ValueError(f"Cannot abort a migration that is '{service.status}'")
    service.append_log("migration aborted")
    return service


def finish_migration(service, status, message=""):
    """End a run, but never overwrite a stop the user asked for.

    The orchestrator can be mid network call when a pause lands, and its in-memory copy
    still says running, so an unconditional save would discard the request.
    """
    finished = MigrationService.objects.filter(pk=service.pk, status="running").update(status=status, ended_at=timezone.now(), last_activity=timezone.now())
    service.refresh_from_db()
    if not finished:
        service.append_log(f"not finishing as '{status}': status is already '{service.status}'")
        return service
    if message:
        service.append_log(message)
    return service


def schedule_migration(service):
    """Arm the task that starts this migration at the time it was given, if it has one.

    Called on every save, so a second save arms a second task. That is why the task
    carries its time: one firing with a time the migration no longer stores stands down.
    """
    options = service.get_options()
    if not options.get("schedule_enabled"):
        return None

    when = parse_scheduled_at(options.get("scheduled_at"))
    if when is None:
        return None

    run_scheduled_migration.apply_async(args=[service.pk, scheduled_at_text(when)], eta=when)
    service.append_log(f"scheduled to start at {timezone.localtime(when).strftime('%Y-%m-%d %H:%M %Z')}")
    return when


# acks_late: an eta task waits in the worker's timer, and an ack on receipt loses it on restart
@task(name="run_scheduled_migration", queue="short_tasks", acks_late=True, reject_on_worker_lost=True)
def run_scheduled_migration(service_id, scheduled_for):
    """Start a migration whose scheduled time has arrived.

    scheduled_for is the time this task was queued for. An eta task cannot be recalled, so
    a stale one stands down by itself: if the migration no longer stores this exact time,
    this is not the task that should act.
    """
    service = MigrationService.objects.filter(pk=service_id).first()
    if service is None:
        return False

    options = service.get_options()
    if not options.get("schedule_enabled"):
        logger.info("scheduled start of migration %s stood down: scheduling is off", service_id)
        return False
    if str(options.get("scheduled_at") or "") != str(scheduled_for or ""):
        logger.info("scheduled start of migration %s stood down: it was rescheduled", service_id)
        return False

    stored = dict(service.options or {})
    stored["schedule_enabled"] = False
    stored["scheduled_at"] = ""
    MigrationService.objects.filter(pk=service_id).update(options=stored)
    service.refresh_from_db()

    if service.status in RERUNNABLE:
        begin = restart_migration
    elif service.status in STARTABLE:
        begin = start_migration
    else:
        service.append_log(f"scheduled start skipped: the migration is '{service.status}'")
        return False

    try:
        begin(service)
    except Exception as exc:  # noqa: BLE001 - a failed start must be visible, not raised into celery
        logger.warning("scheduled start of migration %s failed: %s", service_id, exc)
        service.append_log(f"scheduled start failed: {exc}")
        return False

    return True


@task(name="run_migration", queue="long_tasks", soft_time_limit=60 * 30)
def run_migration(service_id):
    """Handle one page of the current phase, then hand off to the chord callback"""
    service = MigrationService.objects.filter(pk=service_id).first()
    if service is None or service.status != "running":
        return False

    if in_quiet_window(service.get_options()):
        tail = (service.log or "").rstrip().rsplit("\n", 1)[-1]
        if QUIET_LOG_MARKER not in tail:
            service.append_log(f"{QUIET_LOG_MARKER}, waiting until {service.get_options().get('quiet_to')}")
        run_migration.apply_async(args=[service_id], countdown=QUIET_RECHECK_SECONDS)
        return False

    cursor = dict(service.cursor or {})
    phase = first_enabled_phase(service, cursor.get("phase") or phases_for(service)[0])
    if phase != cursor.get("phase"):
        cursor = {"phase": phase}

    if phase == "done":
        finish_migration(service, "success", "migration finished")
        return True

    if phase == "media" and _media_limit_reached(service):
        finish_migration(service, "success", "max_items reached, migration finished")
        return True

    provider = get_provider(service)
    page_size = getattr(settings, "MIGRATION_PAGE_SIZE", 10)

    try:
        source_ids, next_cursor = provider.list_page(phase, cursor, page_size)
    except Exception as exc:  # noqa: BLE001 - a listing failure ends the run, it is not per item
        logger.exception("migration %s: listing %s failed", service_id, phase)
        finish_migration(service, "error", f"could not list {phase}: {exc}")
        return False

    if phase == "media":
        max_items = service.get_options().get("max_items")
        if max_items:
            handled = MigrationRecord.objects.filter(service=service, object_type="media").exclude(status="failed").count()
            remaining = int(max_items) - handled
            if remaining <= 0:
                finish_migration(service, "success", "max_items reached, migration finished")
                return True
            if len(source_ids) > remaining:
                service.append_log(f"max_items: trimming this page to {remaining} entries")
                source_ids = source_ids[:remaining]

    if not source_ids:
        service.append_log(f"phase '{phase}' finished")
        service.cursor = {"phase": next_phase(phase, phases_for(service))}
        service.save(update_fields=["cursor"])
        run_migration.apply_async(args=[service_id], countdown=1)
        return True

    next_cursor = dict(next_cursor or {})
    next_cursor["phase"] = phase

    service.append_log(f"phase '{phase}': handling {len(source_ids)} items")
    header = [migrate_item.s(service_id, phase, source_id) for source_id in source_ids]
    chord(header)(advance_migration.s(service_id, next_cursor))
    return True


@task(name="migrate_item", queue="long_tasks", soft_time_limit=60 * 60 * 2)
def migrate_item(service_id, phase, source_id):
    """Import one source object. Cheap status check first, so pause is responsive."""
    started = time.monotonic()
    source_id = str(source_id)
    log_prefix = f"migration {service_id} {phase} {source_id}:"

    status = MigrationService.objects.filter(pk=service_id).values_list("status", flat=True).first()
    logger.info("%s picked up, migration status is %s", log_prefix, status)
    if status != "running":
        logger.info("%s not running, returning without work", log_prefix)
        return "paused"

    service = MigrationService.objects.get(pk=service_id)
    object_type = RECORD_TYPE[phase]

    existing = MigrationRecord.objects.filter(service=service, object_type=object_type, source_id=source_id).first()
    if existing and existing.status in ("success", "skipped"):
        logger.info("%s already %s in this migration, skipping", log_prefix, existing.status)
        return "skipped"
    if existing:
        logger.info("%s previous attempt was %s, retrying", log_prefix, existing.status)

    other = MigrationRecord.already_migrated(service.source_system, object_type, source_id)
    if other is not None:
        logger.info("%s already migrated by '%s', skipping", log_prefix, other.service.name)
        record(
            service,
            object_type,
            source_id,
            "skipped",
            f"already migrated by '{other.service.name}'",
            target=other.target(),
        )
        return "skipped"

    provider = get_provider(service)
    logger.info("%s starting import", log_prefix)
    try:
        importer_for(service, phase)(service, provider, source_id)
        logger.info("%s imported in %.1fs", log_prefix, time.monotonic() - started)
        return "ok"
    except Exception as exc:  # noqa: BLE001 - one bad item must not end the migration
        logger.exception("migration %s: %s %s failed", service_id, object_type, source_id)
        previous = MigrationRecord.objects.filter(service=service, object_type=object_type, source_id=source_id).first()
        target = previous.target() if previous is not None else None
        record(service, object_type, source_id, "failed", f"{type(exc).__name__}: {exc}", target=target)
        service.append_log(f"{object_type} {source_id} failed: {exc}")
        logger.info("%s failed after %.1fs", log_prefix, time.monotonic() - started)
        return "failed"


@task(name="advance_migration", queue="short_tasks")
def advance_migration(results, service_id, next_cursor):
    """Chord callback: store the advanced cursor and queue the next page"""
    service = MigrationService.objects.filter(pk=service_id).first()
    if service is None:
        return False

    if service.status != "running":
        # do not advance the cursor: items that never started would be stepped past.
        # Replaying a page is cheap, every importer skips what is already recorded.
        service.append_log(f"stopped after a page, status is '{service.status}'; the page will replay on resume")
        MigrationService.objects.filter(pk=service_id).update(last_activity=timezone.now())
        return False

    service.cursor = next_cursor
    service.last_activity = timezone.now()
    service.save(update_fields=["cursor", "last_activity"])

    run_migration.apply_async(args=[service_id], countdown=1)
    return True
