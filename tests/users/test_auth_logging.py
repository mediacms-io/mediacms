import logging

from allauth.account.models import EmailAddress
from allauth.account.signals import email_confirmed, password_reset, user_signed_up
from django.http import HttpResponse
from django.test import RequestFactory, TestCase, override_settings

from cms.middleware import ApprovalMiddleware
from files.models import Comment, Media
from files.tests import create_media
from tests.users.test_users_approval import (
    APPROVAL_BACKENDS,
    APPROVAL_MIDDLEWARE,
    PASSWORD,
    make_user,
)
from users.models import User

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
        with self.assertLogs("users.serializers", level="INFO") as logs:
            response = self.client.post("/api/v1/login", {"username": self.user.username, "password": PASSWORD}, REMOTE_ADDR="203.0.113.11")
        self.assertEqual(response.status_code, 200)
        self.assertIn(f"Login successful - user_id={self.user.id}, ip=203.0.113.11", logs.output[0])
        self.assert_no_identity(logs.output)

    def test_successful_web_login_and_logout_are_logged(self):
        with self.assertLogs("users.models", level="INFO") as logs:
            self.client.post("/accounts/login/", {"login": self.user.username, "password": PASSWORD})
            self.client.post("/accounts/logout/")
        joined = "\n".join(logs.output)
        self.assertIn(f"Login successful (django-allauth) - user_id={self.user.id}", joined)
        self.assertIn(f"Logout (django-allauth) - user_id={self.user.id}", joined)
        self.assert_no_identity(logs.output)


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
        self.assertIn(f"user_id={self.pending.id}, path=/featured", logs.output[0])
        self.assertNotIn(self.pending.username, logs.output[0])

    def test_api_login_of_unapproved_user_logs_outcome_and_ip_only(self):
        with self.assertLogs("users.serializers", level="WARNING") as logs:
            self.client.post("/api/v1/login", {"username": self.pending.username, "password": PASSWORD}, REMOTE_ADDR="203.0.113.12")
        self.assertIn("user_not_approved, ip=203.0.113.12", logs.output[0])
        self.assertNotIn(self.pending.username, logs.output[0])

    def test_manager_approval_is_logged(self):
        self.client.force_login(self.manager)
        with self.assertLogs("users.views", level="INFO") as logs:
            self.client.put(f"/api/v1/users/{self.pending.username}", "action=approve_user", content_type="application/x-www-form-urlencoded")
        self.assertIn(f"User approved - user_id={self.pending.id}, approved_by_user_id={self.manager.id}", logs.output[0])
        self.assertNotIn(self.pending.username, logs.output[0])
        self.assertNotIn(self.manager.username, logs.output[0])


class NoEmailInLogsTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.manager = make_user("mgr", is_manager=True)
        cls.manager.is_approved = True
        cls.manager.save()

    def assert_no_email_or_username(self, records, users):
        for record in records:
            message = record.getMessage()
            self.assertNotIn("@example.com", message)
            if record.levelno >= logging.INFO:
                for user in users:
                    self.assertNotIn(user.username, message)

    def test_account_lifecycle_logs_never_contain_emails_or_usernames(self):
        with self.assertLogs(level="DEBUG") as logs:
            user = make_user("lifecycle")
            user_signed_up.send(sender=User, request=None, user=user)
            email_confirmed.send(sender=EmailAddress, request=None, email_address=EmailAddress(user=user, email=user.email))
            password_reset.send(sender=User, request=None, user=user)
            self.client.post("/api/v1/login", {"username": user.username, "password": PASSWORD})
            self.client.post("/api/v1/login", {"username": user.username, "password": "wrongpass"})
            self.client.post("/accounts/login/", {"login": user.email, "password": "wrongpass"})
            self.client.force_login(self.manager)
            self.client.put(f"/api/v1/users/{user.username}", "action=approve_user", content_type="application/x-www-form-urlencoded")
            media = create_media(user)
            Comment.objects.create(user=user, media=media, text="logged comment")
            self.client.delete(f"/api/v1/manage_comments?comment_ids={Comment.objects.get(media=media).uid}")
            self.client.delete(f"/api/v1/manage_media?tokens={media.friendly_token}")
            self.client.delete(f"/api/v1/manage_users?tokens={user.username}")
        self.assertFalse(User.objects.filter(id=user.id).exists())
        self.assertFalse(Media.objects.filter(id=media.id).exists())
        messages = "\n".join(record.getMessage() for record in logs.records)
        self.assertIn(f"User registered - user_id={user.id}", messages)
        self.assertIn(f"Account signup (django-allauth) - user_id={user.id}", messages)
        self.assertIn(f"Password reset requested - user_id={user.id}", messages)
        self.assertIn(f"User deletion - user_id={user.id}", messages)
        self.assertIn("Admin action: users deleted - count=1", messages)
        self.assertIn("Admin action: media deleted - count=1", messages)
        self.assertIn("Admin action: comments deleted - count=1", messages)
        self.assert_no_email_or_username(logs.records, [user, self.manager])

    @override_settings(ROOT_URLCONF=APPROVAL_URLCONF, USERS_NEEDS_TO_BE_APPROVED=True)
    def test_approval_middleware_log_has_no_email_or_username(self):
        pending = make_user("pendingmw")
        request = RequestFactory().get("/featured")
        request.user = pending
        with self.assertLogs(level="DEBUG") as logs:
            ApprovalMiddleware(lambda request: HttpResponse("passed"))(request)
        self.assert_no_email_or_username(logs.records, [pending])
