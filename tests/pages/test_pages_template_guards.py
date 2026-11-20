import re

from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, TestCase

from files.context_processors import stuff
from files.tests import create_account


class TemplateGuardsTest(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def test_index_without_media_object_has_no_canonical_link(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('rel="canonical"', response.content.decode())

    def test_anonymous_url_config_has_null_edit_profile(self):
        response = self.client.get("/")
        block = re.search(r"MediaCMS\.url = \{(.*?)\};", response.content.decode(), re.S).group(1)
        self.assertRegex(block, r"editProfile:\s*null,")

    def test_authenticated_url_config_has_edit_profile_url(self):
        user = create_account()
        self.client.force_login(user)
        response = self.client.get("/")
        block = re.search(r"MediaCMS\.url = \{(.*?)\};", response.content.decode(), re.S).group(1)
        self.assertIn(f'editProfile: "{user.edit_url()}",', block)

    def test_context_processor_defaults(self):
        request = RequestFactory().get("/")
        request.user = AnonymousUser()
        request.LANGUAGE_CODE = "en"
        context = stuff(request)
        for key in ("CAN_EDIT", "CAN_EDIT_MEDIA", "CAN_DELETE_MEDIA", "CAN_DELETE_COMMENTS", "CAN_DELETE"):
            self.assertIs(context[key], False, key)
        self.assertIsNone(context["media"])
        self.assertIn("current_site", context)
