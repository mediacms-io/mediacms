"""Restore a database backup onto an initial installation."""

import json
import zlib
from contextlib import contextmanager
from pathlib import Path

from django.apps import apps
from django.conf import settings
from django.contrib.sites.models import Site
from django.core import serializers
from django.core.cache import cache
from django.core.management.color import no_style
from django.core.serializers.base import DeserializationError
from django.db import IntegrityError, connection, transaction

from actions.models import EXPORTED_MEDIA_ACTIONS
from admin_customizations.database_backup import EXCLUDED_MODELS, _models_in_order

MAX_COMPRESSED_BYTES = 64 * 1024 * 1024
MAX_DECOMPRESSED_BYTES = 256 * 1024 * 1024
# Migrated with the installation. A backup contains copies; loading them again collides.
SKIP_RESTORE_MODELS = frozenset({"contenttypes.contenttype", "auth.permission"})
# Present while an administrator is signed in, or created by migrate.
IGNORED_MODELS = frozenset(
    {
        ("contenttypes", "contenttype"),
        ("auth", "permission"),
        ("sessions", "session"),
    }
)
SEED_MODELS = frozenset(
    {
        ("users", "user"),
        ("users", "channel"),
        ("files", "category"),
        ("files", "encodeprofile"),
        ("sites", "site"),
    }
)


class RestoreError(Exception):
    """The upload is not a backup this page can apply."""


class RestoreNotAllowed(Exception):
    """The database is no longer an initial installation."""


def _blocker(template, **kwargs):
    rendered = template
    if kwargs:
        try:
            rendered = template.format(**kwargs)
        except (KeyError, ValueError, IndexError):
            rendered = template
    return {"detail": rendered, "detail_template": template, "detail_kwargs": kwargs}


def _seed_rows(filename):
    path = Path(settings.BASE_DIR) / "fixtures" / filename
    if not path.is_file():
        return []
    return json.loads(path.read_text())


def _user_and_channel_blockers():
    from users.models import Channel, User

    users = list(User.objects.order_by("pk"))
    if len(users) == 0:
        return [_blocker("There is no superuser account.")]
    if len(users) > 1:
        return [_blocker("There is more than one user account ({count}).", count=len(users))]
    user = users[0]
    blockers = []
    if not user.is_superuser:
        blockers.append(_blocker("The only user account is not a superuser."))
    if not user.is_active:
        blockers.append(_blocker("The only user account is inactive."))
    channels = list(Channel.objects.all())
    if len(channels) > 1:
        blockers.append(_blocker("There is more than one channel."))
    elif len(channels) == 1:
        channel = channels[0]
        banner = getattr(getattr(channel, "banner_logo", None), "name", "") or ""
        default_banner = banner in ("", "userlogos/banner.jpg")
        untouched = channel.user_id == user.pk and channel.title == "default" and not (channel.description or "").strip() and not channel.subscribers.exists() and default_banner
        if not untouched:
            blockers.append(_blocker("The channel is not the default channel created for the superuser."))
    return blockers


def _category_blockers():
    from files.models.category import Category

    rows = list(Category.objects.values_list("uid", "title", "description", "user_id", "is_global", "media_count"))
    if not rows:
        return []
    expected = frozenset((item["fields"]["uid"], item["fields"]["title"]) for item in _seed_rows("categories.json"))
    identity = frozenset((uid, title) for uid, title, *_rest in rows)
    unmodified = all(not (description or "").strip() and user_id is None and is_global is False and media_count == 0 for _uid, _title, description, user_id, is_global, media_count in rows)
    if identity == expected and unmodified:
        return []
    return [_blocker("Categories do not match the initial installation.")]


def _profile_blockers():
    from files.models.encoding import EncodeProfile

    fields = ("name", "extension", "resolution", "codec", "active", "description")
    rows = list(EncodeProfile.objects.values_list(*fields))
    if not rows:
        return []
    expected = frozenset(tuple(item["fields"].get(field) for field in fields) for item in _seed_rows("encoding_profiles.json"))
    if frozenset(rows) == expected:
        return []
    return [_blocker("Encode profiles do not match the initial installation.")]


def _site_blockers():
    if Site.objects.count() == 1:
        return []
    return [_blocker("There is not exactly one site record.")]


def _other_model_blockers():
    blockers = []
    for model in apps.get_models():
        meta = model._meta
        label = (meta.app_label, meta.model_name)
        if meta.proxy or not meta.managed or label in IGNORED_MODELS or label in SEED_MODELS:
            continue
        count = model._default_manager.count()
        if count:
            blockers.append(
                _blocker(
                    "{count} {label} record(s) are present.",
                    count=count,
                    label=str(meta.verbose_name_plural),
                )
            )
    blockers.sort(key=lambda item: item["detail"])
    return blockers


def vanilla_install_status():
    """True only when the database is still an initial installation."""
    blockers = []
    blockers.extend(_user_and_channel_blockers())
    blockers.extend(_category_blockers())
    blockers.extend(_profile_blockers())
    blockers.extend(_site_blockers())
    blockers.extend(_other_model_blockers())
    return {"enabled": not blockers, "blockers": blockers}


def _backup_model_labels():
    return {f"{model._meta.app_label}.{model._meta.model_name}" for model in _models_in_order()}


def _read_compressed(uploaded):
    chunks = []
    total = 0
    for chunk in uploaded.chunks():
        total += len(chunk)
        if total > MAX_COMPRESSED_BYTES:
            raise RestoreError("The backup file is too large.")
        chunks.append(chunk)
    if total == 0:
        raise RestoreError("The backup file is empty.")
    return b"".join(chunks)


def _gunzip(raw):
    if len(raw) < 2 or raw[:2] != b"\x1f\x8b":
        raise RestoreError("The file is not a gzipped database backup.")
    decompressor = zlib.decompressobj(wbits=16 + zlib.MAX_WBITS)
    out = bytearray()
    try:
        view = memoryview(raw)
        for start in range(0, len(raw), 1024 * 1024):
            piece = decompressor.decompress(view[start : start + 1024 * 1024])
            out.extend(piece)
            if len(out) > MAX_DECOMPRESSED_BYTES:
                raise RestoreError("The backup file is too large.")
        out.extend(decompressor.flush())
    except zlib.error as exc:
        raise RestoreError("The file is not a gzipped database backup.") from exc
    if len(out) > MAX_DECOMPRESSED_BYTES:
        raise RestoreError("The backup file is too large.")
    return bytes(out)


def _validate_fixture(objects):
    if not isinstance(objects, list) or not objects:
        raise RestoreError("The backup file is not a database fixture.")
    allowed = _backup_model_labels()
    excluded = {f"{app}.{model}" for app, model in EXCLUDED_MODELS}
    has_superuser = False
    for item in objects:
        if not isinstance(item, dict):
            raise RestoreError("The backup file is not a database fixture.")
        model = item.get("model")
        fields = item.get("fields")
        if model in excluded or model not in allowed or not isinstance(fields, dict) or "pk" not in item:
            raise RestoreError("The backup file includes records this page does not restore.")
        if model == "actions.mediaaction" and fields.get("action") not in EXPORTED_MEDIA_ACTIONS:
            raise RestoreError("The backup file includes records this page does not restore.")
        if model == "files.encoding" and fields.get("status") == "fail":
            raise RestoreError("The backup file includes records this page does not restore.")
        if model == "users.user" and fields.get("is_superuser"):
            has_superuser = True
    if not has_superuser:
        raise RestoreError("The backup file has no superuser account.")


def _lock_users():
    from users.models import User

    queryset = User.objects.all()
    if connection.vendor == "postgresql":
        queryset = queryset.select_for_update()
    list(queryset)


def _delete_seed_rows():
    from files.models.category import Category
    from files.models.encoding import EncodeProfile
    from users.models import User

    User.objects.all().delete()
    Category.objects.all().delete()
    EncodeProfile.objects.all().delete()


@contextmanager
def _quiet_signals():
    """Keep restore from creating extra channels or starting transcoding."""
    from django.db.models.signals import post_save

    from files.models.encoding import Encoding, encoding_file_save
    from files.models.media import Media, media_save
    from files.models.subtitle import Subtitle, subtitle_save
    from users.models import User, post_user_create

    receivers = (
        (post_save, post_user_create, User),
        (post_save, media_save, Media),
        (post_save, encoding_file_save, Encoding),
        (post_save, subtitle_save, Subtitle),
    )
    for signal, receiver, sender in receivers:
        signal.disconnect(receiver, sender=sender)
    try:
        yield
    finally:
        for signal, receiver, sender in receivers:
            signal.connect(receiver, sender=sender)


def _reset_sequences(models):
    statements = connection.ops.sequence_reset_sql(no_style(), models)
    if not statements:
        return
    with connection.cursor() as cursor:
        for statement in statements:
            cursor.execute(statement)


def restore_database_backup(uploaded):
    """Replace an initial installation with a backup downloaded from this page."""
    payload = _gunzip(_read_compressed(uploaded))
    try:
        text = payload.decode("utf-8")
        objects = json.loads(text)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RestoreError("The backup file is not a database fixture.") from exc
    _validate_fixture(objects)
    loaded = {}
    try:
        with transaction.atomic():
            _lock_users()
            if not vanilla_install_status()["enabled"]:
                raise RestoreNotAllowed()
            _delete_seed_rows()
            with _quiet_signals():
                for obj in serializers.deserialize("json", text):
                    label = obj.object._meta.label_lower
                    if label in SKIP_RESTORE_MODELS:
                        continue
                    model = obj.object.__class__
                    if obj.object.pk is not None and model._default_manager.filter(pk=obj.object.pk).exists():
                        obj.object._state.adding = False
                    obj.save()
                    loaded[label] = model
            _reset_sequences(list(loaded.values()))
    except RestoreNotAllowed:
        raise
    except (DeserializationError, IntegrityError, TypeError, ValueError) as exc:
        raise RestoreError("The backup file is not a database fixture.") from exc
    from admin_customizations.admin import DASHBOARD_STATS_CACHE_KEY

    cache.delete(DASHBOARD_STATS_CACHE_KEY)
