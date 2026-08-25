from unittest import mock

from django.core.files import File
from django.test import TestCase

from files.models import Encoding, Media
from files.tests import create_account
from users.models import User


class TestDoNotTranscodeFlag(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        self.user = create_account()

    def _media(self, do_not_transcode):
        media = Media(user=self.user, title="migrated video")
        if do_not_transcode:
            media._do_not_transcode = True
        with open("fixtures/small_video.mp4", "rb") as fh:
            media.media_file.save(content=File(fh), name="small_video.mp4", save=False)
        media.save()
        return media

    def test_flag_skips_encoding(self):
        media = self._media(do_not_transcode=True)
        self.assertEqual(Encoding.objects.filter(media=media).count(), 0)
        self.assertEqual(media.encoding_status, "success")

    def test_without_the_flag_encoding_still_happens(self):
        media = self._media(do_not_transcode=False)
        self.assertGreater(Encoding.objects.filter(media=media).count(), 0)


class TestSkipAdminNotification(TestCase):
    def test_flag_suppresses_the_admin_email(self):
        with mock.patch("users.models.EmailMessage") as email:
            user = User(username="migrated1", email="migrated1@example.edu")
            user._skip_admin_notification = True
            user.save()
        email.assert_not_called()

    def test_without_the_flag_the_email_is_still_sent(self):
        with mock.patch("users.models.EmailMessage") as email:
            User.objects.create(username="signedup1", email="signedup1@example.edu")
        email.assert_called_once()

    def test_the_default_channel_is_created_either_way(self):
        user = User(username="migrated2", email="migrated2@example.edu")
        user._skip_admin_notification = True
        user.save()
        self.assertEqual(user.channels.count(), 1)
