from django.conf import settings

from django.contrib import admin
from django.utils.html import format_html
from allauth.socialaccount.models import SocialAccount, SocialApp, SocialToken
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
        'remove_from_groups',
        'save_saml_response_logs',
        'view_metadata_url'
    ]
    
    list_filter = [
        'social_app',
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
        SAMLConfigurationGlobalRoleInline,
        SAMLConfigurationGroupRoleInline,
        SAMLConfigurationGroupMappingInline
    ]

    def view_metadata_url(self, obj):
        """Display metadata URL as a clickable link"""
        return format_html(
            '<a href="{}" target="_blank">View Metadata</a>',
            obj.sp_metadata_url
        )
    view_metadata_url.short_description = 'Metadata'

    def formfield_for_dbfield(self, db_field, **kwargs):
        field = super().formfield_for_dbfield(db_field, **kwargs)
        if db_field.name == 'social_app':
            field.label = 'IDP Config Name'
        return field

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


class CustomSocialAppAdmin(SocialAppAdmin):
    list_display = ('get_config_name', 'get_protocol')

    fields = ('provider', 'provider_id', 'name', 'client_id', 'sites')

    def get_protocol(self, obj):
        return obj.provider

    def get_config_name(self, obj):
        return obj.name

    def formfield_for_dbfield(self, db_field, **kwargs):
        field = super().formfield_for_dbfield(db_field, **kwargs)
        if db_field.name == 'provider':
            field.label = 'Protocol'
        elif db_field.name == 'name':
            field.label = 'IDP Config Name'
        return field

    get_config_name.short_description = 'IDP Config Name'
    get_protocol.short_description = 'Protocol'


if getattr(settings, 'USE_SAML', False):
    for field in SAMLConfiguration._meta.fields:
        if field.name == 'social_app':
            field.verbose_name = "ID Provider"

    admin.site.register(SAMLConfiguration, SAMLConfigurationAdmin)
    admin.site.register(SAMLLog,  SAMLLogAdmin)

    admin.site.unregister(SocialToken)

    # This is unregistering the default Social App and registers the custom one here, 
    # with mostly name setting options
    SocialAccount._meta.verbose_name = "User Account"
    SocialAccount._meta.verbose_name_plural = "User Accounts"
    admin.site.unregister(SocialApp)
    admin.site.register(SocialApp, CustomSocialAppAdmin)
    SocialApp._meta.verbose_name = "ID Provider"
    SocialApp._meta.verbose_name_plural = "ID Providers"
    SocialAccount._meta.app_config.verbose_name = "Identity Providers"
