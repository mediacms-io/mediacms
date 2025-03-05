from django.conf import settings

from django.contrib import admin
from django.utils.html import format_html
from allauth.socialaccount.models import SocialApp
from allauth.socialaccount.admin import SocialAppAdmin
from .models import SAMLConfiguration, SAMLLog, SAMLConfigurationGroupRole, SAMLConfigurationGlobalRole, SAMLConfigurationGroupMapping


class SAMLConfigurationGroupRoleInline(admin.TabularInline):
    model = SAMLConfigurationGroupRole
    extra = 1
    verbose_name = "Group Role Mapping"
    verbose_name_plural = "Group Role Mappings"
    fields = ['name', 'map_to']

class SAMLConfigurationGlobalRoleInline(admin.TabularInline):
    model = SAMLConfigurationGlobalRole
    extra = 1
    verbose_name = "Global Role Mapping"
    verbose_name_plural = "Global Role Mappings"
    fields = ['name', 'map_to']

class SAMLConfigurationGroupMappingInline(admin.TabularInline):
    model = SAMLConfigurationGroupMapping
    extra = 1
    verbose_name = "Group Mapping"
    verbose_name_plural = "Group Mappings"
    fields = ['name', 'map_to']



class SAMLConfigurationAdmin(admin.ModelAdmin):
    list_display = [
        'social_app',
        'idp_id',
        'create_groups',
        'remove_from_groups',
        'save_saml_response_logs',
        'view_metadata_url'
    ]
    
    list_filter = [
        'social_app',
        'create_groups',
        'remove_from_groups',
        'save_saml_response_logs'
    ]
    
    search_fields = [
        'social_app__name',
        'idp_id',
        'sp_metadata_url'
    ]
    
    fieldsets = [
        ('Provider Settings', {
            'fields': [
                'social_app',
                'idp_id',
                'idp_cert'
            ]
        }),
        ('URLs', {
            'fields': [
                'sso_url',
                'slo_url',
                'sp_metadata_url'
            ]
        }),
        ('Group Management', {
            'fields': [
                'create_groups',
                'remove_from_groups',
                'save_saml_response_logs'
            ]
        }),
        ('Email Settings', {
            'fields': [
                'verified_email',
                'email_authentication',
            ]
        }),
        ('Attribute Mapping', {
            'fields': [
                'uid',
                'name',
                'email',
                'groups',
                'first_name',
                'last_name',
                'user_logo',
                'role'
            ]
        }),
    ]

    inlines = [
        SAMLConfigurationGroupRoleInline,
        SAMLConfigurationGlobalRoleInline,
        SAMLConfigurationGroupMappingInline
    ]

    def view_metadata_url(self, obj):
        """Display metadata URL as a clickable link"""
        return format_html(
            '<a href="{}" target="_blank">View Metadata</a>',
            obj.sp_metadata_url
        )
    view_metadata_url.short_description = 'Metadata'

class SAMLLogAdmin(admin.ModelAdmin):
    list_display = [
        'social_app',
        'user',
        'created_at',
    ]
    
    list_filter = [
        'social_app',
        'created_at',
        'user'
    ]
    
    search_fields = [
        'social_app__name',
        'user__username',
        'user__email',
        'logs'
    ]
    
    readonly_fields = [
        'social_app',
        'user',
        'created_at',
        'logs'
    ]

if getattr(settings, 'USE_SAML', False):
    # Unregister the default SocialAppAdmin and register our custom one
    admin.site.register(SAMLConfiguration, SAMLConfigurationAdmin)
    admin.site.register(SAMLLog,  SAMLLogAdmin)
 
