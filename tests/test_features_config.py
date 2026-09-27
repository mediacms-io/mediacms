import re

from django.test import Client, TestCase, override_settings


class TestFeaturesConfig(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def media_action_flags(self):
        response = Client().get("/")
        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        return dict(re.findall(r"^\s*(download|comment):\s*(true|false),", body, re.M))

    def test_flags_default_to_true(self):
        self.assertEqual(self.media_action_flags(), {"download": "true", "comment": "true"})

    @override_settings(CAN_DOWNLOAD_MEDIA=False)
    def test_download_flag_follows_setting(self):
        self.assertEqual(self.media_action_flags(), {"download": "false", "comment": "true"})

    @override_settings(CAN_COMMENT_MEDIA=False)
    def test_comment_flag_follows_setting(self):
        self.assertEqual(self.media_action_flags(), {"download": "true", "comment": "false"})
