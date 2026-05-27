from django.core.exceptions import ValidationError
from django.db import models

from allauth.socialaccount.models import SocialApp


class OIDCConfiguration(models.Model):
    """
    Per-provider OIDC configuration, linked to an allauth SocialApp.

    Mirrors SAMLConfiguration: stores the claim-to-field mapping and
    behavioural flags that the OIDCAccountAdapter reads at login time.
    One configuration per SocialApp is enforced via clean().
    """

    social_app = models.ForeignKey(
        SocialApp,
        on_delete=models.CASCADE,
        related_name="oidc_configurations",
    )

    # --- Claim mapping ---
    uid_claim = models.CharField(
        max_length=64,
        default="sub",
        help_text="Claim used as unique identifier (default: sub)",
    )
    email_claim = models.CharField(
        max_length=64,
        default="email",
        help_text="Claim carrying the user e-mail address",
    )
    name_claim = models.CharField(
        max_length=64,
        default="name",
        blank=True,
        help_text="Claim carrying the full display name (default: name)",
    )
    first_name_claim = models.CharField(
        max_length=64,
        default="given_name",
        blank=True,
        help_text="Claim carrying the given name (default: given_name)",
    )
    last_name_claim = models.CharField(
        max_length=64,
        default="family_name",
        blank=True,
        help_text="Claim carrying the family name (default: family_name)",
    )
    # role_claim, groups_claim, roles_pair_separator and user_logo_claim
    # have been replaced by OIDCScopeConfig claim handlers.

    # --- Behavioural flags ---
    verified_email = models.BooleanField(
        default=True,
        help_text="Trust the provider's email as already verified",
    )
    email_authentication = models.BooleanField(
        default=False,
        help_text="Allow login via e-mail matching even without exact UID match",
    )
    remove_from_groups = models.BooleanField(
        default=False,
        help_text="Remove user from groups not present in OIDC claims on each login",
    )
    save_oidc_response_logs = models.BooleanField(
        default=False,
        help_text="Persist raw OIDC claims for debugging (contains sensitive data)",
    )
    scopes = models.JSONField(
        default=list,
        blank=True,
        help_text='OAuth2 scopes to request from the provider (e.g. ["openid", "email", "profile"])',
    )

    class Meta:
        verbose_name = "OIDC Configuration"
        verbose_name_plural = "OIDC Configurations"

    def __str__(self):
        return f"OIDC Config for {self.social_app.name}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.scopes:
            current = self.social_app.settings or {}
            self.social_app.settings = {**current, "scope": self.scopes}
            self.social_app.save(update_fields=["settings"])

    def clean(self):
        existing = OIDCConfiguration.objects.filter(social_app=self.social_app)
        if self.pk:
            existing = existing.exclude(pk=self.pk)
        if existing.exists():
            raise ValidationError(
                {"social_app": "An OIDC configuration already exists for this Social App."}
            )


class OIDCScopeConfig(models.Model):
    """
    Claim handler for an OIDC provider.

    Each record names a JWT claim arriving in the OIDC response and an optional
    dotted-path parser function that processes its raw value at login time.
    OAuth2 scopes are configured separately in SocialApp.settings["scope"].

    Parser signature:
        parser_fn(user, raw_value, social_app, oidc_configuration, **parser_options)

    Built-in parsers:
      - oidc_auth.parsers.ietf_role_mapping.handle_ietf_role_mapping  (IETF-style pairs)
      - oidc_auth.parsers.profile_picture.sync_profile_picture        (profile picture download)
    """

    oidc_configuration = models.ForeignKey(
        OIDCConfiguration,
        on_delete=models.CASCADE,
        related_name="scope_configs",
    )
    claim = models.CharField(
        max_length=64,
        help_text="JWT claim key to read from the OIDC response (e.g. 'picture', 'roles')",
    )
    parser = models.CharField(
        max_length=256,
        blank=True,
        help_text="Dotted Python path to the parser function (e.g. 'oidc_auth.parsers.profile_picture.sync_profile_picture')",
    )
    parser_options = models.JSONField(
        default=dict,
        blank=True,
        help_text="JSON dict of keyword arguments passed to the parser function",
    )

    class Meta:
        ordering = ["claim"]
        unique_together = [("oidc_configuration", "claim")]
        verbose_name = "OIDC Claim Handler"
        verbose_name_plural = "OIDC Claim Handlers"

    def __str__(self):
        return f"{self.oidc_configuration.social_app.name} / {self.claim}"
