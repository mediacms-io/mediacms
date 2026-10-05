import uuid

from allauth.account.models import EmailAddress
from django.core import mail
from django.test import TestCase, override_settings

from files.tests import create_account
from users.models import Channel, User

PASSWORD = "Register!Pass42"


class RegisterFormTest(TestCase):
    def setUp(self):
        token = uuid.uuid4().hex[:8]
        self.data = {"username": f"signup_{token}", "email": f"signup_{token}@example.com", "password1": PASSWORD, "name": "Signed Up Person"}
        mail.outbox = []

    def signup(self, **changes):
        return self.client.post("/accounts/signup/", dict(self.data, **changes))

    def test_signup_page_renders_the_form_with_a_name_field(self):
        response = self.client.get("/accounts/signup/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("name", response.context["form"].fields)

    def test_signup_stores_the_user_and_logs_them_in(self):
        response = self.signup()
        self.assertEqual(response.status_code, 302)
        user = User.objects.get(username=self.data["username"])
        self.assertEqual(user.email, self.data["email"])
        self.assertEqual(user.name, "Signed Up Person")
        self.assertTrue(user.check_password(PASSWORD))
        self.assertFalse(user.is_editor or user.is_manager or user.is_superuser)
        self.assertTrue(Channel.objects.filter(user=user).exists())
        self.assertEqual(self.client.get("/api/v1/whoami").json()["username"], user.username)

    def test_signup_sends_a_confirmation_email(self):
        self.signup()
        address = EmailAddress.objects.get(email=self.data["email"])
        self.assertFalse(address.verified)
        messages = [m for m in mail.outbox if m.to == [self.data["email"]]]
        self.assertEqual(len(messages), 1)
        self.assertIn("/accounts/confirm-email/", messages[0].body)

    @override_settings(SSL_FRONTEND_HOST="https://portal.example.com")
    def test_the_confirmation_link_points_at_the_public_host_not_the_request_host(self):
        self.signup()
        body = next(m.body for m in mail.outbox if m.to == [self.data["email"]])
        self.assertIn("https://portal.example.com/accounts/confirm-email/", body)
        self.assertNotIn("http://testserver/accounts/confirm-email/", body)

    @override_settings(ADMINS_NOTIFICATIONS={"NEW_USER": True}, ADMIN_EMAIL_LIST=["admins@example.com"])
    def test_admins_are_told_about_the_registration(self):
        self.signup()
        self.assertEqual(len([m for m in mail.outbox if m.to == ["admins@example.com"]]), 1)

    @override_settings(USERS_CAN_SELF_REGISTER=False)
    def test_signup_is_closed_when_self_registration_is_disabled(self):
        response = self.client.get("/accounts/signup/")
        self.assertTemplateUsed(response, "account/signup_closed.html")
        response = self.signup()
        self.assertTemplateUsed(response, "account/signup_closed.html")
        self.assertFalse(User.objects.filter(username=self.data["username"]).exists())

    @override_settings(REGISTER_ALLOWED=False)
    def test_register_button_is_hidden_when_registration_is_disallowed(self):
        self.assertFalse(self.client.get("/").context["CAN_REGISTER"])

    @override_settings(RESTRICTED_DOMAINS_FOR_USER_REGISTRATION=["blocked.com"])
    def test_restricted_email_domain_is_refused(self):
        response = self.signup(email=f"{self.data['username']}@blocked.com")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Domain is restricted from registering", response.context["form"].errors["email"])
        self.assertFalse(User.objects.filter(username=self.data["username"]).exists())

    @override_settings(ALLOWED_DOMAINS_FOR_USER_REGISTRATION=["org.com"])
    def test_only_allowed_email_domains_may_register(self):
        response = self.signup()
        self.assertIn("Domain is not in the permitted list", response.context["form"].errors["email"])
        self.assertEqual(self.signup(email=f"{self.data['username']}@org.com").status_code, 302)
        self.assertTrue(User.objects.filter(username=self.data["username"]).exists())

    def test_invalid_usernames_are_refused(self):
        for username in ("has space", "bad/slash", "abc"):
            response = self.signup(username=username)
            self.assertEqual(response.status_code, 200, username)
            self.assertIn("username", response.context["form"].errors, username)
        self.assertFalse(User.objects.filter(email=self.data["email"]).exists())

    def test_taken_username_and_email_are_refused(self):
        existing = create_account()
        response = self.signup(username=existing.username)
        self.assertIn("username", response.context["form"].errors)
        response = self.signup(email=existing.email)
        self.assertIn("email", response.context["form"].errors)
        self.assertFalse(User.objects.filter(username=self.data["username"]).exists())

    def test_weak_password_is_refused(self):
        response = self.signup(password1="123")
        self.assertIn("password1", response.context["form"].errors)
        self.assertFalse(User.objects.filter(username=self.data["username"]).exists())

    def test_name_is_required(self):
        response = self.signup(name="")
        self.assertIn("name", response.context["form"].errors)
        self.assertFalse(User.objects.filter(username=self.data["username"]).exists())
