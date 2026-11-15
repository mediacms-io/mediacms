import jwt
from cryptography.hazmat.primitives import serialization
from django.contrib.admin.sites import site
from django.db import IntegrityError
from django.test import RequestFactory, TestCase
from django.urls import reverse
from jwcrypto import jwk
from lti_testkit import CLIENT_ID, ISSUER, create_platform, tool_public_key

from files.models import Category
from files.tests import create_account
from lti.keys import get_jwks, load_public_key
from lti.models import (
    LTILaunchLog,
    LTIPlatform,
    LTIResourceLink,
    LTIRoleMapping,
    LTIToolKeys,
    LTIUserMapping,
)
from rbac.models import RBACGroup


class LTIPlatformModelTest(TestCase):
    def test_str_shows_name_and_issuer(self):
        platform = create_platform(name="Moodle Production")
        self.assertEqual(str(platform), f"Moodle Production ({ISSUER})")

    def test_lti_config_exposes_everything_pylti1p3_needs(self):
        platform = create_platform(auth_audience="https://lms.example.com/aud")
        config = platform.get_lti_config()
        self.assertEqual(config["platform_id"], ISSUER)
        self.assertEqual(config["client_id"], CLIENT_ID)
        self.assertEqual(config["auth_audience"], "https://lms.example.com/aud")
        self.assertEqual(config["deployment_ids"], ["deployment-1"])
        self.assertEqual(set(config), {"platform_id", "client_id", "auth_login_url", "auth_token_url", "auth_audience", "key_set_url", "deployment_ids"})

    def test_same_issuer_and_client_cannot_be_registered_twice(self):
        create_platform()
        with self.assertRaises(IntegrityError):
            create_platform()

    def test_same_issuer_with_another_client_is_a_separate_platform(self):
        create_platform()
        create_platform(client_id="second-client")
        self.assertEqual(LTIPlatform.objects.filter(platform_id=ISSUER).count(), 2)


class LTIRelatedModelsStrTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.platform = create_platform(name="Moodle Test")
        cls.user = create_account(username="lti_str_user")

    def test_resource_link_prefers_titles_over_ids(self):
        link = LTIResourceLink.objects.create(platform=self.platform, context_id="c1", resource_link_id="r1", context_title="Biology", resource_link_title="Week 1")
        self.assertEqual(str(link), "Biology - Week 1")

    def test_resource_link_falls_back_to_ids(self):
        link = LTIResourceLink.objects.create(platform=self.platform, context_id="c2", resource_link_id="r2")
        self.assertEqual(str(link), "c2 - r2")

    def test_user_mapping_shows_username_and_platform(self):
        mapping = LTIUserMapping.objects.create(platform=self.platform, lti_user_id="sub-1", user=self.user)
        self.assertEqual(str(mapping), "lti_str_user (Moodle Test)")

    def test_role_mapping_shows_none_for_unset_roles(self):
        mapping = LTIRoleMapping.objects.create(platform=self.platform, lti_role="Learner", group_role="member")
        self.assertIn("Learner", str(mapping))
        self.assertIn("none/member", str(mapping))

    def test_launch_log_marks_success_and_unknown_user(self):
        ok = LTILaunchLog.objects.create(platform=self.platform, user=self.user, claims={})
        failed = LTILaunchLog.objects.create(platform=self.platform, success=False, claims={})
        self.assertTrue(str(ok).startswith("✓ lti_str_user @ Moodle Test"))
        self.assertTrue(str(failed).startswith("✗ Unknown @ Moodle Test"))

    def test_launch_logs_are_listed_newest_first(self):
        first = LTILaunchLog.objects.create(platform=self.platform, claims={"n": 1})
        second = LTILaunchLog.objects.create(platform=self.platform, claims={"n": 2})
        self.assertEqual(list(LTILaunchLog.objects.filter(pk__in=[first.pk, second.pk])), [second, first])


class LTIToolKeysTest(TestCase):
    def test_get_or_create_generates_a_signing_key_pair_once(self):
        keys = LTIToolKeys.get_or_create_keys()
        again = LTIToolKeys.get_or_create_keys()
        self.assertEqual(keys.pk, again.pk)
        self.assertEqual(again.private_key_jwk, keys.private_key_jwk)
        self.assertEqual(str(keys), "LTI Keys (mediacms-lti-key)")
        for key in (keys.private_key_jwk, keys.public_key_jwk):
            self.assertEqual(key["kid"], "mediacms-lti-key")
            self.assertEqual(key["alg"], "RS256")
            self.assertEqual(key["use"], "sig")
            self.assertEqual(key["kty"], "RSA")

    def test_public_jwk_does_not_leak_private_parts(self):
        keys = LTIToolKeys.get_or_create_keys()
        self.assertIn("d", keys.private_key_jwk)
        self.assertFalse({"d", "p", "q", "dp", "dq", "qi"} & set(keys.public_key_jwk))

    def test_public_key_verifies_signatures_made_with_private_key(self):
        keys = LTIToolKeys.get_or_create_keys()
        private_key = serialization.load_pem_private_key(jwk.JWK(**keys.private_key_jwk).export_to_pem(private_key=True, password=None), password=None)
        token = jwt.encode({"hello": "world"}, private_key, algorithm="RS256")
        self.assertEqual(jwt.decode(token, tool_public_key(), algorithms=["RS256"]), {"hello": "world"})

    def test_empty_stored_keys_are_regenerated(self):
        LTIToolKeys.objects.create(key_id="mediacms-lti-key", private_key_jwk={}, public_key_jwk={})
        keys = LTIToolKeys.get_or_create_keys()
        self.assertEqual(keys.public_key_jwk["kty"], "RSA")
        self.assertEqual(LTIToolKeys.objects.count(), 1)

    def test_generate_keys_rotates_the_key_material(self):
        keys = LTIToolKeys.get_or_create_keys()
        old_modulus = keys.public_key_jwk["n"]
        keys.generate_keys()
        keys.refresh_from_db()
        self.assertNotEqual(keys.public_key_jwk["n"], old_modulus)


class LTIKeysModuleTest(TestCase):
    def test_jwks_contains_only_the_public_key(self):
        jwks = get_jwks()
        self.assertEqual(jwks, {"keys": [LTIToolKeys.objects.get().public_key_jwk]})
        self.assertNotIn("d", jwks["keys"][0])

    def test_load_public_key_creates_keys_on_first_use(self):
        self.assertFalse(LTIToolKeys.objects.exists())
        self.assertEqual(load_public_key()["kid"], "mediacms-lti-key")
        self.assertTrue(LTIToolKeys.objects.exists())


class LTIAdminTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin_user = create_account(username="lti_admin", is_superuser=True)
        cls.learner = create_account(username="lti_admin_learner", email="learner@example.com")
        cls.platform = create_platform(name="Admin Moodle")
        cls.category = Category.objects.create(title="Admin course", is_rbac_category=True)
        cls.group = RBACGroup.objects.create(name="Admin course group")
        cls.link = LTIResourceLink.objects.create(platform=cls.platform, context_id="c1", resource_link_id="r1", context_title="Admin course", category=cls.category, rbac_group=cls.group)
        cls.bare_link = LTIResourceLink.objects.create(platform=cls.platform, context_id="c2", resource_link_id="r2")
        cls.mapping = LTIUserMapping.objects.create(platform=cls.platform, lti_user_id="sub-admin", user=cls.learner)
        LTIRoleMapping.objects.create(platform=cls.platform, lti_role="Instructor", global_role="editor", group_role="manager")
        cls.ok_log = LTILaunchLog.objects.create(platform=cls.platform, user=cls.learner, claims={})
        cls.failed_log = LTILaunchLog.objects.create(platform=cls.platform, success=False, error_message="boom", claims={})

    def setUp(self):
        self.client.force_login(self.admin_user)

    def test_all_lti_changelists_render_for_superuser(self):
        LTIToolKeys.get_or_create_keys()
        for model in ("ltiplatform", "ltiresourcelink", "ltiusermapping", "ltirolemapping", "ltilaunchlog", "ltitoolkeys"):
            response = self.client.get(reverse(f"admin:lti_{model}_changelist"))
            self.assertEqual(response.status_code, 200, model)

    def test_resource_link_admin_links_to_category_and_group(self):
        model_admin = site._registry[LTIResourceLink]
        self.assertIn(f"/admin/files/category/{self.category.id}/change/", model_admin.category_link(self.link))
        self.assertIn(f"/admin/rbac/rbacgroup/{self.group.id}/change/", model_admin.rbac_group_link(self.link))
        self.assertEqual(model_admin.category_link(self.bare_link), "-")
        self.assertEqual(model_admin.rbac_group_link(self.bare_link), "-")

    def test_platform_admin_shows_feature_flags(self):
        model_admin = site._registry[LTIPlatform]
        disabled = create_platform(client_id="disabled-client", enable_nrps=False, enable_deep_linking=False)
        self.assertEqual(model_admin.nrps_enabled(self.platform), "✓")
        self.assertEqual(model_admin.deep_linking_enabled(self.platform), "✓")
        self.assertEqual(model_admin.nrps_enabled(disabled), "✗")
        self.assertEqual(model_admin.deep_linking_enabled(disabled), "✗")

    def test_user_mapping_admin_shows_user_link_and_email(self):
        model_admin = site._registry[LTIUserMapping]
        self.assertIn(f"/admin/users/user/{self.learner.id}/change/", model_admin.user_link(self.mapping))
        self.assertEqual(model_admin.user_email(self.mapping), "learner@example.com")

    def test_launch_log_admin_is_read_only_and_shows_status(self):
        model_admin = site._registry[LTILaunchLog]
        request = RequestFactory().get("/")
        request.user = self.admin_user
        self.assertFalse(model_admin.has_add_permission(request))
        self.assertFalse(model_admin.has_change_permission(request, self.ok_log))
        self.assertIn("Success", model_admin.success_badge(self.ok_log))
        self.assertIn("Failed", model_admin.success_badge(self.failed_log))
        self.assertIn(f"/admin/users/user/{self.learner.id}/change/", model_admin.user_link(self.ok_log))
        self.assertEqual(model_admin.user_link(self.failed_log), "-")

    def test_tool_keys_admin_allows_a_single_undeletable_key_pair(self):
        model_admin = site._registry[LTIToolKeys]
        request = RequestFactory().get("/")
        request.user = self.admin_user
        self.assertTrue(model_admin.has_add_permission(request))
        keys = LTIToolKeys.get_or_create_keys()
        self.assertFalse(model_admin.has_add_permission(request))
        self.assertFalse(model_admin.has_delete_permission(request, keys))
        self.assertIn(keys.public_key_jwk["n"], model_admin.public_key_display(keys))

    def test_regenerate_keys_action_rotates_the_key(self):
        keys = LTIToolKeys.get_or_create_keys()
        old_modulus = keys.public_key_jwk["n"]
        response = self.client.post(reverse("admin:lti_ltitoolkeys_changelist"), {"action": "regenerate_keys", "_selected_action": [keys.pk]}, follow=True)
        self.assertEqual(response.status_code, 200)
        keys.refresh_from_db()
        self.assertNotEqual(keys.public_key_jwk["n"], old_modulus)
        self.assertContains(response, "Keys regenerated for mediacms-lti-key")
