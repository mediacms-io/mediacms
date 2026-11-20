from django.http import HttpResponse
from django.test import RequestFactory, TestCase, override_settings

from cms.middleware import ApprovalMiddleware
from tests.users.test_users_approval import (
    APPROVAL_BACKENDS,
    APPROVAL_MIDDLEWARE,
    PASSWORD,
    make_user,
)

APPROVAL_URLCONF = "tests.users.test_users_approval"


class FailedLoginLoggingTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("logme")
        cls.user.is_approved = True
        cls.user.save()

    def assert_no_identity(self, output):
        for line in output:
            self.assertNotIn(self.user.username, line)
            self.assertNotIn(self.user.email, line)
            self.assertNotIn(PASSWORD, line)
            self.assertNotIn("wrongpass", line)

    def test_web_login_with_wrong_password_logs_outcome_and_ip_only(self):
        with self.assertLogs("users.adapter", level="WARNING") as logs:
            self.client.post("/accounts/login/", {"login": self.user.username, "password": "wrongpass"}, REMOTE_ADDR="203.0.113.7")
        self.assertEqual(len(logs.output), 1)
        self.assertIn("invalid_credentials, ip=203.0.113.7", logs.output[0])
        self.assert_no_identity(logs.output)

    def test_web_login_with_unknown_user_logs_the_same_outcome(self):
        with self.assertLogs("users.adapter", level="WARNING") as logs:
            self.client.post("/accounts/login/", {"login": "nobody_here", "password": "wrongpass"}, REMOTE_ADDR="203.0.113.8")
        self.assertEqual(len(logs.output), 1)
        self.assertIn("invalid_credentials, ip=203.0.113.8", logs.output[0])
        self.assertNotIn("nobody_here", logs.output[0])

    def test_api_login_with_wrong_password_logs_outcome_and_ip_only(self):
        with self.assertLogs("users.serializers", level="WARNING") as logs:
            response = self.client.post("/api/v1/login", {"username": self.user.username, "password": "wrongpass"}, REMOTE_ADDR="203.0.113.9")
        self.assertEqual(response.status_code, 400)
        self.assertIn("invalid_credentials, ip=203.0.113.9", logs.output[0])
        self.assert_no_identity(logs.output)

    def test_api_login_with_unknown_user_logs_the_same_outcome(self):
        with self.assertLogs("users.serializers", level="WARNING") as logs:
            self.client.post("/api/v1/login", {"username": "nobody_here", "password": "wrongpass"})
        self.assertIn("invalid_credentials", logs.output[0])
        self.assertNotIn("nobody_here", logs.output[0])

    def test_api_login_of_inactive_user_logs_outcome_and_ip_only(self):
        self.user.is_active = False
        self.user.save()
        with self.assertLogs("users.serializers", level="WARNING") as logs:
            self.client.post("/api/v1/login", {"username": self.user.username, "password": PASSWORD}, REMOTE_ADDR="203.0.113.10")
        joined = "\n".join(logs.output)
        self.assertTrue("user_inactive, ip=203.0.113.10" in joined or "invalid_credentials, ip=203.0.113.10" in joined)
        self.assert_no_identity(logs.output)

    def test_successful_api_login_is_logged(self):
        with self.assertLogs("users.views", level="INFO") as logs:
            response = self.client.post("/api/v1/login", {"username": self.user.username, "password": PASSWORD}, REMOTE_ADDR="203.0.113.11")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Login successful", logs.output[0])
        self.assertIn("ip=203.0.113.11", logs.output[0])
        self.assertNotIn(PASSWORD, logs.output[0])

    def test_successful_web_login_and_logout_are_logged(self):
        with self.assertLogs("users.models", level="INFO") as logs:
            self.client.post("/accounts/login/", {"login": self.user.username, "password": PASSWORD})
            self.client.post("/accounts/logout/")
        joined = "\n".join(logs.output)
        self.assertIn("Login successful (django-allauth)", joined)
        self.assertIn("Logout (django-allauth)", joined)


@override_settings(ROOT_URLCONF=APPROVAL_URLCONF, USERS_NEEDS_TO_BE_APPROVED=True, MIDDLEWARE=APPROVAL_MIDDLEWARE, AUTHENTICATION_BACKENDS=APPROVAL_BACKENDS)
class ApprovalLoggingTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.pending = make_user("pending")
        cls.manager = make_user("manager", is_manager=True)
        cls.manager.is_approved = True
        cls.manager.save()

    def test_unapproved_login_is_logged(self):
        with self.assertLogs("users.adapter", level="WARNING") as logs:
            self.client.post("/accounts/login/", {"login": self.pending.username, "password": PASSWORD})
        self.assertIn(f"Login of unapproved user (django-allauth) - user_id={self.pending.id}", logs.output[0])

    def test_approval_middleware_block_is_logged(self):
        request = RequestFactory().get("/featured")
        request.user = self.pending
        with self.assertLogs("cms.middleware", level="WARNING") as logs:
            ApprovalMiddleware(lambda request: HttpResponse("passed"))(request)
        self.assertIn("User access blocked - approval required", logs.output[0])
        self.assertIn("path=/featured", logs.output[0])

    def test_api_login_of_unapproved_user_logs_outcome_and_ip_only(self):
        with self.assertLogs("users.serializers", level="WARNING") as logs:
            self.client.post("/api/v1/login", {"username": self.pending.username, "password": PASSWORD}, REMOTE_ADDR="203.0.113.12")
        self.assertIn("user_not_approved, ip=203.0.113.12", logs.output[0])
        self.assertNotIn(self.pending.username, logs.output[0])

    def test_manager_approval_is_logged(self):
        self.client.force_login(self.manager)
        with self.assertLogs("users.views", level="INFO") as logs:
            self.client.put(f"/api/v1/users/{self.pending.username}", "action=approve_user", content_type="application/x-www-form-urlencoded")
        self.assertIn(f"User approved - user_id={self.pending.id}", logs.output[0])
