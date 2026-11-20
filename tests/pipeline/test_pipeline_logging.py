from django.test import TestCase

from files import tasks
from files.models import Category, Media
from files.tests import create_account, create_media
from tests.pipeline.test_pipeline_upload import IMAGE, PASSWORD, read_fixture, upload


class TaskLoggingTest(TestCase):
    def test_missing_media_is_logged_by_media_init(self):
        with self.assertLogs("files.tasks", level="WARNING") as logs:
            self.assertFalse(tasks.media_init("doesnotexist"))
        self.assertIn("Media not found for initialization - friendly_token=doesnotexist", logs.output[0])

    def test_missing_encoding_is_logged_by_encode_media(self):
        with self.assertLogs("files.tasks", level="WARNING") as logs:
            self.assertFalse(tasks.encode_media("doesnotexist", 1, 987654))
        self.assertTrue(any("encoding_id not found: 987654" in line for line in logs.output))


class UploadLoggingTest(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.user = create_account(password=PASSWORD)

    def setUp(self):
        self.client.login(username=self.user.username, password=PASSWORD)

    def test_successful_upload_is_logged(self):
        with self.assertLogs("uploader.views", level="INFO") as logs:
            response = upload(self.client, read_fixture(IMAGE), "pipeline_logged.png")
        self.assertEqual(response.status_code, 200)
        media = Media.objects.get(user=self.user, title="pipeline_logged.png")
        self.assertIn(f"Media uploaded - user_id={self.user.id}, friendly_token={media.friendly_token}", logs.output[0])

    def test_invalid_upload_form_is_logged(self):
        with self.assertLogs("uploader.views", level="WARNING") as logs:
            response = self.client.post("/fu/upload/", {})
        self.assertEqual(response.status_code, 400)
        self.assertIn("Upload form validation failed", logs.output[0])


class ModelSignalLoggingTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = create_account()

    def test_media_create_and_delete_are_logged(self):
        with self.assertLogs("files.models.media", level="INFO") as logs:
            media = create_media(self.user)
            token = media.friendly_token
            media.delete()
        joined = "\n".join(logs.output)
        self.assertIn(f"Media created - friendly_token={token}", joined)
        self.assertIn(f"Media deletion completed - friendly_token={token}", joined)

    def test_media_category_change_is_logged(self):
        media = create_media(self.user)
        category = Category.objects.create(title="Logged category")
        with self.assertLogs("files.models.media", level="INFO") as logs:
            media.category.add(category)
        self.assertTrue(any("Media category added" in line and "Logged category" in line for line in logs.output))

    def test_category_create_is_logged(self):
        with self.assertLogs("files.models.category", level="INFO") as logs:
            Category.objects.create(title="Another category")
        self.assertIn("Another category", logs.output[0])
