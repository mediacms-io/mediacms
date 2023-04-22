from django.contrib import admin

from .models import (
    MediaAction,
    VoiceAction,
)

class MediaActionAdmin(admin.ModelAdmin):
    search_fields = ["action"] # Some fields here cannot be searched by `icontains`
    list_display = ["action", "extra_info", "user", "media", "action_date", "remote_ip", "session_key"]
    ordering = ("-action_date",)

class VoiceActionAdmin(admin.ModelAdmin):
    search_fields = ["action"] # Some fields here cannot be searched by `icontains`
    list_display = ["action", "extra_info", "user", "media", "action_date", "remote_ip", "session_key", "voice"]
    ordering = ("-action_date",)

admin.site.register(MediaAction, MediaActionAdmin)
admin.site.register(VoiceAction, VoiceActionAdmin)
