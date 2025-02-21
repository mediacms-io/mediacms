from django.conf import settings

from django.contrib import admin
from django.utils.html import format_html
from allauth.socialaccount.models import SocialApp
from allauth.socialaccount.admin import SocialAppAdmin
from .models import SAMLConfiguration, SAMLLog

class SAMLConfigurationInline(admin.StackedInline):
    model = SAMLConfiguration
    extra = 0
    fieldsets = [
        ('Provider Settings', {
            'fields': [
                'idp_id',
                'idp_cert',
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
        ('Role Configuration', {
            'fields': [
                'role_mapping'
            ],
            'classes': ['collapse']
        })
    ]

class CustomSocialAppAdmin(SocialAppAdmin):
    inlines = [SAMLConfigurationInline]

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
        ('Role Configuration', {
            'fields': [
                'role_mapping'
            ],
            'classes': ['collapse']
        })
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
    admin.site.unregister(SocialApp)
    admin.site.register(SocialApp, CustomSocialAppAdmin)
    admin.site.register(SAMLConfiguration, SAMLConfigurationAdmin)
    admin.site.register(SAMLLog,  SAMLLogAdmin)
 
