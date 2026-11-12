from django.contrib import admin

from .models import MigrationRecord, MigrationService


@admin.register(MigrationService)
class MigrationServiceAdmin(admin.ModelAdmin):
    list_display = ["created_at", "name", "provider", "status", "last_activity"]
    list_display_links = ("name",)
    list_filter = ["provider", "status"]
    search_fields = ["name", "source_system"]
    readonly_fields = ["source_system", "cursor", "totals", "log", "created_at", "last_activity"]


@admin.register(MigrationRecord)
class MigrationRecordAdmin(admin.ModelAdmin):
    list_display = ["created_at", "service", "object_type", "source_id", "target_id", "status"]
    list_display_links = ("service",)
    list_filter = ["object_type", "status", "service"]
    search_fields = ["source_id"]
    readonly_fields = ["service", "object_type", "source_id", "target_id", "status", "log"]
