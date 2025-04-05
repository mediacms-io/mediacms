from allauth.socialaccount.models import SocialApp
from django.conf import settings
from django.db import models
from django.db.models.signals import m2m_changed
from django.dispatch import receiver
from django.utils.crypto import get_random_string


def generate_uid():
    return get_random_string(length=10)


class RBACGroup(models.Model):
    uid = models.CharField(max_length=255, default=generate_uid, help_text='Unique identifier for the RBAC group (unique per identity provider)')
    name = models.CharField(max_length=100, help_text='MediaCMS Group name')
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # access to members through the membership model
    members = models.ManyToManyField("users.User", through='RBACMembership', through_fields=('rbac_group', 'user'), related_name='rbac_groups')

    categories = models.ManyToManyField('files.Category', related_name='rbac_groups', blank=True, help_text='Categories this RBAC group has access to')

    identity_provider = models.ForeignKey(SocialApp, on_delete=models.SET_NULL, null=True, blank=True, related_name='rbac_groups', verbose_name='IDP Config Name')

    def __str__(self):
        name = f"{self.name}"
        if self.identity_provider:
            name = f"{name} for {self.identity_provider}"
        return name

    class Meta:
        verbose_name = 'RBAC Group'
        verbose_name_plural = 'RBAC Groups'
        unique_together = [['uid', 'identity_provider'], ['name', 'identity_provider']]


class RBACRole(models.TextChoices):
    MEMBER = 'member', 'Member'
    CONTRIBUTOR = 'contributor', 'Contributor'
    MANAGER = 'manager', 'Manager'


class RBACMembership(models.Model):
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name='rbac_memberships')
    rbac_group = models.ForeignKey(RBACGroup, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(max_length=20, choices=RBACRole.choices, default=RBACRole.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'rbac_group', 'role']
        verbose_name = 'RBAC Membership'
        verbose_name_plural = 'RBAC Memberships'

    def clean(self):
        super().clean()
        return True

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.user.username} - {self.rbac_group.name} ({self.role})'


@receiver(m2m_changed, sender=RBACGroup.categories.through)
def handle_rbac_group_categories_change(sender, instance, action, pk_set, **kwargs):
    """
    Signal handler for when categories are added to or removed from an RBACGroup.
    """
    if not getattr(settings, 'USE_IDENTITY_PROVIDERS', False):
        return

    from files.models import Category
    from identity_providers.models import IdentityProviderCategoryMapping

    if action == 'post_add':
        if not instance.identity_provider:
            return
        # the following apply only if identity_provider is there
        for category_id in pk_set:
            category = Category.objects.get(pk=category_id)

            mapping_exists = IdentityProviderCategoryMapping.objects.filter(identity_provider=instance.identity_provider, name=instance.uid, map_to=category).exists()

            if not mapping_exists:
                IdentityProviderCategoryMapping.objects.create(identity_provider=instance.identity_provider, name=instance.uid, map_to=category)

    elif action == 'post_remove':
        for category_id in pk_set:
            category = Category.objects.get(pk=category_id)

            IdentityProviderCategoryMapping.objects.filter(identity_provider=instance.identity_provider, name=instance.uid, map_to=category).delete()
