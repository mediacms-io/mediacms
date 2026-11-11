from datetime import timedelta

from django.conf import settings
from django.contrib import admin, messages
from django.utils import timezone

from actions.models import MediaAction
from admin_customizations.action_choices import (
    GroupedActionForm,
    build_grouped_action_choices,
)
from files.admin_helpers import (
    ReadOnlyTabularInline,
    admin_change_link,
    admin_changelist_link,
)
from files.models import Comment, Media, Playlist

from .models import Channel, User


class JoinedRecentlyFilter(admin.SimpleListFilter):
    title = "Joined"
    parameter_name = "joined"

    def lookups(self, request, model_admin):
        return (("7d", "Last 7 days"),)

    def queryset(self, request, queryset):
        if self.value() == "7d":
            return queryset.filter(date_added__gte=timezone.now() - timedelta(days=7))
        return queryset


class ActiveUploaderFilter(admin.SimpleListFilter):
    title = "Activity"
    parameter_name = "activity"

    def lookups(self, request, model_admin):
        return (("30d", "Uploaded in the last 30 days"),)

    def queryset(self, request, queryset):
        if self.value() == "30d":
            cutoff = timezone.now() - timedelta(days=30)
            return queryset.filter(media__add_date__gte=cutoff).distinct()
        return queryset


class RegularUserFilter(admin.SimpleListFilter):
    title = "Role"
    parameter_name = "role"

    def lookups(self, request, model_admin):
        return (("regular", "Regular users"),)

    def queryset(self, request, queryset):
        if self.value() == "regular":
            return queryset.filter(
                is_superuser=False,
                is_staff=False,
                is_editor=False,
                is_manager=False,
            )
        return queryset


class ChannelMediaInline(ReadOnlyTabularInline):
    model = Media
    fk_name = "channel"
    fields = ("link_title", "link_owner", "is_listable", "state", "media_type")
    readonly_fields = ("link_title", "link_owner", "is_listable", "state", "media_type")
    ordering = ("-add_date",)
    classes = ["tab", "related-objects-tab"]
    verbose_name = "Media"
    verbose_name_plural = "Media"

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("user")

    @admin.display(description="Media")
    def link_title(self, obj):
        if not obj or not obj.pk:
            return "—"
        return admin_change_link(obj, obj.title)

    @admin.display(description="Owner")
    def link_owner(self, obj):
        if not obj or not obj.user_id:
            return "—"
        return admin_change_link(obj.user, obj.user.username)

    @admin.display(description="Listable", boolean=True)
    def is_listable(self, obj):
        if not obj:
            return None
        return obj.listable


class UserMediaInline(ReadOnlyTabularInline):
    model = Media
    fk_name = "user"
    fields = ("link_title", "media_type", "state", "encoding_status", "add_date")
    readonly_fields = ("link_title", "media_type", "state", "encoding_status", "add_date")
    ordering = ("-add_date",)
    classes = ["tab", "related-objects-tab"]
    verbose_name = "Media"
    verbose_name_plural = "Media"

    @admin.display(description="Media")
    def link_title(self, obj):
        if not obj or not obj.pk:
            return "—"
        return admin_change_link(obj, obj.title)


class UserPlaylistInline(ReadOnlyTabularInline):
    model = Playlist
    fk_name = "user"
    fields = ("link_title", "add_date", "friendly_token")
    readonly_fields = ("link_title", "add_date", "friendly_token")
    ordering = ("-add_date",)
    classes = ["tab", "related-objects-tab"]
    verbose_name = "Playlist"
    verbose_name_plural = "Playlists"

    @admin.display(description="Playlist")
    def link_title(self, obj):
        if not obj or not obj.pk:
            return "—"
        return admin_change_link(obj, obj.title)


class UserChannelInline(ReadOnlyTabularInline):
    model = Channel
    fk_name = "user"
    fields = ("link_title", "add_date", "friendly_token")
    readonly_fields = ("link_title", "add_date", "friendly_token")
    ordering = ("-add_date",)
    classes = ["tab", "related-objects-tab"]
    verbose_name = "Channel"
    verbose_name_plural = "Channels"

    @admin.display(description="Channel")
    def link_title(self, obj):
        if not obj or not obj.pk:
            return "—"
        return admin_change_link(obj, obj.title)


class UserCommentInline(ReadOnlyTabularInline):
    model = Comment
    fk_name = "user"
    fields = ("link_media", "text", "add_date")
    readonly_fields = ("link_media", "text", "add_date")
    ordering = ("-add_date",)
    can_delete = True
    classes = ["tab", "related-objects-tab"]
    verbose_name = "Comment"
    verbose_name_plural = "Comments"

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("media")

    @admin.display(description="Media")
    def link_media(self, obj):
        if not obj or not obj.media_id:
            return "—"
        return admin_change_link(obj.media, obj.media.title)


class UserActivityInline(ReadOnlyTabularInline):
    model = MediaAction
    fk_name = "user"
    fields = ("action", "link_media", "action_date", "remote_ip", "extra_info")
    readonly_fields = ("action", "link_media", "action_date", "remote_ip", "extra_info")
    ordering = ("-action_date",)
    classes = ["tab", "related-objects-tab"]
    verbose_name = "Activity"
    verbose_name_plural = "Activity"

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("media")

    @admin.display(description="Media")
    def link_media(self, obj):
        if not obj or not obj.media_id:
            return "—"
        return admin_change_link(obj.media, obj.media.title)


class UserAdmin(admin.ModelAdmin):
    search_fields = ["email", "username", "name"]
    exclude = [
        "user_permissions",
        "title",
        "password",
        "groups",
        "is_featured",
        "location",
        "first_name",
        "last_name",
        "date_joined",
        "is_approved",
        "media_count",
    ]
    list_display = [
        "username",
        "name",
        "email",
        "logo",
        "date_added",
        "is_active",
        "is_superuser",
        "is_editor",
        "is_manager",
        "media_count",
    ]
    list_filter = ["is_active", "is_superuser", "is_staff", "is_editor", "is_manager", RegularUserFilter, JoinedRecentlyFilter, ActiveUploaderFilter]
    list_editable = []
    ordering = ("-date_added",)
    date_hierarchy = "date_added"
    readonly_fields = (
        "last_login",
        "related_media",
        "related_channels",
        "related_playlists",
        "related_comments",
        "related_likes",
        "related_dislikes",
        "related_watches",
        "related_reports",
        "related_actions",
    )
    inlines = [UserMediaInline, UserPlaylistInline, UserChannelInline, UserCommentInline, UserActivityInline]
    action_form = GroupedActionForm
    action_groups = [
        ["approve_users", "unapprove_users"],
        ["deactivate_users", "reactivate_users"],
        ["delete_selected"],
    ]

    def get_action_choices(self, request, default_choices=None):
        return build_grouped_action_choices(self.get_actions(request), self.action_groups, opts=self.opts)

    if settings.USERS_NEEDS_TO_BE_APPROVED:
        list_display.append("is_approved")
        list_filter.append("is_approved")
        list_editable = ["is_approved"]
        exclude.remove("is_approved")

    def get_fieldsets(self, request, obj=None):
        """Organize the change form into purpose-based Jazzmin tabs."""
        access_fields = [
            "is_active",
            "is_staff",
            "is_superuser",
            "is_editor",
            "is_manager",
            "advancedUser",
            "last_login",
        ]
        if getattr(settings, "USERS_NEEDS_TO_BE_APPROVED", False):
            access_fields.insert(-1, "is_approved")

        return (
            (
                "Profile",
                {
                    "fields": (
                        "username",
                        "name",
                        "email",
                        "logo",
                        "description",
                        "allow_contact",
                        "notification_on_comments",
                        "date_added",
                    ),
                    "classes": ("tab",),
                },
            ),
            (
                "Access",
                {
                    "fields": tuple(access_fields),
                    "classes": ("tab",),
                    "description": "Account status and MediaCMS roles.",
                },
            ),
            (
                "Related",
                {
                    "fields": (
                        "related_media",
                        "related_playlists",
                        "related_channels",
                        "related_comments",
                        "related_likes",
                        "related_dislikes",
                        "related_watches",
                        "related_reports",
                        "related_actions",
                    ),
                    "classes": ("tab", "related-links-tab"),
                    "description": "Links to filtered admin lists for this user's content and engagement.",
                },
            ),
        )

    @admin.display(description="Media")
    def related_media(self, obj):
        if not obj.pk:
            return "—"
        count = Media.objects.filter(user=obj).count()
        return admin_changelist_link(Media, f"View {count} media item(s)", user__id__exact=obj.pk)

    @admin.display(description="Channels")
    def related_channels(self, obj):
        if not obj.pk:
            return "—"
        count = obj.channels.count()
        return admin_changelist_link(Channel, f"View {count} channel(s)", user__id__exact=obj.pk)

    @admin.display(description="Playlists")
    def related_playlists(self, obj):
        if not obj.pk:
            return "—"
        count = obj.playlists.count()
        return admin_changelist_link(Playlist, f"View {count} playlist(s)", user__id__exact=obj.pk)

    @admin.display(description="Comments")
    def related_comments(self, obj):
        if not obj.pk:
            return "—"
        count = Comment.objects.filter(user=obj).count()
        return admin_changelist_link(Comment, f"View {count} comment(s)", user__id__exact=obj.pk)

    @admin.display(description="Likes")
    def related_likes(self, obj):
        if not obj.pk:
            return "—"
        count = MediaAction.objects.filter(user=obj, action="like").count()
        return admin_changelist_link(MediaAction, f"View {count} like(s)", user__id__exact=obj.pk, action__exact="like")

    @admin.display(description="Dislikes")
    def related_dislikes(self, obj):
        if not obj.pk:
            return "—"
        count = MediaAction.objects.filter(user=obj, action="dislike").count()
        return admin_changelist_link(
            MediaAction, f"View {count} dislike(s)", user__id__exact=obj.pk, action__exact="dislike"
        )

    @admin.display(description="Watches")
    def related_watches(self, obj):
        if not obj.pk:
            return "—"
        count = MediaAction.objects.filter(user=obj, action="watch").count()
        return admin_changelist_link(
            MediaAction, f"View {count} watch(es)", user__id__exact=obj.pk, action__exact="watch"
        )

    @admin.display(description="Reports")
    def related_reports(self, obj):
        if not obj.pk:
            return "—"
        count = MediaAction.objects.filter(user=obj, action="report").count()
        return admin_changelist_link(
            MediaAction, f"View {count} report(s)", user__id__exact=obj.pk, action__exact="report"
        )

    @admin.display(description="All activity")
    def related_actions(self, obj):
        if not obj.pk:
            return "—"
        count = MediaAction.objects.filter(user=obj).count()
        return admin_changelist_link(MediaAction, f"View {count} action(s)", user__id__exact=obj.pk)

    @admin.action(description="Approve users", permissions=["change"])
    def approve_users(self, request, queryset):
        updated = queryset.update(is_approved=True)
        self.message_user(request, f"Approved {updated} user(s).", messages.SUCCESS)

    @admin.action(description="Unapprove users", permissions=["change"])
    def unapprove_users(self, request, queryset):
        updated = queryset.update(is_approved=False)
        self.message_user(request, f"Unapproved {updated} user(s).", messages.SUCCESS)

    @admin.action(description="Deactivate users", permissions=["change"])
    def deactivate_users(self, request, queryset):
        updated = queryset.exclude(pk=request.user.pk).update(is_active=False)
        self.message_user(request, f"Deactivated {updated} user(s).", messages.SUCCESS)

    @admin.action(description="Reactivate users", permissions=["change"])
    def reactivate_users(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f"Reactivated {updated} user(s).", messages.SUCCESS)

    def get_actions(self, request):
        actions = super().get_actions(request)
        if not getattr(settings, "USERS_NEEDS_TO_BE_APPROVED", False):
            actions.pop("approve_users", None)
            actions.pop("unapprove_users", None)
        return actions

    actions = [approve_users, unapprove_users, deactivate_users, reactivate_users]


class ChannelAdmin(admin.ModelAdmin):
    search_fields = ["title", "friendly_token", "user__username"]
    list_display = ["title", "link_user", "add_date", "friendly_token", "related_media_count"]
    list_select_related = ("user",)
    list_filter = ["add_date", ("user", admin.RelatedOnlyFieldListFilter)]
    ordering = ("-add_date",)
    date_hierarchy = "add_date"
    readonly_fields = ("friendly_token", "link_user", "related_media")
    exclude = ("user",)
    inlines = [ChannelMediaInline]
    fieldsets = (
        (
            "Channel",
            {
                "fields": (
                    "title",
                    "description",
                    "link_user",
                    "friendly_token",
                    "banner_logo",
                    "subscribers",
                ),
                "classes": ("tab",),
            },
        ),
        (
            "Related",
            {
                "fields": ("related_media",),
                "classes": ("tab", "related-links-tab"),
                "description": "Links to filtered admin lists for related records. Media items are listed on the following tab.",
            },
        ),
    )

    @admin.display(description="User", ordering="user__username")
    def link_user(self, obj):
        return admin_change_link(obj.user, obj.user.username if obj.user_id else None)

    @admin.display(description="Media")
    def related_media(self, obj):
        if not obj.pk:
            return "—"
        count = Media.objects.filter(channel=obj).count()
        return admin_changelist_link(Media, f"View {count} media item(s)", channel__id__exact=obj.pk)

    @admin.display(description="Media count")
    def related_media_count(self, obj):
        count = Media.objects.filter(channel=obj).count()
        return admin_changelist_link(Media, str(count), channel__id__exact=obj.pk)


admin.site.register(User, UserAdmin)
admin.site.register(Channel, ChannelAdmin)
