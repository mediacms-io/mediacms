"""Media/process integrity checks for site health and admin drill-in.

No model or schema changes — conditions are derived from existing rows.
Shared by get_site_health_checks, MediaAdmin filters, and populate_fake_media.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Callable, Iterable, Optional

from django.conf import settings
from django.db.models import Count, Exists, OuterRef, Q, QuerySet
from django.urls import reverse
from django.utils import timezone

from files.models import Encoding, Media, Subtitle, TranscriptionRequest
from files.models.utils import PREVIEW_PROFILE_NAME

INTEGRITY_TITLE_MARKER = "[integrity:{check_id}]"
INTEGRITY_FILTER_PARAM = "integrity"


def successful_playable_encodings_q() -> Q:
    """Non-chunk mp4/webm encodings excluding preview — same gate as set_encoding_status."""
    return Q(chunk=False) & (Q(profile__extension="mp4") | Q(profile__extension="webm")) & ~Q(profile__name=PREVIEW_PROFILE_NAME)


def mark_integrity_title(title: str, check_id: str) -> str:
    marker = INTEGRITY_TITLE_MARKER.format(check_id=check_id)
    if marker in (title or ""):
        return title
    combined = f"{marker} {title or ''}".strip()
    return combined[:100]


def expected_listable(state: str, encoding_status: str, is_reviewed: bool) -> bool:
    return state == "public" and encoding_status == "success" and is_reviewed is True


def media_queryset(base: Optional[QuerySet] = None) -> QuerySet:
    return base if base is not None else Media.objects.all()


def qs_video_success_no_encoding(base: Optional[QuerySet] = None) -> QuerySet:
    """Video marked success but no successful playable Encoding row.

    Skipped when DO_NOT_TRANSCODE_VIDEO is enabled — originals are served directly.
    """
    if getattr(settings, "DO_NOT_TRANSCODE_VIDEO", False):
        return media_queryset(base).none()

    success_encoding = Encoding.objects.filter(
        media_id=OuterRef("pk"),
        status="success",
    ).filter(successful_playable_encodings_q())
    return media_queryset(base).filter(media_type="video", encoding_status="success").annotate(_has_success_encoding=Exists(success_encoding)).filter(_has_success_encoding=False)


def qs_listable_mismatch(base: Optional[QuerySet] = None) -> QuerySet:
    """listable disagrees with public ∧ success ∧ reviewed."""
    qs = media_queryset(base)
    should_be_listable = Q(state="public", encoding_status="success", is_reviewed=True)
    wrongly_listable = Q(listable=True) & ~should_be_listable
    wrongly_unlistable = Q(listable=False) & should_be_listable
    return qs.filter(wrongly_listable | wrongly_unlistable)


def qs_nonvideo_not_success(base: Optional[QuerySet] = None) -> QuerySet:
    """Image/pdf/audio should be forced to success by media_init."""
    return media_queryset(base).filter(media_type__in=["image", "pdf", "audio"]).exclude(encoding_status="success")


def qs_video_queued_no_rows(base: Optional[QuerySet] = None) -> QuerySet:
    """Video pending/running with zero Encoding rows — encode never queued or wiped."""
    if getattr(settings, "DO_NOT_TRANSCODE_VIDEO", False):
        return media_queryset(base).none()
    return media_queryset(base).filter(media_type="video", encoding_status__in=["pending", "running"]).annotate(_encodings_count=Count("encodings")).filter(_encodings_count=0)


def qs_nonvideo_has_encodings(base: Optional[QuerySet] = None) -> QuerySet:
    """Image/pdf never run encode on upload; any Encoding row is unexpected."""
    return media_queryset(base).filter(media_type__in=["image", "pdf"]).annotate(_encodings_count=Count("encodings")).filter(_encodings_count__gt=0)


def qs_transcription_success_no_subtitle(base: Optional[QuerySet] = None) -> QuerySet:
    """Caption request marked success but media has no Subtitle rows."""
    success_request = TranscriptionRequest.objects.filter(media_id=OuterRef("pk"), status="success")
    has_subtitle = Subtitle.objects.filter(media_id=OuterRef("pk"))
    return media_queryset(base).annotate(_has_success_tr=Exists(success_request), _has_subtitle=Exists(has_subtitle)).filter(_has_success_tr=True, _has_subtitle=False)


def qs_stale_encoding_running(base: Optional[QuerySet] = None) -> QuerySet:
    """Media with Encoding rows stuck in running past RUNNING_STATE_STALE."""
    stale_seconds = getattr(settings, "RUNNING_STATE_STALE", 60 * 60 * 2)
    threshold = timezone.now() - timedelta(seconds=stale_seconds)
    stale = Encoding.objects.filter(media_id=OuterRef("pk"), status="running", update_date__lt=threshold)
    return media_queryset(base).annotate(_has_stale_running=Exists(stale)).filter(_has_stale_running=True)


@dataclass(frozen=True)
class IntegrityCheck:
    id: str
    label: str
    severity: str  # warn / fail / info when count > 0
    ok_detail: str
    problem_detail: str  # use {count} placeholder
    queryset: Callable[[Optional[QuerySet]], QuerySet]
    seed: Optional[Callable[[list[Media], int], list[Media]]] = None

    def count(self, base: Optional[QuerySet] = None) -> int:
        return self.queryset(base).count()

    def admin_link(self) -> str:
        return reverse("admin:files_media_changelist") + f"?{INTEGRITY_FILTER_PARAM}={self.id}"

    def health_payload(self, base: Optional[QuerySet] = None) -> dict:
        count = self.count(base)
        if count:
            return {
                "check_id": f"integrity_{self.id}",
                "label": self.label,
                "status": self.severity,
                "detail": self.problem_detail.format(count=count),
                "link": self.admin_link(),
            }
        return {
            "check_id": f"integrity_{self.id}",
            "label": self.label,
            "status": "ok",
            "detail": self.ok_detail,
            "link": self.admin_link(),
        }


def _pick_victims(candidates: list[Media], used_ids: set[int], count: int) -> list[Media]:
    victims = []
    for media in candidates:
        if media.pk in used_ids:
            continue
        victims.append(media)
        used_ids.add(media.pk)
        if len(victims) >= count:
            break
    return victims


def _apply_title_marker(media: Media, check_id: str) -> None:
    new_title = mark_integrity_title(media.title, check_id)
    Media.objects.filter(pk=media.pk).update(title=new_title)
    media.title = new_title


def seed_video_success_no_encoding(created_media: list[Media], count: int = 1, used_ids: Optional[set[int]] = None) -> list[Media]:
    if getattr(settings, "DO_NOT_TRANSCODE_VIDEO", False):
        return []
    used_ids = used_ids if used_ids is not None else set()
    candidates = [m for m in created_media if m.media_type == "video"]
    victims = _pick_victims(candidates, used_ids, count)
    for media in victims:
        Encoding.objects.filter(media=media).delete()
        Media.objects.filter(pk=media.pk).update(encoding_status="success")
        # Recalculate listable consistently then leave encodings missing.
        media.refresh_from_db()
        media.encoding_status = "success"
        media.save(update_fields=["encoding_status", "listable", "state", "is_reviewed"])
        _apply_title_marker(media, "video_success_no_encoding")
    return victims


def seed_listable_mismatch(created_media: list[Media], count: int = 1, used_ids: Optional[set[int]] = None) -> list[Media]:
    used_ids = used_ids if used_ids is not None else set()
    # Prefer public+success+reviewed so flipping listable=False is a clear mismatch.
    candidates = [m for m in created_media if expected_listable(m.state, m.encoding_status, m.is_reviewed)]
    if not candidates:
        candidates = list(created_media)
    victims = _pick_victims(candidates, used_ids, count)
    for media in victims:
        # Bypass Media.save() which always recomputes listable from state/encoding/review.
        if expected_listable(media.state, media.encoding_status, media.is_reviewed):
            Media.objects.filter(pk=media.pk).update(listable=False)
        else:
            # Force wrongly listable while keeping a non-listable state.
            Media.objects.filter(pk=media.pk).update(state="private", listable=True)
        _apply_title_marker(media, "listable_mismatch")
        media.refresh_from_db()
    return victims


def seed_nonvideo_not_success(created_media: list[Media], count: int = 1, used_ids: Optional[set[int]] = None) -> list[Media]:
    used_ids = used_ids if used_ids is not None else set()
    candidates = [m for m in created_media if m.media_type in ("image", "pdf", "audio")]
    victims = _pick_victims(candidates, used_ids, count)
    for media in victims:
        Media.objects.filter(pk=media.pk).update(encoding_status="pending", listable=False)
        _apply_title_marker(media, "nonvideo_not_success")
        media.refresh_from_db()
    return victims


def seed_video_queued_no_rows(created_media: list[Media], count: int = 1, used_ids: Optional[set[int]] = None) -> list[Media]:
    if getattr(settings, "DO_NOT_TRANSCODE_VIDEO", False):
        return []
    used_ids = used_ids if used_ids is not None else set()
    candidates = [m for m in created_media if m.media_type == "video"]
    victims = _pick_victims(candidates, used_ids, count)
    for media in victims:
        Encoding.objects.filter(media=media).delete()
        Media.objects.filter(pk=media.pk).update(encoding_status="pending", listable=False)
        _apply_title_marker(media, "video_queued_no_rows")
        media.refresh_from_db()
    return victims


def _playable_encode_profile():
    from files.models import EncodeProfile

    profile = EncodeProfile.objects.filter(extension="mp4").exclude(name=PREVIEW_PROFILE_NAME).first()
    if profile is not None:
        return profile
    return EncodeProfile.objects.create(
        name="integrity-seed-h264-240",
        extension="mp4",
        resolution=240,
        codec="h264",
        active=True,
    )


def seed_nonvideo_has_encodings(created_media: list[Media], count: int = 1, used_ids: Optional[set[int]] = None) -> list[Media]:
    used_ids = used_ids if used_ids is not None else set()
    profile = _playable_encode_profile()
    candidates = [m for m in created_media if m.media_type in ("image", "pdf")]
    victims = _pick_victims(candidates, used_ids, count)
    for media in victims:
        Encoding.objects.get_or_create(media=media, profile=profile, defaults={"status": "pending"})
        _apply_title_marker(media, "nonvideo_has_encodings")
        media.refresh_from_db()
    return victims


def seed_transcription_success_no_subtitle(created_media: list[Media], count: int = 1, used_ids: Optional[set[int]] = None) -> list[Media]:
    used_ids = used_ids if used_ids is not None else set()
    candidates = [m for m in created_media if m.media_type in ("video", "audio")]
    victims = _pick_victims(candidates, used_ids, count)
    for media in victims:
        Subtitle.objects.filter(media=media).delete()
        TranscriptionRequest.objects.filter(media=media).delete()
        TranscriptionRequest.objects.create(media=media, status="success", translate_to_english=False)
        _apply_title_marker(media, "transcription_success_no_subtitle")
        media.refresh_from_db()
    return victims


def seed_stale_encoding_running(created_media: list[Media], count: int = 1, used_ids: Optional[set[int]] = None) -> list[Media]:
    used_ids = used_ids if used_ids is not None else set()
    profile = _playable_encode_profile()
    candidates = [m for m in created_media if m.media_type == "video"]
    victims = _pick_victims(candidates, used_ids, count)
    stale_seconds = getattr(settings, "RUNNING_STATE_STALE", 60 * 60 * 2)
    stale_time = timezone.now() - timedelta(seconds=stale_seconds + 60)
    for media in victims:
        encoding, _created = Encoding.objects.get_or_create(
            media=media,
            profile=profile,
            chunk=False,
            defaults={"status": "running"},
        )
        Encoding.objects.filter(pk=encoding.pk).update(status="running", update_date=stale_time)
        Media.objects.filter(pk=media.pk).update(encoding_status="running", listable=False)
        _apply_title_marker(media, "stale_encoding_running")
        media.refresh_from_db()
    return victims


INTEGRITY_CHECKS: tuple[IntegrityCheck, ...] = (
    IntegrityCheck(
        id="video_success_no_encoding",
        label="Video success without encodings",
        severity="warn",
        ok_detail="No successful videos are missing playable encodings.",
        problem_detail="{count} video(s) marked success with no successful playable encoding.",
        queryset=qs_video_success_no_encoding,
        seed=seed_video_success_no_encoding,
    ),
    IntegrityCheck(
        id="listable_mismatch",
        label="Listable flag mismatch",
        severity="warn",
        ok_detail="listable matches public + success + reviewed for all media.",
        problem_detail="{count} media item(s) have a listable value that does not match state/encoding/review.",
        queryset=qs_listable_mismatch,
        seed=seed_listable_mismatch,
    ),
    IntegrityCheck(
        id="nonvideo_not_success",
        label="Non-video encoding not success",
        severity="warn",
        ok_detail="All image/pdf/audio items have encoding_status=success.",
        problem_detail="{count} image/pdf/audio item(s) are pending, running, or failed.",
        queryset=qs_nonvideo_not_success,
        seed=seed_nonvideo_not_success,
    ),
    IntegrityCheck(
        id="video_queued_no_rows",
        label="Queued video without Encoding rows",
        severity="warn",
        ok_detail="Pending/running videos all have Encoding rows.",
        problem_detail="{count} pending/running video(s) have no Encoding rows.",
        queryset=qs_video_queued_no_rows,
        seed=seed_video_queued_no_rows,
    ),
    IntegrityCheck(
        id="nonvideo_has_encodings",
        label="Image/PDF with Encoding rows",
        severity="warn",
        ok_detail="No image/pdf items have Encoding rows.",
        problem_detail="{count} image/pdf item(s) unexpectedly have Encoding rows.",
        queryset=qs_nonvideo_has_encodings,
        seed=seed_nonvideo_has_encodings,
    ),
    IntegrityCheck(
        id="transcription_success_no_subtitle",
        label="Caption request success without subtitle",
        severity="info",
        ok_detail="Successful caption requests all have subtitle files.",
        problem_detail="{count} media item(s) have a successful caption request but no subtitle.",
        queryset=qs_transcription_success_no_subtitle,
        seed=seed_transcription_success_no_subtitle,
    ),
    IntegrityCheck(
        id="stale_encoding_running",
        label="Stale running encodings",
        severity="warn",
        ok_detail="No Encoding rows are stuck in running past the stale threshold.",
        problem_detail="{count} media item(s) have Encoding rows stuck in running.",
        queryset=qs_stale_encoding_running,
        seed=seed_stale_encoding_running,
    ),
)


INTEGRITY_CHECKS_BY_ID = {check.id: check for check in INTEGRITY_CHECKS}


def get_integrity_check(check_id: str) -> Optional[IntegrityCheck]:
    return INTEGRITY_CHECKS_BY_ID.get(check_id)


def iter_integrity_health_checks(base: Optional[QuerySet] = None) -> Iterable[dict]:
    for check in INTEGRITY_CHECKS:
        yield check.health_payload(base)


def inject_integrity_faults(created_media: list[Media], per_check: int = 1) -> dict[str, list[Media]]:
    """Apply sparse intentional faults for health-check verification.

    Returns a mapping of check_id → affected media.
    """
    per_check = max(0, min(int(per_check), 2))
    if per_check == 0 or not created_media:
        return {}

    used_ids: set[int] = set()
    injected: dict[str, list[Media]] = {}
    for check in INTEGRITY_CHECKS:
        if check.seed is None:
            continue
        victims = check.seed(created_media, per_check, used_ids)
        if victims:
            injected[check.id] = victims
    return injected
