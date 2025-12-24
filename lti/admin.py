"""
Django Admin for LTI models
"""

from django.contrib import admin
from django.utils.html import format_html

from .models import (
    LTILaunchLog,
    LTIPlatform,
    LTIResourceLink,
    LTIRoleMapping,
    LTIUserMapping,
)


@admin.register(LTIPlatform)
class LTIPlatformAdmin(admin.ModelAdmin):
    """Admin for LTI Platforms (Moodle instances)"""

    list_display = ['name', 'platform_id', 'client_id', 'active_badge', 'nrps_enabled', 'deep_linking_enabled', 'created_at']
    list_filter = ['active', 'enable_nrps', 'enable_deep_linking', 'created_at']
    search_fields = ['name', 'platform_id', 'client_id']
    readonly_fields = ['created_at', 'updated_at', 'key_set_updated']

    fieldsets = (
        ('Basic Information', {'fields': ('name', 'platform_id', 'client_id', 'active')}),
        ('OIDC Endpoints', {'fields': ('auth_login_url', 'auth_token_url', 'auth_audience')}),
        ('JWK Configuration', {'fields': ('key_set_url', 'key_set', 'key_set_updated'), 'classes': ('collapse',)}),
        ('Deployment & Features', {'fields': ('deployment_ids', 'enable_nrps', 'enable_deep_linking')}),
        ('Auto-Provisioning Settings', {'fields': ('auto_create_categories', 'auto_create_users', 'auto_sync_roles', 'remove_from_groups_on_unenroll')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )

    def active_badge(self, obj):
        """Display active status as badge"""
        if obj.active:
            return format_html('<span style="color: green;">✓ Active</span>')
        return format_html('<span style="color: red;">✗ Inactive</span>')

    active_badge.short_description = 'Status'

    def nrps_enabled(self, obj):
        return '✓' if obj.enable_nrps else '✗'

    nrps_enabled.short_description = 'NRPS'

    def deep_linking_enabled(self, obj):
        return '✓' if obj.enable_deep_linking else '✗'

    deep_linking_enabled.short_description = 'Deep Link'


@admin.register(LTIResourceLink)
class LTIResourceLinkAdmin(admin.ModelAdmin):
    """Admin for LTI Resource Links"""

    list_display = ['context_title', 'platform', 'category_link', 'rbac_group_link', 'launch_count', 'last_launch']
    list_filter = ['platform', 'created_at', 'last_launch']
    search_fields = ['context_id', 'context_title', 'resource_link_id']
    readonly_fields = ['created_at', 'last_launch', 'launch_count']

    fieldsets = (
        ('Platform', {'fields': ('platform',)}),
        ('Context (Course)', {'fields': ('context_id', 'context_title', 'context_label')}),
        ('Resource Link', {'fields': ('resource_link_id', 'resource_link_title')}),
        ('MediaCMS Mappings', {'fields': ('category', 'rbac_group', 'media')}),
        ('Metrics', {'fields': ('launch_count', 'last_launch', 'created_at'), 'classes': ('collapse',)}),
    )

    def category_link(self, obj):
        if obj.category:
            return format_html('<a href="/admin/files/category/{}/change/">{}</a>', obj.category.id, obj.category.title)
        return '-'

    category_link.short_description = 'Category'

    def rbac_group_link(self, obj):
        if obj.rbac_group:
            return format_html('<a href="/admin/rbac/rbacgroup/{}/change/">{}</a>', obj.rbac_group.id, obj.rbac_group.name)
        return '-'

    rbac_group_link.short_description = 'RBAC Group'


@admin.register(LTIUserMapping)
class LTIUserMappingAdmin(admin.ModelAdmin):
    """Admin for LTI User Mappings"""

    list_display = ['user_link', 'lti_user_id', 'platform', 'email', 'last_login']
    list_filter = ['platform', 'created_at', 'last_login']
    search_fields = ['lti_user_id', 'user__username', 'user__email', 'email']
    readonly_fields = ['created_at', 'last_login']

    fieldsets = (
        ('Mapping', {'fields': ('platform', 'lti_user_id', 'user')}),
        ('User Info (Cached)', {'fields': ('email', 'given_name', 'family_name', 'name')}),
        ('Timestamps', {'fields': ('created_at', 'last_login')}),
    )

    def user_link(self, obj):
        return format_html('<a href="/admin/users/user/{}/change/">{}</a>', obj.user.id, obj.user.username)

    user_link.short_description = 'MediaCMS User'


@admin.register(LTIRoleMapping)
class LTIRoleMappingAdmin(admin.ModelAdmin):
    """Admin for LTI Role Mappings"""

    list_display = ['lti_role', 'platform', 'global_role', 'group_role']
    list_filter = ['platform', 'global_role', 'group_role']
    search_fields = ['lti_role']

    fieldsets = (
        ('LTI Role', {'fields': ('platform', 'lti_role')}),
        ('MediaCMS Roles', {'fields': ('global_role', 'group_role'), 'description': 'Map this LTI role to MediaCMS global and group roles'}),
    )


@admin.register(LTILaunchLog)
class LTILaunchLogAdmin(admin.ModelAdmin):
    """Admin for LTI Launch Logs"""

    list_display = ['created_at', 'platform', 'user_link', 'launch_type', 'success_badge', 'ip_address']
    list_filter = ['success', 'launch_type', 'platform', 'created_at']
    search_fields = ['user__username', 'ip_address', 'error_message']
    readonly_fields = ['created_at', 'claims']
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Launch Info', {'fields': ('platform', 'user', 'resource_link', 'launch_type', 'success', 'ip_address', 'created_at')}),
        ('Error Details', {'fields': ('error_message',), 'classes': ('collapse',)}),
        ('Claims Data', {'fields': ('claims',), 'classes': ('collapse',)}),
    )

    def success_badge(self, obj):
        if obj.success:
            return format_html('<span style="color: green;">✓ Success</span>')
        return format_html('<span style="color: red;">✗ Failed</span>')

    success_badge.short_description = 'Status'

    def user_link(self, obj):
        if obj.user:
            return format_html('<a href="/admin/users/user/{}/change/">{}</a>', obj.user.id, obj.user.username)
        return '-'

    user_link.short_description = 'User'

    def has_add_permission(self, request):
        """Disable manual creation of launch logs"""
        return False

    def has_change_permission(self, request, obj=None):
        """Make launch logs read-only"""
        return False
