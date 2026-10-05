import json

from django.conf import settings
from django.core import mail
from django.test import Client, TestCase, override_settings

from actions.models import MediaAction
from files.methods import notify_users
from files.models import Media
from files.tests import create_account, create_media

PASSWORD = "report-notify-password"
REPORTED_ON = {"MEDIA_ADDED": False, "MEDIA_REPORTED": True}
REPORTED_OFF = {"MEDIA_ADDED": False, "MEDIA_REPORTED": False}


class MediaReportedNotificationTests(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        self.owner = create_account(username="report_owner", email="report_owner@example.com", password=PASSWORD)
        self.reporter = create_account(username="report_reporter", email="report_reporter@example.com", password=PASSWORD)
        self.media = create_media(self.owner, title="reported media")
        self.client = Client()
        self.client.login(username=self.reporter.username, password=PASSWORD)
        mail.outbox = []

    def report(self, reason="offensive content", client=None):
        client = client or self.client
        return client.post(
            f"/api/v1/media/{self.media.friendly_token}/actions",
            data=json.dumps({"type": "report", "extra_info": reason}),
            content_type="application/json",
        )

    @override_settings(ADMINS_NOTIFICATIONS=REPORTED_ON, USERS_NOTIFICATIONS=REPORTED_OFF, ADMIN_EMAIL_LIST=["moderator@example.com"])
    def test_admins_are_emailed_with_the_reason_and_count(self):
        response = self.report("spam link")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.subject, f"[{settings.PORTAL_NAME}] - Media was reported")
        self.assertEqual(message.to, ["moderator@example.com"])
        self.assertIn("Reason: spam link", message.body)
        self.assertIn("Total times this media has been reported: 1", message.body)
        self.assertIn(f"reported {settings.REPORTED_TIMES_THRESHOLD} times", message.body)
        self.assertIn(settings.SSL_FRONTEND_HOST + self.media.get_absolute_url(), message.body)

    @override_settings(ADMINS_NOTIFICATIONS=REPORTED_OFF, USERS_NOTIFICATIONS=REPORTED_ON)
    def test_media_owner_is_emailed(self):
        self.report()

        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.owner.email])
        self.assertEqual(mail.outbox[0].subject, f"[{settings.PORTAL_NAME}] - Media was reported")

    @override_settings(ADMINS_NOTIFICATIONS=REPORTED_ON, USERS_NOTIFICATIONS=REPORTED_ON)
    def test_admins_and_owner_are_both_emailed(self):
        self.report()
        self.assertCountEqual([message.to for message in mail.outbox], [settings.ADMIN_EMAIL_LIST, [self.owner.email]])

    @override_settings(ADMINS_NOTIFICATIONS=REPORTED_OFF, USERS_NOTIFICATIONS=REPORTED_OFF)
    def test_nobody_is_emailed_when_notifications_are_off(self):
        response = self.report()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(mail.outbox, [])
        self.assertEqual(MediaAction.objects.filter(media=self.media, action="report").count(), 1)

    @override_settings(ADMINS_NOTIFICATIONS=REPORTED_ON, USERS_NOTIFICATIONS=REPORTED_ON)
    def test_reporting_twice_notifies_only_once(self):
        self.report()
        self.report()

        self.assertEqual(len(mail.outbox), 2)
        self.assertEqual(Media.objects.get(pk=self.media.pk).reported_times, 1)

    @override_settings(ADMINS_NOTIFICATIONS=REPORTED_ON, USERS_NOTIFICATIONS=REPORTED_OFF, REPORTED_TIMES_THRESHOLD=1)
    def test_media_reaching_the_threshold_becomes_private(self):
        self.report()

        self.assertEqual(Media.objects.get(pk=self.media.pk).state, "private")
        self.assertEqual(len(mail.outbox), 1)

    @override_settings(ADMINS_NOTIFICATIONS=REPORTED_ON, USERS_NOTIFICATIONS=REPORTED_ON)
    def test_anonymous_reports_notify_too(self):
        response = self.report(client=Client(REMOTE_ADDR="10.20.30.40"))

        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(mail.outbox), 2)

    @override_settings(ADMINS_NOTIFICATIONS=REPORTED_ON, USERS_NOTIFICATIONS=REPORTED_ON)
    def test_unknown_action_sends_nothing(self):
        self.assertTrue(notify_users(friendly_token=self.media.friendly_token, action="something_else"))
        self.assertEqual(mail.outbox, [])
