import base64
import json
import uuid

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import AnonymousUser
from django.http import HttpResponse
from django.test import RequestFactory, TestCase, override_settings
from django.urls import include, path, re_path
from rest_framework.authtoken.models import Token

from cms.auth_backends import ApprovalBackend
from cms.middleware import ApprovalMiddleware
from files.models import Media
from files.tests import create_account, create_media, fixture_path
from files.views import approval_required

PASSWORD = "approval_pass_123"

urlpatterns = [
    re_path(r"^approval_required/", approval_required, name="approval_required"),
    path("", include("cms.urls")),
]

APPROVAL_BACKENDS = (
    "cms.auth_backends.ApprovalBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
)


def _middleware_after_auth(extra):
    middleware = list(settings.MIDDLEWARE)
    middleware.insert(middleware.index("django.contrib.auth.middleware.AuthenticationMiddleware") + 1, extra)
    return middleware


APPROVAL_MIDDLEWARE = _middleware_after_auth("cms.middleware.ApprovalMiddleware")
LOGIN_REQUIRED_MIDDLEWARE = _middleware_after_auth("django.contrib.auth.middleware.LoginRequiredMiddleware")


def make_user(prefix, **kwargs):
    token = uuid.uuid4().hex[:10]
    return create_account(username=f"{prefix}_{token}", email=f"{prefix}_{token}@example.com", password=PASSWORD, **kwargs)


class ApprovalBackendTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.pending = make_user("pending")
        cls.approved = make_user("approved")
        cls.approved.is_approved = True
        cls.approved.save()
        cls.admin = make_user("admin", is_superuser=True)

    def setUp(self):
        self.backend = ApprovalBackend()

    @override_settings(USERS_NEEDS_TO_BE_APPROVED=False)
    def test_unapproved_user_can_authenticate_when_approval_is_disabled(self):
        self.assertTrue(self.backend.user_can_authenticate(self.pending))

    @override_settings(USERS_NEEDS_TO_BE_APPROVED=True)
    def test_unapproved_user_cannot_authenticate_when_approval_is_required(self):
        self.assertFalse(self.backend.user_can_authenticate(self.pending))

    @override_settings(USERS_NEEDS_TO_BE_APPROVED=True)
    def test_approved_user_can_authenticate_when_approval_is_required(self):
        self.assertTrue(self.backend.user_can_authenticate(self.approved))

    @override_settings(USERS_NEEDS_TO_BE_APPROVED=True)
    def test_superuser_does_not_need_approval(self):
        self.assertFalse(self.admin.is_approved)
        self.assertTrue(self.backend.user_can_authenticate(self.admin))

    @override_settings(USERS_NEEDS_TO_BE_APPROVED=True)
    def test_inactive_user_cannot_authenticate_even_if_approved(self):
        self.approved.is_active = False
        self.assertFalse(self.backend.user_can_authenticate(self.approved))

    @override_settings(USERS_NEEDS_TO_BE_APPROVED=True, AUTHENTICATION_BACKENDS=("cms.auth_backends.ApprovalBackend",))
    def test_authenticate_rejects_unapproved_and_accepts_approved_users(self):
        self.assertIsNone(authenticate(username=self.pending.username, password=PASSWORD))
        self.assertEqual(authenticate(username=self.approved.username, password=PASSWORD), self.approved)

    @override_settings(USERS_NEEDS_TO_BE_APPROVED=True, AUTHENTICATION_BACKENDS=("cms.auth_backends.ApprovalBackend",))
    def test_wrong_password_is_rejected_for_approved_user(self):
        self.assertIsNone(authenticate(username=self.approved.username, password="wrong"))


@override_settings(ROOT_URLCONF=__name__, USERS_NEEDS_TO_BE_APPROVED=True)
class ApprovalMiddlewareUnitTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.pending = make_user("pending")
        cls.approved = make_user("approved")
        cls.approved.is_approved = True
        cls.approved.save()
        cls.admin = make_user("admin", is_superuser=True)

    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = ApprovalMiddleware(lambda request: HttpResponse("passed"))

    def _call(self, path, user):
        request = self.factory.get(path)
        request.user = user
        return self.middleware(request)

    def test_anonymous_requests_pass_through(self):
        self.assertEqual(self._call("/", AnonymousUser()).content, b"passed")

    def test_approved_user_passes_through(self):
        self.assertEqual(self._call("/", self.approved).content, b"passed")

    def test_superuser_passes_through_without_approval(self):
        self.assertEqual(self._call("/", self.admin).content, b"passed")

    def test_unapproved_user_is_redirected_to_approval_page(self):
        response = self._call("/featured", self.pending)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/approval_required/")

    def test_unapproved_user_gets_json_403_on_api(self):
        response = self._call("/api/v1/media", self.pending)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(json.loads(response.content), {"detail": "User account not approved."})

    def test_unapproved_user_may_view_approval_page_and_logout(self):
        self.assertEqual(self._call("/approval_required/", self.pending).content, b"passed")
        self.assertEqual(self._call("/accounts/logout/", self.pending).content, b"passed")

    @override_settings(USERS_NEEDS_TO_BE_APPROVED=False)
    def test_unapproved_user_passes_through_when_approval_is_disabled(self):
        self.assertEqual(self._call("/featured", self.pending).content, b"passed")


@override_settings(ROOT_URLCONF=__name__, USERS_NEEDS_TO_BE_APPROVED=True, MIDDLEWARE=APPROVAL_MIDDLEWARE, AUTHENTICATION_BACKENDS=APPROVAL_BACKENDS)
class ApprovalFlowTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.pending = make_user("pending")
        cls.approved = make_user("approved")
        cls.approved.is_approved = True
        cls.approved.save()
        cls.manager = make_user("manager", is_manager=True)
        cls.manager.is_approved = True
        cls.manager.save()

    def _login(self, user):
        response = self.client.post("/accounts/login/", {"login": user.username, "password": PASSWORD})
        self.assertEqual(response.status_code, 302)

    def test_unapproved_user_is_held_at_the_approval_page_after_login(self):
        self._login(self.pending)
        response = self.client.get("/")
        self.assertRedirects(response, "/approval_required/")
        response = self.client.get("/approval_required/")
        self.assertContains(response, "Account Pending Approval")

    def test_unapproved_user_is_refused_by_the_api_over_the_session(self):
        self._login(self.pending)
        response = self.client.get("/api/v1/whoami")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "User account not approved.")

    def test_unapproved_user_can_still_log_out(self):
        self._login(self.pending)
        response = self.client.post("/accounts/logout/")
        self.assertEqual(response.status_code, 302)
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_approved_user_reaches_the_site(self):
        self._login(self.approved)
        self.assertEqual(self.client.get("/").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/whoami").json()["username"], self.approved.username)

    def test_manager_approval_lets_the_user_in(self):
        self._login(self.manager)
        response = self.client.put(f"/api/v1/users/{self.pending.username}", "action=approve_user", content_type="application/x-www-form-urlencoded")
        self.assertEqual(response.status_code, 200)
        self.pending.refresh_from_db()
        self.assertTrue(self.pending.is_approved)

        self.client.logout()
        self._login(self.pending)
        self.assertEqual(self.client.get("/").status_code, 200)

    def test_manager_disapproval_locks_the_user_out_again(self):
        self._login(self.manager)
        response = self.client.put(f"/api/v1/users/{self.approved.username}", "action=disapprove_user", content_type="application/x-www-form-urlencoded")
        self.assertEqual(response.status_code, 200)

        self.client.logout()
        self._login(self.approved)
        self.assertRedirects(self.client.get("/"), "/approval_required/")

    def test_manager_can_filter_users_by_approval_state(self):
        self._login(self.manager)
        approved = {u["username"] for u in self.client.get("/api/v1/users?is_approved=true").json()["results"]}
        pending = {u["username"] for u in self.client.get("/api/v1/users?is_approved=false").json()["results"]}
        self.assertIn(self.approved.username, approved)
        self.assertNotIn(self.pending.username, approved)
        self.assertIn(self.pending.username, pending)
        self.assertNotIn(self.approved.username, pending)


@override_settings(USERS_NEEDS_TO_BE_APPROVED=True)
class ApprovalApiAuthenticationTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.pending = make_user("pending")
        cls.approved = make_user("approved")
        cls.approved.is_approved = True
        cls.approved.save()
        cls.superuser = make_user("super", is_superuser=True)

    def login_api(self, user):
        return self.client.post("/api/v1/login", {"username": user.username, "password": PASSWORD})

    def whoami_with_token(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        return self.client.get("/api/v1/whoami", HTTP_AUTHORIZATION=f"Token {token.key}")

    def whoami_with_basic_auth(self, user):
        credentials = base64.b64encode(f"{user.username}:{PASSWORD}".encode()).decode()
        return self.client.get("/api/v1/whoami", HTTP_AUTHORIZATION=f"Basic {credentials}")

    def test_the_login_api_does_not_issue_a_token_to_an_unapproved_user(self):
        response = self.login_api(self.pending)
        self.assertEqual(response.status_code, 400)
        self.assertIn("User account not approved.", str(response.json()))
        self.assertFalse(Token.objects.filter(user=self.pending).exists())

    def test_the_login_api_issues_a_token_to_an_approved_user(self):
        response = self.login_api(self.approved)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["token"], Token.objects.get(user=self.approved).key)

    def test_a_token_obtained_before_approval_was_required_is_refused(self):
        response = self.whoami_with_token(self.pending)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "User account not approved.")

    def test_basic_auth_is_refused_for_an_unapproved_user(self):
        response = self.whoami_with_basic_auth(self.pending)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "User account not approved.")

    def test_an_unapproved_user_cannot_upload_through_the_api_with_a_token(self):
        token, _ = Token.objects.get_or_create(user=self.pending)
        with open(fixture_path("test_image.png"), "rb") as fp:
            response = self.client.post("/api/v1/media", {"media_file": fp}, HTTP_AUTHORIZATION=f"Token {token.key}")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Media.objects.filter(user=self.pending).exists())

    def test_approved_users_authenticate_with_token_and_basic_auth(self):
        self.assertEqual(self.whoami_with_token(self.approved).json()["username"], self.approved.username)
        self.assertEqual(self.whoami_with_basic_auth(self.approved).json()["username"], self.approved.username)

    def test_a_superuser_needs_no_approval(self):
        self.assertEqual(self.login_api(self.superuser).status_code, 200)
        self.assertEqual(self.whoami_with_token(self.superuser).status_code, 200)

    @override_settings(USERS_NEEDS_TO_BE_APPROVED=False)
    def test_unapproved_users_are_let_in_when_approval_is_not_required(self):
        self.assertEqual(self.login_api(self.pending).status_code, 200)
        self.assertEqual(self.whoami_with_token(self.pending).json()["username"], self.pending.username)


@override_settings(GLOBAL_LOGIN_REQUIRED=True)
class GlobalLoginRequiredApiTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("member")
        cls.media = create_media(cls.user, title="login only portal media", state="public")

    def test_anonymous_requests_to_the_api_are_refused(self):
        for url in ("/api/v1/media", f"/api/v1/media/{self.media.friendly_token}", "/api/v1/search?q=portal", "/api/v1/categories", "/api/v1/users"):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertIn(response.status_code, (401, 403))
                self.assertEqual(response.json()["detail"], "Authentication credentials were not provided.")

    def test_the_login_api_stays_reachable_and_issues_a_token(self):
        response = self.client.post("/api/v1/login", {"username": self.user.username, "password": PASSWORD})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["token"], Token.objects.get(user=self.user).key)

    def test_token_and_session_users_reach_the_api(self):
        token, _ = Token.objects.get_or_create(user=self.user)
        self.assertEqual(self.client.get("/api/v1/media", HTTP_AUTHORIZATION=f"Token {token.key}").status_code, 200)
        self.client.force_login(self.user)
        self.assertEqual(self.client.get(f"/api/v1/media/{self.media.friendly_token}").status_code, 200)

    @override_settings(GLOBAL_LOGIN_REQUIRED=False)
    def test_anonymous_users_read_the_api_when_the_portal_is_open(self):
        self.assertEqual(self.client.get("/api/v1/media").status_code, 200)


@override_settings(MIDDLEWARE=LOGIN_REQUIRED_MIDDLEWARE)
class GlobalLoginRequiredTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("member")

    def test_anonymous_visitor_is_sent_to_login(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], f"{settings.LOGIN_URL}?next=/")

    def test_login_and_signup_pages_stay_reachable(self):
        self.assertEqual(self.client.get("/accounts/login/").status_code, 200)
        self.assertEqual(self.client.get("/accounts/signup/").status_code, 200)

    def test_logged_in_user_reaches_the_site(self):
        self.client.force_login(self.user)
        self.assertEqual(self.client.get("/").status_code, 200)

    def test_login_form_sends_user_back_to_the_requested_page(self):
        response = self.client.post("/accounts/login/?next=/featured", {"login": self.user.username, "password": PASSWORD})
        self.assertRedirects(response, "/featured", fetch_redirect_response=False)
        self.assertEqual(self.client.get("/featured").status_code, 200)
