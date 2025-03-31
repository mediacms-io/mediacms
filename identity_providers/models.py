from allauth.socialaccount.models import SocialApp
from django.core.exceptions import ValidationError
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


class IdentityProviderGroupRole(models.Model):
    identity_provider = models.ForeignKey(SocialApp, on_delete=models.CASCADE, related_name='group_roles')
    name = models.CharField(verbose_name='Group Role Mapping', max_length=100, help_text='Identity Provider role attribute value')

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
    name = models.CharField(verbose_name='Global Role Mapping', max_length=100, help_text='Identity Provider role attribute value')

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


class IdentityProviderCategoryMapping(models.Model):
    identity_provider = models.ForeignKey(SocialApp, on_delete=models.CASCADE, related_name='category_mapping')

    name = models.CharField(verbose_name='Group Attribute Value', max_length=100, help_text='Identity Provider group attribute value')

    map_to = models.ForeignKey('files.Category', on_delete=models.CASCADE, help_text='Category id')

    class Meta:
        verbose_name = 'Identity Provider Category Mapping'
        verbose_name_plural = 'Identity Provider Category Mappings'

    def clean(self):
        if not self._state.adding and self.pk:
            original = IdentityProviderCategoryMapping.objects.get(pk=self.pk)
            if original.name != self.name:
                raise ValidationError("Cannot change the name once it is set. First delete this entry and then create a new one instead.")
        super().clean()

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        from rbac.models import RBACGroup

        group = RBACGroup.objects.filter(identity_provider=self.identity_provider, uid=self.name).first()
        if group:
            group.categories.add(self.map_to)
        return True

    def __str__(self):
        return f'Identity Provider Category Mapping {self.name}'

    def delete(self, *args, **kwargs):
        from rbac.models import RBACGroup

        group = RBACGroup.objects.filter(identity_provider=self.identity_provider, uid=self.name).first()
        if group:
            group.categories.remove(self.map_to)
        super().delete(*args, **kwargs)


class LoginOption(models.Model):
    title = models.CharField(max_length=100, help_text="Display name for this login option (e.g. Login through DEIC)")
    url = models.CharField(max_length=255, help_text="URL or path for this login option")
    ordering = models.PositiveIntegerField(default=0, help_text="Display order (smaller numbers appear first)")
    active = models.BooleanField(default=True, help_text="Whether this login option is currently active")

    class Meta:
        ordering = ['ordering']
        verbose_name = "Login Option"
        verbose_name_plural = "Login Options"

    def __str__(self):
        return self.title
