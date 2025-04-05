import csv
import logging

from django import forms
from django.conf import settings
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.utils.html import format_html

from .models import SAMLConfiguration


class SAMLConfigurationForm(forms.ModelForm):
    import_csv = forms.FileField(required=False, label="CSV file", help_text="Make sure headers are group_id, name")

    class Meta:
        model = SAMLConfiguration
        fields = '__all__'

    def clean_import_csv(self):
        csv_file = self.cleaned_data.get('import_csv')

        if not csv_file:
            return csv_file

        if not csv_file.name.endswith('.csv'):
            raise ValidationError("Uploaded file must be a CSV file.")

        try:
            decoded_file = csv_file.read().decode('utf-8').splitlines()
            csv_reader = csv.reader(decoded_file)
            headers = next(csv_reader, None)
            if not headers or 'group_id' not in headers or 'name' not in headers:
                raise ValidationError("CSV file must contain 'group_id' and 'name' headers. " f"Found headers: {', '.join(headers) if headers else 'none'}")
            csv_file.seek(0)
            return csv_file

        except csv.Error:
            raise ValidationError("Invalid CSV file. Please ensure the file is properly formatted.")
        except UnicodeDecodeError:
            raise ValidationError("Invalid file encoding. Please upload a CSV file with UTF-8 encoding.")


class SAMLConfigurationAdmin(admin.ModelAdmin):
    form = SAMLConfigurationForm

    list_display = ['social_app', 'idp_id', 'remove_from_groups', 'save_saml_response_logs', 'view_metadata_url']

    list_filter = ['social_app', 'remove_from_groups', 'save_saml_response_logs']

    search_fields = ['social_app__name', 'idp_id', 'sp_metadata_url']

    fieldsets = [
        ('Provider Settings', {'fields': ['social_app', 'idp_id', 'idp_cert']}),
        ('URLs', {'fields': ['sso_url', 'slo_url', 'sp_metadata_url']}),
        ('Group Management', {'fields': ['remove_from_groups', 'save_saml_response_logs']}),
        ('Attribute Mapping', {'fields': ['uid', 'name', 'email', 'groups', 'first_name', 'last_name', 'user_logo', 'role']}),
        (
            'Email Settings',
            {
                'fields': [
                    'verified_email',
                    'email_authentication',
                ]
            },
        ),
    ]

    def view_metadata_url(self, obj):
        """Display metadata URL as a clickable link"""
        return format_html('<a href="{}" target="_blank">View Metadata</a>', obj.sp_metadata_url)

    view_metadata_url.short_description = 'Metadata'

    def formfield_for_dbfield(self, db_field, **kwargs):
        field = super().formfield_for_dbfield(db_field, **kwargs)
        if db_field.name == 'social_app':
            field.label = 'IDP Config Name'
        return field

    def get_fieldsets(self, request, obj=None):
        fieldsets = super().get_fieldsets(request, obj)

        fieldsets = list(fieldsets)

        fieldsets.append(('BULK GROUP MAPPINGS', {'fields': ('import_csv',), 'description': 'Optionally upload a CSV file with group_id and name as headers to add multiple group mappings at once.'}))

        return fieldsets

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)

        csv_file = form.cleaned_data.get('import_csv')
        if csv_file:
            from rbac.models import RBACGroup

            try:
                csv_file.seek(0)
                decoded_file = csv_file.read().decode('utf-8').splitlines()
                csv_reader = csv.DictReader(decoded_file)
                for row in csv_reader:
                    group_id = row.get('group_id')
                    name = row.get('name')

                    if group_id and name:
                        if not RBACGroup.objects.filter(uid=group_id, social_app=obj.social_app).exists():
                            try:
                                rbac_group = RBACGroup.objects.create(uid=group_id, name=name, social_app=obj.social_app)  # noqa
                            except Exception as e:
                                logging.error(e)
            except Exception as e:
                logging.error(e)


if getattr(settings, 'USE_SAML', False):
    for field in SAMLConfiguration._meta.fields:
        if field.name == 'social_app':
            field.verbose_name = "ID Provider"

    admin.site.register(SAMLConfiguration, SAMLConfigurationAdmin)

    SAMLConfiguration._meta.app_config.verbose_name = "SAML settings and logs"
    SAMLConfiguration._meta.verbose_name_plural = "SAML Configuration"
