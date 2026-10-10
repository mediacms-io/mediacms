import pytest
from unittest.mock import MagicMock, patch, PropertyMock

from django.contrib.auth import get_user_model
from django.contrib.sites.models import Site

from allauth.socialaccount.models import SocialApp, SocialAccount

from oidc_auth.adapter import (
    OIDCAccountAdapter,
    perform_user_actions,
)
from oidc_auth.parsers.ietf_role_mapping import handle_ietf_role_mapping, _parse_role_pairs
from oidc_auth.parsers.profile_picture import sync_profile_picture
from oidc_auth.models import OIDCConfiguration
from identity_providers.models import IdentityProviderGlobalRole, IdentityProviderGroupRole
from rbac.models import RBACGroup, RBACMembership

User = get_user_model()


def make_social_app(name="Test OIDC", provider_id="test-oidc"):
    app = SocialApp.objects.create(
        provider="openid_connect",
        provider_id=provider_id,
        name=name,
        client_id="client-id",
        secret="client-secret",
    )
    site = Site.objects.get_current()
    app.sites.add(site)
    return app


def make_oidc_config(app, **kwargs):
    return OIDCConfiguration.objects.create(social_app=app, **kwargs)


def make_user(username="testuser", email="test@example.com"):
    return User.objects.create_user(
        username=username,
        email=email,
        password="password123",
    )


def make_social_account(user, app, uid="uid-123", extra_data=None):
    account = SocialAccount.objects.create(
        user=user,
        provider=app.provider_id,
        uid=uid,
        extra_data=extra_data or {},
    )
    return account


@pytest.mark.django_db
class TestPopulateUser:
    def test_sanitises_uid_to_username(self):
        adapter = OIDCAccountAdapter()
        request = MagicMock()

        sociallogin = MagicMock()
        sociallogin.user = User()
        sociallogin.account.uid = "user name!@#€"

        data = {"name": "Test User", "email": "u@example.com"}
        user = adapter.populate_user(request, sociallogin, data)

        # Special characters other than [\w.@-] must be replaced with _
        assert "!" not in user.username
        assert " " not in user.username

    def test_username_truncated_to_150_chars(self):
        adapter = OIDCAccountAdapter()
        request = MagicMock()
        sociallogin = MagicMock()
        sociallogin.user = User()
        sociallogin.account.uid = "a" * 200

        user = adapter.populate_user(request, sociallogin, {"email": "u@example.com"})
        assert len(user.username) <= 150

    def test_name_fields_copied_from_data(self):
        adapter = OIDCAccountAdapter()
        request = MagicMock()
        sociallogin = MagicMock()
        sociallogin.user = User()
        sociallogin.account.uid = "uid-1"

        data = {"name": "Jane Doe", "first_name": "Jane", "last_name": "Doe", "email": "jane@example.com"}
        user = adapter.populate_user(request, sociallogin, data)

        assert user.name == "Jane Doe"
        assert user.first_name == "Jane"
        assert user.last_name == "Doe"


@pytest.mark.django_db
class TestPerformUserActionsAttributeSync:
    def test_updates_name_from_common_fields(self):
        app = make_social_app()
        make_oidc_config(app)
        user = make_user()
        account = make_social_account(user, app)

        common_fields = {"name": "Updated Name", "email": user.email}
        perform_user_actions(user, account, common_fields)

        user.refresh_from_db()
        assert user.name == "Updated Name"

    def test_updates_email_from_common_fields(self):
        app = make_social_app()
        make_oidc_config(app)
        user = make_user()
        account = make_social_account(user, app)

        common_fields = {"email": "new@example.com"}
        perform_user_actions(user, account, common_fields)

        user.refresh_from_db()
        assert user.email == "new@example.com"

    def test_no_update_when_value_unchanged(self):
        app = make_social_app()
        make_oidc_config(app)
        user = make_user(username="nochange", email="same@example.com")
        account = make_social_account(user, app)

        with patch.object(user, "save") as mock_save:
            common_fields = {"email": "same@example.com"}
            perform_user_actions(user, account, common_fields)
            mock_save.assert_not_called()

    def test_no_actions_without_oidc_config(self):
        """If no OIDCConfiguration exists, perform_user_actions is a no-op."""
        app = make_social_app(provider_id="unconfigured-oidc")
        user = make_user(username="unconfigured")
        account = make_social_account(user, app)

        # Should not raise
        result = perform_user_actions(user, account, {"name": "Ghost"})
        assert result == user


@pytest.mark.django_db
class TestSyncProfilePicture:
    @patch("oidc_auth.tasks.download_user_logo")
    def test_enqueues_celery_task_for_picture(self, mock_task):
        app = make_social_app()
        config = make_oidc_config(app)
        user = make_user()
        user.logo.name = "userlogos/user.jpg"

        sync_profile_picture(user, "http://example.com/pic.jpg", app, config)

        mock_task.delay.assert_called_once_with(user.pk, "http://example.com/pic.jpg")

    @patch("oidc_auth.tasks.download_user_logo")
    def test_skips_when_no_url(self, mock_task):
        app = make_social_app()
        config = make_oidc_config(app)
        user = make_user()

        sync_profile_picture(user, None, app, config)
        sync_profile_picture(user, "", app, config)

        mock_task.delay.assert_not_called()

    @patch("oidc_auth.tasks.download_user_logo")
    def test_skips_when_custom_logo_set(self, mock_task):
        app = make_social_app()
        config = make_oidc_config(app)
        user = make_user()
        user.logo.name = "userlogos/custom_avatar.jpg"

        sync_profile_picture(user, "http://example.com/pic.jpg", app, config)

        mock_task.delay.assert_not_called()

    @patch("oidc_auth.tasks.download_user_logo")
    def test_enqueues_when_logo_is_default(self, mock_task):
        app = make_social_app()
        config = make_oidc_config(app)
        user = make_user()
        user.logo.name = "userlogos/user.jpg"

        sync_profile_picture(user, "http://example.com/new.jpg", app, config)

        mock_task.delay.assert_called_once()


class TestParseRolePairs:
    def test_nested_lists_parsed_correctly(self):
        raw = [["chair", "secretariat"], ["member", "iab"]]
        result = _parse_role_pairs(raw, ":")
        assert result == [
            {"role": "chair",  "group": "secretariat", "combined": "chair:secretariat"},
            {"role": "member", "group": "iab",          "combined": "member:iab"},
        ]

    def test_already_combined_strings_accepted(self):
        raw = ["chair:secretariat", "member:iab"]
        result = _parse_role_pairs(raw, ":")
        assert result == [
            {"role": "chair",  "group": "secretariat", "combined": "chair:secretariat"},
            {"role": "member", "group": "iab",          "combined": "member:iab"},
        ]

    def test_empty_list_returns_empty(self):
        assert _parse_role_pairs([], ":") == []

    def test_short_pair_skipped(self):
        raw = [["only-one-element"]]
        assert _parse_role_pairs(raw, ":") == []

    def test_non_list_non_string_entry_skipped(self):
        raw = [42, None, ["recman", "ietf"]]
        result = _parse_role_pairs(raw, ":")
        assert len(result) == 1
        assert result[0]["combined"] == "recman:ietf"

    def test_whitespace_stripped_from_values(self):
        raw = [[" recman ", " ietf "]]
        result = _parse_role_pairs(raw, ":")
        assert result[0] == {"role": "recman", "group": "ietf", "combined": "recman:ietf"}

    def test_custom_separator(self):
        raw = [["chair", "secretariat"]]
        result = _parse_role_pairs(raw, "-")
        assert result[0]["combined"] == "chair-secretariat"

    def test_string_without_separator_skipped(self):
        raw = ["plain-role"]   # no ":" → not a combined string
        assert _parse_role_pairs(raw, ":") == []


@pytest.mark.django_db
class TestHandleRoleMappingPairFormat:
    """Tests for handle_ietf_role_mapping using the [role, group] pair format."""

    def _make_app_and_config(self, **config_kwargs):
        app = make_social_app(provider_id="ietf-datatracker")
        config = make_oidc_config(app, **config_kwargs)
        return app, config

    def test_creates_membership_per_pair(self):
        app, config = self._make_app_and_config()
        user = make_user()
        g1 = RBACGroup.objects.create(identity_provider=app, uid="secretariat", name="Secretariat")
        g2 = RBACGroup.objects.create(identity_provider=app, uid="iab", name="IAB")

        handle_ietf_role_mapping(
            user, [["chair", "secretariat"], ["member", "iab"]], app, config, separator=":",
        )

        assert RBACMembership.objects.filter(user=user, rbac_group=g1).exists()
        assert RBACMembership.objects.filter(user=user, rbac_group=g2).exists()

    def test_admin_assigned_for_recman_ietf(self):
        app, config = self._make_app_and_config()
        user = make_user()

        handle_ietf_role_mapping(
            user,
            [["recman", "ietf"], ["member", "iab"]],
            app,
            config,
            role_matcher={"recman:ietf": "admin"},
        )

        user.refresh_from_db()
        assert user.is_superuser is True or user.portal_user_role in ("admin",)

    def test_group_role_mapping_applied_per_pair(self):
        app, config = self._make_app_and_config()
        user = make_user()
        g = RBACGroup.objects.create(identity_provider=app, uid="editors", name="Editors")
        IdentityProviderGroupRole.objects.create(
            identity_provider=app, name="chair", map_to="manager",
        )

        handle_ietf_role_mapping(user, [["chair", "editors"]], app, config, separator=":")

        membership = RBACMembership.objects.get(user=user, rbac_group=g)
        assert membership.role == "manager"

    def test_unknown_group_in_pair_silently_skipped(self):
        app, config = self._make_app_and_config()
        user = make_user()

        handle_ietf_role_mapping(user, [["chair", "ghost"]], app, config, separator=":")

        assert not RBACMembership.objects.filter(user=user).exists()

    def test_updates_existing_membership_role(self):
        app, config = self._make_app_and_config()
        user = make_user()
        g = RBACGroup.objects.create(identity_provider=app, uid="editors", name="Editors")
        IdentityProviderGroupRole.objects.create(
            identity_provider=app, name="chair", map_to="manager",
        )
        RBACMembership.objects.create(user=user, rbac_group=g, role="member")

        handle_ietf_role_mapping(user, [["chair", "editors"]], app, config, separator=":")

        membership = RBACMembership.objects.get(user=user, rbac_group=g)
        assert membership.role == "manager"

    def test_stale_groups_removed_when_flag_set(self):
        app, config = self._make_app_and_config(remove_from_groups=True)
        user = make_user()
        g_kept = RBACGroup.objects.create(identity_provider=app, uid="kept", name="Kept")
        g_stale = RBACGroup.objects.create(identity_provider=app, uid="stale", name="Stale")
        RBACMembership.objects.create(user=user, rbac_group=g_kept, role="member")
        RBACMembership.objects.create(user=user, rbac_group=g_stale, role="member")

        handle_ietf_role_mapping(user, [["member", "kept"]], app, config, separator=":")

        assert RBACMembership.objects.filter(user=user, rbac_group=g_kept).exists()
        assert not g_stale.members.filter(pk=user.pk).exists()

    def test_stale_groups_preserved_when_flag_not_set(self):
        app, config = self._make_app_and_config(remove_from_groups=False)
        user = make_user()
        g_existing = RBACGroup.objects.create(identity_provider=app, uid="existing", name="Existing")
        RBACMembership.objects.create(user=user, rbac_group=g_existing, role="member")

        handle_ietf_role_mapping(user, [], app, config, separator=":")

        assert RBACMembership.objects.filter(user=user, rbac_group=g_existing).exists()

    def test_empty_roles_is_noop(self):
        app, config = self._make_app_and_config()
        user = make_user()

        handle_ietf_role_mapping(user, [], app, config, separator=":")

        assert not RBACMembership.objects.filter(user=user).exists()

    def test_combined_string_format_accepted(self):
        app, config = self._make_app_and_config()
        user = make_user()
        g = RBACGroup.objects.create(identity_provider=app, uid="secretariat", name="Secretariat")

        handle_ietf_role_mapping(user, ["chair:secretariat"], app, config, separator=":")

        assert RBACMembership.objects.filter(user=user, rbac_group=g).exists()

