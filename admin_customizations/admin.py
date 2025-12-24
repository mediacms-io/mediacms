from datetime import timedelta

from django.conf import settings
from django.db.models import Count, Sum
from django.utils import timezone

from actions.models import MediaAction
from files.models import Category, Comment, Media, Playlist
from users.models import Channel, User


def calculate_statistics():
    """Calculate all dashboard statistics"""
    now = timezone.now()
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)

    stats = {}

    # Media Statistics
    stats['media'] = get_media_statistics(seven_days_ago, thirty_days_ago)

    # Content Moderation
    stats['moderation'] = get_moderation_statistics(seven_days_ago)

    # Engagement Metrics
    stats['engagement'] = get_engagement_statistics(seven_days_ago)

    # User Statistics
    stats['users'] = get_user_statistics(seven_days_ago, thirty_days_ago)

    # System/Infrastructure
    stats['system'] = get_system_statistics()

    return stats


def get_media_statistics(seven_days_ago, thirty_days_ago):
    """Calculate media-related statistics"""
    media_stats = {}

    # Total media count
    media_stats['total'] = Media.objects.count()

    # Media by type
    media_stats['by_type'] = {
        'video': Media.objects.filter(media_type='video').count(),
        'audio': Media.objects.filter(media_type='audio').count(),
        'image': Media.objects.filter(media_type='image').count(),
        'pdf': Media.objects.filter(media_type='pdf').count(),
    }

    # Media by state
    media_stats['by_state'] = {
        'public': Media.objects.filter(state='public').count(),
        'private': Media.objects.filter(state='private').count(),
        'unlisted': Media.objects.filter(state='unlisted').count(),
    }

    # Media by encoding status
    media_stats['by_encoding_status'] = {
        'pending': Media.objects.filter(encoding_status='pending').count(),
        'running': Media.objects.filter(encoding_status='running').count(),
        'success': Media.objects.filter(encoding_status='success').count(),
        'fail': Media.objects.filter(encoding_status='fail').count(),
    }

    # Media requiring review
    media_stats['needs_review'] = Media.objects.filter(is_reviewed=False).count()

    # Media uploaded in time periods
    media_stats['uploaded_last_7_days'] = Media.objects.filter(add_date__gte=seven_days_ago).count()
    media_stats['uploaded_last_30_days'] = Media.objects.filter(add_date__gte=thirty_days_ago).count()

    # Total views
    media_stats['total_views'] = Media.objects.aggregate(total=Sum('views'))['total'] or 0

    return media_stats


def get_moderation_statistics(seven_days_ago):
    """Calculate content moderation statistics"""
    moderation_stats = {}

    # Reported media
    reported_threshold = getattr(settings, 'REPORTED_TIMES_THRESHOLD', 10)
    moderation_stats['reported_media'] = Media.objects.filter(reported_times__gt=0).count()
    moderation_stats['reported_above_threshold'] = Media.objects.filter(
        reported_times__gte=reported_threshold
    ).count()
    moderation_stats['reported_threshold'] = reported_threshold

    # Recent reports (from MediaAction)
    moderation_stats['recent_reports'] = MediaAction.objects.filter(
        action='report',
        action_date__gte=seven_days_ago
    ).count()

    # Unreviewed media
    moderation_stats['unreviewed'] = Media.objects.filter(is_reviewed=False).count()

    # Recent reported media (last 7 days)
    recent_reported_media_ids = MediaAction.objects.filter(
        action='report',
        action_date__gte=seven_days_ago
    ).values_list('media_id', flat=True).distinct()
    moderation_stats['recent_reported_media_count'] = len(recent_reported_media_ids)

    return moderation_stats


def get_engagement_statistics(seven_days_ago):
    """Calculate engagement metrics"""
    engagement_stats = {}

    # Total comments
    engagement_stats['total_comments'] = Comment.objects.count()

    # Recent comments
    engagement_stats['recent_comments'] = Comment.objects.filter(
        add_date__gte=seven_days_ago
    ).count()

    # Total likes and dislikes
    engagement_stats['total_likes'] = Media.objects.aggregate(total=Sum('likes'))['total'] or 0
    engagement_stats['total_dislikes'] = Media.objects.aggregate(total=Sum('dislikes'))['total'] or 0

    # Most liked media (top 5)
    engagement_stats['most_liked'] = list(Media.objects.order_by('-likes')[:5].values(
        'id', 'title', 'likes', 'friendly_token'
    ))

    # Most viewed media (top 5)
    engagement_stats['most_viewed'] = list(Media.objects.order_by('-views')[:5].values(
        'id', 'title', 'views', 'friendly_token'
    ))

    return engagement_stats


def get_user_statistics(seven_days_ago, thirty_days_ago):
    """Calculate user-related statistics"""
    user_stats = {}

    # Total users
    user_stats['total'] = User.objects.count()

    # Recent registrations
    user_stats['registered_last_7_days'] = User.objects.filter(
        date_added__gte=seven_days_ago
    ).count()
    user_stats['registered_last_30_days'] = User.objects.filter(
        date_added__gte=thirty_days_ago
    ).count()

    # Users with most media (top 5)
    user_stats['top_uploaders'] = list(User.objects.annotate(
        media_count_annotated=Count('media')
    ).filter(media_count_annotated__gt=0).order_by('-media_count_annotated')[:5].values(
        'id', 'username', 'media_count_annotated'
    ))

    # Active users (uploaded media in last 30 days)
    user_stats['active_users'] = User.objects.filter(
        media__add_date__gte=thirty_days_ago
    ).distinct().count()

    # Pending user approvals
    if getattr(settings, 'USERS_NEEDS_TO_BE_APPROVED', False):
        user_stats['pending_approvals'] = User.objects.filter(is_approved=False).count()
    else:
        user_stats['pending_approvals'] = 0

    return user_stats


def get_system_statistics():
    """Calculate system/infrastructure statistics"""
    system_stats = {}

    # Total channels
    system_stats['total_channels'] = Channel.objects.count()

    # Total categories
    system_stats['total_categories'] = Category.objects.count()

    # Total playlists
    system_stats['total_playlists'] = Playlist.objects.count()

    # Encoding failures
    system_stats['encoding_failures'] = Media.objects.filter(encoding_status='fail').count()

    # Media in encoding queue
    system_stats['encoding_queue'] = Media.objects.filter(
        encoding_status__in=['pending', 'running']
    ).count()

    return system_stats

