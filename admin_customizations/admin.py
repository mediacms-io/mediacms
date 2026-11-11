from datetime import timedelta

from django.conf import settings
from django.db.models import Case, Count, FloatField, Max, Q, Sum, Value, When
from django.db.models.functions import Cast, Greatest, Replace
from django.utils import timezone

from actions.models import MODERATION_MEDIA_ACTIONS, MediaAction
from files.models import Category, Comment, Media, Playlist
from users.models import Channel, User

# Report-related moderator audit events shown on the dashboard (excludes user "report"
# submissions and media approval reviews, which have their own tiles).
REPORT_AUDIT_ACTIONS = tuple(name for name, _label in MODERATION_MEDIA_ACTIONS if name not in ("media_reviewed",))
REPORT_AUDIT_ACTION_LABELS = dict(MODERATION_MEDIA_ACTIONS)
# Media.size is a display string such as "12.3MB", not a numeric column.
UPLOAD_SIZE_PATTERN = r"^[0-9]+(\.[0-9]+)?MB$"


def format_upload_size(megabytes):
    """Format a summed upload size. Stored values are decimal megabytes."""
    megabytes = float(megabytes or 0)
    if megabytes >= 1000:
        return f"{megabytes / 1000:.1f} GB"
    return f"{megabytes:.1f} MB"


def calculate_statistics():
    """Calculate all dashboard statistics"""
    now = timezone.now()
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)

    stats = {}

    # Media Statistics
    stats['media'] = get_media_statistics()

    # Content Moderation
    stats['moderation'] = get_moderation_statistics(seven_days_ago)

    # Engagement Metrics
    stats['engagement'] = get_engagement_statistics(seven_days_ago)

    # User Statistics
    stats['users'] = get_user_statistics(seven_days_ago, thirty_days_ago)

    # System/Infrastructure
    stats['system'] = get_system_statistics()

    return stats


def get_media_statistics():
    """Calculate media-related statistics"""
    media_stats = {}

    media_stats['total'] = Media.objects.count()

    media_stats['by_type'] = {
        'video': Media.objects.filter(media_type='video').count(),
        'audio': Media.objects.filter(media_type='audio').count(),
        'image': Media.objects.filter(media_type='image').count(),
        'pdf': Media.objects.filter(media_type='pdf').count(),
    }

    media_stats['by_state'] = {
        'public': Media.objects.filter(state='public').count(),
        'private': Media.objects.filter(state='private').count(),
        'unlisted': Media.objects.filter(state='unlisted').count(),
    }

    media_stats['by_encoding_status'] = {
        'pending': Media.objects.filter(encoding_status='pending').count(),
        'running': Media.objects.filter(encoding_status='running').count(),
        'success': Media.objects.filter(encoding_status='success').count(),
        'fail': Media.objects.filter(encoding_status='fail').count(),
    }

    media_stats['failed'] = media_stats['by_encoding_status']['fail']
    media_stats['encoding_queue'] = Media.objects.filter(encoding_status__in=['pending', 'running']).count()
    media_stats['featured'] = Media.objects.filter(featured=True).count()
    media_stats['total_views'] = Media.objects.aggregate(total=Sum('views'))['total'] or 0

    recent_upload_values = ('id', 'title', 'add_date', 'friendly_token', 'user_id', 'user__username')
    media_stats['recent_by_type'] = {
        media_type: list(Media.objects.filter(media_type=media_type).order_by('-add_date')[:5].values(*recent_upload_values)) for media_type in ('video', 'audio', 'image', 'pdf')
    }

    return media_stats


def get_moderation_statistics(seven_days_ago):
    """Calculate content moderation statistics"""
    moderation_stats = {}

    reported_threshold = getattr(settings, 'REPORTED_TIMES_THRESHOLD', 10)
    moderation_stats['reported_media'] = Media.objects.filter(reported_times__gt=0).count()
    moderation_stats['reported_above_threshold'] = Media.objects.filter(reported_times__gte=reported_threshold).count()
    moderation_stats['reported_threshold'] = reported_threshold
    moderation_stats['unreviewed'] = Media.objects.filter(is_reviewed=False).count()

    moderation_stats['clears_last_7_days'] = MediaAction.objects.filter(action='report_cleared', action_date__gte=seven_days_ago).count()
    moderation_stats['confirms_last_7_days'] = MediaAction.objects.filter(action='report_confirmed', action_date__gte=seven_days_ago).count()
    moderation_stats['approved_last_7_days'] = MediaAction.objects.filter(action='media_reviewed', action_date__gte=seven_days_ago).count()

    recent_moderation_values = (
        'id',
        'action',
        'action_date',
        'extra_info',
        'user_id',
        'user__username',
        'media_id',
        'media__title',
        'media__friendly_token',
    )

    moderation_stats['recent_reports'] = list(MediaAction.objects.filter(action='report').order_by('-action_date')[:5].values(*recent_moderation_values))
    recent_report_audits = list(MediaAction.objects.filter(action__in=REPORT_AUDIT_ACTIONS).order_by('-action_date')[:5].values(*recent_moderation_values))
    for row in recent_report_audits:
        row['action_label'] = REPORT_AUDIT_ACTION_LABELS.get(row['action'], row['action'])
    moderation_stats['recent_report_audits'] = recent_report_audits
    moderation_stats['recent_pending_review'] = list(
        Media.objects.filter(is_reviewed=False).select_related('user').order_by('-add_date')[:5].values('id', 'title', 'add_date', 'user_id', 'user__username', 'friendly_token')
    )
    moderation_stats['recent_approved'] = list(MediaAction.objects.filter(action='media_reviewed').order_by('-action_date')[:5].values(*recent_moderation_values))

    return moderation_stats


def get_engagement_statistics(seven_days_ago):
    """Calculate engagement metrics"""
    engagement_stats = {}

    engagement_stats['total_comments'] = Comment.objects.count()
    engagement_stats['recent_comments'] = Comment.objects.filter(add_date__gte=seven_days_ago).count()
    engagement_stats['total_likes'] = Media.objects.aggregate(total=Sum('likes'))['total'] or 0
    engagement_stats['total_dislikes'] = Media.objects.aggregate(total=Sum('dislikes'))['total'] or 0
    engagement_stats['most_liked'] = list(Media.objects.order_by('-likes')[:5].values('id', 'title', 'likes', 'friendly_token'))
    engagement_stats['most_viewed'] = list(Media.objects.order_by('-views')[:5].values('id', 'title', 'views', 'friendly_token'))
    engagement_stats['most_commented'] = list(
        Media.objects.annotate(comment_count=Count('comments')).filter(comment_count__gt=0).order_by('-comment_count')[:5].values('id', 'title', 'comment_count', 'friendly_token')
    )
    engagement_stats['most_disliked'] = list(Media.objects.order_by('-dislikes')[:5].values('id', 'title', 'dislikes', 'friendly_token'))

    return engagement_stats


def get_user_statistics(seven_days_ago, thirty_days_ago):
    """Calculate user-related statistics"""
    user_stats = {}

    user_stats['total'] = User.objects.count()
    user_stats['registered_last_7_days'] = User.objects.filter(date_added__gte=seven_days_ago).count()
    user_stats['registered_last_30_days'] = User.objects.filter(date_added__gte=thirty_days_ago).count()
    user_stats['active_users'] = User.objects.filter(media__add_date__gte=thirty_days_ago).distinct().count()
    user_stats['inactive_users'] = User.objects.filter(is_active=False).count()
    user_stats['superusers'] = User.objects.filter(is_superuser=True).count()
    user_stats['staff_users'] = User.objects.filter(is_staff=True).count()
    user_stats['editors'] = User.objects.filter(is_editor=True).count()
    user_stats['managers'] = User.objects.filter(is_manager=True).count()
    user_stats['regular_users'] = User.objects.filter(
        is_superuser=False,
        is_staff=False,
        is_editor=False,
        is_manager=False,
    ).count()
    user_stats['recent_registered'] = list(User.objects.order_by('-date_added')[:10].values('id', 'username', 'date_added'))
    user_stats['recent_activity'] = list(
        User.objects.annotate(
            last_media=Max('media__add_date'),
            last_action=Max('useractions__action_date'),
            last_comment=Max('comment__add_date'),
        )
        .annotate(last_activity=Greatest('last_login', 'last_media', 'last_action', 'last_comment'))
        .filter(last_activity__isnull=False)
        .order_by('-last_activity')[:10]
        .values('id', 'username', 'last_activity')
    )

    user_stats['top_uploaders'] = list(
        User.objects.annotate(media_count_annotated=Count('media')).filter(media_count_annotated__gt=0).order_by('-media_count_annotated')[:5].values('id', 'username', 'media_count_annotated')
    )
    upload_mb = Sum(
        Case(
            When(
                media__size__regex=UPLOAD_SIZE_PATTERN,
                then=Cast(Replace('media__size', Value('MB'), Value('')), FloatField()),
            ),
            default=Value(0.0),
            output_field=FloatField(),
        )
    )
    top_by_size = list(User.objects.annotate(upload_mb=upload_mb).filter(upload_mb__gt=0).order_by('-upload_mb')[:5].values('id', 'username', 'upload_mb'))
    for row in top_by_size:
        row['upload_size_label'] = format_upload_size(row['upload_mb'])
    user_stats['top_uploaders_by_size'] = top_by_size

    approval_enabled = getattr(settings, 'USERS_NEEDS_TO_BE_APPROVED', False)
    user_stats['approval_workflow_enabled'] = approval_enabled
    if approval_enabled:
        pending_q = Q(is_approved=False) | Q(is_approved__isnull=True)
        user_stats['pending_approvals'] = User.objects.filter(pending_q).count()
        user_stats['approved_users'] = User.objects.filter(is_approved=True).count()
        user_stats['recent_pending_users'] = list(User.objects.filter(pending_q).order_by('-date_added')[:5].values('id', 'username', 'date_added'))
    else:
        user_stats['pending_approvals'] = 0
        user_stats['approved_users'] = 0
        user_stats['recent_pending_users'] = []

    user_stats['top_commenters'] = list(Comment.objects.exclude(user=None).values('user_id', 'user__username').annotate(comment_count=Count('id')).order_by('-comment_count')[:5])
    user_stats['top_likers'] = list(MediaAction.objects.filter(action='like').exclude(user=None).values('user_id', 'user__username').annotate(action_count=Count('id')).order_by('-action_count')[:5])
    user_stats['top_dislikers'] = list(
        MediaAction.objects.filter(action='dislike').exclude(user=None).values('user_id', 'user__username').annotate(action_count=Count('id')).order_by('-action_count')[:5]
    )
    user_stats['top_reporters'] = list(
        MediaAction.objects.filter(action='report').exclude(user=None).values('user_id', 'user__username').annotate(action_count=Count('id')).order_by('-action_count')[:5]
    )

    return user_stats


def get_system_statistics():
    """Calculate system/infrastructure statistics"""
    system_stats = {}

    system_stats['total_channels'] = Channel.objects.count()
    system_stats['total_categories'] = Category.objects.count()
    system_stats['total_playlists'] = Playlist.objects.count()
    system_stats['encoding_failures'] = Media.objects.filter(encoding_status='fail').count()
    system_stats['encoding_queue'] = Media.objects.filter(encoding_status__in=['pending', 'running']).count()

    return system_stats
