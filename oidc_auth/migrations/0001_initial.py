import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("socialaccount", "0006_alter_socialaccount_extra_data"),
    ]

    operations = [
        migrations.CreateModel(
            name="OIDCConfiguration",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "social_app",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="oidc_configurations",
                        to="socialaccount.socialapp",
                    ),
                ),
                (
                    "uid_claim",
                    models.CharField(
                        default="sub",
                        help_text="Claim used as unique identifier (default: sub)",
                        max_length=64,
                    ),
                ),
                (
                    "email_claim",
                    models.CharField(
                        default="email",
                        help_text="Claim carrying the user e-mail address",
                        max_length=64,
                    ),
                ),
                (
                    "name_claim",
                    models.CharField(
                        blank=True,
                        default="name",
                        help_text="Claim carrying the full display name (default: name)",
                        max_length=64,
                    ),
                ),
                (
                    "first_name_claim",
                    models.CharField(
                        blank=True,
                        default="given_name",
                        help_text="Claim carrying the given name (default: given_name)",
                        max_length=64,
                    ),
                ),
                (
                    "last_name_claim",
                    models.CharField(
                        blank=True,
                        default="family_name",
                        help_text="Claim carrying the family name (default: family_name)",
                        max_length=64,
                    ),
                ),
                (
                    "verified_email",
                    models.BooleanField(
                        default=True,
                        help_text="Trust the provider's email as already verified",
                    ),
                ),
                (
                    "email_authentication",
                    models.BooleanField(
                        default=False,
                        help_text="Allow login via e-mail matching even without exact UID match",
                    ),
                ),
                (
                    "remove_from_groups",
                    models.BooleanField(
                        default=False,
                        help_text="Remove user from groups not present in OIDC claims on each login",
                    ),
                ),
                (
                    "save_oidc_response_logs",
                    models.BooleanField(
                        default=False,
                        help_text="Persist raw OIDC claims for debugging (contains sensitive data)",
                    ),
                ),
                (
                    "scopes",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text='OAuth2 scopes to request from the provider (e.g. ["openid", "email", "profile"])',
                    ),
                ),
            ],
            options={
                "verbose_name": "OIDC Configuration",
                "verbose_name_plural": "OIDC Configurations",
            },
        ),
        migrations.CreateModel(
            name="OIDCScopeConfig",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "oidc_configuration",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="scope_configs",
                        to="oidc_auth.oidcconfiguration",
                    ),
                ),
                (
                    "claim",
                    models.CharField(
                        help_text="Claim key to read from the OIDC response (e.g. 'picture', 'roles')",
                        max_length=64,
                    ),
                ),
                (
                    "parser",
                    models.CharField(
                        blank=True,
                        help_text="Dotted Python path to the parser function",
                        max_length=256,
                    ),
                ),
                (
                    "parser_options",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="JSON dict of keyword arguments passed to the parser function",
                    ),
                ),
            ],
            options={
                "verbose_name": "OIDC Claim Handler",
                "verbose_name_plural": "OIDC Claim Handlers",
                "ordering": ["claim"],
            },
        ),
        migrations.AlterUniqueTogether(
            name="oidcscopeconfig",
            unique_together={("oidc_configuration", "claim")},
        ),
    ]
