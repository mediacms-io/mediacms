import importlib
from unittest.mock import patch

from allauth.socialaccount.models import SocialApp
from django.contrib import admin
from django.contrib.admin import AdminSite
from django.contrib.admin.sites import all_sites
from django.test import RequestFactory, TestCase, override_settings
from django.urls import reverse

import users.admin
from files.admin import CategoryAdminForm, PageAdminForm
from files.models import Category, EncodeProfile, Encoding, Media
from files.tests import create_account, create_media
from rbac.models import RBACGroup
from users.models import User

PASSWORD = "admin-files-password"


def make_user(username, **kwargs):
    return create_account(username=username, email=f"{username}@example.com", password=PASSWORD, **kwargs)


def category_form_data(category, **overrides):
    data = {"uid": category.uid, "title": category.title, "description": "", "is_global": "", "media_count": 0, "is_rbac_category": "", "is_lms_course": "", "lti_context_id": "", "rbac_groups": []}
    data.update(overrides)
    return data


class AdminRequestMixin:
    def admin_request(self):
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        return request


class MediaAdminTest(AdminRequestMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("files_admin_root", is_superuser=True)
        cls.category = Category.objects.create(title="Admin filter category")
        cls.public = create_media(cls.superuser, title="admin public media", state="public")
        cls.private = create_media(cls.superuser, title="admin private media", state="private", category=[cls.category])

    def setUp(self):
        self.client.force_login(self.superuser)

    def changelist_titles(self, **params):
        response = self.client.get(reverse("admin:files_media_changelist"), params)
        self.assertEqual(response.status_code, 200)
        return {media.title for media in response.context["cl"].result_list}

    def test_state_and_category_filters_narrow_changelist(self):
        self.assertEqual(self.changelist_titles(state="private"), {"admin private media"})
        self.assertEqual(self.changelist_titles(category__id__exact=self.category.pk), {"admin private media"})
        self.assertEqual(self.changelist_titles(q="public"), {"admin public media"})

    def test_comments_count_column(self):
        model_admin = admin.site._registry[Media]
        self.assertEqual(model_admin.get_comments_count(self.public), 0)

    def test_generate_missing_encodings_action_encodes_selected_media_without_forcing(self):
        with patch.object(Media, "encode") as encode:
            response = self.client.post(reverse("admin:files_media_changelist"), {"action": "generate_missing_encodings", "_selected_action": [self.public.pk, self.private.pk]})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(encode.call_count, 2)
        for call in encode.call_args_list:
            self.assertEqual(call.kwargs, {"force": False})

    def test_action_requires_change_permission(self):
        model_admin = admin.site._registry[Media]
        viewer = make_user("files_admin_viewer")
        request = RequestFactory().get("/admin/")
        request.user = viewer
        self.assertNotIn("generate_missing_encodings", model_admin.get_actions(request))
        self.assertIn("generate_missing_encodings", model_admin.get_actions(self.admin_request()))


class EncodingAdminTest(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def test_title_and_has_file_columns(self):
        user = make_user("files_encoding_admin")
        media = create_media(user, title="encoding admin media")
        encoding = Encoding.objects.create(media=media, profile=EncodeProfile.objects.first(), status="pending")
        model_admin = admin.site._registry[Encoding]
        self.assertEqual(model_admin.get_title(encoding), str(encoding))
        self.assertFalse(model_admin.has_file(encoding))


class PageAdminFormTest(TestCase):
    def test_iframes_are_sandboxed(self):
        form = PageAdminForm(data={"slug": "sandboxed", "title": "Sandboxed", "description": '<p>x</p><iframe src="https://example.org"></iframe>'})
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.cleaned_data["description"], '<p>x</p><iframe sandbox="allow-scripts allow-same-origin allow-presentation" src="https://example.org"></iframe>')


class CategoryAdminConfigurationTest(AdminRequestMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("files_category_root", is_superuser=True)

    def model_admin(self):
        return admin.site._registry[Category]

    def fieldset_fields(self):
        return [field for _, options in self.model_admin().get_fieldsets(self.admin_request()) for field in options["fields"]]

    def test_defaults_without_feature_flags(self):
        request = self.admin_request()
        self.assertEqual(self.model_admin().get_list_filter(request), [])
        self.assertEqual(self.model_admin().get_list_display(request), ["title", "user", "add_date", "media_count"])
        self.assertNotIn("is_rbac_category", self.fieldset_fields())
        self.assertNotIn("lti_platform", self.fieldset_fields())

    @override_settings(USE_RBAC=True)
    def test_rbac_adds_filter_column_and_group_fieldsets(self):
        request = self.admin_request()
        self.assertEqual(self.model_admin().get_list_filter(request), ["is_rbac_category"])
        self.assertEqual(self.model_admin().get_list_display(request), ["title", "user", "add_date", "is_rbac_category", "media_count"])
        self.assertIn("rbac_groups", self.fieldset_fields())
        self.assertNotIn("identity_provider", self.fieldset_fields())

    @override_settings(USE_RBAC=True, USE_IDENTITY_PROVIDERS=True, USE_LTI=True)
    def test_all_flags_add_identity_provider_and_lti_options(self):
        request = self.admin_request()
        self.assertEqual(self.model_admin().get_list_filter(request), ["identity_provider", "is_rbac_category", "is_lms_course"])
        self.assertIn("identity_provider", self.model_admin().get_list_display(request))
        self.assertIn("is_lms_course", self.model_admin().get_list_display(request))
        fields = self.fieldset_fields()
        self.assertIn("identity_provider", fields)
        self.assertIn("lti_platform", fields)

    @override_settings(USE_RBAC=True, USE_IDENTITY_PROVIDERS=True, USE_LTI=True)
    def test_category_pages_render_with_all_flags(self):
        category = Category.objects.create(title="All flags category", is_rbac_category=True)
        self.client.force_login(self.superuser)
        self.assertEqual(self.client.get(reverse("admin:files_category_changelist"), {"is_rbac_category__exact": "1"}).status_code, 200)
        self.assertEqual(self.client.get(reverse("admin:files_category_change", args=[category.pk])).status_code, 200)
        self.assertEqual(self.client.get(reverse("admin:files_category_add")).status_code, 200)


@override_settings(USE_RBAC=True)
class CategoryAdminFormTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("files_category_form_root", is_superuser=True)
        cls.idp = SocialApp.objects.create(provider="saml", provider_id="cat-form-idp", name="Cat form IdP", client_id="cat-form-idp")
        cls.group = RBACGroup.objects.create(name="Category form group")
        cls.second_group = RBACGroup.objects.create(name="Second category form group")
        cls.idp_group = RBACGroup.objects.create(name="IdP category form group", identity_provider=cls.idp)

    def test_initial_groups_reflect_current_assignment(self):
        category = Category.objects.create(title="Initial groups", is_rbac_category=True)
        self.group.categories.add(category)
        form = CategoryAdminForm(instance=category)
        self.assertEqual(list(form.fields["rbac_groups"].initial), [self.group])

    def test_assigning_groups_turns_category_into_rbac_category(self):
        category = Category.objects.create(title="Becomes rbac")
        form = CategoryAdminForm(data=category_form_data(category, rbac_groups=[self.group.pk]), instance=category)
        self.assertTrue(form.is_valid(), form.errors)
        form.save()
        category.refresh_from_db()
        self.assertTrue(category.is_rbac_category)
        self.assertEqual(list(category.rbac_groups.all()), [self.group])

    def test_saving_replaces_group_assignment(self):
        category = Category.objects.create(title="Swap groups", is_rbac_category=True)
        self.group.categories.add(category)
        form = CategoryAdminForm(data=category_form_data(category, is_rbac_category="on", rbac_groups=[self.second_group.pk]), instance=category)
        self.assertTrue(form.is_valid(), form.errors)
        form.save()
        self.assertEqual(list(category.rbac_groups.all()), [self.second_group])

    def test_groups_of_another_identity_provider_are_rejected(self):
        category = Category.objects.create(title="Mismatched provider", is_rbac_category=True)
        form = CategoryAdminForm(data=category_form_data(category, is_rbac_category="on", rbac_groups=[self.idp_group.pk]), instance=category)
        self.assertFalse(form.is_valid())
        self.assertIn("rbac_groups", form.errors)

    def test_groups_matching_category_identity_provider_are_accepted(self):
        category = Category.objects.create(title="Matched provider", is_rbac_category=True, identity_provider=self.idp)
        form = CategoryAdminForm(data=category_form_data(category, is_rbac_category="on", identity_provider=self.idp.pk, rbac_groups=[self.idp_group.pk]), instance=category)
        self.assertTrue(form.is_valid(), form.errors)
        form.save()
        self.assertEqual(list(category.rbac_groups.all()), [self.idp_group])

    def test_admin_change_post_updates_groups(self):
        category = Category.objects.create(title="Posted category")
        self.client.force_login(self.superuser)
        response = self.client.post(reverse("admin:files_category_change", args=[category.pk]), category_form_data(category, rbac_groups=[self.group.pk, self.second_group.pk]))
        self.assertEqual(response.status_code, 302)
        category.refresh_from_db()
        self.assertTrue(category.is_rbac_category)
        self.assertEqual(set(category.rbac_groups.all()), {self.group, self.second_group})


class UserAdminTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("users_admin_root", is_superuser=True)
        cls.editor = make_user("users_admin_editor", is_editor=True)

    def test_role_filters_and_search(self):
        self.client.force_login(self.superuser)
        response = self.client.get(reverse("admin:users_user_changelist"), {"is_editor__exact": "1"})
        self.assertEqual([user.username for user in response.context["cl"].result_list], ["users_admin_editor"])
        response = self.client.get(reverse("admin:users_user_changelist"), {"q": "users_admin_root"})
        self.assertEqual([user.username for user in response.context["cl"].result_list], ["users_admin_root"])

    def test_sensitive_fields_are_not_editable(self):
        self.client.force_login(self.superuser)
        response = self.client.get(reverse("admin:users_user_change", args=[self.editor.pk]))
        form_fields = response.context["adminform"].form.fields
        self.assertNotIn("password", form_fields)
        self.assertNotIn("user_permissions", form_fields)
        self.assertIn("is_editor", form_fields)

    def test_approval_column_and_filter_appear_when_approval_is_required(self):
        site = AdminSite(name="users_approval_site")
        self.addCleanup(all_sites.discard, site)
        with patch.object(admin, "site", site):
            with override_settings(USERS_NEEDS_TO_BE_APPROVED=True):
                importlib.reload(users.admin)
            approval_admin = site._registry[User]
            site.unregister(User)
            importlib.reload(users.admin)
        self.assertIn("is_approved", approval_admin.list_display)
        self.assertIn("is_approved", approval_admin.list_filter)
        self.assertNotIn("is_approved", approval_admin.exclude)
        self.assertNotIn("is_approved", users.admin.UserAdmin.list_display)
