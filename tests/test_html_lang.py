from django.conf import settings
from django.test import TestCase


class TestHtmlLangAttribute(TestCase):
    """The html lang attribute follows the active language"""

    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def test_default_language(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<html lang="en"')

    def test_language_from_cookie(self):
        self.client.cookies[settings.LANGUAGE_COOKIE_NAME] = "fr"
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<html lang="fr"')
        self.assertNotContains(response, '<html lang="en"')
