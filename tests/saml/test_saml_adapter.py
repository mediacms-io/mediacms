import base64
from types import SimpleNamespace
from unittest.mock import patch

from allauth.socialaccount.models import SocialAccount, SocialApp, SocialLogin
from allauth.socialaccount.signals import social_account_updated
from django.contrib.sessions.backends.db import SessionStore
from django.test import RequestFactory, TestCase

from files.tests import create_account, fixture_path
from identity_providers.models import (
    IdentityProviderGlobalRole,
    IdentityProviderGroupRole,
    IdentityProviderUserLog,
)
from rbac.models import RBACGroup, RBACMembership
from saml_auth.adapter import (
    SAMLAccountAdapter,
    add_user_logo,
    handle_role_mapping,
    handle_saml_logs_save,
    perform_user_actions,
)
from saml_auth.models import SAMLConfiguration
from users.models import User

PROVIDER_ID = "adapter-idp"


def make_user(username, **kwargs):
    return create_account(username=username, email=f"{username}@example.com", password="saml-adapter-password", **kwargs)


def make_social_app(provider_id=PROVIDER_ID):
    return SocialApp.objects.create(provider="saml", provider_id=provider_id, name=f"{provider_id} name", client_id=provider_id)


def make_configuration(social_app, **overrides):
    fields = {
        "social_app": social_app,
        "sso_url": "https://idp.example.org/sso",
        "slo_url": "https://idp.example.org/slo",
        "sp_metadata_url": "https://sp.example.org/saml/metadata",
        "idp_id": f"https://idp.example.org/{social_app.provider_id}",
        "idp_cert": "dummy-cert",
        "uid": "uid",
        "groups": "isMemberOf",
        "role": "affiliation",
    }
    fields.update(overrides)
    return SAMLConfiguration.objects.create(**fields)


def png_base64():
    with open(fixture_path("test_image.png"), "rb") as fp:
        return base64.b64encode(fp.read()).decode()


class PopulateUserTest(TestCase):
    def setUp(self):
        self.adapter = SAMLAccountAdapter()

    def sociallogin(self, uid):
        return SimpleNamespace(user=User(), account=SimpleNamespace(uid=uid), data=None)

    def test_username_keeps_only_reversible_characters(self):
        sociallogin = self.sociallogin("jane doe/éx+1@uni.edu")
        user = self.adapter.populate_user(None, sociallogin, {})
        self.assertEqual(user.username, "jane_doe__x_1@uni.edu")

    def test_username_is_truncated_to_field_length(self):
        user = self.adapter.populate_user(None, self.sociallogin("a" * 300), {})
        self.assertEqual(len(user.username), 150)

    def test_missing_uid_leaves_username_empty(self):
        user = self.adapter.populate_user(None, self.sociallogin(None), {})
        self.assertEqual(user.username, "")

    def test_name_fields_are_copied_and_data_is_kept_on_sociallogin(self):
        sociallogin = self.sociallogin("jdoe")
        data = {"name": "Jane Doe", "first_name": "Jane", "last_name": "", "email": "jane@example.com"}
        user = self.adapter.populate_user(None, sociallogin, data)
        self.assertEqual((user.name, user.first_name, user.last_name), ("Jane Doe", "Jane", ""))
        self.assertIs(sociallogin.data, data)

    def test_signup_is_always_open(self):
        self.assertTrue(self.adapter.is_open_for_signup(None, None))


class SaveUserTest(TestCase):
    def test_new_user_is_saved_and_mapped_to_groups_from_response(self):
        social_app = make_social_app()
        make_configuration(social_app)
        group = RBACGroup.objects.create(name="Physics", uid="physics", identity_provider=social_app)

        user = User(username="new_saml_user", email="new_saml_user@example.com")
        account = SocialAccount(provider=PROVIDER_ID, uid="new_saml_user", extra_data={"isMemberOf": ["physics"], "affiliation": ["member"]})
        sociallogin = SocialLogin(user=user, account=account)
        request = RequestFactory().get("/")
        request.session = SessionStore()

        saved = SAMLAccountAdapter().save_user(request, sociallogin)

        self.assertIsNotNone(saved.pk)
        self.assertFalse(saved.has_usable_password())
        self.assertTrue(SocialAccount.objects.filter(user=saved, uid="new_saml_user").exists())
        self.assertTrue(RBACMembership.objects.filter(user=saved, rbac_group=group, role="member").exists())


class SocialAccountUpdatedTest(TestCase):
    def test_signal_refreshes_changed_profile_fields(self):
        user = make_user("saml_updated_user", name="Old Name")
        account = SimpleNamespace(provider="unknown-provider", extra_data={})
        sociallogin = SimpleNamespace(user=user, account=account, data={"name": "New Name", "email": "fresh@example.com", "first_name": ""})

        social_account_updated.send(sender=SocialLogin, request=None, sociallogin=sociallogin)

        user.refresh_from_db()
        self.assertEqual(user.name, "New Name")
        self.assertEqual(user.email, "fresh@example.com")


class PerformUserActionsTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.social_app = make_social_app()

    def account(self, extra_data):
        return SimpleNamespace(provider=PROVIDER_ID, extra_data=extra_data)

    def test_unchanged_fields_are_not_saved(self):
        user = make_user("saml_same_user", name="Same")
        with patch.object(User, "save") as save:
            perform_user_actions(user, self.account({}), {"name": "Same", "email": user.email})
        save.assert_not_called()

    def test_without_configuration_no_mapping_or_log_happens(self):
        user = make_user("saml_noconf_user")
        RBACGroup.objects.create(name="Unused", uid="unused", identity_provider=self.social_app)
        perform_user_actions(user, self.account({"isMemberOf": ["unused"]}))
        self.assertFalse(RBACMembership.objects.filter(user=user).exists())
        self.assertFalse(IdentityProviderUserLog.objects.exists())

    def test_with_configuration_response_is_logged_without_photo(self):
        make_configuration(self.social_app)
        user = make_user("saml_logged_user")
        perform_user_actions(user, self.account({"uid": ["saml_logged_user"], "jpegPhoto": [png_base64()]}))
        log = IdentityProviderUserLog.objects.get(user=user, identity_provider=self.social_app)
        self.assertIn("saml_logged_user", log.logs)
        self.assertNotIn("jpegPhoto", log.logs)
        self.assertIn("SAML Log - saml_logged_user", str(log))

    def test_logging_can_be_disabled_on_configuration(self):
        make_configuration(self.social_app, save_saml_response_logs=False)
        user = make_user("saml_unlogged_user")
        perform_user_actions(user, self.account({"uid": ["x"]}))
        self.assertFalse(IdentityProviderUserLog.objects.exists())

    def test_unknown_provider_is_tolerated(self):
        user = make_user("saml_unknown_provider_user")
        result = perform_user_actions(user, SimpleNamespace(provider="nobody", extra_data={}))
        self.assertIs(result, user)

    def test_logs_save_strips_photo_from_stored_response(self):
        user = make_user("saml_strip_user")
        extra_data = {"mail": ["a@example.com"], "jpegPhoto": ["abc"]}
        self.assertTrue(handle_saml_logs_save(user, extra_data, self.social_app))
        self.assertNotIn("jpegPhoto", extra_data)
        self.assertEqual(IdentityProviderUserLog.objects.get(user=user).logs, str({"mail": ["a@example.com"]}))


class AddUserLogoTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.social_app = make_social_app()

    def test_default_photo_attribute_sets_logo_for_user_without_one(self):
        user = make_user("saml_logo_user")
        self.assertEqual(user.logo.name, "userlogos/user.jpg")
        add_user_logo(user, {"jpegPhoto": [png_base64()]})
        user.refresh_from_db()
        self.assertNotEqual(user.logo.name, "userlogos/user.jpg")
        self.assertTrue(user.logo.name.startswith("userlogos/"))

    def test_configured_attribute_name_is_used(self):
        configuration = make_configuration(self.social_app, user_logo="thumbnailPhoto")
        user = make_user("saml_custom_logo_user")
        add_user_logo(user, {"jpegPhoto": [png_base64()]}, configuration)
        user.refresh_from_db()
        self.assertEqual(user.logo.name, "userlogos/user.jpg")
        add_user_logo(user, {"thumbnailPhoto": [png_base64()]}, configuration)
        user.refresh_from_db()
        self.assertNotEqual(user.logo.name, "userlogos/user.jpg")

    def test_existing_custom_logo_is_not_overwritten(self):
        user = make_user("saml_has_logo_user")
        User.objects.filter(pk=user.pk).update(logo="userlogos/custom.jpg")
        user.refresh_from_db()
        add_user_logo(user, {"jpegPhoto": [png_base64()]})
        user.refresh_from_db()
        self.assertEqual(user.logo.name, "userlogos/custom.jpg")

    def test_undecodable_photo_is_logged_and_ignored(self):
        user = make_user("saml_bad_logo_user")
        with self.assertLogs(level="ERROR"):
            self.assertTrue(add_user_logo(user, {"jpegPhoto": ["not base64!"]}))
        user.refresh_from_db()
        self.assertEqual(user.logo.name, "userlogos/user.jpg")


class HandleRoleMappingTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.social_app = make_social_app()
        cls.other_app = make_social_app("adapter-other-idp")
        cls.physics = RBACGroup.objects.create(name="Physics", uid="physics", identity_provider=cls.social_app)
        cls.maths = RBACGroup.objects.create(name="Maths", uid="maths", identity_provider=cls.social_app)
        cls.foreign = RBACGroup.objects.create(name="Physics", uid="physics", identity_provider=cls.other_app)

    def setUp(self):
        self.configuration = make_configuration(self.social_app)
        self.user = make_user("saml_role_user")

    def roles(self):
        return set(RBACMembership.objects.filter(user=self.user).values_list("rbac_group__uid", "rbac_group__identity_provider__provider_id", "role"))

    def test_without_configuration_nothing_happens(self):
        self.assertFalse(handle_role_mapping(self.user, {"isMemberOf": ["physics"]}, self.social_app, None))
        self.assertEqual(self.roles(), set())

    def test_groups_of_this_provider_get_member_role_by_default(self):
        self.assertTrue(handle_role_mapping(self.user, {"isMemberOf": ["physics", "unknown"]}, self.social_app, self.configuration))
        self.assertEqual(self.roles(), {("physics", PROVIDER_ID, "member")})

    def test_role_attribute_naming_a_group_role_is_used_directly(self):
        handle_role_mapping(self.user, {"isMemberOf": ["physics"], "affiliation": ["manager", "member"]}, self.social_app, self.configuration)
        self.assertEqual(self.roles(), {("physics", PROVIDER_ID, "manager")})

    def test_group_role_mapping_translates_idp_role(self):
        IdentityProviderGroupRole.objects.create(identity_provider=self.social_app, name="faculty", map_to="contributor")
        handle_role_mapping(self.user, {"isMemberOf": ["physics", "maths"], "affiliation": ["faculty"]}, self.social_app, self.configuration)
        self.assertEqual(self.roles(), {("physics", PROVIDER_ID, "contributor"), ("maths", PROVIDER_ID, "contributor")})

    def test_unmapped_role_falls_back_to_member(self):
        handle_role_mapping(self.user, {"isMemberOf": ["physics"], "affiliation": "alumnus"}, self.social_app, self.configuration)
        self.assertEqual(self.roles(), {("physics", PROVIDER_ID, "member")})

    def test_global_role_mapping_updates_user_flags(self):
        IdentityProviderGlobalRole.objects.create(identity_provider=self.social_app, name="staff", map_to="editor")
        handle_role_mapping(self.user, {"affiliation": ["staff"]}, self.social_app, self.configuration)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_editor)
        self.assertFalse(self.user.is_superuser)

    def test_existing_membership_role_is_updated(self):
        RBACMembership.objects.create(user=self.user, rbac_group=self.physics, role="member")
        handle_role_mapping(self.user, {"isMemberOf": ["physics"], "affiliation": ["contributor"]}, self.social_app, self.configuration)
        self.assertEqual(self.roles(), {("physics", PROVIDER_ID, "contributor")})

    def test_groups_missing_from_response_are_kept_by_default(self):
        RBACMembership.objects.create(user=self.user, rbac_group=self.maths, role="member")
        handle_role_mapping(self.user, {"isMemberOf": ["physics"]}, self.social_app, self.configuration)
        self.assertEqual(self.roles(), {("physics", PROVIDER_ID, "member"), ("maths", PROVIDER_ID, "member")})

    def test_remove_from_groups_drops_only_this_providers_missing_groups(self):
        self.configuration.remove_from_groups = True
        self.configuration.save()
        RBACMembership.objects.create(user=self.user, rbac_group=self.maths, role="member")
        RBACMembership.objects.create(user=self.user, rbac_group=self.foreign, role="member")
        handle_role_mapping(self.user, {"isMemberOf": ["physics"]}, self.social_app, self.configuration)
        self.assertEqual(self.roles(), {("physics", PROVIDER_ID, "member"), ("physics", "adapter-other-idp", "member")})

    def test_errors_while_reading_role_mappings_still_assign_groups(self):
        with patch.object(User, "set_role_from_mapping", side_effect=RuntimeError("boom")):
            IdentityProviderGlobalRole.objects.create(identity_provider=self.social_app, name="manager", map_to="manager")
            with self.assertLogs(level="ERROR"):
                handle_role_mapping(self.user, {"isMemberOf": ["physics"], "affiliation": ["manager"]}, self.social_app, self.configuration)
        self.assertEqual(self.roles(), {("physics", PROVIDER_ID, "manager")})
