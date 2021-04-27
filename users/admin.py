from django.contrib import admin

from .models import User


class UserAdmin(admin.ModelAdmin):
    search_fields = ["email", "username", "name"]
    exclude = (
        "user_permissions",
        "title",
        "password",
        "groups",
        "last_login",
        "is_featured",
        "location",
        "first_name",
        "last_name",
        "media_count",
        "date_joined",
        "is_active",
    )
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


admin.site.register(User, UserAdmin)
