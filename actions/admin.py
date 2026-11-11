from django.contrib import admin, messages

from admin_customizations.action_choices import (
    GroupedActionForm,
    build_grouped_action_choices,
)
from files.admin_helpers import admin_change_link
from files.methods import clear_media_reports, is_mediacms_editor
from files.models import Media

from .models import MODERATION_MEDIA_ACTIONS, MediaAction

# Keep in sync with files.admin.MEDIA_REPORT_TAB_ACTIONS (avoid importing files.admin here).
MEDIA_REPORT_TAB_ACTIONS = ("report",) + tuple(name for name, _label in MODERATION_MEDIA_ACTIONS)


@admin.register(MediaAction)
class MediaActionAdmin(admin.ModelAdmin):
    list_display = ['action', 'link_media', 'link_user', 'action_date', 'remote_ip', 'extra_info']
    list_filter = ['action', 'action_date', ('media', admin.RelatedOnlyFieldListFilter), ('user', admin.RelatedOnlyFieldListFilter)]
    search_fields = ['media__title', 'user__username', 'extra_info']
    list_select_related = ('media', 'user')
    readonly_fields = ['user', 'media', 'action_date', 'remote_ip', 'session_key', 'link_media', 'link_user']
    ordering = ('-action_date',)
    date_hierarchy = 'action_date'
    action_form = GroupedActionForm
    action_groups = [
        ["clear_reports_for_related_media"],
        ["delete_selected"],
    ]

    fieldsets = (
        (
            "Action",
            {
                "fields": ("action", "extra_info", "action_date", "remote_ip", "session_key"),
                "classes": ("tab",),
            },
        ),
        (
            "Related",
            {
                "fields": ("link_media", "link_user"),
                "classes": ("tab", "related-links-tab"),
            },
        ),
    )

    @admin.display(description="Media", ordering="media__title")
    def link_media(self, obj):
        fragment = "reports-tab" if obj.action in MEDIA_REPORT_TAB_ACTIONS else None
        return admin_change_link(obj.media, obj.media.title if obj.media_id else None, fragment=fragment)

    @admin.display(description="User", ordering="user__username")
    def link_user(self, obj):
        return admin_change_link(obj.user, obj.user.username if obj.user_id else None)

    def has_clear_reports_permission(self, request):
        return is_mediacms_editor(request.user)

    @admin.action(description="Clear reports for related media", permissions=["clear_reports"])
    def clear_reports_for_related_media(self, request, queryset):
        media_ids = queryset.filter(action="report").values_list("media_id", flat=True).distinct()
        media_qs = Media.objects.filter(pk__in=media_ids)
        count = clear_media_reports(media_qs, user=request.user)
        self.message_user(request, f"Cleared reports for {count} media item(s).", messages.SUCCESS)

    actions = [clear_reports_for_related_media]

    def get_actions(self, request):
        actions = super().get_actions(request)
        if "delete_selected" in actions:
            func, name, _description = actions["delete_selected"]
            actions["delete_selected"] = (func, name, "Delete selected media actions")
        return actions

    def get_action_choices(self, request, default_choices=None):
        return build_grouped_action_choices(self.get_actions(request), self.action_groups, opts=self.opts)
