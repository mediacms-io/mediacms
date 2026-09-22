from django.contrib import admin

from .models import MigrationRecord, MigrationService


@admin.register(MigrationService)
class MigrationServiceAdmin(admin.ModelAdmin):
    list_display = ["name", "provider", "status", "created_at", "last_activity"]
    list_filter = ["provider", "status"]
    search_fields = ["name", "source_system"]
    readonly_fields = ["source_system", "cursor", "totals", "log", "created_at", "last_activity"]


@admin.register(MigrationRecord)
class MigrationRecordAdmin(admin.ModelAdmin):
    list_display = ["service", "object_type", "source_id", "target_id", "status", "created_at"]
    list_filter = ["object_type", "status", "service"]
    search_fields = ["source_id"]
    readonly_fields = ["service", "object_type", "source_id", "target_id", "status", "log"]
