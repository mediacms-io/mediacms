import logging
import os
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
    Subtitle,
    Tag,
)
from users.models import User

from .models import MigrationRecord, MigrationService
from .providers import get_provider
from .providers.kaltura import (
    CATEGORY_PRIVATE,
    MEDIA_TYPE_IMAGE,
    category_title_and_description,
    category_type,
    is_importable_category,
    match_flavors_to_profiles,
    media_state,
    mediacms_role,
    sanitize_username,
    unique_category_title,
)

logger = logging.getLogger(__name__)


def record(service, object_type, source_id, status, log="", target=None):
    """Write the mapping row for one source object.

    update_or_create rather than create so that retrying a failed item
    replaces its record instead of tripping the unique constraint.
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
        # a username match only counts as the same person when the existing
        # account has no email of its own: otherwise it is a distinct,
        # already-identified human who merely collides on the sanitised
        # username, and linking would attach the migration to the wrong account
        candidate = User.objects.filter(username__iexact=username).first()
        if candidate is not None and not candidate.email:
            # and not already claimed by a different source user: two emailless
            # Kaltura accounts can sanitise to the same username, and the second
            # must not inherit the first one's media
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
        # roles are applied only to accounts this migration created. A linked
        # pre-existing account keeps whatever permissions it already had.
        role = mediacms_role(payload.get("roleId"), payload.get("roleName"), options.get("role_map"))
        if role:
            # only called for a mapped role. set_role_from_mapping resets every
            # permission when handed an unknown value
            user.set_role_from_mapping(role)

    action = "created" if created else "linked to existing user"
    record(service, "user", source_id, "success", f"{action} {user.username}", target=user)
    return user


def resolve_owner(service, provider, source_user_id):
    """The MediaCMS user a migrated media should belong to"""
    options = service.get_options()

    # create_users only has a say when migrate_all_users is off: with it on, every owner
    # already has an account and import_user simply finds it
    wants_real_owner = options.get("migrate_all_users", True) or options.get("create_users", True)
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


def rbac_group_uid(service, source_id):
    """Stable identifier for the group that mirrors one source category.

    Prefixed with source_system, which already carries the partner id and the
    host. Two Kaltura installations both number a category 42, so an unscoped
    uid would put one tenant's members inside the other tenant's group.
    """
    return f"{service.source_system}:category:{source_id}"[:255]


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

    Keyed on a uid derived from the source system, so a re-run and a second
    migration of the same installation both land on the existing group instead
    of building a parallel one. Members are added, never changed or removed:
    access someone was granted inside MediaCMS is not this migration's to take
    away on a later run.
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
            # deliberately not through resolve_owner: a member of a private
            # category needs an account for the membership to mean anything,
            # whether or not the run is importing every user
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


def import_category(service, provider, source_id):
    """Create or reuse the MediaCMS category for one source category.

    Access control comes over as far as MediaCMS has somewhere to put it. A
    members-only category becomes an RBAC category with a group holding its
    members; everything else becomes a plain category, and it is the media state
    that carries what the source category implied. The whole import is one
    transaction because the mapping row is written last, and without atomicity a
    failure part way through would leave a real Category with no record of it,
    and the retry would build a second one.
    """
    payload = provider.fetch_category(source_id)

    # a skipped row is just as authoritative as a success one when it carries a
    # target: it means another migration on this same source already made it,
    # and a re-run must reuse it rather than build a duplicate
    existing = MigrationRecord.objects.filter(service=service, object_type="category", source_id=str(source_id), status__in=("success", "skipped")).exclude(target_id=None).first()
    if existing:
        category = existing.target()
        if category is not None:
            return category

    title, description = category_title_and_description(payload.get("fullName"))
    if not title:
        title = payload.get("name") or f"category-{source_id}"
        description = title

    kind = category_type(payload)
    # RBAC is the only place a member list can live. With it off the category is
    # still created and its media still land private, so nothing is exposed: it
    # is only the members that cannot be carried across.
    use_rbac = kind == CATEGORY_PRIVATE and getattr(settings, "USE_RBAC", False)

    with transaction.atomic():
        # read inside the transaction: two categories created in the same run must
        # collide against each other, not just against pre-existing titles
        taken = set(Category.objects.values_list("title", flat=True))
        title = unique_category_title(title, payload.get("parentName") or "", taken)

        category = Category.objects.create(title=title, description=description, is_global=True, is_rbac_category=use_rbac)

        record(service, "category", source_id, "success", f"created category {category.title} ({kind})", target=category)

    if use_rbac:
        # outside the transaction: the members are a long series of API calls, and
        # holding the category row open for them would block every parallel import
        try:
            attach_rbac_group(service, provider, category, payload, source_id)
        except Exception as exc:  # noqa: BLE001 - the category itself is already sound
            service.append_log(f"category {source_id}: could not transfer permissions: {exc}")
    return category


def pick_original_flavor(flavors):
    """The flavor to use as Media.media_file.

    Kaltura installations often purge the source flavor, so fall back to the
    tallest ready flavor and let the caller log the substitution.
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

    MediaCMS reads the file to decide media_type, so this has to be honest: a jpeg
    stored as .mp4 would be imported as a video that cannot play.
    """
    if flavor is not None:
        return (flavor.get("fileExt") or "mp4").lower()

    suffix = os.path.splitext(entry.get("name") or "")[1].lstrip(".").lower()
    if suffix.isalnum() and 1 < len(suffix) <= 5:
        return suffix
    return "jpg"


def get_or_import_category(service, provider, source_id):
    """The MediaCMS category for a source category id, importing it if needed"""
    # a skipped row is just as authoritative as a success one when it carries a
    # target: it means another migration on this same source already made it
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


def create_encoding(media, profile, path):
    """Attach an already transcoded file to a media as a finished Encoding.

    Saved as pending first, because the Encoding post_save receiver only reacts
    to success and fail. The status is then flipped with a queryset update,
    which fires no signals at all. That is what keeps create_hls from being
    launched once per flavor.
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
            # usually a duplicate resolution in the source: MediaCMS has one profile
            # per resolution, so the second copy has nowhere honest to go
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
        # Without at least one successful mp4 or webm encoding, set_encoding_status
        # leaves the media pending and listable stays false, which makes it
        # invisible. Fall back to the file already downloaded as the original.
        extension = os.path.splitext(original_path)[1].lstrip(".").lower()
        fallback = match_flavors_to_profiles([{"id": "original", "height": media.video_height or 0, "fileExt": extension}], profiles)
        if fallback:
            service.append_log(f"media {media.friendly_token}: no usable flavors, using the original as its encoding")
            encodings.append(create_encoding(media, fallback[0][1], original_path))
        else:
            service.append_log(f"media {media.friendly_token}: no flavor and no active encode profile matches " f"extension '{extension}'; the media will not be listable until it is encoded")

    started = time.monotonic()
    finalise_encodings(media, encodings)
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
            # the row exists but its file never became valid WebVTT. A broken
            # caption track attached to the media is worse than no caption, and
            # would otherwise contradict the failed record we are about to write.
            subtitle.delete()
        record(service, "caption", source_id, "failed", f"caption {source_id} failed: {exc}")
        service.append_log(f"media {media.friendly_token}: caption {source_id} failed: {exc}")
        return None


def apply_entry_metadata(service, provider, media, data):
    """Second pass over a freshly created media: state, views, date, tags, categories.

    A second save is required because Media.save() overwrites state with the
    portal default on creation only.
    """
    options = service.get_options()
    entry = data.get("entry") or {}

    if options.get("preserve_views", True):
        media.views = entry.get("plays") or entry.get("views") or 0

    if entry.get("createdAt"):
        media.add_date = datetime.fromtimestamp(int(entry["createdAt"]), tz=dt_timezone.utc)

    if options.get("preserve_publish_state", True):
        # whole categories, not just their privacy: the type one is configured as comes
        # from three fields together. And only the categories the entry is published
        # through, since a submission still awaiting approval is not public anywhere
        published = data.get("published_categories")
        if published is None:
            published = data.get("categories") or []
        media.state = media_state(published, entry.get("displayInSearch"), entry.get("moderationStatus"))

    # a full save() writes every column from this in-memory instance, including
    # ones the background tasks media_init fired fill in behind our back:
    # produce_sprite_from_video finishes while we are still attaching flavors and
    # saves media.sprites, which a full save here overwrites with the empty value
    # this stale instance still holds. Only write the columns we set ourselves.
    media.save(update_fields=["views", "add_date", "state", "listable"])

    for raw_tag in (entry.get("tags") or "").split(","):
        title = helpers.get_alphanumeric_and_spaces(raw_tag).strip()[:100]
        if not title:
            continue
        tag, _created = Tag.objects.get_or_create(title=title, defaults={"user": media.user})
        media.tags.add(tag)

    for source_category in data.get("categories") or []:
        # an entry is attached to every category it belongs to, including ones it is not
        # published through yet, but only real galleries and channels become MediaCMS
        # categories: the rest is KMS housekeeping
        if not is_importable_category(source_category.get("fullName")):
            continue
        category = get_or_import_category(service, provider, str(source_category.get("id")))
        if category:
            media.category.add(category)


class Timings:
    """Per step stopwatch for one media import.

    Detail goes to the worker log; the migration log gets one summary line per
    media, because 12,000 entries times a dozen steps would bury everything else.
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

    Not wrapped in a transaction on purpose: this downloads gigabytes, and holding
    a database transaction open for that long is worse than the failure it would
    prevent. Instead the mapping row is written as soon as the Media exists, so a
    crash leaves a traceable row rather than an invisible orphan, and a retry
    discards the half built Media before starting again.
    """
    options = service.get_options()

    existing = MigrationRecord.objects.filter(service=service, object_type="media", source_id=str(source_id)).first()
    # a skipped row is just as authoritative as a success one when it carries a
    # target: it means another migration on this same source already made it
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
    # an image has no flavor assets at all, so there is nothing to pick: its file
    # comes straight off the entry. anything else without a flavor (a live stream,
    # an entry still transcoding) genuinely has nothing to import
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

        # record before the slow part, so an interrupted import is traceable and
        # its half built Media can be cleaned up on retry instead of orphaned
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

        # metadata last: applying the migrated state before the encodings exist
        # would briefly mark a public media listable with nothing to play
        with timings.step("metadata + categories"):
            apply_entry_metadata(service, provider, media, data)

    service.append_log(timings.summary())
    media.refresh_from_db()
    record(service, "media", source_id, "success", f"imported '{media.title}' as media {media.id}", target=media)
    return media


# Users and categories are walked before media when their option is on. With it off the
# phase is skipped and the objects are still created on demand, as the media that need
# them arrive, so nothing is lost by skipping either one.
PHASES = ["users", "categories", "media"]

PHASE_OPTION = {"users": "migrate_all_users", "categories": "migrate_all_categories", "media": None}

RECORD_TYPE = {"users": "user", "categories": "category", "media": "media"}

IMPORTERS = {"users": import_user, "categories": import_category, "media": import_media_entry}


def next_phase(phase):
    """The phase after this one, or "done" """
    if phase not in PHASES:
        return "done"
    index = PHASES.index(phase)
    return PHASES[index + 1] if index + 1 < len(PHASES) else "done"


def first_enabled_phase(service, phase):
    """Advance past any phases the options switched off"""
    options = service.get_options()
    while phase != "done":
        option = PHASE_OPTION.get(phase)
        if option is None or options.get(option, True):
            return phase
        phase = next_phase(phase)
    return "done"


def _media_limit_reached(service):
    """Whether max_items has been hit. Applies to the media phase only."""
    max_items = service.get_options().get("max_items")
    if not max_items:
        return False
    handled = MigrationRecord.objects.filter(service=service, object_type="media").exclude(status="failed").count()
    return handled >= int(max_items)


# Every status transition below is a conditional queryset update rather than a
# read-then-save on a Python object. Two admins clicking Start at the same moment,
# or a Pause landing while the orchestrator is mid network call, would otherwise
# both pass their guard and the second write would silently win.
STARTABLE = ("pending", "paused", "error", "aborted")
# a finished run can be swept again: each importer skips what it already brought
# over, so a re-run retries the failures and picks up anything new at the source
RERUNNABLE = ("success", "error", "aborted")


def record_discovery_totals(service, provider, force=False):
    """Ask the source how much there is, once, when a migration first starts.

    Best effort: a source that cannot answer must not stop the migration, the
    progress bars simply show counts without a denominator. Returns False only
    when it has ended the run itself, so the caller must not dispatch.
    """
    totals = dict(service.totals or {})
    if totals.get("media_discovered") and not force:
        # already known, a resume must not reset it. a re-run forces a refresh,
        # the source may have gained entries since the first sweep
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
            # Kaltura answers an unknown user with zero rather than an error, so
            # every id being empty means a mistyped list far more often than it
            # means empty accounts. Finishing as a clean success would hide that.
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
        # someone else won the race; do not dispatch a second orchestrator loop,
        # or two chords would race on one cursor
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

    The cursor is reset so the source is swept from the beginning. Items already
    imported are skipped by their importer's own guard for the cost of one query,
    with no source call and no download, so this is "retry the failures and pick
    up anything new" rather than a second full import.
    """
    # the compare and swap is the only check: an in memory status can be stale,
    # and a caller holding a finished object must not be refused a re-run for it
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

    The orchestrator can be mid network call when a pause or abort lands. Its
    in-memory copy still says running, so an unconditional save would silently
    discard the user's request.
    """
    finished = MigrationService.objects.filter(pk=service.pk, status="running").update(status=status, ended_at=timezone.now(), last_activity=timezone.now())
    service.refresh_from_db()
    if not finished:
        service.append_log(f"not finishing as '{status}': status is already '{service.status}'")
        return service
    if message:
        service.append_log(message)
    return service


@task(name="run_migration", queue="long_tasks", soft_time_limit=60 * 30)
def run_migration(service_id):
    """Handle one page of the current phase, then hand off to the chord callback"""
    service = MigrationService.objects.filter(pk=service_id).first()
    if service is None or service.status != "running":
        return False

    cursor = dict(service.cursor or {})
    phase = first_enabled_phase(service, cursor.get("phase") or PHASES[0])
    if phase != cursor.get("phase"):
        # a phase was switched off, start the new one from the beginning
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
                # trim so the cap is exact rather than rounded up to the page size.
                # the cursor will advance past the trimmed entries, which is fine:
                # max_items is a dry run cap and ends the migration.
                service.append_log(f"max_items: trimming this page to {remaining} entries")
                source_ids = source_ids[:remaining]

    if not source_ids:
        service.append_log(f"phase '{phase}' finished")
        service.cursor = {"phase": next_phase(phase)}
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

    # already imported from the same source system by another migration.
    # checked before anything is downloaded, so a rerun costs list calls only
    other = MigrationRecord.already_migrated(service.source_system, object_type, source_id)
    if other is not None:
        logger.info("%s already migrated by '%s', skipping", log_prefix, other.service.name)
        # carry the other migration's target through: a skipped row with no target
        # is invisible to the importers' own guards, which would then re-import the
        # object and duplicate it
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
        IMPORTERS[phase](service, provider, source_id)
        logger.info("%s imported in %.1fs", log_prefix, time.monotonic() - started)
        return "ok"
    except Exception as exc:  # noqa: BLE001 - one bad item must not end the migration
        logger.exception("migration %s: %s %s failed", service_id, object_type, source_id)
        # preserve any target the importer already recorded. import_media_entry
        # writes its row before the slow part precisely so a retry can find and
        # delete the half built object; nulling it here would orphan that object
        # and let the retry create a duplicate beside it.
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
        # Do NOT advance the cursor. When a pause lands mid page, the items that
        # had not started yet returned early without importing anything. Advancing
        # would step the resume position past them and they would never be
        # imported at all. Leaving the cursor put replays the whole page on
        # resume, which is cheap: every importer is idempotent and returns early
        # for work already recorded.
        service.append_log(f"stopped after a page, status is '{service.status}'; the page will replay on resume")
        MigrationService.objects.filter(pk=service_id).update(last_activity=timezone.now())
        return False

    service.cursor = next_cursor
    service.last_activity = timezone.now()
    service.save(update_fields=["cursor", "last_activity"])

    run_migration.apply_async(args=[service_id], countdown=1)
    return True
