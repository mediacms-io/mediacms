from django.test import TestCase

from actions.models import MODERATION_MEDIA_ACTIONS, PUBLIC_USER_MEDIA_ACTIONS, MediaAction
from files.methods import clear_media_reports, confirm_media_reports, record_moderation_action, set_media_reviewed
from files.models import Media
from files.tasks import VALID_USER_ACTIONS, save_user_action
from files.tests import create_account, create_media


class ModerationMediaActionTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.moderator = create_account(username="mod_actions_mod", is_editor=True)
        cls.media = create_media(cls.moderator, title="moderation actions media")

    def test_public_valid_actions_exclude_moderation_types(self):
        public = {name for name, _ in PUBLIC_USER_MEDIA_ACTIONS}
        moderation = {name for name, _ in MODERATION_MEDIA_ACTIONS}
        self.assertTrue(public.isdisjoint(moderation))
        self.assertEqual(set(VALID_USER_ACTIONS), public)
        self.assertTrue(moderation.isdisjoint(VALID_USER_ACTIONS))

    def test_save_user_action_rejects_moderation_types(self):
        actor = {"user_id": self.moderator.id, "remote_ip_addr": "127.0.0.1"}
        for action in ("report_cleared", "report_confirmed", "media_reviewed", "media_unreviewed", "original_deleted"):
            self.assertFalse(save_user_action(actor, friendly_token=self.media.friendly_token, action=action))
        self.assertFalse(MediaAction.objects.filter(media=self.media, action__in=dict(MODERATION_MEDIA_ACTIONS)).exists())

    def test_original_deleted_is_a_moderation_action(self):
        self.assertIn("original_deleted", dict(MODERATION_MEDIA_ACTIONS))
        event = record_moderation_action(self.moderator, self.media, "original_deleted", extra_info="deleted original file: x.mp4")
        self.assertIsNotNone(event)
        self.assertEqual(event.action, "original_deleted")
        self.assertEqual(event.user_id, self.moderator.pk)

    def test_clear_media_reports_logs_report_cleared(self):
        MediaAction.objects.create(user=self.moderator, media=self.media, action="report", extra_info="rude")
        self.media.reported_times = 1
        self.media.save(update_fields=["reported_times"])

        from files.models import Media

        clear_media_reports(Media.objects.filter(pk=self.media.pk), user=self.moderator)

        self.media.refresh_from_db()
        self.assertEqual(self.media.reported_times, 0)
        self.assertFalse(MediaAction.objects.filter(media=self.media, action="report").exists())
        event = MediaAction.objects.get(media=self.media, action="report_cleared")
        self.assertEqual(event.user_id, self.moderator.pk)
        self.assertIn("rude", event.extra_info)

    def test_confirm_media_reports_sets_private_and_logs(self):
        MediaAction.objects.create(user=self.moderator, media=self.media, action="report", extra_info="spam")
        self.media.reported_times = 3
        self.media.state = "public"
        self.media.save(update_fields=["reported_times", "state"])

        count = confirm_media_reports(Media.objects.filter(pk=self.media.pk), user=self.moderator)
        self.assertEqual(count, 1)
        self.media.refresh_from_db()
        self.assertEqual(self.media.state, "private")
        self.assertEqual(self.media.reported_times, 3)
        self.assertTrue(MediaAction.objects.filter(media=self.media, action="report").exists())
        event = MediaAction.objects.get(media=self.media, action="report_confirmed")
        self.assertEqual(event.user_id, self.moderator.pk)
        self.assertIn("reported_times=3", event.extra_info)

    def test_set_media_reviewed_logs_only_on_change(self):
        self.media.is_reviewed = False
        self.media.save()

        self.assertTrue(set_media_reviewed(self.media, True, user=self.moderator))
        self.assertFalse(set_media_reviewed(self.media, True, user=self.moderator))
        self.assertEqual(MediaAction.objects.filter(media=self.media, action="media_reviewed").count(), 1)

        self.assertTrue(set_media_reviewed(self.media, False, user=self.moderator))
        self.assertEqual(MediaAction.objects.filter(media=self.media, action="media_unreviewed").count(), 1)

    def test_record_moderation_action_ignores_unknown_actions(self):
        self.assertIsNone(record_moderation_action(self.moderator, self.media, "like"))
        self.assertFalse(MediaAction.objects.filter(media=self.media, action="like").exists())
