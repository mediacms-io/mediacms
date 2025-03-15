import logging

from allauth.socialaccount.models import SocialApp
from django.db import models


class IdentityProviderUserLog(models.Model):
    identity_provider = models.ForeignKey(SocialApp, on_delete=models.CASCADE, related_name='saml_logs')
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name='saml_logs')
    created_at = models.DateTimeField(auto_now_add=True)
    logs = models.TextField(blank=True, null=True)
    
    class Meta:
        verbose_name = 'Identity Provider User Log'
        verbose_name_plural = 'Identity Provider User Logs'
        ordering = ['-created_at']
    
    def __str__(self):
        return f'SAML Log - {self.user.username} - {self.created_at}'


class IdentityProviderRoleMappingProxy(models.Model):
    # The purpose of this model is to enable editing of Global Roles and Group Roles for an Identity Provider through Django admin. It's not being queried elsewhere. 

    identity_provider = models.OneToOneField(SocialApp, on_delete=models.CASCADE, related_name='role_mapping')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['identity_provider'], name='unique_identity_provider_role_mapping_proxy')
        ]

    def clean(self):
        if not self.pk and IdentityProviderRoleMappingProxy.objects.filter(identity_provider=self.identity_provider).exists():
            raise ValidationError('A role mapping already exists for this Identity Provider.')

    def __str__(self):
        return f"IdentityProviderRoleMappingProxy for {self.identity_provider}"


class IdentityProviderGroupRole(models.Model):
    identity_provider = models.ForeignKey(SocialApp, on_delete=models.CASCADE, related_name='group_roles')

    role_mapping = models.ForeignKey(
        IdentityProviderRoleMappingProxy,
        on_delete=models.CASCADE,
        related_name='group_role_mapping',
        null=True,
        blank=True
    )

    name = models.CharField(verbose_name='Group Role Mapping', max_length=100, help_text='Identity Provider value')

    map_to = models.CharField(max_length=20, choices=[('member', 'Member'), ('contributor', 'Contributor'), ('manager', 'Manager')], help_text='MediaCMS Group Role')

    class Meta:
        verbose_name = 'Identity Provider Group Role Mapping'
        verbose_name_plural = 'Identity Provider Group Role Mappings'
        unique_together = ('identity_provider', 'name')

    def __str__(self):
        return f'Identity Provider Group Role Mapping {self.name}'

    def save(self, *args, **kwargs):
        if not self.identity_provider:
            raise ValidationError({'identity_provider': 'Identity Provider is required.'})

        if IdentityProviderGroupRole.objects.filter(identity_provider=self.identity_provider, name=self.name).exclude(pk=self.pk).exists():
            raise ValidationError({'name': 'A group role mapping for this Identity Provider with this name already exists.'})

        super().save(*args, **kwargs)


class IdentityProviderGlobalRole(models.Model):
    identity_provider = models.ForeignKey(SocialApp, on_delete=models.CASCADE, related_name='global_roles')

    role_mapping = models.ForeignKey(
        IdentityProviderRoleMappingProxy,
        on_delete=models.CASCADE,
        related_name='global_role_mapping',
        null=True,
        blank=True
    )

    name = models.CharField(verbose_name='Global Role Mapping', max_length=100, help_text='Identity Provider value')


    map_to = models.CharField(
        max_length=20,
        choices=[('user', 'Authenticated User'), ('advancedUser', 'Advanced User'), ('editor', 'MediaCMS Editor'), ('manager', 'MediaCMS Manager'), ('admin', 'MediaCMS Administrator')],
        help_text='MediaCMS Global Role',
    )

    class Meta:
        verbose_name = 'Identity Provider Global Role Mapping'
        verbose_name_plural = 'Identity Provider Global Role Mappings'
        unique_together = ('identity_provider', 'name')


    def __str__(self):
        return f'Identity Provider Global Role Mapping {self.name}'


    def save(self, *args, **kwargs):
        if not self.identity_provider:
            raise ValidationError({'identity_provider': 'Identity Provider is required.'})

        if IdentityProviderGlobalRole.objects.filter(identity_provider=self.identity_provider, name=self.name).exclude(pk=self.pk).exists():
            raise ValidationError({'name': 'A global role mapping for this Identity Provider with this name already exists.'})

        super().save(*args, **kwargs)


class IdentityProviderGroupMapping(models.Model):
    identity_provider = models.ForeignKey(SocialApp, on_delete=models.CASCADE, related_name='group_mapping')

    name = models.CharField(verbose_name='Group name', max_length=100, help_text='Identity Provider value')

    map_to = models.CharField(max_length=300, help_text='MediaCMS Group name')

    class Meta:
        verbose_name = 'Identity Provider Group Mapping'
        verbose_name_plural = 'Identity Provider Group Mappings'
        unique_together = ('identity_provider', 'name')

    def clean(self):
        if not self._state.adding and self.pk:
            original = IdentityProviderGroupMapping.objects.get(pk=self.pk)
            if original.name != self.name:
                raise ValidationError("Cannot change the name once it is set. First delete this entry and then create a new one instead.")
        super().clean()



    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        from rbac.models import RBACGroup

        rbac_group = RBACGroup.objects.filter(identity_provider=self.identity_provider, uid=self.name).first()
        if rbac_group:
            if rbac_group.name != self.map_to:
                rbac_group.name = self.map_to
                rbac_group.save(update_fields=['name'])
        else:
            try:
                rbac_group = RBACGroup.objects.create(uid=self.name, name=self.map_to, identity_provider=self.identity_provider)
            except Exception as e:
                logging.error(e)
        return True

    def __str__(self):
        return f'Identity Provider Group Mapping {self.name}'


class IdentityProviderCategoryMapping(models.Model):
    identity_provider = models.ForeignKey(SocialApp, on_delete=models.CASCADE, related_name='category_mapping')

    name = models.CharField(verbose_name='Group name', max_length=100, help_text='Identity Provider value')

    map_to = models.CharField(max_length=300, help_text='Category name')

    class Meta:
        verbose_name = 'Identity Provider Category Mapping'
        verbose_name_plural = 'Identity Provider Category Mappings'
        unique_together = ('identity_provider', 'name')

    def clean(self):
        if not self._state.adding and self.pk:
            original = IdentityProviderCategoryMapping.objects.get(pk=self.pk)
            if original.name != self.name:
                raise ValidationError("Cannot change the name once it is set. First delete this entry and then create a new one instead.")
        super().clean()


    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        from files.models import Category

        category = Category.objects.filter(identity_provider=self.identity_provider, uid=self.name).first()
        if category:
            if category.title != self.map_to:
                category.title = self.map_to
                category.save(update_fields=['title'])
        else:
            try:
                category = Category.objects.create(uid=self.name, title=self.map_to, identity_provider=self.identity_provider, is_rbac_category=True)
            except Exception as e:
                logging.error(e)
        return True

    def __str__(self):
        return f'Identity Provider Category Mapping {self.name}'

