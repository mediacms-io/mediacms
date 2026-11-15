import importlib
from unittest.mock import patch

from allauth.socialaccount.models import SocialAccount, SocialApp, SocialToken
from django.contrib import admin
from django.contrib.admin import AdminSite
from django.contrib.admin.sites import all_sites
from django.contrib.admin.utils import quote
from django.contrib.sites.models import Site
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory, TestCase, override_settings
from django.urls import clear_url_caches, path, reverse

import identity_providers.admin
import rbac.admin
import saml_auth.admin
from cms import urls as cms_urls
from files.models import Category
from files.tests import create_account
from identity_providers.models import (
    IdentityProviderCategoryMapping,
    IdentityProviderGlobalRole,
    IdentityProviderGroupRole,
    IdentityProviderUserLog,
    LoginOption,
)
from rbac.models import RBACGroup, RBACMembership, RBACRole
from saml_auth.models import SAMLConfiguration

PASSWORD = "admin-flags-password"
FLAGGED_MODELS = (RBACGroup, RBACMembership, SAMLConfiguration, IdentityProviderUserLog, LoginOption, SocialApp, SocialAccount)
INLINE_PREFIXES = ("saml_configurations", "global_roles", "group_roles", "rbac_groups", "category_mapping")


NON_ADMIN_PATTERNS = [p for p in cms_urls.urlpatterns if getattr(p, "app_name", None) != "admin"]


class FlaggedAdminUrls:
    urlpatterns = list(NON_ADMIN_PATTERNS)


def make_user(username, **kwargs):
    return create_account(username=username, email=f"{username}@example.com", password=PASSWORD, **kwargs)


def snapshot_meta():
    saved = []
    for model in FLAGGED_MODELS:
        for attr in ("verbose_name", "verbose_name_plural"):
            saved.append((model._meta, attr, getattr(model._meta, attr)))
        saved.append((model._meta.app_config, "verbose_name", model._meta.app_config.verbose_name))
        for field in model._meta.fields:
            saved.append((field, "verbose_name", field.verbose_name))
    return saved


def restore_meta(saved):
    for obj, attr, value in saved:
        setattr(obj, attr, value)


def build_flagged_site():
    site = AdminSite(name="admin")
    site.site_header, site.site_title, site.index_title = admin.site.site_header, admin.site.site_title, admin.site.index_title
    for model, model_admin in admin.site._registry.items():
        site.register(model, type(model_admin))
    with patch.object(admin, "site", site):
        for module in (rbac.admin, saml_auth.admin, identity_providers.admin):
            importlib.reload(module)
    return site


@override_settings(ROOT_URLCONF=FlaggedAdminUrls, USE_RBAC=True, USE_SAML=True, USE_IDENTITY_PROVIDERS=True)
class FlaggedAdminTestCase(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._saved_meta = snapshot_meta()
        cls.site = build_flagged_site()
        FlaggedAdminUrls.urlpatterns = [path("admin/", cls.site.urls)] + NON_ADMIN_PATTERNS
        clear_url_caches()

    @classmethod
    def tearDownClass(cls):
        restore_meta(cls._saved_meta)
        all_sites.discard(cls.site)
        FlaggedAdminUrls.urlpatterns = list(NON_ADMIN_PATTERNS)
        clear_url_caches()
        super().tearDownClass()

    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user(f"flags_root_{cls.__name__.lower()}", is_superuser=True)
        cls.idp = SocialApp.objects.create(provider="saml", provider_id="flags-idp", name="Flags IdP", client_id="flags-idp")
        cls.idp.sites.add(Site.objects.get_current())

    def setUp(self):
        self.client.force_login(self.superuser)

    def admin_request(self):
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        return request

    def model_admin(self, model):
        return self.site._registry[model]


class FlaggedRegistrationTest(FlaggedAdminTestCase):
    def test_flagged_models_are_registered_with_custom_admins(self):
        self.assertIsInstance(self.model_admin(RBACGroup), rbac.admin.RBACGroupAdmin)
        self.assertIsInstance(self.model_admin(RBACMembership), rbac.admin.RBACMembershipAdmin)
        self.assertIsInstance(self.model_admin(SAMLConfiguration), saml_auth.admin.SAMLConfigurationAdmin)
        self.assertIsInstance(self.model_admin(SocialApp), identity_providers.admin.CustomSocialAppAdmin)
        self.assertIsInstance(self.model_admin(SocialAccount), identity_providers.admin.CustomSocialAccountAdmin)
        self.assertIn(IdentityProviderUserLog, self.site._registry)
        self.assertIn(LoginOption, self.site._registry)
        self.assertNotIn(SocialToken, self.site._registry)

    def test_models_are_renamed_for_the_admin(self):
        self.assertEqual(RBACGroup._meta.verbose_name_plural, "Groups")
        self.assertEqual(SocialApp._meta.verbose_name, "ID Provider")
        self.assertEqual(SAMLConfiguration._meta.get_field("social_app").verbose_name, "ID Provider")

    def test_default_site_is_untouched(self):
        self.assertNotIn(RBACGroup, admin.site._registry)
        self.assertIn(SocialToken, admin.site._registry)

    def test_every_flagged_changelist_and_add_page_renders(self):
        for model in FLAGGED_MODELS:
            with self.subTest(model=model._meta.label):
                info = (model._meta.app_label, model._meta.model_name)
                self.assertEqual(self.client.get(reverse("admin:%s_%s_changelist" % info)).status_code, 200)
                self.assertEqual(self.client.get(reverse("admin:%s_%s_add" % info)).status_code, 200)


class FlaggedAppListTest(FlaggedAdminTestCase):
    def test_groups_and_identity_provider_models_are_regrouped(self):
        app_list = self.site.get_app_list(self.admin_request())
        apps = {app["app_label"]: [model["object_name"] for model in app["models"]] for app in app_list}
        labels = [app["app_label"] for app in app_list]
        self.assertEqual(labels[:3], ["files", "users", "socialaccount"])
        self.assertNotIn("rbac", labels)
        self.assertNotIn("saml_auth", labels)
        self.assertIn("RBACGroup", apps["users"])
        self.assertIn("EmailAddress", apps["users"])
        self.assertIn("LoginOption", apps["socialaccount"])
        self.assertIn("IdentityProviderUserLog", apps["socialaccount"])

    def test_index_renders(self):
        response = self.client.get(reverse("admin:index"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "ID Providers")

    @override_settings(USE_RBAC=False, USE_IDENTITY_PROVIDERS=False)
    def test_registered_models_are_still_hidden_when_flags_are_turned_off(self):
        app_list = self.site.get_app_list(self.admin_request())
        apps = {app["app_label"]: [model["object_name"] for model in app["models"]] for app in app_list}
        self.assertNotIn("socialaccount", apps)
        self.assertNotIn("RBACGroup", apps["users"])


class RBACGroupAdminTest(FlaggedAdminTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.member = make_user("flags_member")
        cls.contributor = make_user("flags_contributor")
        cls.manager = make_user("flags_manager")
        cls.category = Category.objects.create(title="Flags rbac category", is_rbac_category=True)
        cls.open_category = Category.objects.create(title="Flags open category")
        cls.group = RBACGroup.objects.create(name="Flags group", uid="flags-group")
        cls.group.categories.add(cls.category)
        RBACMembership.objects.create(user=cls.member, rbac_group=cls.group, role=RBACRole.MEMBER)
        RBACMembership.objects.create(user=cls.contributor, rbac_group=cls.group, role=RBACRole.CONTRIBUTOR)
        cls.empty_group = RBACGroup.objects.create(name="Flags empty group", uid="flags-empty", identity_provider=cls.idp)

    def changelist(self, **params):
        response = self.client.get(reverse("admin:rbac_rbacgroup_changelist"), params)
        self.assertEqual(response.status_code, 200)
        return response

    def test_changelist_shows_role_counts_and_categories(self):
        model_admin = self.model_admin(RBACGroup)
        self.assertEqual(model_admin.get_member_count(self.group), 1)
        self.assertEqual(model_admin.get_contributor_count(self.group), 1)
        self.assertEqual(model_admin.get_manager_count(self.group), 0)
        self.assertEqual(model_admin.categories_list(self.group), "Flags rbac category")
        self.assertEqual(model_admin.member_count(self.group), f'<a href="?rbac_group__id__exact={self.group.id}">2 members</a>')
        self.assertContains(self.changelist(), "Flags rbac category")

    def test_role_filter_keeps_groups_having_that_role(self):
        self.assertEqual(list(self.changelist(role="contributor").context["cl"].result_list), [self.group])
        self.assertEqual(list(self.changelist(role="manager").context["cl"].result_list), [])
        self.assertEqual(set(self.changelist().context["cl"].result_list), {self.group, self.empty_group})

    def test_identity_provider_column_and_filter(self):
        model_admin = self.model_admin(RBACGroup)
        request = self.admin_request()
        self.assertIn("identity_provider", model_admin.get_list_display(request))
        self.assertIn("identity_provider", model_admin.get_list_filter(request))
        self.assertEqual(list(self.changelist(identity_provider__id__exact=self.idp.pk).context["cl"].result_list), [self.empty_group])

    @override_settings(USE_IDENTITY_PROVIDERS=False)
    def test_identity_provider_is_hidden_without_identity_providers(self):
        model_admin = self.model_admin(RBACGroup)
        request = self.admin_request()
        self.assertNotIn("identity_provider", model_admin.get_list_display(request))
        self.assertNotIn("identity_provider", model_admin.get_list_filter(request))
        fields = [field for _, options in model_admin.get_fieldsets(request) for field in options["fields"]]
        self.assertNotIn("identity_provider", fields)

    def test_add_form_has_no_membership_fields_but_change_form_does(self):
        model_admin = self.model_admin(RBACGroup)
        request = self.admin_request()
        add_fields = [field for _, options in model_admin.get_fieldsets(request) for field in options["fields"]]
        change_fields = [field for _, options in model_admin.get_fieldsets(request, self.group) for field in options["fields"]]
        self.assertNotIn("members_field", add_fields)
        self.assertIn("identity_provider", add_fields)
        for field in ("members_field", "contributors_field", "managers_field", "categories"):
            self.assertIn(field, change_fields)
        self.assertEqual(self.client.get(reverse("admin:rbac_rbacgroup_change", args=[self.group.pk])).status_code, 200)

    def test_form_initial_values_reflect_memberships(self):
        form = rbac.admin.RBACGroupAdminForm(instance=self.group)
        self.assertEqual(list(form.fields["members_field"].initial), [self.member])
        self.assertEqual(list(form.fields["contributors_field"].initial), [self.contributor])
        self.assertEqual(list(form.fields["managers_field"].initial), [])
        self.assertEqual(list(form.fields["categories"].initial), [self.category])
        self.assertEqual(list(form.fields["categories"].queryset), [self.category])

    def test_change_post_rewrites_memberships_and_categories(self):
        data = {
            "identity_provider": "",
            "uid": "flags-group",
            "name": "Flags group renamed",
            "description": "",
            "members_field": [self.contributor.pk],
            "contributors_field": [],
            "managers_field": [self.manager.pk],
            "categories": [],
        }
        response = self.client.post(reverse("admin:rbac_rbacgroup_change", args=[self.group.pk]), data)
        self.assertEqual(response.status_code, 302)
        roles = set(RBACMembership.objects.filter(rbac_group=self.group).values_list("user__username", "role"))
        self.assertEqual(roles, {("flags_contributor", "member"), ("flags_manager", "manager")})
        self.group.refresh_from_db()
        self.assertEqual(self.group.name, "Flags group renamed")
        self.assertFalse(self.group.categories.exists())

    def test_add_post_creates_group(self):
        response = self.client.post(reverse("admin:rbac_rbacgroup_add"), {"identity_provider": self.idp.pk, "uid": "flags-new", "name": "Flags new group", "description": "new"})
        self.assertEqual(response.status_code, 302)
        self.assertTrue(RBACGroup.objects.filter(uid="flags-new", identity_provider=self.idp).exists())

    def test_membership_changelist_filters_by_role(self):
        response = self.client.get(reverse("admin:rbac_rbacmembership_changelist"), {"role__exact": "member"})
        self.assertEqual([str(m) for m in response.context["cl"].result_list], ["flags_member - Flags group (member)"])
        membership = RBACMembership.objects.get(user=self.member)
        self.assertEqual(self.client.get(reverse("admin:rbac_rbacmembership_change", args=[membership.pk])).status_code, 200)


class SocialAppAdminTest(FlaggedAdminTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.category = Category.objects.create(title="IdP admin category", is_rbac_category=True)
        cls.group_role = IdentityProviderGroupRole.objects.create(identity_provider=cls.idp, name="faculty", map_to="manager")
        IdentityProviderGlobalRole.objects.create(identity_provider=cls.idp, name="staff", map_to="editor")
        RBACGroup.objects.create(name="Existing IdP group", uid="existing", identity_provider=cls.idp)
        IdentityProviderCategoryMapping.objects.create(identity_provider=cls.idp, name="existing", map_to=cls.category)
        SAMLConfiguration.objects.create(
            social_app=cls.idp,
            sso_url="https://idp.example.org/sso",
            slo_url="https://idp.example.org/slo",
            sp_metadata_url="https://sp.example.org/saml/metadata",
            idp_id="https://idp.example.org/entity",
            idp_cert="CERT",
            uid="uid",
        )

    def inline_management(self, initial=None):
        data = {}
        for prefix in INLINE_PREFIXES:
            data.update({f"{prefix}-TOTAL_FORMS": "0", f"{prefix}-INITIAL_FORMS": "0", f"{prefix}-MIN_NUM_FORMS": "0", f"{prefix}-MAX_NUM_FORMS": "1000"})
        return data

    def app_data(self, provider_id, **extra):
        data = {"provider": "saml", "provider_id": provider_id, "name": f"{provider_id} name", "client_id": provider_id, "sites": [Site.objects.get_current().pk]}
        data.update(self.inline_management())
        data.update(extra)
        return data

    def test_columns_show_name_and_protocol(self):
        model_admin = self.model_admin(SocialApp)
        self.assertEqual(model_admin.get_config_name(self.idp), "Flags IdP")
        self.assertEqual(model_admin.get_protocol(self.idp), "saml")
        self.assertContains(self.client.get(reverse("admin:socialaccount_socialapp_changelist")), "Flags IdP")

    def test_inlines_depend_on_saml_flag(self):
        inline_classes = self.model_admin(SocialApp).inlines
        self.assertEqual(inline_classes[0], identity_providers.admin.SAMLConfigurationInline)
        with override_settings(USE_SAML=False):
            without_saml = identity_providers.admin.CustomSocialAppAdmin(SocialApp, self.site).inlines
        self.assertNotIn(identity_providers.admin.SAMLConfigurationInline, without_saml)
        self.assertEqual(len(without_saml), 4)

    def test_form_labels_and_required_fields(self):
        response = self.client.get(reverse("admin:socialaccount_socialapp_add"))
        form = response.context["adminform"].form
        self.assertEqual(form.fields["provider"].label, "Protocol")
        self.assertEqual(form.fields["name"].label, "IDP Config Name")
        self.assertTrue(form.fields["sites"].required)
        self.assertTrue(form.fields["provider_id"].required)
        self.assertIn("/accounts/saml/{client_id}/login/", form.fields["client_id"].help_text)

    def test_change_page_renders_all_inline_rows(self):
        response = self.client.get(reverse("admin:socialaccount_socialapp_change", args=[self.idp.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "faculty")
        self.assertContains(response, "Existing IdP group")
        self.assertContains(response, "data-help-text")

    def test_add_with_csv_files_creates_groups_and_category_mappings(self):
        groups_csv = SimpleUploadedFile("groups.csv", b"group_id,name\nchem,Chemistry\nexisting,Duplicate uid elsewhere\n,Missing id\n", content_type="text/csv")
        categories_csv = SimpleUploadedFile("cats.csv", f"group_id,category_id\nchem,{self.category.uid}\nchem,no-such-category\n".encode(), content_type="text/csv")
        response = self.client.post(reverse("admin:socialaccount_socialapp_add"), self.app_data("csv-idp", groups_csv=groups_csv, categories_csv=categories_csv))
        self.assertEqual(response.status_code, 302)
        app = SocialApp.objects.get(provider_id="csv-idp")
        self.assertEqual(set(RBACGroup.objects.filter(identity_provider=app).values_list("uid", "name")), {("chem", "Chemistry"), ("existing", "Duplicate uid elsewhere")})
        self.assertEqual(list(IdentityProviderCategoryMapping.objects.filter(identity_provider=app).values_list("name", "map_to__uid")), [("chem", self.category.uid)])
        self.assertIn(self.category, RBACGroup.objects.get(identity_provider=app, uid="chem").categories.all())

    def test_csv_rows_matching_existing_groups_are_skipped(self):
        groups_csv = SimpleUploadedFile("groups.csv", b"group_id,name\nexisting,Other name\nnew-uid,Existing IdP group\nfresh,Fresh group\n", content_type="text/csv")
        data = self.app_data("flags-idp", groups_csv=groups_csv)
        data.update({"name": "Flags IdP", "client_id": "flags-idp"})
        response = self.client.post(reverse("admin:socialaccount_socialapp_change", args=[self.idp.pk]), self.with_existing_inlines(data))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(set(RBACGroup.objects.filter(identity_provider=self.idp).values_list("uid", flat=True)), {"existing", "fresh"})

    def with_existing_inlines(self, data, delete_group_role=False):
        data = dict(data)
        rows = {
            "saml_configurations": list(SAMLConfiguration.objects.filter(social_app=self.idp)),
            "global_roles": list(IdentityProviderGlobalRole.objects.filter(identity_provider=self.idp)),
            "group_roles": list(IdentityProviderGroupRole.objects.filter(identity_provider=self.idp)),
            "rbac_groups": list(RBACGroup.objects.filter(identity_provider=self.idp)),
            "category_mapping": list(IdentityProviderCategoryMapping.objects.filter(identity_provider=self.idp)),
        }
        for prefix, objects in rows.items():
            data[f"{prefix}-TOTAL_FORMS"] = str(len(objects))
            data[f"{prefix}-INITIAL_FORMS"] = str(len(objects))
            for index, obj in enumerate(objects):
                key = f"{prefix}-{index}"
                data[f"{key}-id"] = obj.pk
                data[f"{key}-identity_provider"] = self.idp.pk
                if prefix == "saml_configurations":
                    data[f"{key}-social_app"] = self.idp.pk
                    for field in ("sso_url", "slo_url", "sp_metadata_url", "idp_id", "idp_cert", "uid", "save_saml_response_logs"):
                        data[f"{key}-{field}"] = getattr(obj, field)
                elif prefix == "rbac_groups":
                    data[f"{key}-uid"] = obj.uid
                    data[f"{key}-name"] = obj.name
                else:
                    data[f"{key}-name"] = obj.name
                    data[f"{key}-map_to"] = obj.map_to_id if prefix == "category_mapping" else obj.map_to
                if delete_group_role and prefix == "group_roles":
                    data[f"{key}-should_delete"] = "True"
        return data

    def test_should_delete_flag_removes_inline_row(self):
        data = self.app_data("flags-idp")
        data.update({"name": "Flags IdP", "client_id": "flags-idp"})
        response = self.client.post(reverse("admin:socialaccount_socialapp_change", args=[self.idp.pk]), self.with_existing_inlines(data, delete_group_role=True))
        self.assertEqual(response.status_code, 302)
        self.assertFalse(IdentityProviderGroupRole.objects.filter(pk=self.group_role.pk).exists())
        self.assertTrue(IdentityProviderGlobalRole.objects.filter(identity_provider=self.idp, name="staff").exists())

    def test_inline_forms_reject_duplicate_role_names(self):
        group_form = identity_providers.admin.IdentityProviderGroupRoleInlineForm(data={"name": "faculty", "map_to": "member"}, instance=IdentityProviderGroupRole(identity_provider=self.idp))
        global_form = identity_providers.admin.IdentityProviderGlobalRoleInlineForm(data={"name": "staff", "map_to": "admin"}, instance=IdentityProviderGlobalRole(identity_provider=self.idp))
        self.assertIn("already exists", group_form.errors["name"][0])
        self.assertIn("already exists", global_form.errors["name"][0])

    def test_inline_forms_accept_new_role_names(self):
        group_form = identity_providers.admin.IdentityProviderGroupRoleInlineForm(data={"name": "student", "map_to": "member"}, instance=IdentityProviderGroupRole(identity_provider=self.idp))
        global_form = identity_providers.admin.IdentityProviderGlobalRoleInlineForm(data={"name": "student", "map_to": "user"}, instance=IdentityProviderGlobalRole(identity_provider=self.idp))
        self.assertTrue(group_form.is_valid(), group_form.errors)
        self.assertTrue(global_form.is_valid(), global_form.errors)

    def test_inlines_allow_deleting(self):
        request = self.admin_request()
        for inline in self.model_admin(SocialApp).get_inline_instances(request, self.idp):
            with self.subTest(inline=type(inline).__name__):
                self.assertTrue(inline.has_delete_permission(request, self.idp))


class IdentityProviderSupportAdminsTest(FlaggedAdminTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.user = make_user("flags_social_user")
        cls.account = SocialAccount.objects.create(user=cls.user, provider="flags-idp", uid="flags-social-uid")
        cls.log = IdentityProviderUserLog.objects.create(identity_provider=cls.idp, user=cls.user, logs="{'uid': ['flags']}")
        LoginOption.objects.create(title="Login through Flags", url="/accounts/saml/flags-idp/login/", ordering=1)

    def test_social_account_admin_shows_provider(self):
        model_admin = self.model_admin(SocialAccount)
        self.assertEqual(model_admin.get_provider(self.account), "flags-idp")
        response = self.client.get(reverse("admin:socialaccount_socialaccount_changelist"))
        self.assertContains(response, "flags-social-uid")
        response = self.client.get(reverse("admin:socialaccount_socialaccount_change", args=[self.account.pk]))
        self.assertEqual(response.context["adminform"].form.fields["provider"].label, "Provider ID")

    def test_user_logs_are_read_only_and_searchable(self):
        response = self.client.get(reverse("admin:identity_providers_identityprovideruserlog_changelist"), {"q": "flags_social_user"})
        self.assertEqual(list(response.context["cl"].result_list), [self.log])
        response = self.client.get(reverse("admin:identity_providers_identityprovideruserlog_change", args=[quote(self.log.pk)]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.context["adminform"].form.fields), set())

    def test_login_options_are_editable_from_the_changelist(self):
        option = LoginOption.objects.get(title="Login through Flags")
        data = {"form-TOTAL_FORMS": "1", "form-INITIAL_FORMS": "1", "form-0-id": option.pk, "form-0-ordering": "7", "_save": "Save"}
        response = self.client.post(reverse("admin:identity_providers_loginoption_changelist"), data)
        self.assertEqual(response.status_code, 302)
        option.refresh_from_db()
        self.assertEqual(option.ordering, 7)
        self.assertFalse(option.active)


class SAMLConfigurationAdminTest(FlaggedAdminTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.configuration = SAMLConfiguration.objects.create(
            social_app=cls.idp,
            sso_url="https://idp.example.org/sso",
            slo_url="https://idp.example.org/slo",
            sp_metadata_url="https://sp.example.org/saml/metadata",
            idp_id="https://idp.example.org/entity",
            idp_cert="CERT",
            uid="uid",
        )

    def csv_form(self, upload):
        return saml_auth.admin.SAMLConfigurationForm(data={"social_app": self.idp.pk}, files={"import_csv": upload})

    def test_changelist_links_metadata(self):
        model_admin = self.model_admin(SAMLConfiguration)
        self.assertEqual(model_admin.view_metadata_url(self.configuration), '<a href="https://sp.example.org/saml/metadata" target="_blank">View Metadata</a>')
        response = self.client.get(reverse("admin:saml_auth_samlconfiguration_changelist"), {"remove_from_groups__exact": "0"})
        self.assertEqual(list(response.context["cl"].result_list), [self.configuration])

    def test_change_page_offers_bulk_group_mapping_and_labels_provider(self):
        response = self.client.get(reverse("admin:saml_auth_samlconfiguration_change", args=[self.configuration.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "BULK GROUP MAPPINGS")
        self.assertEqual(response.context["adminform"].form.fields["social_app"].label, "IDP Config Name")

    def test_editing_configuration_through_admin(self):
        data = {
            "social_app": self.idp.pk,
            "idp_id": "https://idp.example.org/entity",
            "idp_cert": "NEWCERT",
            "sso_url": "https://idp.example.org/sso",
            "slo_url": "https://idp.example.org/slo",
            "sp_metadata_url": "https://sp.example.org/saml/metadata",
            "uid": "eduPersonPrincipalName",
            "save_saml_response_logs": "on",
        }
        response = self.client.post(reverse("admin:saml_auth_samlconfiguration_change", args=[self.configuration.pk]), data)
        self.assertEqual(response.status_code, 302)
        self.configuration.refresh_from_db()
        self.assertEqual(self.configuration.idp_cert, "NEWCERT")
        self.assertEqual(self.configuration.uid, "eduPersonPrincipalName")

    def test_import_csv_validation(self):
        cases = {
            "groups.txt": (b"group_id,name\n", "Uploaded file must be a CSV file."),
            "headers.csv": (b"id,title\n", "Found headers: id, title"),
            "empty.csv": (b"\n", "Found headers: none"),
            "latin.csv": (b"\xff\xfegroup", "UTF-8"),
        }
        for name, (content, message) in cases.items():
            with self.subTest(name=name):
                form = self.csv_form(SimpleUploadedFile(name, content))
                form.is_valid()
                self.assertIn(message, form.errors["import_csv"][0])

    def test_valid_import_csv_is_accepted(self):
        form = self.csv_form(SimpleUploadedFile("groups.csv", b"group_id,name\ng,G\n"))
        form.is_valid()
        self.assertNotIn("import_csv", form.errors)
        self.assertEqual(form.cleaned_data["import_csv"].read(), b"group_id,name\ng,G\n")
