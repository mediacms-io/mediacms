from unittest import mock

from django.conf import settings
from django.test import TestCase

from files.models import EncodeProfile, Encoding, Media


class TestEncodeWithoutProfiles(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def long_video(self):
        # not saved: encode() only reads these attributes
        return Media(
            friendly_token="notsaved01",
            media_type="video",
            duration=settings.CHUNKIZE_VIDEO_DURATION + 60,
            video_height=720,
        )

    def test_no_chunking_when_no_profile_is_active(self):
        EncodeProfile.objects.update(active=False)
        media = self.long_video()

        with mock.patch("files.tasks.chunkize_media.delay") as chunkize, mock.patch("files.tasks.encode_media.apply_async") as encode_media:
            media.encode()

        chunkize.assert_not_called()
        encode_media.assert_not_called()
        self.assertEqual(Encoding.objects.count(), 0)

    def test_chunking_still_happens_with_active_profiles(self):
        # the gif profile is encoded outside the chunks and needs a saved media
        EncodeProfile.objects.filter(extension="gif").update(active=False)
        self.assertTrue(EncodeProfile.objects.filter(active=True).exists())
        media = self.long_video()

        with mock.patch("files.tasks.chunkize_media.delay") as chunkize, mock.patch("files.tasks.encode_media.apply_async"):
            media.encode()

        chunkize.assert_called_once()
