from django.conf import settings
from django.contrib import admin, messages

from admin_customizations.action_choices import (
    GroupedActionForm,
    build_grouped_action_choices,
)
from files.admin_helpers import admin_change_link, admin_changelist_link
from files.models import Comment, Media, Playlist

from .models import Channel, User


class UserAdmin(admin.ModelAdmin):
    search_fields = ["email", "username", "name"]
    exclude = ["user_permissions", "title", "password", "groups", "last_login", "is_featured", "location", "first_name", "last_name", "media_count", "date_joined", "is_approved"]
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
    list_filter = ["is_active", "is_superuser", "is_editor", "is_manager"]
    list_editable = []
    ordering = ("-date_added",)
    date_hierarchy = "date_added"
    readonly_fields = (
        "related_media",
        "related_channels",
        "related_playlists",
        "related_comments",
    )
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
