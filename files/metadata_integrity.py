"""Filesystem metadata refresh and integrity checks for Media/encodings.

Fills blank md5/size/media_info from disk. Never overwrites existing values;
mismatches and missing files become integrity_warning MediaAction audits.
"""

from __future__ import annotations

import json
import os
from datetime import timedelta
from typing import Iterable, Optional

from django.conf import settings
from django.db.models import Q, QuerySet
from django.urls import reverse
from django.utils import timezone

from files import helpers
from files.integrity import successful_playable_encodings_q
from files.methods import record_moderation_action
from files.models import Encoding, Media, Subtitle

EXTRA_INFO_MAX = 800
MISSING_METADATA_FILTER_PARAM = "missing_metadata"
INTEGRITY_WARNING_LOOKBACK_DAYS = 7


def _blank(value) -> bool:
    return value is None or value == ""


def _filefield_path(field) -> Optional[str]:
    """Return on-disk path for a FileField/ImageField, or None."""
    try:
        if not field:
            return None
        return field.path
    except (ValueError, NotImplementedError, OSError):
        return None


def _path_exists(path: Optional[str]) -> bool:
    return bool(path and os.path.isfile(path))


def _compute_md5(path: str) -> Optional[str]:
    cmd = ["md5sum", path]
    stdout = helpers.run_command(cmd).get("out")
    if stdout:
        return stdout.strip().split()[0]
    return None


def _compute_size_bytes(path: str) -> Optional[int]:
    cmd = ["stat", "-c", "%s", path]
    stdout = helpers.run_command(cmd).get("out")
    if stdout:
        try:
            return int(stdout.strip())
        except (TypeError, ValueError):
            return None
    return None


def _truncate_summary(parts: list[str], fallback: str) -> str:
    if not parts:
        return fallback
    return "; ".join(parts)[:EXTRA_INFO_MAX]


def _check_and_fill_hash_size(
    *,
    label: str,
    path: str,
    stored_md5,
    stored_size,
    fill_md5: bool = True,
    fill_size: bool = True,
) -> tuple[dict, list[str], list[str]]:
    """Compare/fill md5 and size for one on-disk file.

    Returns (updates_dict, filled_notes, warnings).
    """
    updates: dict = {}
    filled: list[str] = []
    warnings: list[str] = []

    computed_md5 = _compute_md5(path) if fill_md5 else None
    size_bytes = _compute_size_bytes(path) if fill_size else None
    computed_size = helpers.show_file_size(size_bytes) if size_bytes is not None else None

    if fill_md5 and computed_md5:
        if _blank(stored_md5):
            updates["md5sum"] = computed_md5
            filled.append(f"{label} md5sum")
        elif stored_md5 != computed_md5:
            warnings.append(f"{label} md5sum mismatch: stored={stored_md5} computed={computed_md5}")

    if fill_size and computed_size:
        if _blank(stored_size):
            updates["size"] = computed_size
            filled.append(f"{label} size")
        elif stored_size != computed_size:
            warnings.append(f"{label} size mismatch: stored={stored_size} computed={computed_size}")

    return updates, filled, warnings


def _check_related_path(label: str, path: Optional[str], warnings: list[str]) -> None:
    if path and not _path_exists(path):
        warnings.append(f"{label} missing on disk")


def _encoding_label(encoding: Encoding) -> str:
    if encoding.profile_id:
        return f"encoding:{encoding.profile.name}:{encoding.pk}"
    return f"encoding:{encoding.pk}"


def _refresh_encoding(encoding: Encoding, filled: list[str], warnings: list[str]) -> None:
    label = _encoding_label(encoding)
    enc_updates: dict = {}

    media_file_path = _filefield_path(encoding.media_file)
    if encoding.media_file:
        if not _path_exists(media_file_path):
            warnings.append(f"{label} file missing on disk")
        else:
            updates, notes, warns = _check_and_fill_hash_size(
                label=label,
                path=media_file_path,
                stored_md5=encoding.md5sum,
                stored_size=encoding.size,
            )
            enc_updates.update(updates)
            filled.extend(notes)
            warnings.extend(warns)

    if encoding.chunk_file_path:
        if not _path_exists(encoding.chunk_file_path):
            warnings.append(f"{label} chunk missing on disk")
        elif not encoding.media_file:
            # Chunk-only rows store md5 of the chunk path
            stored_md5 = enc_updates.get("md5sum", encoding.md5sum)
            updates, notes, warns = _check_and_fill_hash_size(
                label=f"{label} chunk",
                path=encoding.chunk_file_path,
                stored_md5=stored_md5,
                stored_size=None,
                fill_size=False,
            )
            enc_updates.update(updates)
            filled.extend(notes)
            warnings.extend(warns)

    if enc_updates:
        Encoding.objects.filter(pk=encoding.pk).update(**enc_updates)


def refresh_and_check_media(media: Media, user=None) -> dict:
    """Review original + encodings + related files; fill blanks; audit results.

    Returns {"filled": [...], "warnings": [...]}.
    """
    filled: list[str] = []
    warnings: list[str] = []
    media_updates: dict = {}

    # --- Original file ---
    original_path = _filefield_path(media.media_file)
    if not original_path or not _path_exists(original_path):
        if media.media_file:
            warnings.append("original missing on disk")
    else:
        updates, notes, warns = _check_and_fill_hash_size(
            label="original",
            path=original_path,
            stored_md5=media.md5sum,
            stored_size=media.size,
        )
        media_updates.update(updates)
        filled.extend(notes)
        warnings.extend(warns)

        if _blank(media.media_info):
            info = helpers.media_file_info(original_path)
            if not info.get("fail"):
                try:
                    media_updates["media_info"] = json.dumps(info)
                    filled.append("original media_info")
                except TypeError:
                    pass

    # --- Encodings ---
    for encoding in media.encodings.select_related("profile").all():
        _refresh_encoding(encoding, filled, warnings)

    playable_success = media.encodings.filter(successful_playable_encodings_q(), status="success").exists()
    if media.media_type == "video" and media.encoding_status == "success" and not getattr(settings, "DO_NOT_TRANSCODE_VIDEO", False) and not playable_success:
        warnings.append("missing playable encodings")

    # --- HLS ---
    if media.hls_file:
        if not _path_exists(media.hls_file):
            warnings.append("HLS missing on disk")
    elif media.media_type == "video" and media.encoding_status == "success" and playable_success and not getattr(settings, "DO_NOT_TRANSCODE_VIDEO", False):
        warnings.append("missing HLS")

    # --- Subtitles / VTT ---
    for subtitle in Subtitle.objects.filter(media=media).select_related("language"):
        sub_path = _filefield_path(subtitle.subtitle_file)
        if subtitle.subtitle_file and not _path_exists(sub_path):
            lang = getattr(subtitle.language, "code", None) or getattr(subtitle.language, "title", None) or subtitle.pk
            warnings.append(f"subtitle:{lang} missing on disk")

    # --- Related derivative paths ---
    _check_related_path("sprites", _filefield_path(media.sprites), warnings)
    _check_related_path("poster", _filefield_path(media.poster), warnings)
    _check_related_path("thumbnail", _filefield_path(media.thumbnail), warnings)
    if media.preview_file_path:
        _check_related_path("preview", media.preview_file_path, warnings)

    if media_updates:
        Media.objects.filter(pk=media.pk).update(**media_updates)
        for key, value in media_updates.items():
            setattr(media, key, value)

    refresh_summary = _truncate_summary(filled, "no missing metadata")
    record_moderation_action(user, media, "metadata_refresh", extra_info=refresh_summary)

    if warnings:
        warn_summary = _truncate_summary(warnings, "")
        record_moderation_action(user, media, "integrity_warning", extra_info=warn_summary)

    return {"filled": filled, "warnings": warnings}


def qs_missing_media_metadata(base: Optional[QuerySet] = None) -> QuerySet:
    """Media with a media_file set but blank md5sum or size (DB-cheap)."""
    qs = base if base is not None else Media.objects.all()
    return qs.exclude(media_file="").exclude(media_file__isnull=True).filter(Q(md5sum__isnull=True) | Q(md5sum="") | Q(size__isnull=True) | Q(size=""))


def count_recent_integrity_warnings(days: int = INTEGRITY_WARNING_LOOKBACK_DAYS) -> int:
    from actions.models import MediaAction

    since = timezone.now() - timedelta(days=days)
    return MediaAction.objects.filter(action="integrity_warning", action_date__gte=since).count()


def iter_metadata_health_checks(base: Optional[QuerySet] = None) -> Iterable[dict]:
    """Site Health payloads that do not require a live filesystem scan."""
    missing_count = qs_missing_media_metadata(base).count()
    media_link = reverse("admin:files_media_changelist") + f"?{MISSING_METADATA_FILTER_PARAM}=1"
    if missing_count:
        yield {
            "check_id": "missing_media_metadata",
            "label": "Missing media metadata",
            "status": "warn",
            "detail": f"{missing_count} media item(s) missing md5sum or size.",
            "link": media_link,
        }
    else:
        yield {
            "check_id": "missing_media_metadata",
            "label": "Missing media metadata",
            "status": "ok",
            "detail": "All media with files have md5sum and size.",
            "link": media_link,
        }

    warning_count = count_recent_integrity_warnings()
    action_link = reverse("admin:actions_mediaaction_changelist") + "?action__exact=integrity_warning"
    days = INTEGRITY_WARNING_LOOKBACK_DAYS
    if warning_count:
        yield {
            "check_id": "recent_integrity_warnings",
            "label": "Recent integrity warnings",
            "status": "warn",
            "detail": f"{warning_count} integrity warning(s) in the last {days} days.",
            "link": action_link,
        }
    else:
        yield {
            "check_id": "recent_integrity_warnings",
            "label": "Recent integrity warnings",
            "status": "ok",
            "detail": f"No integrity warnings in the last {days} days.",
            "link": action_link,
        }
