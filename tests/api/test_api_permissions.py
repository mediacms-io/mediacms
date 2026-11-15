import uuid
from types import SimpleNamespace

from allauth.account.models import EmailAddress
from django.contrib.auth.models import AnonymousUser
from django.test import Client, RequestFactory, TestCase, override_settings
from rest_framework.exceptions import PermissionDenied

from cms.permissions import (
    IsAuthorizedToAdd,
    IsAuthorizedToAddComment,
    IsMediaContributorOrEditor,
    IsUserOrEditor,
    IsUserOrManager,
    user_allowed_to_comment,
)
from files.models import Category, MediaPermission
from files.permissions import IsMediacmsEditor
from files.tests import create_account, create_media
from rbac.models import RBACGroup, RBACMembership


def make_user(**kwargs):
    name = uuid.uuid4().hex[:12]
    return create_account(username=f'u{name}', email=f'{name}@example.com', **kwargs)


def build_request(method, user):
    request = getattr(RequestFactory(), method.lower())('/')
    request.user = user
    return request


class PermissionTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.regular = make_user()
        cls.other = make_user()
        cls.advanced = make_user()
        cls.advanced.advancedUser = True
        cls.advanced.save()
        cls.verified = make_user()
        EmailAddress.objects.create(user=cls.verified, email=cls.verified.email, verified=True, primary=True)
        cls.editor = make_user(is_editor=True)
        cls.manager = make_user(is_manager=True)
        cls.admin = make_user(is_superuser=True)


class IsAuthorizedToAddTest(PermissionTestCase):
    def allowed(self, method, user):
        return IsAuthorizedToAdd().has_permission(build_request(method, user), None)

    def test_safe_methods_are_always_allowed(self):
        for method in ('GET', 'HEAD', 'OPTIONS'):
            self.assertTrue(self.allowed(method, AnonymousUser()))

    def test_anonymous_writes_are_denied_with_explanation(self):
        with self.assertRaises(PermissionDenied):
            self.allowed('POST', AnonymousUser())

    def test_any_user_may_add_by_default(self):
        self.assertTrue(self.allowed('POST', self.regular))

    @override_settings(CAN_ADD_MEDIA='email_verified')
    def test_only_verified_users_may_add_when_required(self):
        self.assertTrue(self.allowed('POST', self.verified))
        with self.assertRaises(PermissionDenied):
            self.allowed('POST', self.regular)

    @override_settings(CAN_ADD_MEDIA='advancedUser')
    def test_only_advanced_users_may_add_when_required(self):
        self.assertTrue(self.allowed('POST', self.advanced))
        with self.assertRaises(PermissionDenied):
            self.allowed('PUT', self.regular)

    @override_settings(CAN_ADD_MEDIA='nobody')
    def test_unknown_policy_denies_regular_users_but_not_editors(self):
        with self.assertRaises(PermissionDenied):
            self.allowed('POST', self.advanced)
        self.assertTrue(self.allowed('POST', self.editor))

    @override_settings(NUMBER_OF_MEDIA_USER_CAN_UPLOAD=1)
    def test_users_at_their_upload_limit_are_denied(self):
        user = make_user()
        self.assertTrue(self.allowed('POST', user))
        create_media(user)
        with self.assertRaises(PermissionDenied):
            self.allowed('POST', user)

    @override_settings(NUMBER_OF_MEDIA_USER_CAN_UPLOAD=0, CAN_ADD_MEDIA='advancedUser')
    def test_editors_bypass_limits_and_policy(self):
        for user in (self.editor, self.manager, self.admin):
            self.assertTrue(self.allowed('POST', user))


class IsAuthorizedToAddCommentTest(PermissionTestCase):
    def allowed(self, method, user):
        return IsAuthorizedToAddComment().has_permission(build_request(method, user), None)

    def test_safe_methods_are_always_allowed(self):
        self.assertTrue(self.allowed('GET', AnonymousUser()))

    def test_writes_follow_comment_policy(self):
        self.assertFalse(self.allowed('POST', AnonymousUser()))
        self.assertTrue(self.allowed('POST', self.regular))
        self.assertTrue(self.allowed('DELETE', self.regular))
        with override_settings(CAN_COMMENT='advancedUser'):
            self.assertFalse(self.allowed('POST', self.regular))
            self.assertTrue(self.allowed('POST', self.advanced))


class UserAllowedToCommentTest(PermissionTestCase):
    def allowed(self, user):
        return user_allowed_to_comment(build_request('POST', user))

    def test_anonymous_users_may_never_comment(self):
        self.assertFalse(self.allowed(AnonymousUser()))

    def test_everyone_logged_in_may_comment_by_default(self):
        self.assertTrue(self.allowed(self.regular))

    @override_settings(CAN_COMMENT='email_verified')
    def test_email_verified_policy(self):
        self.assertTrue(self.allowed(self.verified))
        self.assertFalse(self.allowed(self.regular))
        self.assertFalse(self.allowed(self.advanced))

    @override_settings(CAN_COMMENT='advancedUser')
    def test_advanced_user_policy(self):
        self.assertTrue(self.allowed(self.advanced))
        self.assertFalse(self.allowed(self.verified))

    @override_settings(CAN_COMMENT='nobody')
    def test_unknown_policy_allows_only_superusers(self):
        self.assertFalse(self.allowed(self.regular))
        self.assertFalse(self.allowed(self.manager))
        self.assertTrue(self.allowed(self.admin))


class IsUserOrManagerTest(PermissionTestCase):
    def allowed(self, method, user, obj):
        return IsUserOrManager().has_object_permission(build_request(method, user), None, obj)

    def test_safe_methods_are_allowed_for_anyone(self):
        self.assertTrue(self.allowed('GET', AnonymousUser(), self.regular))

    def test_object_owner_may_write(self):
        self.assertTrue(self.allowed('POST', self.regular, SimpleNamespace(user=self.regular)))
        self.assertFalse(self.allowed('POST', self.other, SimpleNamespace(user=self.regular)))

    def test_user_objects_are_writable_only_by_themselves(self):
        self.assertTrue(self.allowed('PUT', self.regular, self.regular))
        self.assertFalse(self.allowed('PUT', self.other, self.regular))

    def test_managers_and_superusers_may_write_anything(self):
        for user in (self.manager, self.admin):
            self.assertTrue(self.allowed('DELETE', user, self.regular))
            self.assertTrue(self.allowed('DELETE', user, SimpleNamespace(user=self.regular)))

    def test_editors_are_not_managers(self):
        self.assertFalse(self.allowed('POST', self.editor, self.regular))


class IsUserOrEditorTest(PermissionTestCase):
    def allowed(self, method, user, obj):
        return IsUserOrEditor().has_object_permission(build_request(method, user), None, obj)

    def test_safe_methods_are_allowed_for_anyone(self):
        self.assertTrue(self.allowed('GET', AnonymousUser(), SimpleNamespace(user=self.regular)))

    def test_only_owner_editors_managers_and_admins_may_write(self):
        obj = SimpleNamespace(user=self.regular)
        self.assertTrue(self.allowed('POST', self.regular, obj))
        self.assertFalse(self.allowed('POST', self.other, obj))
        for user in (self.editor, self.manager, self.admin):
            self.assertTrue(self.allowed('DELETE', user, obj))


class IsMediaContributorOrEditorTest(PermissionTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.public = create_media(cls.regular, title='permission public', state='public')
        cls.unlisted = create_media(cls.regular, title='permission unlisted', state='unlisted')
        cls.private = create_media(cls.regular, title='permission private', state='private')
        cls.viewer = make_user()
        cls.shared_editor = make_user()
        MediaPermission.objects.create(owner_user=cls.regular, user=cls.viewer, media=cls.private, permission='viewer')
        MediaPermission.objects.create(owner_user=cls.regular, user=cls.shared_editor, media=cls.private, permission='editor')

    def allowed(self, method, user, obj):
        return IsMediaContributorOrEditor().has_object_permission(build_request(method, user), None, obj)

    def test_public_and_unlisted_media_are_readable_by_anyone(self):
        for media in (self.public, self.unlisted):
            for method in ('GET', 'HEAD', 'OPTIONS'):
                with self.subTest(state=media.state, method=method):
                    self.assertTrue(self.allowed(method, AnonymousUser(), media))
                    self.assertTrue(self.allowed(method, self.other, media))

    def test_private_media_is_not_readable_by_anonymous_users_or_strangers(self):
        for method in ('GET', 'HEAD', 'OPTIONS'):
            with self.subTest(method=method):
                self.assertFalse(self.allowed(method, AnonymousUser(), self.private))
                self.assertFalse(self.allowed(method, self.other, self.private))

    def test_private_media_is_readable_by_owner_sharees_and_mediacms_editors(self):
        for user in (self.regular, self.viewer, self.shared_editor, self.editor, self.manager, self.admin):
            with self.subTest(user=user.username):
                self.assertTrue(self.allowed('GET', user, self.private))

    @override_settings(USE_RBAC=True)
    def test_private_media_is_readable_by_rbac_members_of_its_category(self):
        member = make_user()
        category = Category.objects.create(title=f'perm course {uuid.uuid4().hex[:6]}', is_rbac_category=True)
        self.private.category.add(category)
        group = RBACGroup.objects.create(name=f'perm group {uuid.uuid4().hex[:6]}')
        group.categories.add(category)
        RBACMembership.objects.create(user=member, rbac_group=group, role='member')
        self.assertTrue(self.allowed('GET', member, self.private))
        self.assertFalse(self.allowed('PUT', member, self.private))

    def test_writes_follow_the_edit_and_delete_rules(self):
        self.assertTrue(self.allowed('PUT', self.shared_editor, self.private))
        self.assertTrue(self.allowed('PATCH', self.shared_editor, self.private))
        self.assertFalse(self.allowed('DELETE', self.shared_editor, self.private))
        self.assertFalse(self.allowed('PUT', self.viewer, self.private))
        self.assertTrue(self.allowed('DELETE', self.regular, self.private))
        self.assertTrue(self.allowed('DELETE', self.editor, self.private))
        self.assertFalse(self.allowed('PUT', self.other, self.public))


class IsMediacmsEditorTest(PermissionTestCase):
    def allowed(self, user):
        return IsMediacmsEditor().has_permission(build_request('GET', user), None)

    def test_only_editors_managers_and_admins_pass(self):
        self.assertFalse(self.allowed(AnonymousUser()))
        self.assertFalse(self.allowed(self.regular))
        self.assertFalse(self.allowed(self.advanced))
        for user in (self.editor, self.manager, self.admin):
            self.assertTrue(self.allowed(user))


class IsUserOrManagerThroughUserDetailTest(PermissionTestCase):
    def post_description(self, actor, target, description):
        client = Client()
        if actor:
            client.force_login(actor)
        return client.post(f'/api/v1/users/{target.username}', {'description': description, 'name': target.name})

    def test_users_edit_their_own_profile(self):
        response = self.post_description(self.regular, self.regular, 'about me')
        self.assertEqual(response.status_code, 201)
        self.regular.refresh_from_db()
        self.assertEqual(self.regular.description, 'about me')

    def test_users_cannot_edit_other_profiles(self):
        response = self.post_description(self.other, self.regular, 'vandalised')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['detail'], 'not enough permissions')

    def test_editors_cannot_edit_other_profiles(self):
        self.assertEqual(self.post_description(self.editor, self.regular, 'edited').status_code, 400)

    def test_managers_edit_other_profiles(self):
        response = self.post_description(self.manager, self.other, 'curated')
        self.assertEqual(response.status_code, 201)
        self.other.refresh_from_db()
        self.assertEqual(self.other.description, 'curated')

    def test_anonymous_users_cannot_edit_profiles(self):
        self.assertEqual(self.post_description(None, self.regular, 'anon').status_code, 403)
