from allauth.socialaccount.models import SocialApp
from django.core.exceptions import ValidationError
from django.db import models


class RBACGroup(models.Model):
    uid = models.CharField(max_length=255, help_text='Unique identifier for the RBAC group (unique per social app)')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # access to members through the membership model
    members = models.ManyToManyField("users.User", through='RBACMembership', through_fields=('rbac_group', 'user'), related_name='rbac_groups')

    categories = models.ManyToManyField('files.Category', related_name='rbac_groups', blank=True, help_text='Categories this RBAC group has access to')

    social_app = models.ForeignKey(SocialApp, on_delete=models.SET_NULL, null=True, blank=True, related_name='rbac_groups')

    def __str__(self):
        name = f"{self.name}"
        if self.social_app:
            name = f"{name} for self.social_app.provider"
        return name

    class Meta:
        verbose_name = 'RBAC Group'
        verbose_name_plural = 'RBAC Groups'
        unique_together = [['uid', 'social_app'], ['name', 'social_app']]


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
        if self.role not in RBACRole.values:
            raise ValidationError({'role': f'Invalid role. Must be one of {", ".join(RBACRole.values)}'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.user.username} - {self.rbac_group.name} ({self.role})'
