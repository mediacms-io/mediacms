from allauth.socialaccount.models import SocialApp
from django.core.exceptions import ValidationError
from django.db import models


class SAMLConfiguration(models.Model):
    social_app = models.ForeignKey(SocialApp, on_delete=models.CASCADE, related_name='saml_configurations')

    # URLs
    sso_url = models.URLField(help_text='Sign-in URL')
    slo_url = models.URLField(help_text='Sign-out URL')
    sp_metadata_url = models.URLField(help_text='https://host/saml/metadata')
    idp_id = models.URLField(help_text='Identity Provider ID')

    # Certificates
    idp_cert = models.TextField(help_text='x509cert')

    # Attribute Mapping Fields
    uid = models.CharField(max_length=100, help_text='eg eduPersonPrincipalName')
    name = models.CharField(max_length=100, blank=True, null=True, help_text='eg displayName')
    email = models.CharField(max_length=100, blank=True, null=True, help_text='eg mail')
    groups = models.CharField(max_length=100, blank=True, null=True, help_text='eg isMemberOf')
    first_name = models.CharField(max_length=100, blank=True, null=True, help_text='eg gn')
    last_name = models.CharField(max_length=100, blank=True, null=True, help_text='eg sn')
    user_logo = models.CharField(max_length=100, blank=True, null=True, help_text='eg jpegPhoto')
    role = models.CharField(max_length=100, blank=True, null=True, help_text='eduPersonPrimaryAffiliation')

    verified_email = models.BooleanField(default=False, help_text='Mark email as verified')

    email_authentication = models.BooleanField(default=False, help_text='Use email authentication too')

    remove_from_groups = models.BooleanField(default=False, help_text='Automatically remove from groups')
    save_saml_response_logs = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'SAML Configuration'
        verbose_name_plural = 'SAML Configurations'
        unique_together = ['social_app', 'idp_id']

    def __str__(self):
        return f'SAML Config for {self.social_app.name} - {self.idp_id}'

    def clean(self):
        existing_conf = SAMLConfiguration.objects.filter(social_app=self.social_app)

        if self.pk:
            existing_conf = existing_conf.exclude(pk=self.pk)

        if existing_conf.exists():
            raise ValidationError({'social_app': 'Cannot create configuration for the same social app because one configuration already exists.'})

        super().clean()

    @property
    def saml_provider_settings(self):
        # provide settings in a way for Social App SAML provider
        provider_settings = {}
        provider_settings["sp"] = {"entity_id": self.sp_metadata_url}
        provider_settings["idp"] = {"slo_url": self.slo_url, "sso_url": self.sso_url, "x509cert": self.idp_cert, "entity_id": self.idp_id}

        provider_settings["attribute_mapping"] = {
            "uid": self.uid,
            "name": self.name,
            "role": self.role,
            "email": self.email,
            "groups": self.groups,
            "first_name": self.first_name,
            "last_name": self.last_name,
        }
        provider_settings["email_verified"] = self.verified_email
        provider_settings["email_authentication"] = self.email_authentication
        return provider_settings
