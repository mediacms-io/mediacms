from django.conf import settings
from django.contrib import admin

from allauth.socialaccount.models import SocialAccount, SocialApp, SocialToken
from allauth.socialaccount.admin import SocialAppAdmin, SocialAccountAdmin

from saml_auth.models import SAMLConfiguration 
from identity_providers.models import IdentityProviderUserLog

class IdentityProviderUserLogAdmin(admin.ModelAdmin):
    list_display = [
        'social_app',
        'user',
        'created_at',
    ]

    list_filter = ['social_app', 'created_at']

    search_fields = ['social_app__name', 'user__username', 'user__email', 'logs']

    readonly_fields = ['social_app', 'user', 'created_at', 'logs']


class SAMLConfigurationInline(admin.StackedInline):
    model = SAMLConfiguration
    extra = 0
    can_delete = True
    show_change_link = True


class CustomSocialAppAdmin(SocialAppAdmin):
    change_form_template = 'admin/identity_providers/change_form.html'
    list_display = ('get_config_name', 'get_protocol')
    fields = ('provider', 'provider_id', 'name', 'client_id', 'sites')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.inlines = []

        if getattr(settings, 'USE_SAML', False):
            self.inlines.append(SAMLConfigurationInline)


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


class CustomSocialAccountAdmin(SocialAccountAdmin):
    list_display = ('user', 'uid', 'get_provider')

    def get_provider(self, obj):
        return obj.provider

    def formfield_for_dbfield(self, db_field, **kwargs):
        field = super().formfield_for_dbfield(db_field, **kwargs)
        if db_field.name == 'provider':
            field.label = 'Provider ID'
        return field

    get_provider.short_description = 'Provider ID'



if getattr(settings, 'USE_IDENTITY_PROVIDERS', False):
    admin.site.register(IdentityProviderUserLog, IdentityProviderUserLogAdmin)
    admin.site.unregister(SocialToken)


    # This is unregistering the default Social App and registers the custom one here,
    # with mostly name setting options
    IdentityProviderUserLog._meta.verbose_name = "User Logs"
    IdentityProviderUserLog._meta.verbose_name_plural = "User Logs"

    SocialAccount._meta.verbose_name = "User Account"
    SocialAccount._meta.verbose_name_plural = "User Accounts"
    admin.site.unregister(SocialApp)
    admin.site.register(SocialApp, CustomSocialAppAdmin)
    admin.site.unregister(SocialAccount)
    admin.site.register(SocialAccount, CustomSocialAccountAdmin)
    SocialApp._meta.verbose_name = "ID Provider"
    SocialApp._meta.verbose_name_plural = "ID Providers"
    SocialAccount._meta.app_config.verbose_name = "Identity Providers"

