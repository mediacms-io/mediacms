"""
Management command: sync_oidc_providers

Creates or updates SocialApp, OIDCConfiguration, OIDCScopeConfig and
LoginOption records from the OIDC_PROVIDERS setting.  Idempotent: safe
to run on every deploy.

Example::

    OIDC_PROVIDERS = [
        {
            "provider_id": "myprovider",
            "name": "My Provider",
            "client_id": os.getenv("OIDC_CLIENT_ID"),
            "secret": os.getenv("OIDC_CLIENT_SECRET"),
            "server_url": os.getenv("OIDC_SERVER_URL"),
            "oidc_config": {
                "verified_email": True,
                "remove_from_groups": False,
            },
            "scopes": ["openid", "email", "profile"],
            "claim_handlers": [
                {
                    "claim": "picture",
                    "parser": "oidc_auth.parsers.profile_picture.sync_profile_picture",
                },
            ],
        },
    ]

``oidc_config`` keys map 1-to-1 to OIDCConfiguration model fields.
"""

import logging

from django.conf import settings
from django.contrib.sites.models import Site
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

logger = logging.getLogger(__name__)

# Fields accepted in the oidc_config dict; map 1-to-1 to OIDCConfiguration.
_OIDC_CONFIG_FIELDS = {
    "uid_claim",
    "email_claim",
    "name_claim",
    "first_name_claim",
    "last_name_claim",
    "verified_email",
    "email_authentication",
    "remove_from_groups",
    "save_oidc_response_logs",
}


class Command(BaseCommand):
    help = (
        "Create or update OIDC providers (SocialApp + OIDCConfiguration + "
        "role mappings) from the OIDC_PROVIDERS setting."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be done without writing to the database.",
        )
        parser.add_argument(
            "--provider-id",
            dest="provider_id",
            default=None,
            help="Sync only the provider with this provider_id.",
        )

    def handle(self, *args, **options):
        providers = getattr(settings, "OIDC_PROVIDERS", [])
        if not providers:
            self.stdout.write(self.style.WARNING("OIDC_PROVIDERS is empty or not set — nothing to do."))
            return

        dry_run = options["dry_run"]
        filter_id = options["provider_id"]

        if dry_run:
            self.stdout.write(self.style.WARNING("--- DRY RUN: no changes will be written ---"))

        for entry in providers:
            pid = entry.get("provider_id")
            if not pid:
                raise CommandError("Every OIDC_PROVIDERS entry must have a 'provider_id'.")
            if filter_id and pid != filter_id:
                continue
            try:
                with transaction.atomic():
                    self._sync_provider(entry, dry_run)
            except Exception as exc:
                raise CommandError(f"Failed to sync provider '{pid}': {exc}") from exc


    def _sync_provider(self, entry, dry_run):
        from allauth.socialaccount.models import SocialApp
        from identity_providers.models import LoginOption
        from oidc_auth.models import OIDCConfiguration, OIDCScopeConfig

        pid = entry["provider_id"]
        name = entry.get("name", pid)
        client_id = entry.get("client_id", "")
        secret = entry.get("secret", "")
        server_url = entry.get("server_url", "")

        if not server_url:
            raise CommandError(f"Provider '{pid}' is missing 'server_url'.")

        # SocialApp
        app_defaults = {
            "name": name,
            "client_id": client_id,
            "secret": secret,
            "settings": {"server_url": server_url},
        }
        if dry_run:
            self._log_dry("SocialApp", pid, app_defaults)
        else:
            app, created = SocialApp.objects.update_or_create(
                provider="openid_connect",
                provider_id=pid,
                defaults=app_defaults,
            )
            # Ensure the current site is associated
            current_site = Site.objects.get_current()
            app.sites.add(current_site)
            self.stdout.write(
                self.style.SUCCESS(f"  [{'created' if created else 'updated'}] SocialApp '{pid}'")
            )

        # OIDCConfiguration
        raw_config = entry.get("oidc_config", {})
        config_defaults = {k: v for k, v in raw_config.items() if k in _OIDC_CONFIG_FIELDS}
        config_defaults["scopes"] = entry.get("scopes", [])
        unknown = set(raw_config) - _OIDC_CONFIG_FIELDS
        if unknown:
            self.stdout.write(
                self.style.WARNING(f"  [warn] Unknown oidc_config keys ignored for '{pid}': {unknown}")
            )

        if dry_run:
            self._log_dry("OIDCConfiguration", pid, config_defaults)
        else:
            oidc_cfg, cfg_created = OIDCConfiguration.objects.update_or_create(
                social_app=app,
                defaults=config_defaults,
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f"  [{'created' if cfg_created else 'updated'}] OIDCConfiguration for '{pid}'"
                )
            )

        # LoginOption
        login_option_title = entry.get("login_option_title", name)
        login_option_url = f"/accounts/oidc/{pid}/login/"
        if dry_run:
            self._log_dry("LoginOption", pid, {"title": login_option_title, "url": login_option_url})
        else:
            lo, lo_created = LoginOption.objects.update_or_create(
                url=login_option_url,
                defaults={"title": login_option_title, "active": True},
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f"  [{'created' if lo_created else 'updated'}] LoginOption '{login_option_title}' → '{login_option_url}'"
                )
            )

        # Claim handlers → OIDCScopeConfig
        claim_handlers = entry.get("claim_handlers", [])
        for idx, handler in enumerate(claim_handlers):
            claim = handler.get("claim")
            if not claim:
                raise CommandError(f"claim_handlers entry missing 'claim' for provider '{pid}'.")
            handler_defaults = {
                "parser": handler.get("parser", ""),
                "parser_options": handler.get("parser_options", {}),
            }
            if dry_run:
                self._log_dry("OIDCScopeConfig", f"claim:{claim}", handler_defaults)
            else:
                sc, sc_created = OIDCScopeConfig.objects.update_or_create(
                    oidc_configuration=oidc_cfg,
                    claim=claim,
                    defaults=handler_defaults,
                )
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  [{'created' if sc_created else 'updated'}] OIDCScopeConfig '{claim}'"
                    )
                )

    def _log_dry(self, model, key, defaults):
        self.stdout.write(f"  [dry-run] Would upsert {model} key='{key}' defaults={defaults}")
