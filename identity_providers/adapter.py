import logging
import re

from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.models import SocialApp
from allauth.socialaccount.signals import social_account_updated
from django.dispatch import receiver

logger = logging.getLogger(__name__)


class UnifiedSocialAccountAdapter(DefaultSocialAccountAdapter):
    """
    Protocol-agnostic social account adapter.

    Handles populate_user (username sanitisation is identical for SAML and
    OIDC) and delegates post-save actions to the correct per-protocol
    perform_user_actions helper based on SocialApp.provider.
    """

    def is_open_for_signup(self, request, socialaccount):
        return True

    def populate_user(self, request, sociallogin, data):
        """Sanitise the provider UID into a valid MediaCMS username."""
        user = sociallogin.user
        raw_uid = sociallogin.account.uid or ""
        sanitized = re.sub(r"[^\w.@-]", "_", raw_uid, flags=re.ASCII)
        user.username = sanitized[:150] if sanitized else raw_uid
        for field in ("name", "first_name", "last_name"):
            if data.get(field):
                setattr(user, field, data[field])
        sociallogin.data = data
        return user

    def save_user(self, request, sociallogin, form=None):
        user = super().save_user(request, sociallogin, form)
        _dispatch_user_actions(user, sociallogin.account, sociallogin.data)
        return user


@receiver(social_account_updated)
def unified_social_account_updated(sender, request, sociallogin, **kwargs):
    """
    Sync attributes and roles on every login via any social provider.

    This receiver coexists with the per-protocol receivers in saml_auth and
    oidc_auth.  Those receivers have their own guards and will exit early when
    UnifiedSocialAccountAdapter is active, making this the single dispatch
    point for attribute/role sync.
    """
    _dispatch_user_actions(
        sociallogin.user,
        sociallogin.account,
        getattr(sociallogin, "data", None),
    )


def _dispatch_user_actions(user, social_account, common_fields=None):
    """
    Look up the SocialApp for this social_account and route to the
    appropriate perform_user_actions based on SocialApp.provider.

    Imports are deferred inside the function to avoid any circular-import
    risk at module load time.
    """
    social_app = SocialApp.objects.filter(
        provider_id=social_account.provider
    ).first()

    if not social_app:
        logger.debug(
            "UnifiedAdapter: no SocialApp found for provider_id=%s",
            social_account.provider,
        )
        return

    protocol = social_app.provider

    if protocol == "openid_connect":
        from oidc_auth.adapter import perform_user_actions as oidc_pua
        oidc_pua(user, social_account, common_fields)

    elif protocol == "saml":
        from saml_auth.adapter import perform_user_actions as saml_pua
        saml_pua(user, social_account, common_fields)

    else:
        logger.debug(
            "UnifiedAdapter: no handler registered for protocol=%s", protocol
        )
