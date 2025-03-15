import logging

from allauth.socialaccount.models import SocialApp
from django.db import models


class IdentityProviderUserLog(models.Model):
    social_app = models.ForeignKey(SocialApp, on_delete=models.CASCADE, related_name='saml_logs')
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name='saml_logs')
    created_at = models.DateTimeField(auto_now_add=True)
    logs = models.TextField(blank=True, null=True)
    
    class Meta:
        verbose_name = 'Identity Provider User Log'
        verbose_name_plural = 'Identity Provider User Logs'
        ordering = ['-created_at']
    
    def __str__(self):
        return f'SAML Log - {self.user.username} - {self.created_at}'

