from django.contrib import admin

from .models import MediaAction


@admin.register(MediaAction)
class MediaActionAdmin(admin.ModelAdmin):
    list_display = ['action', 'media', 'user', 'action_date', 'remote_ip']
    list_filter = ['action', 'action_date']
    search_fields = ['media__title', 'user__username', 'extra_info']
    readonly_fields = ['user', 'media', 'action_date', 'remote_ip', 'session_key']
    ordering = ('-action_date',)
    date_hierarchy = 'action_date'

    fieldsets = (
        ('Action Details', {'fields': ('action', 'media', 'user', 'session_key')}),
        ('Additional Information', {'fields': ('extra_info', 'action_date', 'remote_ip')}),
    )
