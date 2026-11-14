import csv

from allauth.socialaccount.models import SocialApp
from django import forms
from django.contrib.sites.models import Site
from django.core.exceptions import ValidationError
from django.utils.safestring import mark_safe

from identity_providers.providers import (
    OAUTH_PROVIDER_IDS,
    catalog_choices,
    provider_kind,
)
from saml_auth.models import SAMLConfiguration


class SAMLConfigurationInlineForm(forms.ModelForm):
    clear_sp_private_key = forms.BooleanField(
        required=False,
        label="Clear saved private key",
        help_text="Remove the saved private key. Leave this unchecked to keep it.",
    )

    class Meta:
        model = SAMLConfiguration
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        private_key = self.fields["sp_private_key"]
        private_key.widget = forms.PasswordInput(render_value=False, attrs={"autocomplete": "new-password"})
        private_key.required = False
        if self.instance.pk and self.instance.sp_private_key:
            private_key.label = "New private key"
            private_key.help_text = "A private key is saved and is not shown. Enter a new value to replace it, or clear it below. Leave both unchanged to keep the saved key."
        else:
            self.fields["clear_sp_private_key"].widget = forms.HiddenInput()

    def clean(self):
        cleaned = super().clean()
        stored = self.instance.sp_private_key if self.instance.pk else ""
        submitted = (cleaned.get("sp_private_key") or "").strip()
        if submitted:
            cleaned["sp_private_key"] = submitted
        elif cleaned.get("clear_sp_private_key"):
            cleaned["sp_private_key"] = ""
        else:
            cleaned["sp_private_key"] = stored or ""
        return cleaned


class ImportCSVsForm(forms.ModelForm):
    server_url = forms.URLField(
        required=False,
        label="Issuer URL",
        help_text="OpenID Connect issuer. For example, https://accounts.example.com.",
        assume_scheme="https",
    )
    groups_csv = forms.FileField(
        required=False,
        label="CSV file",
        help_text=mark_safe("Optionally, upload a CSV file to add multiple group mappings at once. <a href='/static/templates/group_mapping.csv' class='download-template'>Download Template</a>"),
    )
    categories_csv = forms.FileField(
        required=False,
        label="CSV file",
        help_text=("Optionally, upload a CSV file to add multiple category mappings at once. <a href='/static/templates/category_mapping.csv' class='download-template'>Download Template</a>"),
    )
    clear_secret = forms.BooleanField(
        required=False,
        label="Clear saved client secret",
        help_text="Remove the saved client secret. Leave this unchecked to keep it.",
    )

    class Meta:
        model = SocialApp
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        provider_field = self.fields["provider"]
        current = getattr(self.instance, "provider", None)
        provider_field.widget = forms.Select(choices=catalog_choices(current))
        if self.instance.pk and self.instance.provider == "openid_connect":
            self.fields["server_url"].initial = (self.instance.settings or {}).get("server_url", "")
        secret_field = self.fields["secret"]
        secret_field.widget = forms.PasswordInput(render_value=False, attrs={"autocomplete": "new-password"})
        secret_field.required = False
        if self.instance.pk and self.instance.secret:
            secret_field.label = "New client secret"
            secret_field.help_text = "A client secret is saved and is not shown. Enter a new value to replace it, or clear it below. Leave both unchanged to keep the saved secret."
        else:
            self.fields["clear_secret"].widget = forms.HiddenInput()
        if not self.instance.pk and not self.is_bound:
            site = Site.objects.order_by("id").first()
            if site is not None:
                self.fields["sites"].initial = [site.pk]

    def clean(self):
        cleaned = super().clean()
        provider = cleaned.get("provider")
        kind = provider_kind(provider)
        stored_secret = self.instance.secret if self.instance.pk else ""
        submitted_secret = (cleaned.get("secret") or "").strip()
        if submitted_secret:
            cleaned["secret"] = submitted_secret
        elif cleaned.get("clear_secret"):
            cleaned["secret"] = ""
        else:
            cleaned["secret"] = stored_secret or ""
        if kind in ("oauth2", "oidc") and not cleaned.get("secret"):
            self.add_error("secret", "Client secret is required.")
        if kind == "oidc" and not cleaned.get("server_url"):
            self.add_error("server_url", "Issuer URL is required for OpenID Connect.")
        if kind in ("saml", "oidc") and not cleaned.get("provider_id"):
            self.add_error("provider_id", "This should be a unique identifier for the provider.")
        if kind == "oauth2" and not cleaned.get("provider_id") and provider in OAUTH_PROVIDER_IDS:
            cleaned["provider_id"] = provider
        return cleaned

    def save(self, commit=True):
        obj = super().save(commit=False)
        if obj.provider == "openid_connect":
            settings_data = dict(obj.settings or {})
            settings_data["server_url"] = self.cleaned_data.get("server_url") or ""
            obj.settings = settings_data
        if obj.provider in OAUTH_PROVIDER_IDS and not obj.provider_id:
            obj.provider_id = obj.provider
        if commit:
            obj.save()
            self.save_m2m()
        return obj

    def clean_groups_csv(self):
        groups_csv = self.cleaned_data.get('groups_csv')

        if not groups_csv:
            return groups_csv

        if not groups_csv.name.endswith('.csv'):
            raise ValidationError("Uploaded file must be a CSV file.")

        try:
            decoded_file = groups_csv.read().decode('utf-8').splitlines()
            csv_reader = csv.reader(decoded_file)
            headers = next(csv_reader, None)
            if not headers or 'group_id' not in headers or 'name' not in headers:
                raise ValidationError("CSV file must contain 'group_id' and 'name' headers. " f"Found headers: {', '.join(headers) if headers else 'none'}")
            groups_csv.seek(0)
            return groups_csv

        except csv.Error:
            raise ValidationError("Invalid CSV file. Please ensure the file is properly formatted.")
        except UnicodeDecodeError:
            raise ValidationError("Invalid file encoding. Please upload a CSV file with UTF-8 encoding.")

    def clean_categories_csv(self):
        categories_csv = self.cleaned_data.get('categories_csv')

        if not categories_csv:
            return categories_csv

        if not categories_csv.name.endswith('.csv'):
            raise ValidationError("Uploaded file must be a CSV file.")

        try:
            decoded_file = categories_csv.read().decode('utf-8').splitlines()
            csv_reader = csv.reader(decoded_file)
            headers = next(csv_reader, None)
            if not headers or 'category_id' not in headers or 'group_id' not in headers:
                raise ValidationError("CSV file must contain 'group_id' and 'category_id' headers. " f"Found headers: {', '.join(headers) if headers else 'none'}")
            categories_csv.seek(0)
            return categories_csv

        except csv.Error:
            raise ValidationError("Invalid CSV file. Please ensure the file is properly formatted.")
        except UnicodeDecodeError:
            raise ValidationError("Invalid file encoding. Please upload a CSV file with UTF-8 encoding.")
