from django.test import TestCase

from files.models import Subtitle
from files.tests import create_account
from migrationservice.models import MigrationRecord, MigrationService
from migrationservice.tasks import import_media_entry
from migrationservice.tests.fakes import FakeProvider

VIDEO = "fixtures/small_video.mp4"
CAPTION = "migrationservice/tests/fixtures/sample.srt"


def make_service(**options):
    defaults = {
        "create_users": True,
        "migrate_all_categories": True,
        "import_captions": True,
        "skip_transcoding": True,
        "fallback_username": "admin",
    }
    defaults.update(options)
    return MigrationService.objects.create(
        name="Kaltura production",
        provider="kaltura",
        connection={"service_url": "https://kaltura.example.edu", "partner_id": "342", "app_token_id": "atok", "app_token": "x"},
        options=defaults,
    )


def make_provider(captions):
    provider = FakeProvider()
    provider.users = {"jdoe": {"id": "jdoe", "email": "jdoe@example.edu", "fullName": "J Doe", "screenName": "", "roleName": ""}}
    provider.media = {
        "1_a": {
            "entry": {"id": "1_a", "name": "Lecture 4", "userId": "jdoe", "tags": ""},
            "flavors": [{"id": "source", "height": 720, "fileExt": "mp4", "isOriginal": True, "status": 2}],
            "captions": captions,
            "categories": [],
        }
    }
    provider.downloads = {"source": VIDEO, "cap1": CAPTION, "cap2": CAPTION}
    return provider


class TestImportCaptions(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        create_account(username="admin")
        self.service = make_service()

    def test_a_caption_becomes_a_subtitle(self):
        provider = make_provider([{"id": "cap1", "languageCode": "da", "language": "Danish", "format": 1}])
        media = import_media_entry(self.service, provider, "1_a")
        subtitle = Subtitle.objects.get(media=media)
        self.assertEqual(subtitle.language.code, "da")
        self.assertEqual(subtitle.language.title, "Danish")

    def test_the_stored_file_is_webvtt(self):
        provider = make_provider([{"id": "cap1", "languageCode": "da", "language": "Danish", "format": 1}])
        media = import_media_entry(self.service, provider, "1_a")
        subtitle = Subtitle.objects.get(media=media)
        with open(subtitle.subtitle_file.path) as handle:
            self.assertTrue(handle.read().lstrip().startswith("WEBVTT"))

    def test_a_record_is_written_per_caption(self):
        provider = make_provider([{"id": "cap1", "languageCode": "da", "language": "Danish", "format": 1}])
        import_media_entry(self.service, provider, "1_a")
        row = MigrationRecord.objects.get(service=self.service, object_type="caption", source_id="cap1")
        self.assertEqual(row.status, "success")

    def test_two_captions_reuse_one_language_row(self):
        from files.models import Language

        provider = make_provider(
            [
                {"id": "cap1", "languageCode": "da", "language": "Danish", "format": 1},
                {"id": "cap2", "languageCode": "da", "language": "Danish", "format": 1},
            ]
        )
        media = import_media_entry(self.service, provider, "1_a")
        self.assertEqual(Subtitle.objects.filter(media=media).count(), 2)
        self.assertEqual(Language.objects.filter(code="da").count(), 1)

    def test_captions_off_skips_them_entirely(self):
        service = make_service(import_captions=False)
        provider = make_provider([{"id": "cap1", "languageCode": "da", "language": "Danish", "format": 1}])
        media = import_media_entry(service, provider, "1_a")
        self.assertEqual(Subtitle.objects.filter(media=media).count(), 0)

    def test_a_failing_caption_is_recorded_and_the_media_survives(self):
        provider = make_provider([{"id": "missing", "languageCode": "da", "language": "Danish", "format": 1}])
        media = import_media_entry(self.service, provider, "1_a")
        self.assertIsNotNone(media.id)
        row = MigrationRecord.objects.get(service=self.service, object_type="caption", source_id="missing")
        self.assertEqual(row.status, "failed")

    def test_a_caption_with_no_language_code_defaults_to_english(self):
        provider = make_provider([{"id": "cap1", "languageCode": "", "language": "", "format": 1}])
        media = import_media_entry(self.service, provider, "1_a")
        subtitle = Subtitle.objects.get(media=media)
        self.assertEqual(subtitle.language.code, "en")

    def test_a_caption_that_fails_conversion_leaves_no_broken_subtitle(self):
        from unittest import mock

        provider = make_provider([{"id": "cap1", "languageCode": "da", "language": "Danish", "format": 1}])
        with mock.patch("files.models.Subtitle.convert_to_srt", side_effect=Exception("unparseable")):
            media = import_media_entry(self.service, provider, "1_a")

        self.assertEqual(Subtitle.objects.filter(media=media).count(), 0)
        row = MigrationRecord.objects.get(service=self.service, object_type="caption", source_id="cap1")
        self.assertEqual(row.status, "failed")

    def test_a_failing_caption_still_leaves_the_media_fully_imported(self):
        provider = make_provider([{"id": "missing", "languageCode": "da", "language": "Danish", "format": 1}])
        import_media_entry(self.service, provider, "1_a")
        row = MigrationRecord.objects.get(service=self.service, object_type="media", source_id="1_a")
        self.assertEqual(row.status, "success", "the media import did not run to completion")
