from collections import defaultdict
from datetime import timedelta
from urllib.parse import urlparse

from django.conf import settings
from django.contrib.sites.models import Site
from django.core.cache import cache
from django.db.models import Count, Q, Sum
from django.db.models.functions import Coalesce
from django.urls import reverse
from django.utils import timezone

from actions.models import MODERATION_MEDIA_ACTIONS, MediaAction
from files.models import (
    Category,
    Comment,
    EncodeProfile,
    Encoding,
    Language,
    License,
    Media,
    MediaPermission,
    Page,
    Playlist,
    Subtitle,
    Tag,
    TranscriptionRequest,
    VideoTrimRequest,
)
from users.models import Channel, User

# Report-related moderator audit events shown on the dashboard (excludes user "report"
# submissions and media approval reviews, which have their own tiles).
REPORT_AUDIT_ACTIONS = tuple(name for name, _label in MODERATION_MEDIA_ACTIONS if name not in ("media_reviewed",))
REPORT_AUDIT_ACTION_LABELS = dict(MODERATION_MEDIA_ACTIONS)

DASHBOARD_STATS_CACHE_KEY = "admin_dashboard_stats_v4"
DASHBOARD_STATS_CACHE_TTL = 60


def format_upload_size(megabytes):
    """Format a summed upload size. Stored values are decimal megabytes."""
    megabytes = float(megabytes or 0)
    if megabytes >= 1000:
        return f"{megabytes / 1000:.1f} GB"
    return f"{megabytes:.1f} MB"


def invalidate_dashboard_stats_cache():
    cache.delete(DASHBOARD_STATS_CACHE_KEY)


def calculate_statistics(*, force_refresh=False):
    """Calculate all dashboard statistics, with a short-lived Redis cache."""
    if not force_refresh:
        cached = cache.get(DASHBOARD_STATS_CACHE_KEY)
        if cached is not None:
            return cached

    now = timezone.now()
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)

    media_stats = get_media_statistics()
    stats = {
        "media": media_stats,
        "moderation": get_moderation_statistics(seven_days_ago, media_stats=media_stats),
        "engagement": get_engagement_statistics(seven_days_ago, media_stats=media_stats),
        "users": get_user_statistics(seven_days_ago, thirty_days_ago),
        "system": get_system_statistics(media_stats=media_stats),
    }
    cache.set(DASHBOARD_STATS_CACHE_KEY, stats, DASHBOARD_STATS_CACHE_TTL)
    return stats


def get_media_statistics():
    """Calculate media-related statistics with a single aggregate query."""
    media_stats = {}
    seven_days_ago = timezone.now() - timedelta(days=7)
    aggregates = Media.objects.aggregate(
        total=Count("id"),
        video=Count("id", filter=Q(media_type="video")),
        audio=Count("id", filter=Q(media_type="audio")),
        image=Count("id", filter=Q(media_type="image")),
        pdf=Count("id", filter=Q(media_type="pdf")),
        public=Count("id", filter=Q(state="public")),
        private=Count("id", filter=Q(state="private")),
        unlisted=Count("id", filter=Q(state="unlisted")),
        pending=Count("id", filter=Q(encoding_status="pending")),
        running=Count("id", filter=Q(encoding_status="running")),
        success=Count("id", filter=Q(encoding_status="success")),
        fail=Count("id", filter=Q(encoding_status="fail")),
        featured=Count("id", filter=Q(featured=True)),
        reported_media=Count("id", filter=Q(reported_times__gt=0)),
        reported_above_threshold=Count(
            "id",
            filter=Q(reported_times__gte=getattr(settings, "REPORTED_TIMES_THRESHOLD", 10)),
        ),
        unreviewed=Count("id", filter=Q(is_reviewed=False)),
        added_last_7_days=Count("id", filter=Q(add_date__gte=seven_days_ago)),
        total_views=Coalesce(Sum("views"), 0),
        total_likes=Coalesce(Sum("likes"), 0),
        total_dislikes=Coalesce(Sum("dislikes"), 0),
    )

    media_stats["total"] = aggregates["total"]
    media_stats["by_type"] = {
        "video": aggregates["video"],
        "audio": aggregates["audio"],
        "image": aggregates["image"],
        "pdf": aggregates["pdf"],
    }
    media_stats["by_state"] = {
        "public": aggregates["public"],
        "private": aggregates["private"],
        "unlisted": aggregates["unlisted"],
    }
    media_stats["by_encoding_status"] = {
        "pending": aggregates["pending"],
        "running": aggregates["running"],
        "success": aggregates["success"],
        "fail": aggregates["fail"],
    }
    media_stats["failed"] = aggregates["fail"]
    media_stats["encoding_queue"] = aggregates["pending"] + aggregates["running"]
    media_stats["featured"] = aggregates["featured"]
    media_stats["added_last_7_days"] = aggregates["added_last_7_days"]
    media_stats["total_views"] = aggregates["total_views"]
    media_stats["reported_media"] = aggregates["reported_media"]
    media_stats["reported_above_threshold"] = aggregates["reported_above_threshold"]
    media_stats["unreviewed"] = aggregates["unreviewed"]
    media_stats["total_likes"] = aggregates["total_likes"]
    media_stats["total_dislikes"] = aggregates["total_dislikes"]

    recent_upload_values = ("id", "title", "add_date", "friendly_token", "user_id", "user__username")
    media_stats["recent_by_type"] = {
        media_type: list(Media.objects.filter(media_type=media_type).order_by("-add_date")[:5].values(*recent_upload_values)) for media_type in ("video", "audio", "image", "pdf")
    }

    return media_stats


def get_moderation_statistics(seven_days_ago, media_stats=None):
    """Calculate content moderation statistics"""
    moderation_stats = {}
    reported_threshold = getattr(settings, "REPORTED_TIMES_THRESHOLD", 10)
    moderation_stats["reported_threshold"] = reported_threshold

    if media_stats is None:
        media_counts = Media.objects.aggregate(
            reported_media=Count("id", filter=Q(reported_times__gt=0)),
            reported_above_threshold=Count("id", filter=Q(reported_times__gte=reported_threshold)),
            unreviewed=Count("id", filter=Q(is_reviewed=False)),
        )
        moderation_stats["reported_media"] = media_counts["reported_media"]
        moderation_stats["reported_above_threshold"] = media_counts["reported_above_threshold"]
        moderation_stats["unreviewed"] = media_counts["unreviewed"]
    else:
        moderation_stats["reported_media"] = media_stats["reported_media"]
        moderation_stats["reported_above_threshold"] = media_stats["reported_above_threshold"]
        moderation_stats["unreviewed"] = media_stats["unreviewed"]

    action_counts = MediaAction.objects.aggregate(
        clears_last_7_days=Count("id", filter=Q(action="report_cleared", action_date__gte=seven_days_ago)),
        confirms_last_7_days=Count("id", filter=Q(action="report_confirmed", action_date__gte=seven_days_ago)),
        approved_last_7_days=Count("id", filter=Q(action="media_reviewed", action_date__gte=seven_days_ago)),
    )
    moderation_stats.update(action_counts)

    recent_moderation_values = (
        "id",
        "action",
        "action_date",
        "extra_info",
        "user_id",
        "user__username",
        "media_id",
        "media__title",
        "media__friendly_token",
    )

    moderation_stats["recent_reports"] = list(MediaAction.objects.filter(action="report").order_by("-action_date")[:5].values(*recent_moderation_values))
    recent_report_audits = list(MediaAction.objects.filter(action__in=REPORT_AUDIT_ACTIONS).order_by("-action_date")[:5].values(*recent_moderation_values))
    for row in recent_report_audits:
        row["action_label"] = REPORT_AUDIT_ACTION_LABELS.get(row["action"], row["action"])
    moderation_stats["recent_report_audits"] = recent_report_audits
    moderation_stats["recent_pending_review"] = list(Media.objects.filter(is_reviewed=False).order_by("-add_date")[:5].values("id", "title", "add_date", "user_id", "user__username", "friendly_token"))
    moderation_stats["recent_approved"] = list(MediaAction.objects.filter(action="media_reviewed").order_by("-action_date")[:5].values(*recent_moderation_values))

    return moderation_stats


def get_engagement_statistics(seven_days_ago, media_stats=None):
    """Calculate engagement metrics"""
    engagement_stats = {}

    comment_counts = Comment.objects.aggregate(
        total_comments=Count("id"),
        recent_comments=Count("id", filter=Q(add_date__gte=seven_days_ago)),
    )
    engagement_stats["total_comments"] = comment_counts["total_comments"]
    engagement_stats["recent_comments"] = comment_counts["recent_comments"]

    if media_stats is None:
        sums = Media.objects.aggregate(
            total_likes=Coalesce(Sum("likes"), 0),
            total_dislikes=Coalesce(Sum("dislikes"), 0),
        )
        engagement_stats["total_likes"] = sums["total_likes"]
        engagement_stats["total_dislikes"] = sums["total_dislikes"]
    else:
        engagement_stats["total_likes"] = media_stats["total_likes"]
        engagement_stats["total_dislikes"] = media_stats["total_dislikes"]

    engagement_stats["most_liked"] = list(Media.objects.order_by("-likes")[:5].values("id", "title", "likes", "friendly_token"))
    engagement_stats["most_viewed"] = list(Media.objects.order_by("-views")[:5].values("id", "title", "views", "friendly_token"))
    engagement_stats["most_disliked"] = list(Media.objects.order_by("-dislikes")[:5].values("id", "title", "dislikes", "friendly_token"))

    # Prefer grouping comments (smaller table) over annotating every Media row.
    top_commented = list(
        Comment.objects.values("media_id", "media__title", "media__friendly_token")
        .annotate(comment_count=Count("id"))
        .filter(comment_count__gt=0, media_id__isnull=False)
        .order_by("-comment_count")[:5]
    )
    engagement_stats["most_commented"] = [
        {
            "id": row["media_id"],
            "title": row["media__title"],
            "comment_count": row["comment_count"],
            "friendly_token": row["media__friendly_token"],
        }
        for row in top_commented
    ]

    return engagement_stats


def _top_uploaders_by_size(limit=5):
    """Sum Media.size display strings in Python to avoid SQL regex scans."""
    totals = defaultdict(lambda: {"username": "", "upload_mb": 0.0})
    for user_id, username, size in Media.objects.exclude(size="").values_list("user_id", "user__username", "size"):
        if not user_id or not size or not size.endswith("MB"):
            continue
        try:
            megabytes = float(size[:-2])
        except ValueError:
            continue
        totals[user_id]["username"] = username
        totals[user_id]["upload_mb"] += megabytes

    ranked = sorted(totals.items(), key=lambda item: item[1]["upload_mb"], reverse=True)[:limit]
    result = []
    for user_id, payload in ranked:
        if payload["upload_mb"] <= 0:
            continue
        result.append(
            {
                "id": user_id,
                "username": payload["username"],
                "upload_mb": payload["upload_mb"],
                "upload_size_label": format_upload_size(payload["upload_mb"]),
            }
        )
    return result


def get_user_statistics(seven_days_ago, thirty_days_ago):
    """Calculate user-related statistics"""
    user_stats = {}

    pending_q = Q(is_approved=False) | Q(is_approved__isnull=True)
    aggregates = User.objects.aggregate(
        total=Count("id"),
        registered_last_7_days=Count("id", filter=Q(date_added__gte=seven_days_ago)),
        registered_last_30_days=Count("id", filter=Q(date_added__gte=thirty_days_ago)),
        inactive_users=Count("id", filter=Q(is_active=False)),
        superusers=Count("id", filter=Q(is_superuser=True)),
        staff_users=Count("id", filter=Q(is_staff=True)),
        editors=Count("id", filter=Q(is_editor=True)),
        managers=Count("id", filter=Q(is_manager=True)),
        regular_users=Count(
            "id",
            filter=Q(
                is_superuser=False,
                is_staff=False,
                is_editor=False,
                is_manager=False,
            ),
        ),
        pending_approvals=Count("id", filter=pending_q),
        approved_users=Count("id", filter=Q(is_approved=True)),
    )
    user_stats.update(
        {
            "total": aggregates["total"],
            "registered_last_7_days": aggregates["registered_last_7_days"],
            "registered_last_30_days": aggregates["registered_last_30_days"],
            "inactive_users": aggregates["inactive_users"],
            "superusers": aggregates["superusers"],
            "staff_users": aggregates["staff_users"],
            "editors": aggregates["editors"],
            "managers": aggregates["managers"],
            "regular_users": aggregates["regular_users"],
        }
    )
    user_stats["active_users"] = User.objects.filter(media__add_date__gte=thirty_days_ago).distinct().count()
    user_stats["recent_registered"] = list(User.objects.order_by("-date_added")[:10].values("id", "username", "date_added"))
    # Prefer indexed last_login over Greatest/Max joins across media/actions/comments.
    user_stats["recent_activity"] = [
        {"id": row["id"], "username": row["username"], "last_activity": row["last_login"]}
        for row in User.objects.filter(last_login__isnull=False).order_by("-last_login")[:10].values("id", "username", "last_login")
    ]

    user_stats["top_uploaders"] = list(
        User.objects.annotate(media_count_annotated=Count("media")).filter(media_count_annotated__gt=0).order_by("-media_count_annotated")[:5].values("id", "username", "media_count_annotated")
    )
    user_stats["top_uploaders_by_size"] = _top_uploaders_by_size()

    approval_enabled = getattr(settings, "USERS_NEEDS_TO_BE_APPROVED", False)
    user_stats["approval_workflow_enabled"] = approval_enabled
    if approval_enabled:
        user_stats["pending_approvals"] = aggregates["pending_approvals"]
        user_stats["approved_users"] = aggregates["approved_users"]
        user_stats["recent_pending_users"] = list(User.objects.filter(pending_q).order_by("-date_added")[:5].values("id", "username", "date_added"))
    else:
        user_stats["pending_approvals"] = 0
        user_stats["approved_users"] = 0
        user_stats["recent_pending_users"] = []

    user_stats["top_commenters"] = list(Comment.objects.exclude(user=None).values("user_id", "user__username").annotate(comment_count=Count("id")).order_by("-comment_count")[:5])
    user_stats["top_likers"] = list(MediaAction.objects.filter(action="like").exclude(user=None).values("user_id", "user__username").annotate(action_count=Count("id")).order_by("-action_count")[:5])
    user_stats["top_dislikers"] = list(
        MediaAction.objects.filter(action="dislike").exclude(user=None).values("user_id", "user__username").annotate(action_count=Count("id")).order_by("-action_count")[:5]
    )
    user_stats["top_reporters"] = list(
        MediaAction.objects.filter(action="report").exclude(user=None).values("user_id", "user__username").annotate(action_count=Count("id")).order_by("-action_count")[:5]
    )

    return user_stats


def _frontend_host_parts():
    """Return (scheme, hostname) for FRONTEND_HOST, ignoring path/port noise."""
    raw = (getattr(settings, "FRONTEND_HOST", "") or "").strip()
    if not raw:
        return "", ""
    parsed = urlparse(raw if "://" in raw else f"http://{raw}")
    host = (parsed.hostname or parsed.path.split("/")[0] or "").rstrip(".")
    return (parsed.scheme or "").lower(), host.lower()


def _health_check(check_id, label, status, detail, link=None):
    return {
        "id": check_id,
        "label": label,
        "status": status,
        "detail": detail,
        "link": link,
    }


def get_site_health_checks(media_stats=None):
    """Lightweight configuration and dependency checks for Site overview."""
    checks = []
    site = Site.objects.filter(id=getattr(settings, "SITE_ID", 1)).first() or Site.objects.first()
    portal_name = getattr(settings, "PORTAL_NAME", "") or ""
    frontend_scheme, frontend_host = _frontend_host_parts()
    site_change_url = reverse("admin:sites_site_change", args=[site.pk]) if site else None

    if site is None:
        checks.append(_health_check("django_site", "Django site record", "fail", "No django.contrib.sites Site row exists."))
    else:
        if site.name == portal_name:
            checks.append(
                _health_check(
                    "site_name",
                    "Site name matches PORTAL_NAME",
                    "ok",
                    f'Site.name and PORTAL_NAME are both "{portal_name}".',
                    link=site_change_url,
                )
            )
        else:
            checks.append(
                _health_check(
                    "site_name",
                    "Site name matches PORTAL_NAME",
                    "warn",
                    f'Site.name is "{site.name}" but PORTAL_NAME is "{portal_name}".',
                    link=site_change_url,
                )
            )

        site_domain = (site.domain or "").split(":")[0].strip().lower().rstrip(".")
        if not frontend_host:
            checks.append(
                _health_check(
                    "site_domain",
                    "Site domain matches FRONTEND_HOST",
                    "warn",
                    "FRONTEND_HOST is empty, so the Site domain cannot be validated.",
                    link=site_change_url,
                )
            )
        elif site_domain == frontend_host:
            checks.append(
                _health_check(
                    "site_domain",
                    "Site domain matches FRONTEND_HOST",
                    "ok",
                    f'Site.domain and FRONTEND_HOST both resolve to "{frontend_host}".',
                    link=site_change_url,
                )
            )
        else:
            checks.append(
                _health_check(
                    "site_domain",
                    "Site domain matches FRONTEND_HOST",
                    "warn",
                    f'Site.domain is "{site.domain}" but FRONTEND_HOST host is "{frontend_host}".',
                    link=site_change_url,
                )
            )

    if getattr(settings, "DEBUG", False):
        checks.append(_health_check("debug", "DEBUG disabled", "warn", "DEBUG is True. Disable it for production deployments."))
    else:
        checks.append(_health_check("debug", "DEBUG disabled", "ok", "DEBUG is False."))

    allowed_hosts = [str(host).strip().lower() for host in getattr(settings, "ALLOWED_HOSTS", [])]
    if not frontend_host:
        checks.append(_health_check("allowed_hosts", "ALLOWED_HOSTS includes FRONTEND_HOST", "warn", "FRONTEND_HOST host is empty."))
    elif "*" in allowed_hosts:
        checks.append(
            _health_check(
                "allowed_hosts",
                "ALLOWED_HOSTS includes FRONTEND_HOST",
                "warn",
                'ALLOWED_HOSTS contains "*". Prefer an explicit host list in production.',
            )
        )
    elif any(host.endswith("/") for host in allowed_hosts):
        checks.append(
            _health_check(
                "allowed_hosts",
                "ALLOWED_HOSTS includes FRONTEND_HOST",
                "warn",
                "ALLOWED_HOSTS has an entry with a trailing slash. Host values should not include paths.",
            )
        )
    elif frontend_host in allowed_hosts:
        checks.append(
            _health_check(
                "allowed_hosts",
                "ALLOWED_HOSTS includes FRONTEND_HOST",
                "ok",
                f'ALLOWED_HOSTS includes "{frontend_host}".',
            )
        )
    else:
        checks.append(
            _health_check(
                "allowed_hosts",
                "ALLOWED_HOSTS includes FRONTEND_HOST",
                "fail",
                f'FRONTEND_HOST host "{frontend_host}" is not present in ALLOWED_HOSTS.',
            )
        )

    local_install = bool(getattr(settings, "LOCAL_INSTALL", False))
    if frontend_scheme == "https":
        checks.append(_health_check("frontend_https", "FRONTEND_HOST uses HTTPS", "ok", 'FRONTEND_HOST scheme is "https".'))
    elif local_install or getattr(settings, "DEBUG", False):
        checks.append(
            _health_check(
                "frontend_https",
                "FRONTEND_HOST uses HTTPS",
                "info",
                f'FRONTEND_HOST scheme is "{frontend_scheme or "missing"}" (acceptable for local/debug).',
            )
        )
    else:
        checks.append(
            _health_check(
                "frontend_https",
                "FRONTEND_HOST uses HTTPS",
                "warn",
                "FRONTEND_HOST is not HTTPS. Public deployments usually need HTTPS.",
            )
        )

    try:
        probe_key = "admin_dashboard_health_probe"
        cache.set(probe_key, "ok", 5)
        cache_ok = cache.get(probe_key) == "ok"
    except Exception as exc:  # noqa: BLE001 - surface cache/broker misconfig to admins
        cache_ok = False
        cache_error = str(exc)
    else:
        cache_error = ""
    if cache_ok:
        checks.append(_health_check("cache", "Cache / Redis reachable", "ok", "Cache backend accepted a short probe write/read."))
    else:
        checks.append(
            _health_check(
                "cache",
                "Cache / Redis reachable",
                "fail",
                cache_error or "Cache backend probe failed.",
            )
        )

    active_profiles = EncodeProfile.objects.filter(active=True).count()
    if active_profiles:
        checks.append(
            _health_check(
                "encode_profiles",
                "Active encode profiles",
                "ok",
                f"{active_profiles} active encode profile(s).",
                link=reverse("admin:files_encodeprofile_changelist"),
            )
        )
    else:
        checks.append(
            _health_check(
                "encode_profiles",
                "Active encode profiles",
                "fail",
                "No active encode profiles. Video transcoding will not run.",
                link=reverse("admin:files_encodeprofile_changelist"),
            )
        )

    superusers = User.objects.filter(is_superuser=True, is_active=True).count()
    if superusers:
        checks.append(
            _health_check(
                "superusers",
                "Active superuser exists",
                "ok",
                f"{superusers} active superuser(s).",
                link=reverse("admin:users_user_changelist") + "?is_superuser__exact=1",
            )
        )
    else:
        checks.append(
            _health_check(
                "superusers",
                "Active superuser exists",
                "fail",
                "No active superuser accounts found.",
                link=reverse("admin:users_user_changelist"),
            )
        )

    default_from = (getattr(settings, "DEFAULT_FROM_EMAIL", "") or "").strip()
    if not default_from or default_from.endswith("@mediacms.io"):
        checks.append(
            _health_check(
                "email_from",
                "DEFAULT_FROM_EMAIL configured",
                "warn",
                f'DEFAULT_FROM_EMAIL is "{default_from or "(empty)"}". Update it for production mail.',
            )
        )
    else:
        checks.append(_health_check("email_from", "DEFAULT_FROM_EMAIL configured", "ok", f'DEFAULT_FROM_EMAIL is "{default_from}".'))

    email_use_tls = bool(getattr(settings, "EMAIL_USE_TLS", False))
    email_use_ssl = bool(getattr(settings, "EMAIL_USE_SSL", False))
    if email_use_tls and email_use_ssl:
        checks.append(
            _health_check(
                "email_tls_ssl",
                "EMAIL_USE_TLS / EMAIL_USE_SSL exclusive",
                "fail",
                "EMAIL_USE_TLS and EMAIL_USE_SSL are both True. Only one may be True; set the other to False.",
            )
        )
    elif email_use_ssl:
        checks.append(
            _health_check(
                "email_tls_ssl",
                "EMAIL_USE_TLS / EMAIL_USE_SSL exclusive",
                "ok",
                "EMAIL_USE_SSL is True and EMAIL_USE_TLS is False.",
            )
        )
    elif email_use_tls:
        checks.append(
            _health_check(
                "email_tls_ssl",
                "EMAIL_USE_TLS / EMAIL_USE_SSL exclusive",
                "ok",
                "EMAIL_USE_TLS is True and EMAIL_USE_SSL is False.",
            )
        )
    else:
        checks.append(
            _health_check(
                "email_tls_ssl",
                "EMAIL_USE_TLS / EMAIL_USE_SSL exclusive",
                "info",
                "Neither EMAIL_USE_TLS nor EMAIL_USE_SSL is enabled.",
            )
        )

    failed = media_stats["failed"] if media_stats is not None else Media.objects.filter(encoding_status="fail").count()
    queue = media_stats["encoding_queue"] if media_stats is not None else Media.objects.filter(encoding_status__in=["pending", "running"]).count()
    if failed:
        checks.append(
            _health_check(
                "encoding_failures",
                "Encoding failures",
                "warn",
                f"{failed} media item(s) have failed encodings.",
                link=reverse("admin:files_media_changelist") + "?encoding_queue=fail",
            )
        )
    else:
        checks.append(_health_check("encoding_failures", "Encoding failures", "ok", "No failed encodings."))
    checks.append(
        _health_check(
            "encoding_queue",
            "Encoding queue",
            "info" if queue else "ok",
            f"{queue} media item(s) pending or running.",
            link=reverse("admin:files_media_changelist") + "?encoding_queue=yes",
        )
    )

    severity_order = {"fail": 0, "warn": 1, "info": 2, "ok": 3}
    checks.sort(key=lambda check: (severity_order.get(check["status"], 99), check["label"]))
    return checks


def get_site_configuration_status():
    """Expose common portal settings for troubleshooting (informational)."""
    return [
        {"label": "PORTAL_NAME", "value": str(getattr(settings, "PORTAL_NAME", ""))},
        {"label": "FRONTEND_HOST", "value": str(getattr(settings, "FRONTEND_HOST", ""))},
        {"label": "PORTAL_WORKFLOW", "value": str(getattr(settings, "PORTAL_WORKFLOW", ""))},
        {"label": "MEDIA_IS_REVIEWED", "value": str(getattr(settings, "MEDIA_IS_REVIEWED", True))},
        {"label": "CAN_ADD_MEDIA", "value": str(getattr(settings, "CAN_ADD_MEDIA", ""))},
        {"label": "CAN_COMMENT", "value": str(getattr(settings, "CAN_COMMENT", ""))},
        {"label": "USERS_NEEDS_TO_BE_APPROVED", "value": str(getattr(settings, "USERS_NEEDS_TO_BE_APPROVED", False))},
        {"label": "GLOBAL_LOGIN_REQUIRED", "value": str(getattr(settings, "GLOBAL_LOGIN_REQUIRED", False))},
        {"label": "ACCOUNT_EMAIL_VERIFICATION", "value": str(getattr(settings, "ACCOUNT_EMAIL_VERIFICATION", ""))},
        {"label": "EMAIL_USE_TLS", "value": str(getattr(settings, "EMAIL_USE_TLS", False))},
        {"label": "EMAIL_USE_SSL", "value": str(getattr(settings, "EMAIL_USE_SSL", False))},
        {"label": "USE_RBAC", "value": str(getattr(settings, "USE_RBAC", False))},
        {"label": "USE_SAML", "value": str(getattr(settings, "USE_SAML", False))},
        {"label": "USE_IDENTITY_PROVIDERS", "value": str(getattr(settings, "USE_IDENTITY_PROVIDERS", False))},
        {"label": "USE_LTI", "value": str(getattr(settings, "USE_LTI", False))},
        {"label": "USE_WHISPER_TRANSCRIBE", "value": str(getattr(settings, "USE_WHISPER_TRANSCRIBE", False))},
        {"label": "LOCAL_INSTALL", "value": str(getattr(settings, "LOCAL_INSTALL", False))},
        {"label": "DEBUG", "value": str(getattr(settings, "DEBUG", False))},
    ]


def get_system_statistics(media_stats=None):
    """Calculate system/infrastructure statistics, object totals, and site health."""
    object_totals = [
        {"label": "Media", "count": Media.objects.count(), "url": reverse("admin:files_media_changelist")},
        {"label": "Users", "count": User.objects.count(), "url": reverse("admin:users_user_changelist")},
        {"label": "Comments", "count": Comment.objects.count(), "url": reverse("admin:files_comment_changelist")},
        {"label": "Encodings", "count": Encoding.objects.count(), "url": reverse("admin:files_encoding_changelist")},
        {"label": "Media actions", "count": MediaAction.objects.count(), "url": reverse("admin:actions_mediaaction_changelist")},
        {"label": "Categories", "count": Category.objects.count(), "url": reverse("admin:files_category_changelist")},
        {"label": "Tags", "count": Tag.objects.count(), "url": reverse("admin:files_tag_changelist")},
        {"label": "Playlists", "count": Playlist.objects.count(), "url": reverse("admin:files_playlist_changelist")},
        {"label": "Channels", "count": Channel.objects.count(), "url": reverse("admin:users_channel_changelist")},
        {"label": "Pages", "count": Page.objects.count(), "url": reverse("admin:files_page_changelist")},
        {"label": "Captions", "count": Subtitle.objects.count(), "url": reverse("admin:files_subtitle_changelist")},
        {"label": "Caption Requests", "count": TranscriptionRequest.objects.count(), "url": reverse("admin:files_transcriptionrequest_changelist")},
        {"label": "Trim Requests", "count": VideoTrimRequest.objects.count(), "url": reverse("admin:files_videotrimrequest_changelist")},
        {"label": "Encode profiles", "count": EncodeProfile.objects.count(), "url": reverse("admin:files_encodeprofile_changelist")},
        {"label": "Licenses", "count": License.objects.count(), "url": reverse("admin:files_license_changelist")},
        {"label": "Languages", "count": Language.objects.count(), "url": reverse("admin:files_language_changelist")},
        {"label": "Media permissions", "count": MediaPermission.objects.count(), "url": reverse("admin:files_mediapermission_changelist")},
    ]

    totals_by_label = {item["label"]: item["count"] for item in object_totals}
    system_stats = {
        "total_channels": totals_by_label["Channels"],
        "total_categories": totals_by_label["Categories"],
        "total_playlists": totals_by_label["Playlists"],
        "total_tags": totals_by_label["Tags"],
        "total_pages": totals_by_label["Pages"],
        "object_totals": object_totals,
        "health_checks": get_site_health_checks(media_stats=media_stats),
        "configuration": get_site_configuration_status(),
    }
    system_stats["health_counts"] = {
        "ok": sum(1 for check in system_stats["health_checks"] if check["status"] == "ok"),
        "warn": sum(1 for check in system_stats["health_checks"] if check["status"] == "warn"),
        "fail": sum(1 for check in system_stats["health_checks"] if check["status"] == "fail"),
        "info": sum(1 for check in system_stats["health_checks"] if check["status"] == "info"),
    }

    if media_stats is None:
        encoding = Media.objects.aggregate(
            encoding_failures=Count("id", filter=Q(encoding_status="fail")),
            encoding_queue=Count("id", filter=Q(encoding_status__in=["pending", "running"])),
        )
        system_stats["encoding_failures"] = encoding["encoding_failures"]
        system_stats["encoding_queue"] = encoding["encoding_queue"]
    else:
        system_stats["encoding_failures"] = media_stats["failed"]
        system_stats["encoding_queue"] = media_stats["encoding_queue"]

    return system_stats
