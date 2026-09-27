from django.core.files import File
from django.test import Client, TestCase, override_settings

from files.models import Media
from files.tests import create_account


@override_settings(REPORTED_TIMES_THRESHOLD=2)
class TestReportThreshold(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        self.owner = create_account()
        with open("fixtures/test_image2.jpg", "rb") as f:
            self.media = Media.objects.create(title="Reported media", user=self.owner, state="public", encoding_status="success", is_reviewed=True, listable=True, media_file=File(f))
        self.url = f"/api/v1/media/{self.media.friendly_token}/actions"

    def report(self, client):
        response = client.post(self.url, {"type": "report", "extra_info": "test report"}, content_type="application/json")
        self.assertIn(response.status_code, (201, 400))
        return response

    def test_anonymous_reports_do_not_make_media_private(self):
        for i in range(3):
            self.report(Client(REMOTE_ADDR=f"198.51.100.{i + 1}"))
        self.media.refresh_from_db()
        self.assertEqual(self.media.state, "public")

    def test_reports_from_distinct_users_make_media_private(self):
        for _ in range(2):
            client = Client()
            client.force_login(create_account())
            self.assertEqual(self.report(client).status_code, 201)
        self.media.refresh_from_db()
        self.assertEqual(self.media.state, "private")
