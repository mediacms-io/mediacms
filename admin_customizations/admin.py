from collections import defaultdict
from datetime import timedelta

from allauth.socialaccount.models import SocialAccount, SocialApp
from django.conf import settings
from django.contrib.sites.models import Site
from django.core.cache import cache
from django.db.models import Count, Q, Sum
from django.db.models.functions import Coalesce
from django.urls import NoReverseMatch, reverse
from django.utils import timezone

from actions.models import MODERATION_MEDIA_ACTIONS, MediaAction
from admin_customizations.database_stats import get_database_statistics
from admin_customizations.deployment_health import (
    deployment_configuration_rows,
    frontend_host_parts,
    iter_deployment_health_checks,
    iter_media_storage_health_checks,
)
from admin_customizations.processing_stats import (
    get_migration_status_groups,
    get_processing_status_groups,
)
from admin_customizations.runtime_info import get_system_runtime_rows
from admin_customizations.status_health import iter_status_health_checks
from files.admin_helpers import MEDIA_ACTION_ICONS
from files.integrity import qs_duplicate_md5, qs_duplicate_name
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
from identity_providers.models import IdentityProviderUserLog, LoginOption
from lti.models import (
    LTILaunchLog,
    LTIPlatform,
    LTIResourceLink,
    LTIRoleMapping,
    LTIToolKeys,
    LTIUserMapping,
)
from saml_auth.models import SAMLConfiguration
from users.models import Channel, User

# Report-related moderator audit events shown on the dashboard (excludes user "report"
# submissions, media approval reviews, and filesystem integrity audits).
_REPORT_AUDIT_EXCLUDED = ("media_reviewed", "metadata_refresh", "integrity_warning")
REPORT_AUDIT_ACTIONS = tuple(name for name, _label in MODERATION_MEDIA_ACTIONS if name not in _REPORT_AUDIT_EXCLUDED)
REPORT_AUDIT_ACTION_LABELS = dict(MODERATION_MEDIA_ACTIONS)

DASHBOARD_STATS_CACHE_KEY = "admin_dashboard_stats_v15"
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
    integrations = get_integrations_statistics(seven_days_ago)
    stats = {
        "generated_at": now,
        "media": media_stats,
        "moderation": get_moderation_statistics(seven_days_ago, media_stats=media_stats),
        "engagement": get_engagement_statistics(seven_days_ago, media_stats=media_stats),
        "users": get_user_statistics(seven_days_ago, thirty_days_ago),
        "system": get_system_statistics(media_stats=media_stats, extra_checks=integrations["health_checks"]),
        "processing": {"status_groups": get_processing_status_groups()},
        "integrations": integrations,
        "database": get_database_statistics(),
    }
    cache.set(DASHBOARD_STATS_CACHE_KEY, stats, DASHBOARD_STATS_CACHE_TTL)
    return stats


def _status_count(groups, key, status):
    for group in groups:
        if group["key"] != key:
            continue
        for item in group["statuses"]:
            if item["key"] == status:
                return item["count"]
    return 0


def _changelist_url(model, query=""):
    """Changelist URL when the model is registered in the admin."""
    try:
        url = reverse(f"admin:{model._meta.app_label}_{model._meta.model_name}_changelist")
    except NoReverseMatch:
        return None
    if query:
        return f"{url}?{query}"
    return url


def _object_total(label, count, url, icon):
    if url is None:
        return None
    return {"label": label, "count": count, "url": url, "icon": icon}


def _count_health(checks):
    checks = list(checks)
    return {
        "ok": sum(1 for check in checks if check["status"] == "ok"),
        "warn": sum(1 for check in checks if check["status"] == "warn"),
        "fail": sum(1 for check in checks if check["status"] == "fail"),
        "info": sum(1 for check in checks if check["status"] == "info"),
    }


def _integration_check(check_id, label, problem, ok_detail, count, link, ok_kwargs=None):
    if count:
        kwargs = {"count": count} if "{count}" in problem else None
        return _health_check(check_id, label, "warn", problem, link=link, group="integrations", detail_kwargs=kwargs)
    return _health_check(check_id, label, "ok", ok_detail, link=link, group="integrations", detail_kwargs=ok_kwargs)


def get_integrations_health_checks(migration_groups):
    """Warnings for integration objects that are missing or in a failure status."""
    checks = []
    migrations_in_error = _status_count(migration_groups, "migrations", "error")
    failed_records = _status_count(migration_groups, "migration_records", "failed")
    migration_url = None
    record_url = None
    for group in migration_groups:
        for item in group["statuses"]:
            if group["key"] == "migrations" and item["key"] == "error":
                migration_url = item["url"]
            if group["key"] == "migration_records" and item["key"] == "failed":
                record_url = item["url"]
    checks.append(
        _integration_check(
            "migration_errors",
            "Migration errors",
            "{count} migration(s) ended in error.",
            "No migrations in error.",
            migrations_in_error,
            migration_url,
        )
    )
    checks.append(
        _integration_check(
            "migration_record_failures",
            "Migration record failures",
            "{count} migration record(s) failed.",
            "No failed migration records.",
            failed_records,
            record_url,
        )
    )

    if getattr(settings, "USE_IDENTITY_PROVIDERS", False):
        from allauth.socialaccount.models import SocialApp

        from identity_providers.models import LoginOption

        provider_count = SocialApp.objects.count()
        active_logins = LoginOption.objects.filter(active=True).count()
        checks.append(
            _integration_check(
                "identity_providers",
                "Identity Providers",
                "No identity providers are configured.",
                "{count} identity provider(s) configured.",
                0 if provider_count else 1,
                _changelist_url(SocialApp),
                ok_kwargs={"count": provider_count},
            )
        )
        checks.append(
            _integration_check(
                "active_login_options",
                "Active login options",
                "No active login options.",
                "{count} active login option(s).",
                0 if active_logins else 1,
                _changelist_url(LoginOption, "active__exact=1"),
                ok_kwargs={"count": active_logins},
            )
        )

    if getattr(settings, "USE_SAML", False):
        from saml_auth.models import SAMLConfiguration

        saml_count = SAMLConfiguration.objects.count()
        checks.append(
            _integration_check(
                "saml_configuration",
                "SAML Configurations",
                "SAML is enabled but no configurations exist.",
                "{count} SAML configuration(s).",
                0 if saml_count else 1,
                _changelist_url(SAMLConfiguration),
                ok_kwargs={"count": saml_count},
            )
        )

    if getattr(settings, "USE_LTI", False):
        from lti.models import LTILaunchLog, LTIPlatform, LTIToolKeys

        platforms = LTIPlatform.objects.count()
        tool_keys = LTIToolKeys.objects.count()
        failed_launches = LTILaunchLog.objects.filter(success=False).count()
        checks.append(
            _integration_check(
                "lti_platforms",
                "LTI Platforms",
                "LTI is enabled but no platforms exist.",
                "{count} LTI platform(s).",
                0 if platforms else 1,
                _changelist_url(LTIPlatform),
                ok_kwargs={"count": platforms},
            )
        )
        checks.append(
            _integration_check(
                "lti_tool_keys",
                "LTI Tool Keys",
                "LTI is enabled but no tool keys exist.",
                "{count} LTI tool key(s).",
                0 if tool_keys else 1,
                _changelist_url(LTIToolKeys),
                ok_kwargs={"count": tool_keys},
            )
        )
        checks.append(
            _integration_check(
                "failed_lti_launches",
                "Failed LTI launches",
                "{count} LTI launch(es) failed.",
                "No failed LTI launches.",
                failed_launches,
                _changelist_url(LTILaunchLog, "success__exact=0"),
            )
        )
    return checks


def get_integrations_statistics(seven_days_ago):
    """Counts for the integration objects listed in the admin sidebar."""
    migration_groups = get_migration_status_groups()
    health_checks = get_integrations_health_checks(migration_groups)
    today = timezone.localdate()
    since = (today - timedelta(days=7)).isoformat()
    until = (today + timedelta(days=1)).isoformat()
    recent_query = f"created_at__gte={since}&created_at__lt={until}"
    stats = {
        "migration_groups": migration_groups,
        "migrations_in_error": _status_count(migration_groups, "migrations", "error"),
        "failed_migration_records": _status_count(migration_groups, "migration_records", "failed"),
        "identity_providers_enabled": bool(getattr(settings, "USE_IDENTITY_PROVIDERS", False)),
        "saml_enabled": bool(getattr(settings, "USE_SAML", False)),
        "lti_enabled": bool(getattr(settings, "USE_LTI", False)),
        "identity_objects": [],
        "saml_objects": [],
        "lti_objects": [],
        "social_accounts": 0,
        "lti_platforms": 0,
        "failed_launches": 0,
        "health_checks": health_checks,
        "health_counts": _count_health(health_checks),
    }

    if stats["identity_providers_enabled"]:
        logs_last_7_days = IdentityProviderUserLog.objects.filter(created_at__gte=seven_days_ago).count()
        stats["social_accounts"] = SocialAccount.objects.count()
        stats["identity_objects"] = [
            item
            for item in (
                _object_total("Social apps", SocialApp.objects.count(), _changelist_url(SocialApp), "fas fa-key"),
                _object_total(
                    "Social accounts",
                    stats["social_accounts"],
                    _changelist_url(SocialAccount),
                    "fas fa-user-circle",
                ),
                _object_total(
                    "Login Options",
                    LoginOption.objects.count(),
                    _changelist_url(LoginOption),
                    "fas fa-sign-in-alt",
                ),
                _object_total(
                    "Active login options",
                    LoginOption.objects.filter(active=True).count(),
                    _changelist_url(LoginOption, "active__exact=1"),
                    "fas fa-sign-in-alt",
                ),
                _object_total(
                    "Identity Provider User Logs",
                    IdentityProviderUserLog.objects.count(),
                    _changelist_url(IdentityProviderUserLog),
                    "fas fa-clipboard-list",
                ),
                _object_total(
                    "Identity provider logs (7 days)",
                    logs_last_7_days,
                    _changelist_url(IdentityProviderUserLog, recent_query),
                    "fas fa-clipboard-list",
                ),
            )
            if item
        ]

    if stats["saml_enabled"]:
        stats["saml_objects"] = [
            item
            for item in (
                _object_total(
                    "SAML Configurations",
                    SAMLConfiguration.objects.count(),
                    _changelist_url(SAMLConfiguration),
                    "fas fa-shield-alt",
                ),
            )
            if item
        ]

    if stats["lti_enabled"]:
        launches = LTILaunchLog.objects.aggregate(
            total=Count("id"),
            successful=Count("id", filter=Q(success=True)),
            failed=Count("id", filter=Q(success=False)),
            last_7_days=Count("id", filter=Q(created_at__gte=seven_days_ago)),
        )
        stats["lti_platforms"] = LTIPlatform.objects.count()
        stats["failed_launches"] = launches["failed"]
        stats["lti_objects"] = [
            item
            for item in (
                _object_total(
                    "LTI Platforms",
                    stats["lti_platforms"],
                    _changelist_url(LTIPlatform),
                    "fas fa-chalkboard-teacher",
                ),
                _object_total(
                    "LTI Resource Links",
                    LTIResourceLink.objects.count(),
                    _changelist_url(LTIResourceLink),
                    "fas fa-link",
                ),
                _object_total(
                    "LTI User Mappings",
                    LTIUserMapping.objects.count(),
                    _changelist_url(LTIUserMapping),
                    "fas fa-user",
                ),
                _object_total(
                    "LTI Role Mappings",
                    LTIRoleMapping.objects.count(),
                    _changelist_url(LTIRoleMapping),
                    "fas fa-id-badge",
                ),
                _object_total(
                    "LTI Tool Keys",
                    LTIToolKeys.objects.count(),
                    _changelist_url(LTIToolKeys),
                    "fas fa-key",
                ),
                _object_total(
                    "LTI Launch Logs",
                    launches["total"],
                    _changelist_url(LTILaunchLog),
                    "fas fa-clipboard-list",
                ),
                _object_total(
                    "Successful launches",
                    launches["successful"],
                    _changelist_url(LTILaunchLog, "success__exact=1"),
                    "fas fa-check-circle",
                ),
                _object_total(
                    "Failed launches",
                    launches["failed"],
                    _changelist_url(LTILaunchLog, "success__exact=0"),
                    "fas fa-times-circle",
                ),
                _object_total(
                    "Launches (7 days)",
                    launches["last_7_days"],
                    _changelist_url(LTILaunchLog, recent_query),
                    "fas fa-calendar-week",
                ),
            )
            if item
        ]

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
    media_stats["duplicate_md5"] = qs_duplicate_md5().count()
    media_stats["duplicate_names"] = qs_duplicate_name().count()

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
    report_media_ids = {row["media_id"] for row in moderation_stats["recent_reports"] if row["media_id"]}
    latest_report_ids = {}
    if report_media_ids:
        seen_media = set()
        latest_reports = MediaAction.objects.filter(action="report", media_id__in=report_media_ids).order_by("-action_date", "-id").values_list("id", "media_id")
        for report_id, media_id in latest_reports:
            if media_id in seen_media:
                continue
            seen_media.add(media_id)
            latest_report_ids[media_id] = report_id
    for row in moderation_stats["recent_reports"]:
        row["latest_report_id"] = latest_report_ids.get(row["media_id"])
    recent_report_audits = list(MediaAction.objects.filter(action__in=REPORT_AUDIT_ACTIONS).order_by("-action_date")[:5].values(*recent_moderation_values))
    for row in recent_report_audits:
        row["action_label"] = REPORT_AUDIT_ACTION_LABELS.get(row["action"], row["action"])
        icon, modifier = MEDIA_ACTION_ICONS.get(row["action"], ("fas fa-clipboard-list", "pending"))
        row["action_icon"] = icon
        row["action_modifier"] = modifier
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


_CONFIGURATION_CHECK_IDS = frozenset(
    {
        "django_site",
        "site_name",
        "site_domain",
        "debug",
        "allowed_hosts",
        "frontend_https",
        "email_from",
        "email_tls_ssl",
        "proxy_forwarded_host",
        "proxy_ssl_header",
        "csrf_trusted_origins",
        "secure_cookies",
        "secure_ssl_redirect",
        "cors_allow_all",
    }
)
_SYSTEM_CHECK_IDS = frozenset(
    {
        "cache",
        "encode_profiles",
        "media_root_access",
        "hls_dir_access",
        "temp_dir_access",
        "media_subdir_original",
        "media_subdir_encoded",
        "media_subdir_uploads",
        "media_subdir_chunks",
    }
)


def _health_check(check_id, label, status, detail, link=None, group=None, detail_kwargs=None, detail_template=None):
    detail_kwargs = dict(detail_kwargs or {})
    template = detail if detail_template is None else detail_template
    if detail_kwargs and detail_template is None:
        try:
            rendered = template.format(**detail_kwargs)
        except (KeyError, ValueError, IndexError):
            rendered = detail
    else:
        rendered = detail
    return {
        "id": check_id,
        "label": label,
        "status": status,
        "detail": rendered,
        "detail_template": template,
        "detail_kwargs": detail_kwargs,
        "link": link,
        "group": group,
    }


def _tag_health_group(check):
    if check.get("group"):
        return check
    check_id = check["id"]
    if check_id in _CONFIGURATION_CHECK_IDS:
        check["group"] = "configuration"
    elif check_id in _SYSTEM_CHECK_IDS:
        check["group"] = "system"
    else:
        check["group"] = "health"
    return check


def get_site_health_checks(media_stats=None, extra_checks=None):
    """Lightweight configuration and dependency checks for Site overview."""
    checks = []
    site = Site.objects.filter(id=getattr(settings, "SITE_ID", 1)).first() or Site.objects.first()
    portal_name = getattr(settings, "PORTAL_NAME", "") or ""
    frontend_scheme, frontend_host, _frontend_origin = frontend_host_parts()
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
                    'Site.name and PORTAL_NAME are both "{name}".',
                    link=site_change_url,
                    detail_kwargs={"name": portal_name},
                )
            )
        else:
            checks.append(
                _health_check(
                    "site_name",
                    "Site name matches PORTAL_NAME",
                    "warn",
                    'Site.name is "{site_name}" but PORTAL_NAME is "{portal_name}".',
                    link=site_change_url,
                    detail_kwargs={"site_name": site.name, "portal_name": portal_name},
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
                    'Site.domain and FRONTEND_HOST both resolve to "{host}".',
                    link=site_change_url,
                    detail_kwargs={"host": frontend_host},
                )
            )
        else:
            checks.append(
                _health_check(
                    "site_domain",
                    "Site domain matches FRONTEND_HOST",
                    "warn",
                    'Site.domain is "{domain}" but FRONTEND_HOST host is "{host}".',
                    link=site_change_url,
                    detail_kwargs={"domain": site.domain, "host": frontend_host},
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
                'ALLOWED_HOSTS includes "{host}".',
                detail_kwargs={"host": frontend_host},
            )
        )
    else:
        checks.append(
            _health_check(
                "allowed_hosts",
                "ALLOWED_HOSTS includes FRONTEND_HOST",
                "fail",
                'FRONTEND_HOST host "{host}" is not present in ALLOWED_HOSTS.',
                detail_kwargs={"host": frontend_host},
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
                "FRONTEND_HOST scheme is missing (acceptable for local/debug)." if not frontend_scheme else 'FRONTEND_HOST scheme is "{scheme}" (acceptable for local/debug).',
                detail_kwargs={"scheme": frontend_scheme} if frontend_scheme else None,
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
                "Cache backend probe failed: {error}." if cache_error else "Cache backend probe failed.",
                detail_kwargs={"error": cache_error} if cache_error else None,
            )
        )

    active_profiles = EncodeProfile.objects.filter(active=True).count()
    if active_profiles:
        checks.append(
            _health_check(
                "encode_profiles",
                "Active encode profiles",
                "ok",
                "{count} active encode profile(s).",
                link=reverse("admin:files_encodeprofile_changelist"),
                detail_kwargs={"count": active_profiles},
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
                "{count} active superuser(s).",
                link=reverse("admin:users_user_changelist") + "?is_superuser__exact=1",
                detail_kwargs={"count": superusers},
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
    if not default_from:
        checks.append(
            _health_check(
                "email_from",
                "DEFAULT_FROM_EMAIL configured",
                "warn",
                "DEFAULT_FROM_EMAIL is empty. Update it for production mail.",
            )
        )
    elif default_from.endswith("@mediacms.io"):
        checks.append(
            _health_check(
                "email_from",
                "DEFAULT_FROM_EMAIL configured",
                "warn",
                'DEFAULT_FROM_EMAIL is "{email}". Update it for production mail.',
                detail_kwargs={"email": default_from},
            )
        )
    else:
        checks.append(
            _health_check(
                "email_from",
                "DEFAULT_FROM_EMAIL configured",
                "ok",
                'DEFAULT_FROM_EMAIL is "{email}".',
                detail_kwargs={"email": default_from},
            )
        )

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
                "{count} media item(s) have failed encodings.",
                link=reverse("admin:files_media_changelist") + "?encoding_queue=fail",
                detail_kwargs={"count": failed},
            )
        )
    else:
        checks.append(_health_check("encoding_failures", "Encoding failures", "ok", "No failed encodings."))
    checks.append(
        _health_check(
            "encoding_queue",
            "Encoding queue",
            "info" if queue else "ok",
            "{count} media item(s) pending or running.",
            link=reverse("admin:files_media_changelist") + "?encoding_queue=yes",
            detail_kwargs={"count": queue},
        )
    )

    from files.integrity import iter_integrity_health_checks
    from files.metadata_integrity import iter_metadata_health_checks

    for payload in iter_status_health_checks():
        checks.append(_health_check(**payload))

    for payload in iter_integrity_health_checks():
        checks.append(_health_check(**payload))

    for payload in iter_metadata_health_checks():
        checks.append(_health_check(**payload))

    for payload in iter_deployment_health_checks():
        checks.append(_health_check(**payload))

    for payload in iter_media_storage_health_checks():
        checks.append(_health_check(**payload))

    if extra_checks is None:
        extra_checks = get_integrations_health_checks(get_migration_status_groups())
    for check in extra_checks:
        checks.append(check)

    checks = [_tag_health_group(check) for check in checks]
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
        *deployment_configuration_rows(),
    ]


def get_system_statistics(media_stats=None, extra_checks=None):
    """Calculate system/infrastructure statistics, object totals, and site health."""
    object_totals = [
        {"label": "Media", "count": Media.objects.count(), "url": reverse("admin:files_media_changelist"), "icon": "fas fa-video"},
        {"label": "Users", "count": User.objects.count(), "url": reverse("admin:users_user_changelist"), "icon": "fas fa-users"},
        {"label": "Comments", "count": Comment.objects.count(), "url": reverse("admin:files_comment_changelist"), "icon": "fas fa-comments"},
        {"label": "Encodings", "count": Encoding.objects.count(), "url": reverse("admin:files_encoding_changelist"), "icon": "fas fa-film"},
        {"label": "Media actions", "count": MediaAction.objects.count(), "url": reverse("admin:actions_mediaaction_changelist"), "icon": "fas fa-history"},
        {"label": "Categories", "count": Category.objects.count(), "url": reverse("admin:files_category_changelist"), "icon": "fas fa-folder"},
        {"label": "Tags", "count": Tag.objects.count(), "url": reverse("admin:files_tag_changelist"), "icon": "fas fa-tags"},
        {"label": "Playlists", "count": Playlist.objects.count(), "url": reverse("admin:files_playlist_changelist"), "icon": "fas fa-list"},
        {"label": "Channels", "count": Channel.objects.count(), "url": reverse("admin:users_channel_changelist"), "icon": "fas fa-broadcast-tower"},
        {"label": "Pages", "count": Page.objects.count(), "url": reverse("admin:files_page_changelist"), "icon": "fas fa-file-alt"},
        {"label": "Captions", "count": Subtitle.objects.count(), "url": reverse("admin:files_subtitle_changelist"), "icon": "fas fa-closed-captioning"},
        {"label": "Caption Requests", "count": TranscriptionRequest.objects.count(), "url": reverse("admin:files_transcriptionrequest_changelist"), "icon": "fas fa-microphone"},
        {"label": "Trim Requests", "count": VideoTrimRequest.objects.count(), "url": reverse("admin:files_videotrimrequest_changelist"), "icon": "fas fa-cut"},
        {"label": "Encode profiles", "count": EncodeProfile.objects.count(), "url": reverse("admin:files_encodeprofile_changelist"), "icon": "fas fa-sliders-h"},
        {"label": "Licenses", "count": License.objects.count(), "url": reverse("admin:files_license_changelist"), "icon": "fas fa-balance-scale"},
        {"label": "Languages", "count": Language.objects.count(), "url": reverse("admin:files_language_changelist"), "icon": "fas fa-language"},
        {"label": "Media permissions", "count": MediaPermission.objects.count(), "url": reverse("admin:files_mediapermission_changelist"), "icon": "fas fa-user-lock"},
    ]

    totals_by_label = {item["label"]: item["count"] for item in object_totals}
    system_stats = {
        "total_channels": totals_by_label["Channels"],
        "total_categories": totals_by_label["Categories"],
        "total_playlists": totals_by_label["Playlists"],
        "total_tags": totals_by_label["Tags"],
        "total_pages": totals_by_label["Pages"],
        "object_totals": object_totals,
        "health_checks": get_site_health_checks(media_stats=media_stats, extra_checks=extra_checks),
        "configuration": get_site_configuration_status(),
        "runtime": get_system_runtime_rows(),
    }
    system_stats["health_counts"] = _count_health(system_stats["health_checks"])
    system_stats["configuration_counts"] = _count_health(check for check in system_stats["health_checks"] if check["group"] == "configuration")
    system_stats["system_counts"] = _count_health(check for check in system_stats["health_checks"] if check["group"] == "system")

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
