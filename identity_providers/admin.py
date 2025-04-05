import csv
import logging

from allauth.socialaccount.admin import SocialAccountAdmin, SocialAppAdmin
from allauth.socialaccount.models import SocialAccount, SocialApp, SocialToken
from django import forms
from django.conf import settings
from django.contrib import admin

from identity_providers.forms import ImportCSVsForm
from identity_providers.models import (
    IdentityProviderCategoryMapping,
    IdentityProviderGlobalRole,
    IdentityProviderGroupRole,
    IdentityProviderUserLog,
    LoginOption,
)
from rbac.models import RBACGroup
from saml_auth.models import SAMLConfiguration


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


class IdentityProviderCategoryMappingInlineForm(forms.ModelForm):
    class Meta:
        model = IdentityProviderCategoryMapping
        fields = ('name', 'map_to')

    # custom field to track if the row should be deleted
    should_delete = forms.BooleanField(required=False, widget=forms.HiddenInput())


class IdentityProviderCategoryMappingInline(admin.TabularInline):
    model = IdentityProviderCategoryMapping
    form = IdentityProviderCategoryMappingInlineForm
    extra = 0
    can_delete = True
    show_change_link = True
    verbose_name = "Category Mapping"
    verbose_name_plural = "Category Mapping"
    template = 'admin/socialaccount/socialapp/custom_tabular_inline.html'
    autocomplete_fields = ['map_to']

    def formfield_for_dbfield(self, db_field, **kwargs):
        formfield = super().formfield_for_dbfield(db_field, **kwargs)
        if db_field.name in ('name', 'map_to') and formfield:
            formfield.widget.attrs.update(
                {
                    'data-help-text': db_field.help_text,
                    'class': 'with-help-text',
                }
            )
        return formfield

    def get_formset(self, request, obj=None, **kwargs):
        formset = super().get_formset(request, obj, **kwargs)
        return formset

    def has_delete_permission(self, request, obj=None):
        return True


class RBACGroupInlineForm(forms.ModelForm):
    class Meta:
        model = RBACGroup
        fields = ('uid', 'name')
        labels = {
            'uid': 'Group Attribute Value',
            'name': 'Name',
        }
        help_texts = {
            'uid': 'Identity Provider group attribute value',
            'name': 'MediaCMS Group name',
        }

    # custom field to track if the row should be deleted
    should_delete = forms.BooleanField(required=False, widget=forms.HiddenInput())


class RBACGroupInline(admin.TabularInline):
    model = RBACGroup
    form = RBACGroupInlineForm
    extra = 0
    can_delete = True
    show_change_link = True
    verbose_name = "Group Mapping"
    verbose_name_plural = "Group Mapping"
    template = 'admin/socialaccount/socialapp/custom_tabular_inline_for_groups.html'

    def formfield_for_dbfield(self, db_field, **kwargs):
        formfield = super().formfield_for_dbfield(db_field, **kwargs)
        if db_field.name in ('uid', 'name') and formfield:
            formfield.widget.attrs.update(
                {
                    'data-help-text': db_field.help_text,
                    'class': 'with-help-text',
                }
            )
        return formfield

    def get_formset(self, request, obj=None, **kwargs):
        formset = super().get_formset(request, obj, **kwargs)
        return formset

    def has_delete_permission(self, request, obj=None):
        return True


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
        self.inlines.append(RBACGroupInline)
        self.inlines.append(IdentityProviderCategoryMappingInline)

    def get_protocol(self, obj):
        return obj.provider

    def get_config_name(self, obj):
        return obj.name

    def formfield_for_dbfield(self, db_field, **kwargs):
        field = super().formfield_for_dbfield(db_field, **kwargs)
        if db_field.name == 'provider':
            field.label = 'Protocol'
            field.help_text = "The provider type, eg `google`. For SAML providers, make sure this is set to `saml` lowercase."
        elif db_field.name == 'name':
            field.label = 'IDP Config Name'
            field.help_text = "This should be a unique name for the provider."
        elif db_field.name == 'client_id':
            field.help_text = 'App ID, or consumer key. For SAML providers, this will be part of the default login URL /accounts/saml/{client_id}/login/'
        elif db_field.name == 'sites':
            field.required = True
            field.help_text = "Select at least one site where this social application is available. Required."
        elif db_field.name == 'provider_id':
            field.required = True
            field.help_text = "This should be a unique identifier for the provider."
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
                        if not (RBACGroup.objects.filter(identity_provider=obj, uid=group_id).exists() or RBACGroup.objects.filter(identity_provider=obj, name=name).exists()):
                            try:
                                group = RBACGroup.objects.create(identity_provider=obj, uid=group_id, name=name)  # noqa
                            except Exception as e:
                                logging.error(e)
            except Exception as e:
                logging.error(e)

        csv_file = form.cleaned_data.get('categories_csv')
        if csv_file:
            from files.models import Category

            try:
                csv_file.seek(0)
                decoded_file = csv_file.read().decode('utf-8').splitlines()
                csv_reader = csv.DictReader(decoded_file)
                for row in csv_reader:
                    group_id = row.get('group_id')
                    category_id = row.get('category_id')
                    if group_id and category_id:
                        category = Category.objects.filter(uid=category_id).first()
                        if category:
                            if not IdentityProviderCategoryMapping.objects.filter(identity_provider=obj, name=group_id, map_to=category).exists():
                                mapping = IdentityProviderCategoryMapping.objects.create(identity_provider=obj, name=group_id, map_to=category)  # noqa
            except Exception as e:
                logging.error(e)

    def save_formset(self, request, form, formset, change):
        instances = formset.save(commit=False)

        for form in formset.forms:
            if form.cleaned_data.get('should_delete', False) and form.instance.pk:
                instances.remove(form.instance)
                form.instance.delete()

        for instance in instances:
            instance.save()
        formset.save_m2m()


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


class IdentityProviderGroupRoleInlineForm(forms.ModelForm):
    class Meta:
        model = IdentityProviderGroupRole
        fields = ('name', 'map_to')

    # custom field to track if the row should be deleted
    should_delete = forms.BooleanField(required=False, widget=forms.HiddenInput())

    def clean(self):
        cleaned_data = super().clean()
        name = cleaned_data.get('name')
        identity_provider = getattr(self.instance, 'identity_provider', None)

        if name and identity_provider:
            if IdentityProviderGroupRole.objects.filter(identity_provider=identity_provider, name=name).exclude(pk=self.instance.pk).exists():
                self.add_error('name', 'A group role mapping with this name already exists for this Identity provider.')


class IdentityProviderGroupRoleInline(admin.TabularInline):
    model = IdentityProviderGroupRole
    form = IdentityProviderGroupRoleInlineForm
    extra = 0
    verbose_name = "Group Role Mapping"
    verbose_name_plural = "Group Role Mapping"
    template = 'admin/socialaccount/socialapp/custom_tabular_inline.html'

    def formfield_for_dbfield(self, db_field, **kwargs):
        formfield = super().formfield_for_dbfield(db_field, **kwargs)
        if db_field.name in ('name',) and formfield:
            formfield.widget.attrs.update(
                {
                    'data-help-text': db_field.help_text,
                    'class': 'with-help-text',
                }
            )
        return formfield

    def get_formset(self, request, obj=None, **kwargs):
        formset = super().get_formset(request, obj, **kwargs)
        return formset

    def has_delete_permission(self, request, obj=None):
        return True


class IdentityProviderGlobalRoleInlineForm(forms.ModelForm):
    class Meta:
        model = IdentityProviderGlobalRole
        fields = ('name', 'map_to')

    # custom field to track if the row should be deleted
    should_delete = forms.BooleanField(required=False, widget=forms.HiddenInput())

    def clean(self):
        cleaned_data = super().clean()
        name = cleaned_data.get('name')
        identity_provider = getattr(self.instance, 'identity_provider', None)

        if name and identity_provider:
            if IdentityProviderGlobalRole.objects.filter(identity_provider=identity_provider, name=name).exclude(pk=self.instance.pk).exists():
                self.add_error('name', 'A global role mapping with this name already exists for this Identity provider.')


class IdentityProviderGlobalRoleInline(admin.TabularInline):
    model = IdentityProviderGlobalRole
    form = IdentityProviderGlobalRoleInlineForm
    extra = 0
    verbose_name = "Global Role Mapping"
    verbose_name_plural = "Global Role Mapping"
    template = 'admin/socialaccount/socialapp/custom_tabular_inline.html'

    def formfield_for_dbfield(self, db_field, **kwargs):
        formfield = super().formfield_for_dbfield(db_field, **kwargs)
        if db_field.name in ('name',) and formfield:
            formfield.widget.attrs.update(
                {
                    'data-help-text': db_field.help_text,
                    'class': 'with-help-text',
                }
            )
        return formfield

    def get_formset(self, request, obj=None, **kwargs):
        formset = super().get_formset(request, obj, **kwargs)
        return formset

    def has_delete_permission(self, request, obj=None):
        return True


class LoginOptionAdmin(admin.ModelAdmin):
    list_display = ('title', 'url', 'ordering', 'active')
    list_editable = ('ordering', 'active')
    list_filter = ('active',)
    search_fields = ('title', 'url')


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
    admin.site.register(LoginOption, LoginOptionAdmin)
    admin.site.unregister(SocialAccount)
    admin.site.register(SocialAccount, CustomSocialAccountAdmin)
    SocialApp._meta.verbose_name = "ID Provider"
    SocialApp._meta.verbose_name_plural = "ID Providers"
    SocialAccount._meta.app_config.verbose_name = "Identity Providers"
