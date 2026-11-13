from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import load_command_class
from django.test import TestCase
from django.utils import timezone

from files.models import Language, Media, Subtitle, TranscriptionRequest
from files.tests import create_account, create_media


class PopulateFakeMediaTranscriptionRequestsTest(TestCase):
    def setUp(self):
        self.command = load_command_class("files", "populate_fake_media")
        self.command._now = timezone.now()
        self.command._horizon_start = self.command._now - timedelta(days=365)
        self.command.stdout = type("Stdout", (), {"write": lambda *args, **kwargs: None})()
        self.user = create_account(username="fake_tx_user", email="fake_tx@example.com", password="x")

    def _video(self, title):
        media = create_media(self.user, title=title)
        Media.objects.filter(pk=media.pk).update(media_type="video", encoding_status="success")
        media.refresh_from_db()
        return media

    def test_captioned_media_gets_success_caption_request(self):
        captioned = self._video("captioned for transcription")
        uncaptioned = self._video("waiting for transcription")
        language = Language.objects.create(code="en", title="English")
        Subtitle.objects.create(
            language=language,
            media=captioned,
            user=self.user,
            subtitle_file=SimpleUploadedFile("captions.vtt", b"WEBVTT\n"),
        )

        created = self.command.create_transcription_requests([captioned, uncaptioned])
        self.assertGreaterEqual(created, 1)
        success = TranscriptionRequest.objects.filter(media=captioned, status="success", translate_to_english=False)
        self.assertEqual(success.count(), 1)
        captioned.refresh_from_db()
        self.assertTrue(captioned.allow_whisper_transcribe)

        open_statuses = set(TranscriptionRequest.objects.filter(media=uncaptioned).values_list("status", flat=True))
        self.assertTrue(open_statuses.issubset({"pending", "running", "fail"}))
