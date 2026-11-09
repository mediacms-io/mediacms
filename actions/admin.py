from django.contrib import admin, messages

from files.admin_helpers import admin_change_link
from files.methods import clear_media_reports, is_mediacms_editor
from files.models import Media

from .models import MediaAction


@admin.register(MediaAction)
class MediaActionAdmin(admin.ModelAdmin):
    list_display = ['action', 'link_media', 'link_user', 'action_date', 'remote_ip', 'extra_info']
    list_filter = ['action', 'action_date', ('media', admin.RelatedOnlyFieldListFilter)]
    search_fields = ['media__title', 'user__username', 'extra_info']
    list_select_related = ('media', 'user')
    readonly_fields = ['user', 'media', 'action_date', 'remote_ip', 'session_key', 'link_media', 'link_user']
    ordering = ('-action_date',)
    date_hierarchy = 'action_date'

    fieldsets = (
        ('Action Details', {'fields': ('action', 'link_media', 'link_user', 'session_key')}),
        ('Additional Information', {'fields': ('extra_info', 'action_date', 'remote_ip')}),
    )

    @admin.display(description="Media", ordering="media__title")
    def link_media(self, obj):
        return admin_change_link(obj.media, obj.media.title if obj.media_id else None)

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
