from django.conf import settings
from django.contrib import admin
from django.db.models import Count, Q

from .models import User


class UserAdmin(admin.ModelAdmin):
    search_fields = ["email", "username", "name"]
    exclude = ["user_permissions", "title", "password", "groups", "last_login", "is_featured", "location", "first_name", "last_name", "date_joined", "is_active", "is_approved"]
    list_display = [
        "username",
        "name",
        "email",
        "logo",
        "date_added",
        "is_superuser",
        "is_editor",
        "is_manager",
        "media_count",
    ]
    list_filter = ["is_superuser", "is_editor", "is_manager"]
    ordering = ("-date_added",)

    if settings.USERS_NEEDS_TO_BE_APPROVED:
        list_display.append("is_approved")
        list_filter.append("is_approved")
        exclude.remove("is_approved")

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(media_count_annot=Count("media", filter=Q(media__listable=True)))

    @admin.display(description="Media count", ordering="media_count_annot")
    def media_count(self, obj):
        return obj.media_count_annot


admin.site.register(User, UserAdmin)
