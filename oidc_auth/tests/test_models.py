import pytest
from django.core.exceptions import ValidationError

from allauth.socialaccount.models import SocialApp

from oidc_auth.models import OIDCConfiguration


@pytest.mark.django_db
class TestOIDCConfigurationModel:
    def _make_social_app(self, name="Test OIDC", provider="openid_connect", provider_id="test-oidc"):
        app = SocialApp.objects.create(
            provider=provider,
            provider_id=provider_id,
            name=name,
            client_id="client-id",
            secret="client-secret",
        )
        return app

    def test_create_configuration_with_defaults(self):
        app = self._make_social_app()
        config = OIDCConfiguration.objects.create(social_app=app)

        assert config.uid_claim == "sub"
        assert config.email_claim == "email"
        assert config.name_claim == "name"
        assert config.first_name_claim == "given_name"
        assert config.last_name_claim == "family_name"
        assert config.groups_claim == "groups"
        assert config.role_claim == "roles"
        assert config.user_logo_claim == "picture"
        assert config.verified_email is True
        assert config.email_authentication is False
        assert config.remove_from_groups is False
        assert config.save_oidc_response_logs is False

    def test_str_representation(self):
        app = self._make_social_app(name="My Provider")
        config = OIDCConfiguration.objects.create(social_app=app)
        assert "My Provider" in str(config)

    def test_one_config_per_social_app_enforced(self):
        app = self._make_social_app()
        OIDCConfiguration.objects.create(social_app=app)

        duplicate = OIDCConfiguration(social_app=app)
        with pytest.raises(ValidationError):
            duplicate.clean()

    def test_custom_claim_names_saved(self):
        app = self._make_social_app()
        config = OIDCConfiguration.objects.create(
            social_app=app,
            uid_claim="preferred_username",
            groups_claim="member_of",
            role_claim="eduPersonAffiliation",
        )
        config.refresh_from_db()
        assert config.uid_claim == "preferred_username"
        assert config.groups_claim == "member_of"
        assert config.role_claim == "eduPersonAffiliation"
