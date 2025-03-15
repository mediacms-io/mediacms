import logging

from allauth.socialaccount.models import SocialApp
from django.core.exceptions import ValidationError
from django.db import models


class SAMLConfiguration(models.Model):
    social_app = models.ForeignKey(SocialApp, on_delete=models.CASCADE, related_name='saml_configurations')

    remove_from_groups = models.BooleanField(default=False, help_text='Automatically remove from groups')
    save_saml_response_logs = models.BooleanField(default=True)

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


class SAMLRoleMapping(models.Model):
    # The purpose of this model is to enable editing of Global Roles and Group Roles for a SAML Configuration
    # through Django admin. It's not being queried elsewhere. 
        
    configuration = models.OneToOneField('SAMLConfiguration', on_delete=models.CASCADE, related_name='role_mapping')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['configuration'], name='unique_saml_role_mapping')
        ]
    
    def clean(self):
        if not self.pk and SAMLRoleMapping.objects.filter(configuration=self.configuration).exists():
            raise ValidationError('A role mapping already exists for this SAML configuration.')
        
    def __str__(self):
        return f"Role mapping for {self.configuration}"
    


class SAMLConfigurationGroupRole(models.Model):
    configuration = models.ForeignKey(SAMLConfiguration, on_delete=models.CASCADE, related_name='group_roles')

    role_mapping = models.ForeignKey(
        SAMLRoleMapping,
        on_delete=models.CASCADE,
        related_name='group_role_mapping',
        null=True,
        blank=True
    )

    name = models.CharField(verbose_name='Group Role Mapping', max_length=100, help_text='SAML value')

    map_to = models.CharField(max_length=20, choices=[('member', 'Member'), ('contributor', 'Contributor'), ('manager', 'Manager')], help_text='MediaCMS Group Role')

    class Meta:
        verbose_name = 'SAML Group Role Mapping'
        verbose_name_plural = 'SAML Group Role Mappings'
        unique_together = ('configuration', 'name')

    def __str__(self):
        return f'SAML Group Role Mapping {self.name}'

    def save(self, *args, **kwargs):
        if not self.configuration_id:
            raise ValidationError({'configuration': 'Configuration is required.'})
        
        if SAMLConfigurationGroupRole.objects.filter(configuration=self.configuration, name=self.name).exclude(pk=self.pk).exists():
            raise ValidationError({'name': 'A group role mapping with this configuration and name already exists.'})

        super().save(*args, **kwargs)


class SAMLConfigurationGlobalRole(models.Model):
    configuration = models.ForeignKey(SAMLConfiguration, on_delete=models.CASCADE, related_name='global_roles')

    role_mapping = models.ForeignKey(
        SAMLRoleMapping,
        on_delete=models.CASCADE,
        related_name='global_role_mapping',
        null=True,
        blank=True
    )

    name = models.CharField(verbose_name='Global Role Mapping', max_length=100, help_text='SAML value')

    map_to = models.CharField(
        max_length=20,
        choices=[('user', 'Authenticated User'), ('advancedUser', 'Advanced User'), ('editor', 'MediaCMS Editor'), ('manager', 'MediaCMS Manager'), ('admin', 'MediaCMS Administrator')],
        help_text='MediaCMS Global Role',
    )

    class Meta:
        verbose_name = 'SAML Global Role Mapping'
        verbose_name_plural = 'SAML Global Role Mappings'
        unique_together = ('configuration', 'name')

    def __str__(self):
        return f'SAML Global Role {self.name}'



class SAMLConfigurationGroupMapping(models.Model):
    configuration = models.ForeignKey(SAMLConfiguration, on_delete=models.CASCADE, related_name='group_mapping')

    name = models.CharField(verbose_name='Group name', max_length=100, help_text='SAML value')

    map_to = models.CharField(max_length=300, help_text='MediaCMS Group name')

    class Meta:
        verbose_name = 'SAML Group Mapping'
        verbose_name_plural = 'SAML Group Mappings'
        unique_together = ('configuration', 'name')

    def clean(self):
        if not self._state.adding and self.pk:
            original = SAMLConfigurationGroupMapping.objects.get(pk=self.pk)
            if original.name != self.name:
                raise ValidationError("Cannot change the name once it is set. First delete this entry and then create a new one instead.")
        super().clean()

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        from rbac.models import RBACGroup

        rbac_group = RBACGroup.objects.filter(social_app=self.configuration.social_app, uid=self.name).first()
        if rbac_group:
            if rbac_group.name != self.map_to:
                rbac_group.name = self.map_to
                rbac_group.save(update_fields=['name'])
        else:
            try:
                rbac_group = RBACGroup.objects.create(uid=self.name, name=self.map_to, social_app=self.configuration.social_app)
            except Exception as e:
                logging.error(e)
        return True

    def __str__(self):
        return f'SAML Group Mapping {self.name}'


