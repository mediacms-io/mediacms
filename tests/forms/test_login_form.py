from django.conf import settings
from django.test import TestCase, override_settings

from files.tests import create_account

PASSWORD = "login_form_pass_77"


class LoginFormTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = create_account(password=PASSWORD)

    def login(self, login, password=PASSWORD, url="/accounts/login/"):
        return self.client.post(url, {"login": login, "password": password})

    def assertLoggedInAs(self, user):
        self.assertEqual(self.client.get("/api/v1/whoami").json()["username"], user.username)

    def test_login_page_renders_the_form(self):
        response = self.client.get("/accounts/login/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("login", response.context["form"].fields)
        self.assertIn("password", response.context["form"].fields)

    def test_login_with_username_redirects_to_home(self):
        response = self.login(self.user.username)
        self.assertRedirects(response, settings.LOGIN_REDIRECT_URL, fetch_redirect_response=False)
        self.assertLoggedInAs(self.user)

    def test_login_with_email_works(self):
        response = self.login(self.user.email)
        self.assertEqual(response.status_code, 302)
        self.assertLoggedInAs(self.user)

    def test_login_without_trailing_slash_uses_the_same_form(self):
        response = self.login(self.user.username, url="/accounts/login")
        self.assertEqual(response.status_code, 302)
        self.assertLoggedInAs(self.user)

    def test_wrong_password_shows_errors_and_does_not_log_in(self):
        response = self.login(self.user.username, password="not the password")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.context["form"].errors)
        self.assertEqual(self.client.get("/api/v1/whoami").status_code, 403)

    def test_login_redirects_back_to_the_protected_page(self):
        edit_url = f"/user/{self.user.username}/edit"
        response = self.client.get(edit_url)
        self.assertEqual(response.status_code, 302)
        login_url = response["Location"]
        self.assertIn(f"next={edit_url}", login_url)

        response = self.client.post(login_url, {"login": self.user.username, "password": PASSWORD})
        self.assertRedirects(response, edit_url, fetch_redirect_response=False)
        self.assertEqual(self.client.get(edit_url).status_code, 200)

    def test_inactive_user_is_sent_to_the_inactive_page(self):
        inactive = create_account(password=PASSWORD)
        inactive.is_active = False
        inactive.save()
        response = self.login(inactive.username)
        self.assertRedirects(response, "/accounts/inactive/", fetch_redirect_response=False)
        self.assertEqual(self.client.get("/api/v1/whoami").status_code, 403)

    def test_logout_ends_the_session(self):
        self.login(self.user.username)
        response = self.client.post("/accounts/logout/")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(self.client.get("/api/v1/whoami").status_code, 403)

    @override_settings(LOGIN_ALLOWED=False)
    def test_login_button_is_hidden_when_login_is_disallowed(self):
        self.assertFalse(self.client.get("/").context["CAN_LOGIN"])

    def test_login_button_is_shown_by_default(self):
        self.assertTrue(self.client.get("/").context["CAN_LOGIN"])
