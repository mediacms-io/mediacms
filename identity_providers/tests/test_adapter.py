import pytest
from unittest.mock import MagicMock, patch, call

from django.contrib.auth import get_user_model
from django.contrib.sites.models import Site

from allauth.socialaccount.models import SocialApp, SocialAccount

from identity_providers.adapter import (
    UnifiedSocialAccountAdapter,
    _dispatch_user_actions,
    unified_social_account_updated,
)

User = get_user_model()


def make_social_app(provider="openid_connect", provider_id="test-oidc", name="Test App"):
    app = SocialApp.objects.create(
        provider=provider,
        provider_id=provider_id,
        name=name,
        client_id="client-id",
        secret="client-secret",
    )
    app.sites.add(Site.objects.get_current())
    return app


def make_user(username="testuser", email="test@example.com"):
    return User.objects.create_user(username=username, email=email, password="pass")


def make_social_account(user, app, uid="uid-123", extra_data=None):
    return SocialAccount.objects.create(
        user=user,
        provider=app.provider_id,
        uid=uid,
        extra_data=extra_data or {},
    )


def make_sociallogin(user, account, data=None):
    sl = MagicMock()
    sl.user = user
    sl.account = account
    sl.data = data or {}
    return sl


class TestIsOpenForSignup:
    def test_always_returns_true(self):
        adapter = UnifiedSocialAccountAdapter()
        assert adapter.is_open_for_signup(MagicMock(), MagicMock()) is True


class TestPopulateUser:
    """
    populate_user is protocol-agnostic: it sanitises the UID into a username
    using the same regex accepted by all MediaCMS username validators.
    """

    def _sl(self, uid):
        sl = MagicMock()
        sl.user = User()
        sl.account.uid = uid
        return sl

    def test_spaces_and_special_chars_replaced_by_underscore(self):
        adapter = UnifiedSocialAccountAdapter()
        user = adapter.populate_user(MagicMock(), self._sl("user name!@#€"), {})
        assert " " not in user.username
        assert "!" not in user.username
        assert "#" not in user.username

    def test_allowed_chars_preserved(self):
        adapter = UnifiedSocialAccountAdapter()
        uid = "jane.doe@domain-test_1"
        user = adapter.populate_user(MagicMock(), self._sl(uid), {})
        assert user.username == uid

    def test_username_truncated_to_150_chars(self):
        adapter = UnifiedSocialAccountAdapter()
        user = adapter.populate_user(MagicMock(), self._sl("a" * 200), {})
        assert len(user.username) <= 150

    def test_empty_uid_keeps_empty_string(self):
        adapter = UnifiedSocialAccountAdapter()
        user = adapter.populate_user(MagicMock(), self._sl(""), {})
        assert user.username == ""

    def test_name_fields_copied_from_data(self):
        adapter = UnifiedSocialAccountAdapter()
        data = {"name": "Jane Doe", "first_name": "Jane", "last_name": "Doe"}
        user = adapter.populate_user(MagicMock(), self._sl("uid-1"), data)
        assert user.name == "Jane Doe"
        assert user.first_name == "Jane"
        assert user.last_name == "Doe"

    def test_absent_name_fields_not_set(self):
        adapter = UnifiedSocialAccountAdapter()
        user = adapter.populate_user(MagicMock(), self._sl("uid-1"), {})
        assert user.first_name == ""
        assert user.last_name == ""

    def test_data_stored_on_sociallogin(self):
        adapter = UnifiedSocialAccountAdapter()
        sl = self._sl("uid-1")
        data = {"email": "u@example.com"}
        adapter.populate_user(MagicMock(), sl, data)
        assert sl.data is data


@pytest.mark.django_db
class TestDispatchUserActions:

    def test_routes_openid_connect_to_oidc_pua(self):
        app = make_social_app(provider="openid_connect", provider_id="myoidc")
        user = make_user()
        account = make_social_account(user, app, uid="sub-123")
        common_fields = {"email": "user@example.com"}

        with patch("oidc_auth.adapter.perform_user_actions") as mock_pua:
            _dispatch_user_actions(user, account, common_fields)

        mock_pua.assert_called_once_with(user, account, common_fields)

    def test_routes_saml_to_saml_pua(self):
        app = make_social_app(provider="saml", provider_id="mysaml")
        user = make_user()
        account = make_social_account(user, app, uid="saml-uid-1")
        common_fields = {"email": "user@example.com"}

        with patch("saml_auth.adapter.perform_user_actions") as mock_pua:
            _dispatch_user_actions(user, account, common_fields)

        mock_pua.assert_called_once_with(user, account, common_fields)

    def test_none_common_fields_passed_through(self):
        app = make_social_app(provider="openid_connect", provider_id="myoidc2")
        user = make_user(username="user2", email="user2@example.com")
        account = make_social_account(user, app, uid="sub-456")

        with patch("oidc_auth.adapter.perform_user_actions") as mock_pua:
            _dispatch_user_actions(user, account, None)

        mock_pua.assert_called_once_with(user, account, None)

    def test_no_social_app_found_is_silent(self):
        """Unknown provider_id → no SocialApp → both helpers never called."""
        user = make_user()
        account = MagicMock()
        account.provider = "provider-that-does-not-exist"

        with patch("oidc_auth.adapter.perform_user_actions") as mock_oidc, \
             patch("saml_auth.adapter.perform_user_actions") as mock_saml:
            _dispatch_user_actions(user, account)

        mock_oidc.assert_not_called()
        mock_saml.assert_not_called()

    def test_unknown_protocol_is_silent(self):
        """SocialApp exists but protocol is not saml/openid_connect → no dispatch."""
        # Django CharField lets us store any value even outside declared choices.
        app = SocialApp.objects.create(
            provider="github",
            provider_id="github",
            name="GitHub",
            client_id="gh-id",
            secret="gh-secret",
        )
        user = make_user()
        account = make_social_account(user, app, uid="gh-1")

        with patch("oidc_auth.adapter.perform_user_actions") as mock_oidc, \
             patch("saml_auth.adapter.perform_user_actions") as mock_saml:
            _dispatch_user_actions(user, account)

        mock_oidc.assert_not_called()
        mock_saml.assert_not_called()

    def test_oidc_pua_not_called_for_saml_provider(self):
        """Ensure cross-dispatch never happens."""
        app = make_social_app(provider="saml", provider_id="only-saml")
        user = make_user()
        account = make_social_account(user, app)

        with patch("oidc_auth.adapter.perform_user_actions") as mock_oidc, \
             patch("saml_auth.adapter.perform_user_actions"):
            _dispatch_user_actions(user, account)

        mock_oidc.assert_not_called()

    def test_saml_pua_not_called_for_oidc_provider(self):
        """Ensure cross-dispatch never happens."""
        app = make_social_app(provider="openid_connect", provider_id="only-oidc")
        user = make_user()
        account = make_social_account(user, app)

        with patch("saml_auth.adapter.perform_user_actions") as mock_saml, \
             patch("oidc_auth.adapter.perform_user_actions"):
            _dispatch_user_actions(user, account)

        mock_saml.assert_not_called()


@pytest.mark.django_db
class TestSaveUser:

    def test_calls_dispatch_after_super_save(self):
        app = make_social_app(provider="openid_connect", provider_id="oidc-save")
        user = make_user(username="saveuser", email="save@example.com")
        account = make_social_account(user, app)
        sl = make_sociallogin(user, account, data={"email": "save@example.com"})

        adapter = UnifiedSocialAccountAdapter()
        sup = "allauth.socialaccount.adapter.DefaultSocialAccountAdapter.save_user"

        with patch(sup, return_value=user), \
             patch("identity_providers.adapter._dispatch_user_actions") as mock_dispatch:
            result = adapter.save_user(MagicMock(), sl)

        mock_dispatch.assert_called_once_with(user, account, sl.data)
        assert result is user

    def test_dispatch_receives_correct_sociallogin_data(self):
        user = make_user(username="datauser", email="data@example.com")
        data = {"email": "data@example.com", "name": "Data User"}
        sl = MagicMock()
        sl.data = data

        adapter = UnifiedSocialAccountAdapter()
        sup = "allauth.socialaccount.adapter.DefaultSocialAccountAdapter.save_user"

        with patch(sup, return_value=user), \
             patch("identity_providers.adapter._dispatch_user_actions") as mock_dispatch:
            adapter.save_user(MagicMock(), sl)

        _, _, passed_data = mock_dispatch.call_args[0]
        assert passed_data is data


@pytest.mark.django_db
class TestUnifiedSignalReceiver:

    def test_dispatches_with_user_account_and_data(self):
        app = make_social_app(provider="openid_connect", provider_id="oidc-sig")
        user = make_user(username="siguser", email="sig@example.com")
        account = make_social_account(user, app)
        sl = make_sociallogin(user, account, data={"email": "sig@example.com"})

        with patch("identity_providers.adapter._dispatch_user_actions") as mock_dispatch:
            unified_social_account_updated(sender=None, request=MagicMock(), sociallogin=sl)

        mock_dispatch.assert_called_once_with(user, account, sl.data)

    def test_sociallogin_without_data_attribute_passes_none(self):
        """
        Some adapters (e.g. SAML) may produce sociallogin objects without a
        .data attribute.  getattr(sociallogin, 'data', None) must not raise.
        """
        app = make_social_app(provider="saml", provider_id="saml-sig")
        user = make_user(username="siguser2", email="sig2@example.com")
        account = make_social_account(user, app)

        # Restrict spec to simulate missing .data attribute
        sl = MagicMock(spec=["user", "account"])
        sl.user = user
        sl.account = account

        with patch("identity_providers.adapter._dispatch_user_actions") as mock_dispatch:
            unified_social_account_updated(sender=None, request=MagicMock(), sociallogin=sl)

        mock_dispatch.assert_called_once_with(user, account, None)

    def test_dispatches_for_saml_provider(self):
        app = make_social_app(provider="saml", provider_id="saml-sig2")
        user = make_user(username="samlsig", email="samlsig@example.com")
        account = make_social_account(user, app)
        sl = make_sociallogin(user, account, data={"uid": "saml-uid"})

        with patch("identity_providers.adapter._dispatch_user_actions") as mock_dispatch:
            unified_social_account_updated(sender=None, request=MagicMock(), sociallogin=sl)

        mock_dispatch.assert_called_once()
        args = mock_dispatch.call_args[0]
        assert args[0] is user
        assert args[1] is account
