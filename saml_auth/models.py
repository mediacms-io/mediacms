from django.db import models
from allauth.socialaccount.models import SocialApp


class SAMLConfiguration(models.Model):
    social_app = models.ForeignKey(
        SocialApp,
        on_delete=models.CASCADE,
        related_name='saml_configurations'
    )
    
    # Group Management
    create_groups = models.BooleanField(
        default=True,
        help_text='Automatically create groups'
    )
    remove_from_groups = models.BooleanField(
        default=False,
        help_text='Automatically remove from groups'
    )
    save_saml_response_logs = models.BooleanField(default=True)
    
    # URLs
    sso_url = models.URLField(
        help_text='Sign-in URL'
    )
    slo_url = models.URLField(
        help_text='Sign-out URL'
    )
    sp_metadata_url = models.URLField(
        help_text='https://host/saml/metadata'
    )
    idp_id = models.URLField(
        help_text='Identity Provider ID'
    )
    
    # Certificates
    idp_cert = models.TextField(
        help_text='x509cert'
    )
    
    # Attribute Mapping Fields
    uid = models.CharField(
        max_length=100,
        help_text='eg eduPersonPrincipalName'
    )
    name = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text='eg displayName'
    )
    email = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text='eg mail'
    )
    groups = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text='eg isMemberOf'
    )
    first_name = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text='eg gn'
    )
    last_name = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text='eg sn'
    )
    user_logo = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text='eg jpegPhoto'
    )
    role = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text='eduPersonPrimaryAffiliation'
    )

    def default_role_mapping():
        return {'staff': 'advancedUser'}

    role_mapping = models.JSONField(
        default=default_role_mapping,
        blank=True,
        help_text='Role mapping configuration'
    )

    class Meta:
        verbose_name = 'SAML Configuration'
        verbose_name_plural = 'SAML Configurations'
        unique_together = ['social_app', 'idp_id']

    def __str__(self):
        return f'SAML Config for {self.social_app.name} - {self.idp_id}'


class SAMLLog(models.Model):
    social_app = models.ForeignKey(
        SocialApp,
        on_delete=models.CASCADE,
        related_name='saml_logs'
    )
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name='saml_logs'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    logs = models.TextField(
        blank=True,
        null=True
    )

    class Meta:
        verbose_name = 'SAML Log'
        verbose_name_plural = 'SAML Logs'
        ordering = ['-created_at']

    def __str__(self):
        return f'SAML Log - {self.user.username} - {self.created_at}'
