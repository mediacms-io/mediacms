import json

from django.conf import settings
from django.core import mail
from django.test import Client, TestCase, override_settings

from files.methods import notify_user_on_comment
from files.tests import create_account, create_media

PASSWORD = "comment-notify-password"


class CommentAddedNotificationTests(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        self.owner = create_account(username="comment_owner", email="comment_owner@example.com", password=PASSWORD)
        self.commenter = create_account(username="comment_writer", email="comment_writer@example.com", password=PASSWORD)
        self.media = create_media(self.owner, title="commented media")
        self.client = Client()
        mail.outbox = []

    def post_comment(self, user, text):
        self.client.login(username=user.username, password=PASSWORD)
        return self.client.post(f"/api/v1/media/{self.media.friendly_token}/comments", data=json.dumps({"text": text}), content_type="application/json")

    def test_media_owner_is_emailed_when_someone_comments(self):
        response = self.post_comment(self.commenter, "nice video")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.subject, f"[{settings.PORTAL_NAME}] - A comment was added")
        self.assertEqual(message.to, [self.owner.email])
        self.assertIn(self.media.title, message.body)
        self.assertIn(settings.SSL_FRONTEND_HOST + self.media.get_absolute_url(), message.body)

    def test_owner_commenting_on_own_media_is_not_emailed(self):
        response = self.post_comment(self.owner, "my own comment")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(mail.outbox, [])

    def test_owner_who_opted_out_is_not_emailed(self):
        self.owner.notification_on_comments = False
        self.owner.save()

        response = self.post_comment(self.commenter, "nobody hears this")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(mail.outbox, [])

    @override_settings(ALLOW_MENTION_IN_COMMENTS=True)
    def test_mentioned_users_are_emailed_alongside_the_owner(self):
        mentioned = create_account(username="comment_mentioned", email="comment_mentioned@example.com")
        mail.outbox = []

        response = self.post_comment(self.commenter, "look @(_comment_mentioned_)")

        self.assertEqual(response.status_code, 201)
        recipients = sorted(message.to[0] for message in mail.outbox)
        self.assertEqual(recipients, sorted([self.owner.email, mentioned.email]))

    def test_rejected_comment_sends_nothing(self):
        self.media.enable_comments = False
        self.media.save()

        response = self.post_comment(self.commenter, "comments are closed")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(mail.outbox, [])

    def test_unknown_media_is_not_notified(self):
        self.assertFalse(notify_user_on_comment("doesnotexist"))
        self.assertEqual(mail.outbox, [])
