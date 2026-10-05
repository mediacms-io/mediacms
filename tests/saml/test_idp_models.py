from allauth.socialaccount.models import SocialApp
from django.contrib.sites.models import Site
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from files.models import Category
from identity_providers.forms import ImportCSVsForm
from identity_providers.models import (
    IdentityProviderCategoryMapping,
    IdentityProviderGlobalRole,
    IdentityProviderGroupRole,
    LoginOption,
)
from rbac.models import RBACGroup


def make_app(client_id):
    return SocialApp.objects.create(provider="saml", provider_id=f"{client_id}-id", name=f"{client_id} name", client_id=client_id)


class RoleMappingModelTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.app = make_app("idp-roles")
        cls.other_app = make_app("idp-roles-other")

    def test_group_role_names_are_unique_per_provider(self):
        IdentityProviderGroupRole.objects.create(identity_provider=self.app, name="faculty", map_to="manager")
        with self.assertRaises(ValidationError) as ctx:
            IdentityProviderGroupRole.objects.create(identity_provider=self.app, name="faculty", map_to="member")
        self.assertIn("name", ctx.exception.message_dict)
        IdentityProviderGroupRole.objects.create(identity_provider=self.other_app, name="faculty", map_to="member")

    def test_global_role_names_are_unique_per_provider(self):
        IdentityProviderGlobalRole.objects.create(identity_provider=self.app, name="staff", map_to="editor")
        with self.assertRaises(ValidationError) as ctx:
            IdentityProviderGlobalRole.objects.create(identity_provider=self.app, name="staff", map_to="admin")
        self.assertIn("name", ctx.exception.message_dict)
        IdentityProviderGlobalRole.objects.create(identity_provider=self.other_app, name="staff", map_to="admin")

    def test_existing_mapping_can_be_resaved(self):
        group_role = IdentityProviderGroupRole.objects.create(identity_provider=self.app, name="student", map_to="member")
        group_role.map_to = "contributor"
        group_role.save()
        global_role = IdentityProviderGlobalRole.objects.create(identity_provider=self.app, name="student", map_to="user")
        global_role.map_to = "advancedUser"
        global_role.save()
        self.assertEqual(IdentityProviderGroupRole.objects.get(pk=group_role.pk).map_to, "contributor")
        self.assertEqual(IdentityProviderGlobalRole.objects.get(pk=global_role.pk).map_to, "advancedUser")

    def test_str_representations(self):
        group_role = IdentityProviderGroupRole(identity_provider=self.app, name="faculty", map_to="manager")
        global_role = IdentityProviderGlobalRole(identity_provider=self.app, name="staff", map_to="editor")
        self.assertEqual(str(group_role), "Identity Provider Group Role Mapping faculty")
        self.assertEqual(str(global_role), "Identity Provider Global Role Mapping staff")


class CategoryMappingModelTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.app = make_app("idp-categories")
        cls.category = Category.objects.create(title="Mapped category", is_rbac_category=True)
        cls.group = RBACGroup.objects.create(name="Mapped group", uid="mapped-uid", identity_provider=cls.app)

    def test_saving_mapping_grants_matching_group_the_category(self):
        mapping = IdentityProviderCategoryMapping.objects.create(identity_provider=self.app, name="mapped-uid", map_to=self.category)
        self.assertIn(self.category, self.group.categories.all())
        self.assertEqual(str(mapping), "Identity Provider Category Mapping mapped-uid")

    def test_mapping_without_matching_group_is_saved_alone(self):
        IdentityProviderCategoryMapping.objects.create(identity_provider=self.app, name="no-group", map_to=self.category)
        self.assertFalse(self.group.categories.exists())
        self.assertTrue(IdentityProviderCategoryMapping.objects.filter(name="no-group").exists())

    def test_deleting_mapping_revokes_category_from_group(self):
        mapping = IdentityProviderCategoryMapping.objects.create(identity_provider=self.app, name="mapped-uid", map_to=self.category)
        mapping.delete()
        self.assertFalse(self.group.categories.exists())
        self.assertFalse(IdentityProviderCategoryMapping.objects.exists())

    def test_deleting_mapping_without_group_only_removes_mapping(self):
        mapping = IdentityProviderCategoryMapping.objects.create(identity_provider=self.app, name="lonely", map_to=self.category)
        mapping.delete()
        self.assertFalse(IdentityProviderCategoryMapping.objects.exists())

    def test_name_cannot_change_after_creation(self):
        mapping = IdentityProviderCategoryMapping.objects.create(identity_provider=self.app, name="fixed", map_to=self.category)
        mapping.name = "renamed"
        with self.assertRaises(ValidationError):
            mapping.clean()

    def test_unchanged_and_new_mappings_pass_clean(self):
        mapping = IdentityProviderCategoryMapping.objects.create(identity_provider=self.app, name="fixed", map_to=self.category)
        mapping.clean()
        IdentityProviderCategoryMapping(identity_provider=self.app, name="new", map_to=self.category).clean()


class LoginOptionModelTest(TestCase):
    def test_options_are_ordered_and_named_by_title(self):
        LoginOption.objects.create(title="Second", url="/second", ordering=2)
        LoginOption.objects.create(title="First", url="/first", ordering=1)
        self.assertEqual([str(option) for option in LoginOption.objects.all()], ["First", "Second"])
        self.assertTrue(LoginOption.objects.get(title="First").active)


class ImportCSVsFormTest(TestCase):
    def form(self, **files):
        data = {"provider": "saml", "provider_id": "csv-idp", "name": "CSV IdP", "client_id": "csv-idp", "secret": "", "key": "", "settings": "{}", "sites": [Site.objects.get_current().pk]}
        return ImportCSVsForm(data=data, files=files)

    def csv(self, content, name="mappings.csv"):
        return SimpleUploadedFile(name, content, content_type="text/csv")

    def test_form_is_valid_without_csv_files(self):
        form = self.form()
        self.assertTrue(form.is_valid(), form.errors)
        self.assertIsNone(form.cleaned_data["groups_csv"])
        self.assertIsNone(form.cleaned_data["categories_csv"])

    def test_valid_csv_files_are_accepted_and_rewound(self):
        form = self.form(groups_csv=self.csv(b"group_id,name\ng1,Group one\n"), categories_csv=self.csv(b"group_id,category_id\ng1,c1\n"))
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.cleaned_data["groups_csv"].read(), b"group_id,name\ng1,Group one\n")
        self.assertEqual(form.cleaned_data["categories_csv"].read(), b"group_id,category_id\ng1,c1\n")

    def test_non_csv_extension_is_rejected(self):
        form = self.form(groups_csv=self.csv(b"group_id,name\n", name="groups.txt"), categories_csv=self.csv(b"group_id,category_id\n", name="cats.xlsx"))
        self.assertFalse(form.is_valid())
        self.assertEqual(form.errors["groups_csv"], ["Uploaded file must be a CSV file."])
        self.assertEqual(form.errors["categories_csv"], ["Uploaded file must be a CSV file."])

    def test_missing_headers_are_reported_with_found_headers(self):
        form = self.form(groups_csv=self.csv(b"id,title\n"), categories_csv=self.csv(b"group_id,category\n"))
        self.assertFalse(form.is_valid())
        self.assertIn("Found headers: id, title", form.errors["groups_csv"][0])
        self.assertIn("Found headers: group_id, category", form.errors["categories_csv"][0])

    def test_empty_file_reports_no_headers(self):
        form = self.form(groups_csv=self.csv(b"\n"), categories_csv=self.csv(b"\n"))
        self.assertFalse(form.is_valid())
        self.assertIn("Found headers: none", form.errors["groups_csv"][0])
        self.assertIn("Found headers: none", form.errors["categories_csv"][0])

    def test_non_utf8_file_is_rejected(self):
        form = self.form(groups_csv=self.csv(b"\xff\xfegroup_id"), categories_csv=self.csv(b"\xff\xfegroup_id"))
        self.assertFalse(form.is_valid())
        self.assertIn("UTF-8", form.errors["groups_csv"][0])
        self.assertIn("UTF-8", form.errors["categories_csv"][0])
