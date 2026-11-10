from datetime import timedelta

from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from actions.models import MediaAction
from admin_customizations.admin import (
    calculate_statistics,
    get_media_statistics,
    get_moderation_statistics,
    get_user_statistics,
)
from files.methods import clear_media_reports, confirm_media_reports, set_media_reviewed
from files.models import Media
from files.tests import create_account, create_media


class DashboardStatisticsTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = create_account(username="dash_stats_admin", is_superuser=True, is_editor=True)
        cls.media = create_media(cls.admin, title="dash stats media", encoding_status="fail", featured=True)
        cls.queued = create_media(cls.admin, title="dash stats queued", encoding_status="pending")

    def test_media_stats_expose_failed_queue_featured_without_longest_videos(self):
        stats = get_media_statistics()
        self.assertGreaterEqual(stats["failed"], 1)
        self.assertGreaterEqual(stats["encoding_queue"], 1)
        self.assertGreaterEqual(stats["featured"], 1)
        self.assertNotIn("longest_videos", stats)
        self.assertNotIn("needs_review", stats)
        self.assertEqual(set(stats["recent_by_type"]), {"video", "audio", "image", "pdf"})
        image_titles = [item["title"] for item in stats["recent_by_type"]["image"]]
        self.assertIn(self.media.title, image_titles)
        self.assertLessEqual(len(stats["recent_by_type"]["image"]), 5)

    def test_moderation_stats_include_seven_day_workflow_counts(self):
        MediaAction.objects.create(user=self.admin, media=self.media, action="report", extra_info="spam")
        self.media.reported_times = 1
        self.media.save(update_fields=["reported_times"])
        seven_days_ago = timezone.now() - timedelta(days=7)
        open_report_stats = get_moderation_statistics(seven_days_ago)
        self.assertEqual(open_report_stats["recent_reports"][0]["media_id"], self.media.pk)
        self.assertNotIn("top_reviewers", open_report_stats)

        confirm_media_reports(Media.objects.filter(pk=self.media.pk), user=self.admin)
        clear_media_reports(Media.objects.filter(pk=self.media.pk), user=self.admin)
        self.queued.is_reviewed = False
        self.queued.save(update_fields=["is_reviewed"])
        set_media_reviewed(self.queued, True, user=self.admin)

        stats = get_moderation_statistics(seven_days_ago)
        self.assertGreaterEqual(stats["clears_last_7_days"], 1)
        self.assertGreaterEqual(stats["confirms_last_7_days"], 1)
        self.assertGreaterEqual(stats["approved_last_7_days"], 1)

    @override_settings(USERS_NEEDS_TO_BE_APPROVED=True)
    def test_user_stats_expose_pending_approved_and_recent_pending(self):
        pending = create_account(username="dash_pending_user")
        pending.is_approved = False
        pending.save(update_fields=["is_approved"])
        approved = create_account(username="dash_approved_user")
        approved.is_approved = True
        approved.save(update_fields=["is_approved"])
        seven_days_ago = timezone.now() - timedelta(days=7)
        thirty_days_ago = timezone.now() - timedelta(days=30)

        stats = get_user_statistics(seven_days_ago, thirty_days_ago)
        self.assertTrue(stats["approval_workflow_enabled"])
        self.assertGreaterEqual(stats["pending_approvals"], 1)
        self.assertGreaterEqual(stats["approved_users"], 1)
        pending_ids = {u["id"] for u in stats["recent_pending_users"]}
        self.assertIn(pending.pk, pending_ids)
        self.assertNotIn(approved.pk, pending_ids)

    @override_settings(USERS_NEEDS_TO_BE_APPROVED=False)
    def test_user_stats_hide_approval_workflow_when_disabled(self):
        seven_days_ago = timezone.now() - timedelta(days=7)
        thirty_days_ago = timezone.now() - timedelta(days=30)
        stats = get_user_statistics(seven_days_ago, thirty_days_ago)
        self.assertFalse(stats["approval_workflow_enabled"])
        self.assertEqual(stats["pending_approvals"], 0)
        self.assertEqual(stats["recent_pending_users"], [])

    def test_calculate_statistics_returns_all_sections(self):
        stats = calculate_statistics()
        self.assertIn("media", stats)
        self.assertIn("moderation", stats)
        self.assertIn("users", stats)
        self.assertIn("engagement", stats)
        self.assertIn("system", stats)


class DashboardIndexOrderTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = create_account(username="dash_index_admin", is_superuser=True)

    def setUp(self):
        self.client.force_login(self.admin)

    def test_admin_index_section_order(self):
        response = self.client.get(reverse("admin:index"))
        self.assertEqual(response.status_code, 200)
        content = response.content.decode()
        moderation = content.find("Reported media")
        users = content.find("New users (7 days)")
        media = content.find("Media by type")
        engagement = content.find("Most liked media")
        system = content.find("Encoding failures")
        self.assertGreater(moderation, -1)
        self.assertGreater(users, moderation)
        self.assertGreater(media, users)
        self.assertGreater(engagement, media)
        self.assertGreater(system, engagement)
        self.assertContains(response, "Reports cleared (7 days)")
        self.assertContains(response, "Reports confirmed (7 days)")
        self.assertContains(response, "Media approved (7 days)")
        self.assertContains(response, "Failed encodings")
        self.assertContains(response, "Encoding queue")
        self.assertContains(response, "Recent video uploads")
        self.assertContains(response, "Recent audio uploads")
        self.assertContains(response, "Recent image uploads")
        self.assertContains(response, "Recent PDF uploads")
        self.assertContains(response, "Recent reports")
        self.assertNotContains(response, "Top reviewers")
        self.assertNotContains(response, "Top Videos by Duration")
        self.assertNotContains(response, "Needs Review")
