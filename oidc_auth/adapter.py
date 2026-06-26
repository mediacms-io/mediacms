import importlib
import logging
import re

from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.models import SocialApp
from allauth.socialaccount.signals import social_account_updated
from django.dispatch import receiver

from identity_providers.models import IdentityProviderUserLog

logger = logging.getLogger(__name__)


class OIDCAccountAdapter(DefaultSocialAccountAdapter):
    """
    Social account adapter for OIDC providers.

    Sanitises the username from the subject claim and delegates attribute-sync
    and role/group mapping to perform_user_actions(), which is called both on
    first login (save_user) and on subsequent logins (social_account_updated).
    """

    def is_open_for_signup(self, request, socialaccount):
        return True

    def populate_user(self, request, sociallogin, data):
        user = sociallogin.user
        raw_uid = sociallogin.account.uid or ""
        # Keep only characters allowed by MediaCMS username validators.
        sanitized = re.sub(r"[^\w.@-]", "_", raw_uid, flags=re.ASCII)
        user.username = sanitized[:150] if sanitized else raw_uid
        for field in ("name", "first_name", "last_name"):
            if data.get(field):
                setattr(user, field, data[field])
        sociallogin.data = data
        return user

    def save_user(self, request, sociallogin, form=None):
        user = super().save_user(request, sociallogin, form)
        perform_user_actions(user, sociallogin.account, sociallogin.data)
        return user


@receiver(social_account_updated)
def oidc_social_account_updated(sender, request, sociallogin, **kwargs):
    """
    Sync attributes and roles on every OIDC login, not just the first.

    Guard: skip non-OIDC providers (e.g. SAML) with a single targeted query
    so this receiver is a no-op for other protocols.
    """
    oidc_app = SocialApp.objects.filter(
        provider_id=sociallogin.account.provider,
        provider="openid_connect",
    ).first()
    if not oidc_app:
        return
    perform_user_actions(sociallogin.user, sociallogin.account, getattr(sociallogin, "data", None))


def _get_oidc_app_and_config(social_account):
    """
    Return (SocialApp, OIDCConfiguration) for the given social_account,
    or (None, None) if not found or not an OIDC provider.
    """
    social_app = SocialApp.objects.filter(provider_id=social_account.provider).first()
    if not social_app:
        return None, None
    config = social_app.oidc_configurations.first()
    return social_app, config


def perform_user_actions(user, social_account, common_fields=None):
    """
    Sync profile fields and invoke per-scope parsers from OIDC claims.

    Reads claim values from SocialAccount.extra_data using the names
    configured in OIDCConfiguration, then calls each OIDCScopeConfig parser.
    """
    social_app, oidc_configuration = _get_oidc_app_and_config(social_account)
    if not oidc_configuration:
        return user

    extra_data = social_account.extra_data or {}

    # Sync standard profile fields using the claim names from OIDCConfiguration
    # so that custom mappings set in the admin are respected.
    claim_field_map = [
        ("first_name", oidc_configuration.first_name_claim),
        ("last_name", oidc_configuration.last_name_claim),
        ("name", oidc_configuration.name_claim),
        ("email", oidc_configuration.email_claim),
    ]
    fields_to_update = []
    for field, claim in claim_field_map:
        if not claim:
            continue
        value = extra_data.get(claim)
        if value and value != getattr(user, field, None):
            setattr(user, field, value)
            fields_to_update.append(field)

    if fields_to_update:
        user.save(update_fields=fields_to_update)

    for scope_cfg in oidc_configuration.scope_configs.all():
        _call_scope_parser(user, scope_cfg, extra_data, social_app, oidc_configuration)

    if oidc_configuration.save_oidc_response_logs:
        handle_oidc_logs_save(user, extra_data, social_app)

    return user


def _call_scope_parser(user, scope_cfg, extra_data, social_app, oidc_configuration):
    """
    Resolve and call the parser function registered for a scope config.

    The raw claim value is extracted from extra_data using scope_cfg.claim;
    when claim is blank the full extra_data dict is passed as raw_value so
    that parsers with cross-claim logic can still access all claims.
    """
    if not scope_cfg.parser:
        return

    raw_value = extra_data.get(scope_cfg.claim) if scope_cfg.claim else extra_data

    parser_fn = _import_parser(scope_cfg.parser)
    if parser_fn is None:
        return

    try:
        parser_fn(user, raw_value, social_app, oidc_configuration, **scope_cfg.parser_options)
    except Exception as exc:
        logger.error(
            "Scope parser %r failed for user %s / scope %r: %s",
            scope_cfg.parser,
            user.username,
            scope_cfg.name,
            exc,
        )


def _import_parser(dotted_path):
    """
    Import and return the callable at dotted_path.

    Returns None (with a logged warning) on any import / attribute error so
    that a misconfigured parser does not break the login flow.
    """
    try:
        module_path, attr = dotted_path.rsplit(".", 1)
        module = importlib.import_module(module_path)
        return getattr(module, attr)
    except Exception as exc:
        logger.warning("Could not import scope parser %r: %s", dotted_path, exc)
        return None


def handle_oidc_logs_save(user, extra_data, social_app):
    """Store raw OIDC claims for auditing (activate only when debugging)."""
    try:
        IdentityProviderUserLog.objects.create(
            user=user,
            identity_provider=social_app,
            logs=extra_data,
        )
    except Exception as exc:
        logger.error("OIDC handle_oidc_logs_save failed for user %s: %s", user.username, exc)
