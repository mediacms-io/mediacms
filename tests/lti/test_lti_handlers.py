import hashlib
from unittest import mock

from allauth.account.models import EmailAddress
from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.backends.db import SessionStore
from django.test import RequestFactory, TestCase, override_settings
from lti_testkit import (
    CLAIM,
    LIS_MEMBERSHIP,
    create_platform,
    encode_publishdata,
    launch_claims,
)

from files.models import Category
from files.tests import create_account
from lti.handlers import (
    apply_lti_roles,
    create_lti_session,
    generate_username_from_lti,
    get_higher_privilege_global,
    provision_lti_bulk_contexts,
    provision_lti_context,
    provision_lti_user,
    resolve_group_role,
    validate_lti_session,
)
from lti.models import LTIResourceLink, LTIRoleMapping, LTIUserMapping
from rbac.models import RBACGroup, RBACMembership
from users.models import User


class ProvisionLTIUserTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.platform = create_platform()

    def test_first_launch_creates_user_with_verified_email_and_mapping(self):
        user = provision_lti_user(self.platform, launch_claims(sub="sub-new"))
        self.assertEqual(user.username, "jane_doe")
        self.assertEqual(user.email, "jane.doe@school.example.com")
        self.assertEqual((user.first_name, user.last_name, user.name), ("Jane", "Doe", "Jane Doe"))
        self.assertTrue(user.is_active)
        self.assertTrue(EmailAddress.objects.filter(user=user, email=user.email, verified=True, primary=True).exists())
        self.assertTrue(LTIUserMapping.objects.filter(platform=self.platform, lti_user_id="sub-new", user=user).exists())

    def test_relaunch_reuses_the_user_and_syncs_profile_changes(self):
        user = provision_lti_user(self.platform, launch_claims(sub="sub-relaunch"))
        claims = launch_claims(sub="sub-relaunch", email="jane.smith@school.example.com", family_name="Smith", name="Jane Smith", given_name="Janet")
        again = provision_lti_user(self.platform, claims)
        self.assertEqual(again.pk, user.pk)
        again.refresh_from_db()
        self.assertEqual((again.email, again.first_name, again.last_name, again.name), ("jane.smith@school.example.com", "Janet", "Smith", "Jane Smith"))
        self.assertEqual(again.username, "jane_doe")
        self.assertEqual(LTIUserMapping.objects.filter(lti_user_id="sub-relaunch").count(), 1)

    def test_relaunch_without_profile_claims_keeps_existing_values(self):
        user = provision_lti_user(self.platform, launch_claims(sub="sub-sparse"))
        again = provision_lti_user(self.platform, {"sub": "sub-sparse"})
        again.refresh_from_db()
        self.assertEqual(again.pk, user.pk)
        self.assertEqual((again.email, again.name), ("jane.doe@school.example.com", "Jane Doe"))

    def test_same_issuer_with_another_client_reuses_the_user(self):
        user = provision_lti_user(self.platform, launch_claims(sub="sub-shared"))
        second_tool = create_platform(client_id="second-client")
        again = provision_lti_user(second_tool, launch_claims(sub="sub-shared"))
        self.assertEqual(again.pk, user.pk)
        self.assertTrue(LTIUserMapping.objects.filter(platform=second_tool, lti_user_id="sub-shared", user=user).exists())

    def test_same_sub_on_an_unrelated_platform_is_a_different_user(self):
        user = provision_lti_user(self.platform, launch_claims(sub="sub-collide"))
        other_lms = create_platform(platform_id="https://other-lms.example.com", client_id="other")
        other = provision_lti_user(other_lms, launch_claims(sub="sub-collide", email="someone@other.example.com"))
        self.assertNotEqual(other.pk, user.pk)

    def test_taken_username_gets_a_deterministic_suffix(self):
        create_account(username="jane_doe")
        user = provision_lti_user(self.platform, launch_claims(sub="sub-dup"))
        self.assertEqual(user.username, "jane_doe_" + hashlib.md5(b"sub-dup").hexdigest()[:6])

    def test_suffix_collision_falls_back_to_counter(self):
        create_account(username="jane_doe")
        create_account(username="jane_doe_" + hashlib.md5(b"sub-dup2").hexdigest()[:6])
        user = provision_lti_user(self.platform, launch_claims(sub="sub-dup2"))
        self.assertEqual(user.username, "jane_doe_" + hashlib.md5(b"sub-dup2").hexdigest()[:6] + "_1")

    def test_name_is_built_from_given_and_family_name_when_missing(self):
        user = provision_lti_user(self.platform, {"sub": "sub-names", "given_name": "Ada", "family_name": "Lovelace"})
        self.assertEqual(user.name, "Ada Lovelace")
        self.assertEqual(user.username, "ada.lovelace")
        self.assertEqual(user.email, "")
        self.assertFalse(EmailAddress.objects.filter(user=user).exists())

    def test_anonymous_claims_get_a_hashed_username(self):
        user = provision_lti_user(self.platform, {"sub": "sub-anon"})
        expected = "lti_user_" + hashlib.md5(b"sub-anon").hexdigest()[:10]
        self.assertEqual(user.username, expected)
        self.assertEqual(user.name, expected)

    def test_missing_sub_is_rejected(self):
        with self.assertRaisesMessage(ValueError, "Missing 'sub' claim"):
            provision_lti_user(self.platform, {"email": "x@example.com"})
        self.assertFalse(User.objects.filter(email="x@example.com").exists())


class GenerateUsernameTest(TestCase):
    def test_email_local_part_is_sanitized(self):
        self.assertEqual(generate_username_from_lti("s", "o'brien+lti@example.com", "", ""), "o_brien_lti")

    def test_long_email_local_part_is_truncated(self):
        self.assertEqual(generate_username_from_lti("s", "a" * 40 + "@example.com", "", ""), "a" * 30)

    def test_short_email_falls_back_to_names(self):
        self.assertEqual(generate_username_from_lti("s", "ab@example.com", "Mary Ann", "Lee"), "mary_ann.lee")

    def test_short_names_fall_back_to_hash(self):
        self.assertEqual(generate_username_from_lti("s1", "", "A", "B"), "lti_user_" + hashlib.md5(b"s1").hexdigest()[:10])


class ProvisionLTIContextTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.platform = create_platform(name="Moodle Ctx")

    def test_course_launch_creates_lms_category_group_and_resource_link(self):
        category, group, link = provision_lti_context(self.platform, launch_claims(), "resource-link-1")
        self.assertEqual(category.title, "Biology 101")
        self.assertTrue(category.is_lms_course)
        self.assertTrue(category.is_rbac_category)
        self.assertFalse(category.is_global)
        self.assertEqual(category.lti_platform, self.platform)
        self.assertEqual(category.lti_context_id, "course-42")
        self.assertEqual(group.name, "Biology 101 (Moodle Ctx)")
        self.assertEqual(list(group.categories.all()), [category])
        self.assertEqual((link.context_id, link.context_label, link.resource_link_id), ("course-42", "BIO101", "resource-link-1"))
        self.assertEqual((link.category, link.rbac_group), (category, group))

    def test_relaunch_reuses_records_and_syncs_renamed_course(self):
        category, group, link = provision_lti_context(self.platform, launch_claims(), "resource-link-1")
        renamed = launch_claims(context={"id": "course-42", "title": "Biology 102", "label": "BIO102"})
        category2, group2, link2 = provision_lti_context(self.platform, renamed, "resource-link-1")
        self.assertEqual((category2.pk, group2.pk, link2.pk), (category.pk, group.pk, link.pk))
        category.refresh_from_db()
        link.refresh_from_db()
        self.assertEqual(category.title, "Biology 102")
        self.assertEqual((link.context_title, link.context_label), ("Biology 102", "BIO102"))
        self.assertEqual(Category.objects.filter(lti_context_id="course-42").count(), 1)
        self.assertEqual(LTIResourceLink.objects.filter(platform=self.platform).count(), 1)

    def test_real_resource_link_replaces_bulk_placeholder_but_not_vice_versa(self):
        provision_lti_context(self.platform, launch_claims(), "bulk_course-42")
        _, _, link = provision_lti_context(self.platform, launch_claims(), "real-link")
        self.assertEqual(link.resource_link_id, "real-link")
        _, _, link = provision_lti_context(self.platform, launch_claims(), "bulk_course-42")
        link.refresh_from_db()
        self.assertEqual(link.resource_link_id, "real-link")

    def test_numeric_context_id_is_stored_as_string_and_untitled_course_gets_a_name(self):
        claims = launch_claims()
        claims[CLAIM + "context"] = {"id": 77}
        category, _, link = provision_lti_context(self.platform, claims, "rl")
        self.assertEqual(link.context_id, "77")
        self.assertEqual(category.title, "Course 77")

    def test_missing_context_is_rejected(self):
        claims = launch_claims()
        del claims[CLAIM + "context"]
        with self.assertRaisesMessage(ValueError, "Missing context ID"):
            provision_lti_context(self.platform, claims, "rl")


class ApplyLTIRolesTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.platform = create_platform()

    def setUp(self):
        self.user = create_account(username="role_user")
        self.group = RBACGroup.objects.create(name="Role course")

    def _role(self):
        return RBACMembership.objects.get(user=self.user, rbac_group=self.group).role

    def test_learner_becomes_member(self):
        self.assertEqual(apply_lti_roles(self.user, self.platform, [LIS_MEMBERSHIP + "Learner"], self.group), ("user", "member"))
        self.assertEqual(self._role(), "member")

    def test_instructor_uri_becomes_group_manager(self):
        apply_lti_roles(self.user, self.platform, [LIS_MEMBERSHIP + "Instructor"], self.group)
        self.assertEqual(self._role(), "manager")

    def test_teaching_assistant_sub_role_becomes_contributor(self):
        apply_lti_roles(self.user, self.platform, ["http://purl.imsglobal.org/vocab/lis/v2/membership/Instructor#TeachingAssistant"], self.group)
        self.assertEqual(self._role(), "contributor")

    def test_slash_separated_and_short_roles_are_understood(self):
        apply_lti_roles(self.user, self.platform, ["urn:lti:role:ims/lis/Learner", "TeachingAssistant"], self.group)
        self.assertEqual(self._role(), "contributor")

    def test_highest_group_role_wins_regardless_of_order(self):
        apply_lti_roles(self.user, self.platform, [LIS_MEMBERSHIP + "Instructor", LIS_MEMBERSHIP + "Learner"], self.group)
        self.assertEqual(self._role(), "manager")

    def test_unknown_or_missing_roles_default_to_member(self):
        self.assertEqual(apply_lti_roles(self.user, self.platform, ["http://example.com/role#Mentor"], self.group), ("user", "member"))
        self.assertEqual(apply_lti_roles(self.user, self.platform, None, self.group), ("user", "member"))
        self.assertEqual(RBACMembership.objects.filter(user=self.user, rbac_group=self.group).count(), 1)

    def test_relaunch_with_lower_role_downgrades_existing_membership(self):
        apply_lti_roles(self.user, self.platform, [LIS_MEMBERSHIP + "Instructor"], self.group)
        apply_lti_roles(self.user, self.platform, [LIS_MEMBERSHIP + "Learner"], self.group)
        self.assertEqual(self._role(), "member")
        self.assertEqual(RBACMembership.objects.filter(user=self.user, rbac_group=self.group).count(), 1)

    def test_platform_role_mapping_can_grant_global_role(self):
        LTIRoleMapping.objects.create(platform=self.platform, lti_role="Instructor", global_role="editor", group_role="contributor")
        self.assertEqual(apply_lti_roles(self.user, self.platform, [LIS_MEMBERSHIP + "Instructor"], self.group), ("editor", "contributor"))
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_editor)
        self.assertEqual(self._role(), "contributor")

    def test_role_mapping_of_another_platform_is_ignored(self):
        other = create_platform(client_id="other-client")
        LTIRoleMapping.objects.create(platform=other, lti_role="Learner", global_role="manager", group_role="manager")
        self.assertEqual(apply_lti_roles(self.user, self.platform, [LIS_MEMBERSHIP + "Learner"], self.group), ("user", "member"))
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_manager)

    def test_a_launch_that_grants_no_global_role_keeps_the_rights_given_in_mediacms(self):
        for flags in ({"is_editor": True}, {"is_manager": True}, {"advancedUser": True}, {"is_superuser": True, "is_staff": True}):
            with self.subTest(**flags):
                User.objects.filter(pk=self.user.pk).update(**flags)
                self.user.refresh_from_db()
                for role in ("Learner", "Instructor"):
                    self.assertEqual(apply_lti_roles(self.user, self.platform, [LIS_MEMBERSHIP + role], self.group)[0], "user")
                self.user.refresh_from_db()
                for flag, value in flags.items():
                    self.assertEqual(getattr(self.user, flag), value, flag)

    def test_a_launch_without_any_roles_keeps_the_rights_given_in_mediacms(self):
        User.objects.filter(pk=self.user.pk).update(is_manager=True)
        apply_lti_roles(self.user, self.platform, None, self.group)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_manager)

    def test_a_mapped_global_role_is_added_on_top_of_existing_rights(self):
        User.objects.filter(pk=self.user.pk).update(is_manager=True)
        LTIRoleMapping.objects.create(platform=self.platform, lti_role="Instructor", global_role="editor", group_role="manager")
        apply_lti_roles(self.user, self.platform, [LIS_MEMBERSHIP + "Instructor"], self.group)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_editor)
        self.assertTrue(self.user.is_manager)

    def test_a_plain_user_stays_a_plain_user(self):
        apply_lti_roles(self.user, self.platform, [LIS_MEMBERSHIP + "Instructor"], self.group)
        self.user.refresh_from_db()
        self.assertFalse(any([self.user.is_superuser, self.user.is_staff, self.user.advancedUser, self.user.is_editor, self.user.is_manager]))


class RolePrivilegeOrderTest(TestCase):
    def test_global_roles(self):
        self.assertEqual(get_higher_privilege_global("user", "editor"), "editor")
        self.assertEqual(get_higher_privilege_global("admin", "editor"), "admin")
        self.assertEqual(get_higher_privilege_global("user", "custom"), "custom")

    def test_group_roles(self):
        self.assertEqual(resolve_group_role("member", "manager"), "manager")
        self.assertEqual(resolve_group_role("manager", "contributor"), "manager")
        self.assertEqual(resolve_group_role("member", "custom"), "custom")


class ProvisionBulkContextsTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.platform = create_platform(name="Moodle Bulk", remove_from_groups_on_unenroll=True)

    def setUp(self):
        self.user = create_account(username="bulk_user")

    def _memberships(self):
        return {m.rbac_group.lti_resource_links.get().context_id: m.role for m in RBACMembership.objects.filter(user=self.user).select_related("rbac_group")}

    def test_my_media_launch_provisions_every_enrolled_course(self):
        courses = [
            {"id": 10, "fullname": "Chemistry", "shortname": "CHEM", "role": "editingteacher"},
            {"id": 11, "fullname": "Physics", "shortname": "PHYS", "role": "student"},
            {"id": 12, "fullname": "Maths", "shortname": "MATH", "role": "ta"},
            {"id": 13, "fullname": "Art", "shortname": "ART"},
        ]
        provision_lti_bulk_contexts(self.platform, self.user, encode_publishdata(courses))
        self.assertEqual(self._memberships(), {"10": "manager", "11": "member", "12": "contributor", "13": "member"})
        link = LTIResourceLink.objects.get(platform=self.platform, context_id="10")
        self.assertEqual(link.resource_link_id, "bulk_10")
        self.assertEqual(link.category.title, "Chemistry")
        self.assertTrue(link.category.is_lms_course)

    def test_bulk_launch_reuses_courses_created_by_course_launches(self):
        claims = launch_claims(context={"id": "20", "title": "History", "label": "HIST"})
        category, group, _ = provision_lti_context(self.platform, claims, "real-link")
        provision_lti_bulk_contexts(self.platform, self.user, encode_publishdata([{"id": 20, "fullname": "History", "role": "student"}]))
        link = LTIResourceLink.objects.get(platform=self.platform, context_id="20")
        self.assertEqual((link.category, link.rbac_group, link.resource_link_id), (category, group, "real-link"))
        self.assertTrue(RBACMembership.objects.filter(user=self.user, rbac_group=group, role="member").exists())

    def test_courses_missing_from_publishdata_lose_membership(self):
        provision_lti_bulk_contexts(self.platform, self.user, encode_publishdata([{"id": 30, "fullname": "A"}, {"id": 31, "fullname": "B"}]))
        provision_lti_bulk_contexts(self.platform, self.user, encode_publishdata([{"id": 31, "fullname": "B"}]))
        self.assertEqual(self._memberships(), {"31": "member"})
        self.assertTrue(LTIResourceLink.objects.filter(platform=self.platform, context_id="30").exists())

    def test_other_users_and_platforms_are_untouched_by_unenrolment_cleanup(self):
        classmate = create_account(username="bulk_classmate")
        other_platform = create_platform(client_id="bulk-other")
        provision_lti_bulk_contexts(self.platform, classmate, encode_publishdata([{"id": 40, "fullname": "Shared"}]))
        provision_lti_bulk_contexts(other_platform, self.user, encode_publishdata([{"id": 41, "fullname": "Elsewhere"}]))
        provision_lti_bulk_contexts(self.platform, self.user, encode_publishdata([{"id": 42, "fullname": "Mine"}]))
        self.assertEqual(RBACMembership.objects.filter(user=classmate).count(), 1)
        self.assertTrue(RBACMembership.objects.filter(user=self.user, rbac_group__lti_resource_links__platform=other_platform).exists())

    def test_courses_without_id_are_skipped(self):
        provision_lti_bulk_contexts(self.platform, self.user, encode_publishdata([{"fullname": "No id"}, {"id": " ", "fullname": "Blank"}, {"id": 50, "fullname": "Ok"}]))
        self.assertEqual(self._memberships(), {"50": "member"})

    def test_undecodable_or_non_list_publishdata_is_ignored(self):
        existing = RBACGroup.objects.count()
        provision_lti_bulk_contexts(self.platform, self.user, "%%%not-base64%%%")
        provision_lti_bulk_contexts(self.platform, self.user, encode_publishdata({"id": 70}))
        self.assertEqual(RBACGroup.objects.count(), existing)
        self.assertFalse(RBACMembership.objects.filter(user=self.user).exists())

    def test_empty_course_list_keeps_existing_memberships(self):
        provision_lti_bulk_contexts(self.platform, self.user, encode_publishdata([{"id": 80, "fullname": "Keep"}]))
        provision_lti_bulk_contexts(self.platform, self.user, encode_publishdata([]))
        self.assertEqual(self._memberships(), {"80": "member"})


class LTISessionTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.platform = create_platform(name="Moodle Session")
        cls.user = create_account(username="session_user")

    def _request(self):
        request = RequestFactory().post("/lti/launch/")
        request.session = SessionStore()
        request.user = AnonymousUser()
        return request

    @override_settings(LTI_SESSION_TIMEOUT=1234)
    def test_create_session_logs_in_and_stores_launch_context(self):
        request = self._request()
        launch = mock.Mock(**{"get_launch_data.return_value": launch_claims(roles=[LIS_MEMBERSHIP + "Instructor"])})
        self.assertTrue(create_lti_session(request, self.user, launch, self.platform))
        self.assertEqual(request.user, self.user)
        self.assertEqual(int(request.session["_auth_user_id"]), self.user.pk)
        lti_session = request.session["lti_session"]
        self.assertEqual(lti_session["platform_id"], self.platform.pk)
        self.assertEqual(lti_session["platform_name"], "Moodle Session")
        self.assertEqual((lti_session["context_id"], lti_session["context_title"]), ("course-42", "Biology 101"))
        self.assertEqual(lti_session["resource_link_id"], "resource-link-1")
        self.assertEqual(lti_session["roles"], [LIS_MEMBERSHIP + "Instructor"])
        self.assertIn("launch_time", lti_session)
        self.assertEqual(request.session.get_expiry_age(), 1234)
        self.assertTrue(SessionStore(session_key=request.session.session_key).exists(request.session.session_key))
        self.assertEqual(validate_lti_session(request), lti_session)

    def test_validate_session_requires_authenticated_user(self):
        request = self._request()
        request.session["lti_session"] = {"context_id": "c"}
        self.assertIsNone(validate_lti_session(request))

    def test_validate_session_is_none_for_regular_login(self):
        request = self._request()
        request.user = self.user
        self.assertIsNone(validate_lti_session(request))
