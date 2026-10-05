from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialAccount, SocialApp, SocialToken
from django.contrib import admin
from django.contrib.admin.utils import quote
from django.contrib.auth.models import Group
from django.contrib.sites.models import Site
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, RequestFactory, TestCase
from django.urls import reverse
from rest_framework.authtoken.models import Token, TokenProxy

from files.models import (
    Category,
    Comment,
    EncodeProfile,
    Encoding,
    Language,
    Page,
    Subtitle,
    Tag,
    TinyMCEMedia,
    TranscriptionRequest,
    VideoTrimRequest,
)
from files.tests import create_account, create_media
from lti.models import (
    LTILaunchLog,
    LTIPlatform,
    LTIResourceLink,
    LTIRoleMapping,
    LTIToolKeys,
    LTIUserMapping,
)
from migrationservice.models import MigrationRecord, MigrationService
from rbac.models import RBACGroup

PASSWORD = "admin-smoke-password"

VTT = b"WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nhello\n"


def make_user(username, **kwargs):
    return create_account(username=username, email=f"{username}@example.com", password=PASSWORD, **kwargs)


def build_instances(superuser):
    media = create_media(superuser, title="admin smoke media")
    profile = EncodeProfile.objects.create(name="admin smoke profile", extension="mp4", resolution=240, codec="h264")
    language = Language.objects.create(code="xx", title="Smoke language")
    category = Category.objects.create(title="admin smoke category")
    social_app = SocialApp.objects.create(provider="saml", provider_id="smoke-idp", name="Smoke IdP", client_id="smoke-idp")
    social_account = SocialAccount.objects.create(user=superuser, provider="smoke-idp", uid="smoke-uid")
    platform = LTIPlatform.objects.create(
        name="Smoke LMS",
        platform_id="https://lms.example.org",
        client_id="smoke-client",
        auth_login_url="https://lms.example.org/auth",
        auth_token_url="https://lms.example.org/token",
        key_set_url="https://lms.example.org/jwks",
    )
    group = RBACGroup.objects.create(name="Smoke course group")
    resource_link = LTIResourceLink.objects.create(platform=platform, context_id="ctx", context_title="Smoke course", resource_link_id="rl", category=category, rbac_group=group)
    service = MigrationService.objects.create(name="Smoke migration")
    Token.objects.create(user=superuser)
    return {
        Group: Group.objects.create(name="smoke group"),
        EmailAddress: EmailAddress.objects.create(user=superuser, email=superuser.email, verified=True, primary=True),
        SocialApp: social_app,
        SocialAccount: social_account,
        SocialToken: SocialToken.objects.create(app=social_app, account=social_account, token="smoke-token"),
        Site: Site.objects.get_current(),
        TokenProxy: TokenProxy.objects.get(user=superuser),
        TinyMCEMedia: TinyMCEMedia.objects.create(file=SimpleUploadedFile("smoke.png", b"png"), file_type="image", original_filename="smoke.png", user=superuser),
        EncodeProfile: profile,
        Comment: Comment.objects.create(media=media, user=superuser, text="smoke comment"),
        media.__class__: media,
        Encoding: Encoding.objects.create(media=media, profile=profile, status="success"),
        Category: category,
        Page: Page.objects.create(slug="smoke-page", title="Smoke page", description="<p>hi</p>"),
        Tag: Tag.objects.create(title="smoketag"),
        Subtitle: Subtitle.objects.create(language=language, media=media, user=superuser, subtitle_file=SimpleUploadedFile("smoke.vtt", VTT)),
        Language: language,
        VideoTrimRequest: VideoTrimRequest.objects.create(media=media, video_action="replace", timestamps=[{"startTime": 0, "endTime": 1}]),
        TranscriptionRequest: TranscriptionRequest.objects.create(media=media),
        superuser.__class__: superuser,
        LTIPlatform: platform,
        LTIResourceLink: resource_link,
        LTIUserMapping: LTIUserMapping.objects.create(platform=platform, lti_user_id="lti-sub", user=superuser),
        LTIRoleMapping: LTIRoleMapping.objects.create(platform=platform, lti_role="Instructor", global_role="editor", group_role="manager"),
        LTILaunchLog: LTILaunchLog.objects.create(platform=platform, user=superuser, resource_link=resource_link, claims={"sub": "x"}, success=False, error_message="smoke"),
        LTIToolKeys: LTIToolKeys.objects.create(private_key_jwk={"kty": "RSA"}, public_key_jwk={"kty": "RSA"}),
        MigrationService: service,
        MigrationRecord: MigrationRecord.objects.create(service=service, object_type="media", source_id="smoke-1"),
    }


def admin_url(model, view, *args):
    return reverse(f"admin:{model._meta.app_label}_{model._meta.model_name}_{view}", args=args)


class AdminSmokeTest(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("admin_smoke_root", is_superuser=True)
        cls.instances = build_instances(cls.superuser)

    def setUp(self):
        self.client.force_login(self.superuser)
        self.request = RequestFactory().get("/admin/")
        self.request.user = self.superuser

    def test_every_registered_model_has_an_instance_to_open(self):
        self.assertEqual(set(admin.site._registry) - set(self.instances), set())

    def test_admin_index_renders(self):
        response = self.client.get(reverse("admin:index"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "MediaCMS")

    def test_every_changelist_renders(self):
        for model in admin.site._registry:
            with self.subTest(model=model._meta.label):
                self.assertEqual(self.client.get(admin_url(model, "changelist")).status_code, 200)

    def test_every_changelist_search_renders(self):
        for model, model_admin in admin.site._registry.items():
            if not model_admin.get_search_fields(self.request):
                continue
            with self.subTest(model=model._meta.label):
                self.assertEqual(self.client.get(admin_url(model, "changelist"), {"q": "smoke"}).status_code, 200)

    def test_every_add_page_renders_or_is_forbidden_when_adding_is_disabled(self):
        for model, model_admin in admin.site._registry.items():
            with self.subTest(model=model._meta.label):
                expected = 200 if model_admin.has_add_permission(self.request) else 403
                self.assertEqual(self.client.get(admin_url(model, "add")).status_code, expected)

    def test_every_change_page_renders(self):
        for model in admin.site._registry:
            with self.subTest(model=model._meta.label):
                obj = self.instances[model]
                self.assertEqual(self.client.get(admin_url(model, "change", quote(obj.pk))).status_code, 200)

    def test_launch_logs_cannot_be_added_or_changed(self):
        model_admin = admin.site._registry[LTILaunchLog]
        self.assertFalse(model_admin.has_add_permission(self.request))
        self.assertFalse(model_admin.has_change_permission(self.request))

    def test_tool_keys_are_a_protected_singleton(self):
        model_admin = admin.site._registry[LTIToolKeys]
        self.assertFalse(model_admin.has_add_permission(self.request))
        self.assertFalse(model_admin.has_delete_permission(self.request))


class AdminAccessTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.regular = make_user("admin_access_regular")
        cls.staff = make_user("admin_access_staff")
        cls.staff.is_staff = True
        cls.staff.save()

    def test_anonymous_user_is_sent_to_admin_login(self):
        response = Client().get(reverse("admin:index"))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response["Location"].startswith(reverse("admin:login")))

    def test_non_staff_user_is_sent_to_admin_login(self):
        client = Client()
        client.force_login(self.regular)
        for url in (reverse("admin:index"), admin_url(Category, "changelist"), admin_url(self.regular.__class__, "changelist")):
            with self.subTest(url=url):
                response = client.get(url)
                self.assertEqual(response.status_code, 302)
                self.assertTrue(response["Location"].startswith(reverse("admin:login")))

    def test_staff_without_permissions_cannot_open_changelists(self):
        client = Client()
        client.force_login(self.staff)
        self.assertEqual(client.get(reverse("admin:index")).status_code, 200)
        self.assertEqual(client.get(admin_url(Category, "changelist")).status_code, 403)


class AdminAppListTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("admin_applist_root", is_superuser=True)

    def app_list(self):
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        return admin.site.get_app_list(request)

    def test_internal_apps_are_hidden_when_features_are_off(self):
        labels = [app["app_label"] for app in self.app_list()]
        for hidden in ("auth", "account", "authtoken", "socialaccount", "rbac", "saml_auth"):
            self.assertNotIn(hidden, labels)

    def test_files_and_users_come_first(self):
        labels = [app["app_label"] for app in self.app_list()]
        self.assertEqual(labels[:2], ["files", "users"])

    def test_email_addresses_are_listed_under_users(self):
        users_app = next(app for app in self.app_list() if app["app_label"] == "users")
        self.assertIn("EmailAddress", [model["object_name"] for model in users_app["models"]])

    def test_single_app_index_still_works(self):
        response = self.client_for_superuser().get(reverse("admin:app_list", args=["files"]))
        self.assertEqual(response.status_code, 200)

    def client_for_superuser(self):
        client = Client()
        client.force_login(self.superuser)
        return client
