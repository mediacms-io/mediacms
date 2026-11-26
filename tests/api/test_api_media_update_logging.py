from django.test import TestCase
from rest_framework.test import APIClient

from files.models import Media
from files.tests import create_account, create_media


class MediaUpdateLoggingTest(TestCase):
    def setUp(self):
        self.owner = create_account()
        self.media = create_media(self.owner, title="original title", state="private")
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def put(self, data):
        return self.client.put(f"/api/v1/media/{self.media.friendly_token}", data, format="multipart")

    def test_unknown_request_keys_do_not_evaluate_media_properties(self):
        Media.objects.filter(pk=self.media.pk).update(media_type="video", media_file="")
        response = self.put({"title": "probe", "trim_video_url": "x", "hls_info": "x", "encodings_info": "x"})
        self.assertEqual(response.status_code, 201)
        self.media.refresh_from_db()
        self.assertEqual(self.media.title, "probe")

    def test_only_changed_validated_fields_are_logged(self):
        with self.assertLogs("files.views.media", level="INFO") as logs:
            self.put({"title": "new title", "description": self.media.description, "trim_video_url": "x"})
        self.assertEqual(len(logs.output), 1)
        self.assertIn("changed_fields=['title']", logs.output[0])
        self.assertIn(f"request_user_id={self.owner.id}", logs.output[0])
