from collections import defaultdict
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.db.models import Count, Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from actions.models import MODERATION_MEDIA_ACTIONS, MediaAction
from files.models import Category, Comment, Media, Playlist
from users.models import Channel, User

# Report-related moderator audit events shown on the dashboard (excludes user "report"
# submissions and media approval reviews, which have their own tiles).
REPORT_AUDIT_ACTIONS = tuple(name for name, _label in MODERATION_MEDIA_ACTIONS if name not in ("media_reviewed",))
REPORT_AUDIT_ACTION_LABELS = dict(MODERATION_MEDIA_ACTIONS)

DASHBOARD_STATS_CACHE_KEY = "admin_dashboard_stats_v1"
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


def get_system_statistics(media_stats=None):
    """Calculate system/infrastructure statistics"""
    system_stats = {
        "total_channels": Channel.objects.count(),
        "total_categories": Category.objects.count(),
        "total_playlists": Playlist.objects.count(),
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
