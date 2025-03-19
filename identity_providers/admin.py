import logging
import csv
from django.core.exceptions import ValidationError

from django.conf import settings
from django.contrib import admin
from django import forms
from allauth.socialaccount.models import SocialAccount, SocialApp, SocialToken
from allauth.socialaccount.admin import SocialAppAdmin, SocialAccountAdmin

from saml_auth.models import SAMLConfiguration 
from identity_providers.forms import ImportCSVsForm

from identity_providers.models import IdentityProviderUserLog, IdentityProviderGroupRole, IdentityProviderGlobalRole, IdentityProviderGroupMapping, IdentityProviderCategoryMapping

class IdentityProviderUserLogAdmin(admin.ModelAdmin):
    list_display = [
        'identity_provider',
        'user',
        'created_at',
    ]

    list_filter = ['identity_provider', 'created_at']

    search_fields = ['identity_provider__name', 'user__username', 'user__email', 'logs']

    readonly_fields = ['identity_provider', 'user', 'created_at', 'logs']


class SAMLConfigurationInline(admin.StackedInline):
    model = SAMLConfiguration
    extra = 0
    can_delete = True
    max_num = 1


class IdentityProviderCategoryMappingInline(admin.TabularInline):
    model = IdentityProviderCategoryMapping
    extra = 1
    can_delete = True
    show_change_link = True
    verbose_name = "Category Mapping"
    verbose_name_plural = "Category Mapping"

    def formfield_for_dbfield(self, db_field, **kwargs):
        formfield = super().formfield_for_dbfield(db_field, **kwargs)
        if db_field.name in ('name', 'map_to') and formfield:
            formfield.widget.attrs.update({
                'data-help-text': db_field.help_text,
                'class': 'with-help-text',
            })
        return formfield

    class Media:
        js = ('admin/js/inline_help_text.js',)
        css = {
            'all': ('admin/css/inline_help_text.css',)
        }

class IdentityProviderGroupMappingInline(admin.TabularInline):
    model = IdentityProviderGroupMapping
    extra = 1
    can_delete = True
    show_change_link = True
    verbose_name = "Group Mapping"
    verbose_name_plural = "Group Mapping"

    def formfield_for_dbfield(self, db_field, **kwargs):
        formfield = super().formfield_for_dbfield(db_field, **kwargs)
        if db_field.name in ('name', 'map_to') and formfield:
            formfield.widget.attrs.update({
                'data-help-text': db_field.help_text,
                'class': 'with-help-text',
            })
        return formfield

    class Media:
        js = ('admin/js/inline_help_text.js',)
        css = {
            'all': ('admin/css/inline_help_text.css',)
        }

class CustomSocialAppAdmin(SocialAppAdmin):
    # The default SocialAppAdmin has been overriden to achieve a number of changes. 
    # If you need to add more fields (out of those that are hidden), or remove tabs, or 
    # change the ordering of fields, or the place where fields appear, don't forget to 
    # check the html template!


    change_form_template = 'admin/socialaccount/socialapp/change_form.html'
    list_display = ('get_config_name', 'get_protocol')
    fields = ('provider', 'provider_id', 'name', 'client_id', 'sites', 'groups_csv', 'categories_csv')
    form = ImportCSVsForm

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.inlines = []

        if getattr(settings, 'USE_SAML', False):
            self.inlines.append(SAMLConfigurationInline)
        self.inlines.append(IdentityProviderGlobalRoleInline)
        self.inlines.append(IdentityProviderGroupRoleInline)
        self.inlines.append(IdentityProviderGroupMappingInline)
        self.inlines.append(IdentityProviderCategoryMappingInline)


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

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        csv_file = form.cleaned_data.get('groups_csv')
        if csv_file:
            try:
                csv_file.seek(0)
                decoded_file = csv_file.read().decode('utf-8').splitlines()
                csv_reader = csv.DictReader(decoded_file)
                for row in csv_reader:
                    group_id = row.get('group_id')
                    name = row.get('name')

                    if group_id and name:
                        if not IdentityProviderGroupMapping.objects.filter(identity_provider=obj, name=group_id).exists():
                            try:
                                mapping = IdentityProviderGroupMapping.objects.create(identity_provider=obj, name=group_id, map_to=name)
                            except Exception as e:
                                logging.error(e)
            except Exception as e:
                logging.error(e)


        csv_file = form.cleaned_data.get('categories_csv')
        if csv_file:
            try:
                csv_file.seek(0)
                decoded_file = csv_file.read().decode('utf-8').splitlines()
                csv_reader = csv.DictReader(decoded_file)
                for row in csv_reader:
                    group_id = row.get('group_id')
                    category_id = row.get('category_id')

                    if group_id and category_id:
                        if not IdentityProviderCategoryMapping.objects.filter(identity_provider=obj, name=group_id).exists():
                            try:
                                mapping = IdentityProviderCategoryMapping.objects.create(identity_provider=obj, name=group_id, map_to=category_id)
                            except Exception as e:
                                logging.error(e)
                        
            except Exception as e:
                logging.error(e)


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

class GlobalRoleInlineFormset(forms.models.BaseInlineFormSet):
    def save_new(self, form, commit=True):
        obj = super().save_new(form, commit=False)
        obj.identity_provider = self.instance
        if commit:
            obj.save()
        return obj

    def clean(self):
        super().clean()
        for form in self.forms:
            if not form.is_valid() or not form.cleaned_data:
                continue

            name = form.cleaned_data.get('name')
            identity_provider = form.cleaned_data.get('identity_provider')
            if name and identity_provider:
                if IdentityProviderGlobalRole.objects.filter(identity_provider=identity_provider, name=name).exclude(pk=form.instance.pk).exists():
                    form.add_error('name', 'A global role mapping with this name already exists for this Identity provider.')



class GroupRoleInlineFormset(forms.models.BaseInlineFormSet):
    def save_new(self, form, commit=True):
        obj = super().save_new(form, commit=False)
        obj.identity_provider = self.instance
        if commit:
            obj.save()
        return obj

    def clean(self):
        super().clean()
        for form in self.forms:
            if not form.is_valid() or not form.cleaned_data:
                continue

            name = form.cleaned_data.get('name')
            identity_provider = form.cleaned_data.get('identity_provider')
            if name and identity_provider:
                if IdentityProviderGroupRole.objects.filter(identity_provider=identity_provider, name=name).exclude(pk=form.instance.pk).exists():
                    form.add_error('name', 'A group role mapping with this name already exists for this Identity provider.')


class IdentityProviderGlobalRoleInline(admin.TabularInline):
    model = IdentityProviderGlobalRole
    formset = GlobalRoleInlineFormset    
    extra = 1
    verbose_name = "Global Role Mapping"
    verbose_name_plural = "Global Role Mapping"
    fields = ('name', 'map_to')

    def clean(self):
        super().clean()
        for form in self.forms:
            if not form.is_valid() or not form.cleaned_data:
                continue

            name = form.cleaned_data.get('name')
            identity_provider = form.cleaned_data.get('identity_provider')
            if name and identity_provider:
                if IdentityProviderGlobalRole.objects.filter(identity_provider=identity_provider, name=name).exclude(pk=form.instance.pk).exists():
                    form.add_error('name', 'A global role mapping with this Identity Provider already exists')

    def formfield_for_dbfield(self, db_field, **kwargs):
        formfield = super().formfield_for_dbfield(db_field, **kwargs)
        if db_field.name in ('name', ) and formfield:
            formfield.widget.attrs.update({
                'data-help-text': db_field.help_text,
                'class': 'with-help-text',
            })
        return formfield

    class Media:
        js = ('admin/js/inline_help_text.js',)
        css = {
            'all': ('admin/css/inline_help_text.css',)
        }

class IdentityProviderGroupRoleInline(admin.TabularInline):
    model = IdentityProviderGroupRole
    formset = GroupRoleInlineFormset    
    extra = 1
    verbose_name = "Group Role Mapping"
    verbose_name_plural = "Group Role Mapping"
    fields = ('name', 'map_to')
    
    def formfield_for_dbfield(self, db_field, **kwargs):
        formfield = super().formfield_for_dbfield(db_field, **kwargs)
        if db_field.name in ('name', ) and formfield:
            formfield.widget.attrs.update({
                'data-help-text': db_field.help_text,
                'class': 'with-help-text',
            })
        return formfield

    class Media:
        js = ('admin/js/inline_help_text.js',)
        css = {
            'all': ('admin/css/inline_help_text.css',)
        }


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


