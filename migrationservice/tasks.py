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
from django.core.files import File
from django.db import transaction
from django.utils import timezone

from files import helpers
from files.models import (
    Category,
    EncodeProfile,
    Encoding,
    Language,
    Media,
    Playlist,
    PlaylistMedia,
    Subtitle,
    Tag,
)
from files.models.utils import PREVIEW_PROFILE_NAME, generate_uid
from users.models import User

from .models import MigrationRecord, MigrationService
from .providers import get_provider
from .providers.kaltura import (
    CATEGORY_PRIVATE,
    LMS_TREE,
    MEDIA_TYPE_IMAGE,
    category_title_and_description,
    category_tree_kind,
    category_type,
    is_ignored_category,
    match_flavors_to_profiles,
    media_state,
    mediacms_role,
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

# said once on entering the window, or a month of quiet hours fills a capped log
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
        # a username match is the same person only when the existing account has no email of
        # its own: otherwise it is a distinct human who merely collides on the sanitised name
        candidate = User.objects.filter(username__iexact=username).first()
        if candidate is not None and not candidate.email:
            # and unclaimed: two emailless Kaltura accounts can sanitise to the same username
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
        # only accounts this migration created: a linked one keeps the permissions it had
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

    # create_users and restrict_to_users only have a say when migrate_all_users is off. Naming
    # the users to migrate counts as asking for real owners, since they have been named.
    wants_real_owner = options.get("migrate_all_users", True) or options.get("create_users", False) or options.get("restrict_to_users", False)
    if wants_real_owner and source_user_id:
        try:
            return import_user(service, provider, source_user_id)
        except KeyError:
            logger.warning("migration %s: source user %s not found, using fallback", service.pk, source_user_id)
        except Exception as exc:  # noqa: BLE001 - fall back rather than lose the media
            logger.warning("migration %s: could not import user %s: %s", service.pk, source_user_id, exc)

    fallback_username = options.get("fallback_username") or "admin"
    fallback = User.objects.filter(username=fallback_username).first()
    if fallback is None:
        raise ValueError(f"Fallback user '{fallback_username}' does not exist")
    return fallback


CATEGORY_UID_MAX = 36


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
    # the source id is unique by definition, so this always terminates
    tail = f" {source_id}"
    return f"{name[: 100 - len(tail)]}{tail}"


def attach_rbac_group(service, provider, category, payload, source_id):
    """Carry a members-only source category's member list into an RBAC group.

    Keyed on a uid from the source system, so a re-run lands on the existing group.
    Members are added, never removed: access granted inside MediaCMS is not this
    migration's to take away.
    """
    from rbac.models import RBACGroup, RBACMembership

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
        # the owner manages the category whether or not they hold a member row
        members.append({"userId": owner_id, "role": "manager"})

    added = 0
    for member in members:
        try:
            # not resolve_owner: a member of a private category needs an account for the
            # membership to mean anything, whatever the run is importing
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
        # nowhere for a group to live, and somebody who switched this on expects groups
        record(service, "group", source_id, "skipped", "RBAC is switched off on this portal, so groups have nowhere to go")
        return None

    from rbac.models import RBACGroup, RBACMembership

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

    # one rendition per profile when skipping transcoding: YouTube already holds an h264
    # stream at each height. Otherwise just the best, and MediaCMS makes its own ladder.
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
                # one encoding per profile: two streams can round to the same one
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

            # encode() makes the hover preview, and skipping transcoding never reaches it
            ensure_preview(media)

        for caption in payload["captions"]:
            import_youtube_caption(service, provider, media, caption, tmp_dir)

        return media
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        provider.cleanup()


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


def import_category(service, provider, source_id):
    """Create or reuse the MediaCMS category for one source category.

    A members-only category becomes an RBAC category with a group holding its members;
    everything else becomes a plain one and the media state carries what the source
    implied. One transaction, because the mapping row is written last: without it a
    failure part way would leave a Category nothing knows about and the retry would
    build a second.
    """
    # a skipped row carrying a target means another migration on this source already made
    # it, so a re-run reuses it rather than building a duplicate
    existing = MigrationRecord.objects.filter(service=service, object_type="category", source_id=str(source_id), status__in=("success", "skipped")).exclude(target_id=None).first()
    if existing:
        category = existing.target()
        if category is not None:
            return category

    payload = provider.fetch_category(source_id)
    title, description = category_title_and_description(payload.get("fullName"), payload.get("courseName") or "")
    if not title:
        title = payload.get("name") or f"category-{source_id}"
        description = title

    # the Kaltura id is the category's identity, so one already carrying it is reused. A uid
    # held by something with a different title is not this category: it keeps its uid and
    # this import takes a free one.
    claimed = Category.objects.filter(uid=str(source_id)[:CATEGORY_UID_MAX]).first()
    known_titles = [title, payload.get("name") or ""]
    if claimed is not None and any(name and (claimed.title == name or claimed.title.startswith(name + " (")) for name in known_titles):
        record(service, "category", source_id, "success", f"reused existing category {claimed.title}", target=claimed)
        return claimed

    kind = category_type(payload)
    # RBAC is the only place a member list can live. With it off the category is still
    # created and its media still land private, so only the members are lost.
    use_rbac = kind == CATEGORY_PRIVATE and getattr(settings, "USE_RBAC", False)
    is_lms_course = category_tree_kind(payload) == LMS_TREE

    with transaction.atomic():
        # inside the transaction: two categories in one run must collide against each other
        taken = set(Category.objects.values_list("title", flat=True))
        title = unique_category_title(title, payload.get("parentName") or "", taken)

        category = Category.objects.create(
            uid=free_category_uid(source_id),
            title=title,
            description=description,
            is_global=True,
            is_rbac_category=use_rbac,
            is_lms_course=is_lms_course,
        )

        log = f"created category {category.title} ({kind})"
        if is_lms_course:
            log = f"created LMS course {category.title} ({kind})"
        record(service, "category", source_id, "success", log, target=category)

    if use_rbac:
        # outside it: the members are many API calls, and holding the row open for them
        # would block every parallel import
        try:
            attach_rbac_group(service, provider, category, payload, source_id)
        except Exception as exc:  # noqa: BLE001 - the category itself is already sound
            service.append_log(f"category {source_id}: could not transfer permissions: {exc}")
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
            # usually a duplicate resolution: MediaCMS has one profile per resolution
            service.append_log(f"media {media.friendly_token}: no matching profile for flavor " f"{flavor.get('id')} at {flavor.get('height')}p, skipped")

    encodings = []
    for flavor, profile in pairs:
        path = os.path.join(tmp_dir, f"{flavor['id']}.{profile.extension}")
        started = time.monotonic()
        try:
            written = provider.download_flavor(flavor, path)
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

    if not encodings:
        # without one successful mp4 or webm encoding, set_encoding_status leaves the media
        # pending and invisible. Fall back to the file already downloaded.
        extension = os.path.splitext(original_path)[1].lstrip(".").lower()
        fallback = match_flavors_to_profiles([{"id": "original", "height": media.video_height or 0, "fileExt": extension}], profiles)
        if fallback:
            service.append_log(f"media {media.friendly_token}: no usable flavors, using the original as its encoding")
            encodings.append(create_encoding(media, fallback[0][1], original_path))
        else:
            service.append_log(f"media {media.friendly_token}: no flavor and no active encode profile matches " f"extension '{extension}'; the media will not be listable until it is encoded")

    started = time.monotonic()
    finalise_encodings(media, encodings)
    # encode() makes the hover preview, and skipping transcoding never reaches it
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
        # despite the name this converts the stored file to WebVTT in place
        subtitle.convert_to_srt()

        record(service, "caption", source_id, "success", f"attached {code} caption to media {media.id}", target=subtitle)
        return subtitle
    except Exception as exc:  # noqa: BLE001 - a bad caption must not lose the media
        if subtitle is not None and subtitle.pk:
            # the row exists but never became valid WebVTT, which is worse than no caption and
            # would contradict the failed record we are about to write
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
        # whole categories, since the type comes from three fields together, and only the ones
        # the entry is published through: a submission awaiting approval is not public
        published = data.get("published_categories")
        if published is None:
            published = data.get("categories") or []
        media.state = media_state(published, entry.get("displayInSearch"), entry.get("moderationStatus"))

    # a full save() would write every column from this stale instance, including ones the
    # tasks media_init fired fill in behind our back: produce_sprite_from_video saves
    # media.sprites while we are still attaching flavors. Only write what we set.
    media.save(update_fields=["views", "add_date", "state", "listable"])

    attach_tags(media, (entry.get("tags") or "").split(","), media.user)

    for source_category in data.get("categories") or []:
        # an entry is attached to every category it belongs to, but only real galleries and
        # channels become MediaCMS categories: the rest is KMS housekeeping
        source_category_id = source_category.get("id")
        if is_ignored_category(source_category):
            # an LTI course parks its media in an InContext child, which is plumbing nobody
            # browses, so it is rolled up to the course a person recognises
            source_category_id = source_category.get("parentId")
            parent_path = (source_category.get("fullName") or "").rsplit(">", 1)[0]
            if not source_category_id or not provider.within_selection(parent_path):
                continue
        elif not provider.worth_importing(source_category):
            # outside the chosen roots, or housekeeping. The media still comes over, since it
            # follows its owner, but it drags in no category tree nobody asked for.
            continue
        category = get_or_import_category(service, provider, str(source_category_id))
        if category:
            media.category.add(category)


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
    # an image has no flavors: its file comes straight off the entry. Anything else
    # without one (a live stream, an entry still transcoding) has nothing to import.
    is_image = entry.get("mediaType") == MEDIA_TYPE_IMAGE and bool(entry.get("downloadUrl"))
    if original is None and not is_image:
        raise ValueError(f"entry {source_id} has no downloadable flavor")
    if original is not None and not original.get("isOriginal"):
        service.append_log(f"entry {source_id}: no source flavor, using flavor {original.get('id')} as the original")

    with tempfile.TemporaryDirectory(dir=settings.TEMP_DIRECTORY) as tmp_dir:
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

        # record before the slow part, so an interrupted import is traceable and its half
        # built Media can be cleaned up on retry instead of orphaned
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

        # metadata last: the migrated state before the encodings exist would briefly mark a
        # public media listable with nothing to play
        with timings.step("metadata + categories"):
            apply_entry_metadata(service, provider, media, data)

    service.append_log(timings.summary())
    media.refresh_from_db()
    record(service, "media", source_id, "success", f"imported '{media.title}' as media {media.id}", target=media)
    return media


# Users and categories are walked before media when their option is on; with it off they
# are created on demand as the media that need them arrive. Playlists last: one can only
# reference media the run has already brought over.
PHASES = ["users", "groups", "categories", "media", "playlists"]

# the categories phase always runs: it is scoped by the chosen categories rather than
# switched on and off, and a migration with none chosen sweeps nothing anyway
PHASE_OPTION = {"users": "migrate_all_users", "groups": "migrate_groups", "categories": None, "media": None, "playlists": "migrate_playlists"}

RECORD_TYPE = {"users": "user", "groups": "group", "categories": "category", "media": "media", "playlists": "playlist"}

IMPORTERS = {"users": import_user, "groups": import_group, "categories": import_category, "media": import_media_entry, "playlists": import_playlist}


# a provider whose source has no notion of a phase does not walk it; absent means all
PROVIDER_PHASES = {"youtube": ["media"]}

# and brings its own importers when its objects are shaped nothing like a portal's.
# Kept here rather than on the provider so providers need not import tasks.
PROVIDER_IMPORTERS = {"youtube": {"media": import_youtube_video}}


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
        # a cursor from before the source's phase list was narrowed
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
# a finished run can be swept again: each importer skips what it already brought over
RERUNNABLE = ("success", "error", "aborted")


def record_discovery_totals(service, provider, force=False):
    """Ask the source how much there is, once, when a migration first starts.

    Best effort: a source that cannot answer leaves the bars without a denominator.
    Returns False only when it has ended the run itself, so the caller must not dispatch.
    """
    totals = dict(service.totals or {})
    if totals.get("media_discovered") and not force:
        # a resume must not reset a known total; a re-run refreshes, the source may have grown
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
    if service.status not in STARTABLE:
        raise ValueError(f"Cannot start a migration that is '{service.status}'")

    now = timezone.now()
    claimed = MigrationService.objects.filter(pk=service.pk, status__in=STARTABLE).update(status="running", ended_at=None, last_activity=now)
    if not claimed:
        # someone else won the race: a second orchestrator loop would race on one cursor
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
    # the compare and swap is the only check: a caller holding a finished object must
    # not be refused a re-run over a stale in memory status
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


@task(name="run_scheduled_migration", queue="short_tasks")
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

    # switch scheduling off before starting, so the used time stops being offered by the
    # form and a duplicate task armed by an earlier save finds nothing to do
    stored = dict(service.options or {})
    stored["schedule_enabled"] = False
    stored["scheduled_at"] = ""
    MigrationService.objects.filter(pk=service_id).update(options=stored)
    service.refresh_from_db()

    if service.status not in STARTABLE:
        service.append_log(f"scheduled start skipped: the migration is '{service.status}'")
        return False

    try:
        # start_migration claims the row itself, so two tasks racing here cannot both run
        start_migration(service)
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

    # after the status check, never before: a paused migration must fall out above rather
    # than be handed another task. The run does no work this cycle and looks again shortly.
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
                # trim so the cap is exact rather than rounded up to the page size. The cursor
                # advances past the trimmed entries, which is fine: max_items ends the migration.
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

    # already imported from this source system by another migration, checked before
    # anything is downloaded so a rerun costs list calls only
    other = MigrationRecord.already_migrated(service.source_system, object_type, source_id)
    if other is not None:
        logger.info("%s already migrated by '%s', skipping", log_prefix, other.service.name)
        # carry the other migration's target through: a skipped row with no target is
        # invisible to the importers' own guards, which would re-import and duplicate
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
        # preserve any target the importer recorded: it writes its row before the slow part
        # precisely so a retry can find and delete the half built object
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
        # Do NOT advance the cursor: items that had not started returned early without
        # importing, and advancing would step the resume position past them. Replaying the
        # page is cheap, every importer returns early for work already recorded.
        service.append_log(f"stopped after a page, status is '{service.status}'; the page will replay on resume")
        MigrationService.objects.filter(pk=service_id).update(last_activity=timezone.now())
        return False

    service.cursor = next_cursor
    service.last_activity = timezone.now()
    service.save(update_fields=["cursor", "last_activity"])

    run_migration.apply_async(args=[service_id], countdown=1)
    return True
