from django.conf import settings
from django.test import TestCase
from django.urls import reverse

from files.frontend_translations import translate_string
from files.tests import create_account

PASSWORD = "admin-language-switcher-password"


class AdminLanguageSwitcherTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = create_account(
            username="admin_lang_switcher",
            email="admin_lang_switcher@example.com",
            password=PASSWORD,
            is_superuser=True,
        )

    def setUp(self):
        self.client.force_login(self.superuser)

    def test_admin_navbar_includes_language_chooser(self):
        response = self.client.get(reverse("admin:index"))
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn('id="jazzy-languagemenu"', html)
        self.assertIn('action="/i18n/setlang/"', html)
        self.assertIn('name="language"', html)
        self.assertIn('value="el"', html)
        self.assertIn('value="es"', html)

    def test_admin_language_switch_sets_cookie_and_translates_dashboard(self):
        admin_url = reverse("admin:index")
        response = self.client.post(
            "/i18n/setlang/",
            {"language": "el", "next": admin_url},
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], admin_url)
        self.assertEqual(response.cookies[settings.LANGUAGE_COOKIE_NAME].value, "el")

        dashboard = self.client.get(admin_url)
        self.assertEqual(dashboard.status_code, 200)
        html = dashboard.content.decode()
        self.assertIn(translate_string("el", "Dashboard"), html)
        self.assertRegex(
            html,
            r'class="dropdown-item\s+active"[^>]*lang="el"|lang="el"[^>]*class="dropdown-item\s+active"',
        )
