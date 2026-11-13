"""Stream a dated Django fixture of the database, leaving out operational rows."""

import zlib

from django.apps import apps
from django.core import serializers
from django.utils import timezone

from actions.models import EXPORTED_MEDIA_ACTIONS

# Job queues, sessions, and logs. Content such as finished captions stays.
EXCLUDED_MODELS = frozenset(
    {
        ("sessions", "session"),
        ("admin", "logentry"),
        ("users", "notification"),
        ("identity_providers", "identityprovideruserlog"),
        ("lti", "ltilaunchlog"),
        ("files", "videotrimrequest"),
        ("files", "transcriptionrequest"),
    }
)


def database_backup_filename(when=None):
    """Local date and time, for example mediacms-database-backup-2026-11-13-1325.json.gz."""
    moment = timezone.localtime(when or timezone.now())
    return moment.strftime("mediacms-database-backup-%Y-%m-%d-%H%M.json.gz")


def _models_in_order():
    app_list = []
    for app_config in apps.get_app_configs():
        models = []
        for model in app_config.get_models():
            if model._meta.proxy or not model._meta.managed:
                continue
            if (model._meta.app_label, model._meta.model_name) in EXCLUDED_MODELS:
                continue
            models.append(model)
        if models:
            app_list.append((app_config, models))
    return serializers.sort_dependencies(app_list)


def _queryset_for(model):
    queryset = model._default_manager.order_by(model._meta.pk.name)
    label = (model._meta.app_label, model._meta.model_name)
    if label == ("actions", "mediaaction"):
        return queryset.filter(action__in=EXPORTED_MEDIA_ACTIONS)
    if label == ("files", "encoding"):
        return queryset.exclude(status="fail")
    return queryset


def _object_json(instance):
    raw = serializers.serialize("json", [instance])
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end < start:
        return b""
    return raw[start : end + 1].encode("utf-8")


def _fixture_bytes():
    yield b"["
    first = True
    for model in _models_in_order():
        for instance in _queryset_for(model).iterator(chunk_size=500):
            piece = _object_json(instance)
            if not piece:
                continue
            if first:
                first = False
                yield piece
            else:
                yield b"," + piece
    yield b"]"


def iter_database_backup():
    """Yield gzip chunks of a JSON fixture."""
    compressor = zlib.compressobj(wbits=16 + zlib.MAX_WBITS)
    for chunk in _fixture_bytes():
        compressed = compressor.compress(chunk)
        if compressed:
            yield compressed
    tail = compressor.flush()
    if tail:
        yield tail
