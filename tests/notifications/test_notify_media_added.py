from django.conf import settings
from django.core import mail
from django.core.files import File
from django.test import TestCase, override_settings

from files.methods import notify_users
from files.models import Media
from files.tests import create_account, create_media, fixture_path
from files.tests.media_utils import IMAGE

BOTH_ON = {"MEDIA_ADDED": True, "MEDIA_REPORTED": True}
BOTH_OFF = {"MEDIA_ADDED": False, "MEDIA_REPORTED": False}


class MediaAddedNotificationTests(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        self.uploader = create_account(username="added_uploader", email="added_uploader@example.com")
        mail.outbox = []

    def subjects(self):
        return [message.subject for message in mail.outbox]

    @override_settings(ADMINS_NOTIFICATIONS=BOTH_ON, USERS_NOTIFICATIONS=BOTH_OFF, ADMIN_EMAIL_LIST=["admin1@example.com", "admin2@example.com"])
    def test_admins_are_emailed_when_media_is_uploaded(self):
        media = create_media(self.uploader, title="admins see this")

        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.subject, f"[{settings.PORTAL_NAME}] - Media was added")
        self.assertEqual(message.to, ["admin1@example.com", "admin2@example.com"])
        self.assertEqual(message.from_email, settings.DEFAULT_FROM_EMAIL)
        self.assertIn(settings.SSL_FRONTEND_HOST + media.get_absolute_url(), message.body)
        self.assertIn(str(self.uploader), message.body)

    @override_settings(ADMINS_NOTIFICATIONS=BOTH_OFF, USERS_NOTIFICATIONS=BOTH_ON)
    def test_uploader_is_told_the_media_was_added(self):
        media = create_media(self.uploader, title="uploader sees this")

        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.subject, f"[{settings.PORTAL_NAME}] - Your media was added")
        self.assertEqual(message.to, [self.uploader.email])
        self.assertIn(settings.SSL_FRONTEND_HOST + media.get_absolute_url(), message.body)

    @override_settings(ADMINS_NOTIFICATIONS=BOTH_ON, USERS_NOTIFICATIONS=BOTH_ON)
    def test_admins_and_uploader_are_both_emailed(self):
        create_media(self.uploader, title="everyone sees this")
        self.assertCountEqual(self.subjects(), [f"[{settings.PORTAL_NAME}] - Media was added", f"[{settings.PORTAL_NAME}] - Your media was added"])

    @override_settings(ADMINS_NOTIFICATIONS=BOTH_OFF, USERS_NOTIFICATIONS=BOTH_OFF)
    def test_nobody_is_emailed_when_notifications_are_off(self):
        create_media(self.uploader, title="nobody sees this")
        self.assertEqual(mail.outbox, [])

    @override_settings(ADMINS_NOTIFICATIONS=BOTH_ON, USERS_NOTIFICATIONS=BOTH_ON)
    def test_saving_existing_media_does_not_notify_again(self):
        media = create_media(self.uploader, title="saved twice")
        mail.outbox = []

        media.title = "renamed"
        media.save()

        self.assertEqual(mail.outbox, [])

    @override_settings(ADMINS_NOTIFICATIONS=BOTH_ON, USERS_NOTIFICATIONS=BOTH_ON)
    def test_bulk_imports_can_skip_the_notification(self):
        media = Media(user=self.uploader, title="imported")
        media._skip_admin_notification = True
        with open(fixture_path(IMAGE), "rb") as fp:
            media.media_file.save(IMAGE, File(fp), save=False)
        media.save()

        self.assertTrue(Media.objects.filter(pk=media.pk).exists())
        self.assertEqual(mail.outbox, [])

    def test_unknown_media_is_not_notified(self):
        self.assertFalse(notify_users(friendly_token="doesnotexist", action="media_added"))
        self.assertEqual(mail.outbox, [])
