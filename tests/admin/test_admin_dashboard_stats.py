from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone

from actions.models import MediaAction
from admin_customizations.admin import (
    DASHBOARD_STATS_CACHE_KEY,
    calculate_statistics,
    get_media_statistics,
    get_moderation_statistics,
    get_user_statistics,
    invalidate_dashboard_stats_cache,
)
from files.methods import clear_media_reports, confirm_media_reports, set_media_reviewed
from files.models import Comment, Media
from files.tests import create_account, create_media
from users.models import User


class DashboardStatisticsTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = create_account(username="dash_stats_admin", is_superuser=True, is_editor=True)
        cls.media = create_media(cls.admin, title="dash stats media", encoding_status="fail", featured=True)
        cls.queued = create_media(cls.admin, title="dash stats queued", encoding_status="pending")

    def setUp(self):
        invalidate_dashboard_stats_cache()

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
        pending = create_media(self.admin, title="dash pending review")
        Media.objects.filter(pk=pending.pk).update(is_reviewed=False)

        stats = get_moderation_statistics(seven_days_ago)
        self.assertGreaterEqual(stats["clears_last_7_days"], 1)
        self.assertGreaterEqual(stats["confirms_last_7_days"], 1)
        self.assertGreaterEqual(stats["approved_last_7_days"], 1)
        pending_ids = {item["id"] for item in stats["recent_pending_review"]}
        self.assertIn(pending.pk, pending_ids)
        self.assertNotIn("recent_media_reviews", stats)
        self.assertNotIn("recent_report_confirmations", stats)
        self.assertNotIn("recent_report_clears", stats)
        audit_actions = {item["action"] for item in stats["recent_report_audits"]}
        self.assertTrue(audit_actions.issubset({"report_cleared", "report_confirmed", "media_unreviewed", "original_deleted"}))
        self.assertNotIn("report", audit_actions)
        self.assertNotIn("media_reviewed", audit_actions)
        approved_ids = {item["media_id"] for item in stats["recent_approved"]}
        self.assertIn(self.queued.pk, approved_ids)

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

    def test_calculate_statistics_caches_payload_and_skips_db_on_hit(self):
        first = calculate_statistics(force_refresh=True)
        self.assertIsNotNone(cache.get(DASHBOARD_STATS_CACHE_KEY))
        with CaptureQueriesContext(connection) as ctx:
            second = calculate_statistics()
        self.assertEqual(len(ctx), 0)
        self.assertEqual(second["media"]["total"], first["media"]["total"])
        self.assertEqual(second["system"]["encoding_queue"], first["media"]["encoding_queue"])

    def test_calculate_statistics_force_refresh_bypasses_cache(self):
        calculate_statistics(force_refresh=True)
        with patch("admin_customizations.admin.get_media_statistics", wraps=get_media_statistics) as media_stats:
            calculate_statistics(force_refresh=True)
            self.assertEqual(media_stats.call_count, 1)
            calculate_statistics()
            self.assertEqual(media_stats.call_count, 1)

    def test_admin_index_refresh_stats_forces_recompute(self):
        self.client.force_login(self.admin)
        calculate_statistics(force_refresh=True)
        cached_total = cache.get(DASHBOARD_STATS_CACHE_KEY)["media"]["total"]
        create_media(self.admin, title="dash refresh media")

        stale = self.client.get(reverse("admin:index"))
        self.assertEqual(stale.status_code, 200)
        self.assertEqual(stale.context["dashboard_stats"]["media"]["total"], cached_total)

        refreshed = self.client.get(reverse("admin:index"), {"refresh_stats": "1"})
        self.assertEqual(refreshed.status_code, 200)
        self.assertGreater(refreshed.context["dashboard_stats"]["media"]["total"], cached_total)

    def test_dashboard_links_use_item_text_and_filtered_counts(self):
        Comment.objects.create(media=self.media, user=self.admin, text="dash comment")
        MediaAction.objects.create(user=self.admin, media=self.media, action="like")
        MediaAction.objects.create(user=self.admin, media=self.media, action="dislike")
        MediaAction.objects.create(user=self.admin, media=self.media, action="watch")
        MediaAction.objects.create(user=self.admin, media=self.media, action="report", extra_info="dash report")
        self.media.likes = 1
        self.media.dislikes = 1
        self.media.views = 4
        self.media.save(update_fields=["likes", "dislikes", "views"])
        self.client.force_login(self.admin)

        response = self.client.get(reverse("admin:index"))
        self.assertEqual(response.status_code, 200)
        content = response.content.decode()
        self.assertNotIn('class="btn btn-xs btn-primary"', content)
        self.assertNotIn('class="btn btn-sm btn-outline-info"', content)
        self.assertIn("Open on site", content)

        media_change = reverse("admin:files_media_change", args=[self.media.pk])
        self.assertIn(f'<a href="{media_change}">{self.media.title}</a>', content)
        self.assertIn(f"{media_change}#reports-tab", content)
        self.assertIn(reverse("admin:users_user_change", args=[self.admin.pk]), content)

        media_list = reverse("admin:files_media_changelist")
        for status in ("pending", "running", "success", "fail"):
            self.assertIn(f"{media_list}?encoding_status__exact={status}", content)

        actions = reverse("admin:actions_mediaaction_changelist")
        comments = reverse("admin:files_comment_changelist")
        like_url = f"{actions}?action__exact=like&media__id__exact={self.media.pk}"
        dislike_url = f"{actions}?action__exact=dislike&media__id__exact={self.media.pk}"
        watch_url = f"{actions}?action__exact=watch&media__id__exact={self.media.pk}"
        comment_url = f"{comments}?media__id__exact={self.media.pk}"
        user_media_url = f"{media_list}?user__id__exact={self.admin.pk}"
        user_like_url = f"{actions}?action__exact=like&user__id__exact={self.admin.pk}"
        for url in (like_url, dislike_url, watch_url, comment_url, user_media_url, user_like_url):
            self.assertIn(url.replace("&", "&amp;"), content)

        like_response = self.client.get(like_url)
        self.assertEqual({item.action for item in like_response.context["cl"].result_list}, {"like"})
        comment_response = self.client.get(comment_url)
        self.assertEqual({item.text for item in comment_response.context["cl"].result_list}, {"dash comment"})
        pending_response = self.client.get(f"{media_list}?encoding_status__exact=pending")
        pending_titles = {item.title for item in pending_response.context["cl"].result_list}
        self.assertIn(self.queued.title, pending_titles)
        self.assertNotIn(self.media.title, pending_titles)

        users_list = reverse("admin:users_user_changelist")
        self.assertIn(f"{users_list}?joined=7d", content)
        self.assertIn(f"{users_list}?activity=30d", content)
        self.assertIn(f"{users_list}?is_active__exact=0", content)
        self.assertIn(f"{users_list}?is_superuser__exact=1", content)
        self.assertIn(f"{users_list}?is_staff__exact=1", content)
        self.assertIn(f"{users_list}?is_editor__exact=1", content)
        self.assertIn(f"{users_list}?is_manager__exact=1", content)
        self.assertIn(f"{users_list}?role=regular", content)
        self.assertIn("Top uploaders by count", content)
        self.assertIn("Top uploaders by size", content)
        self.assertIn("Recently registered", content)
        self.assertIn("User activity", content)
        self.assertIn(f'{actions}?action__exact=like"', content)
        self.assertIn(f'{actions}?action__exact=dislike"', content)
        self.assertIn(f'{actions}?action__exact=watch"', content)

    def test_top_uploaders_by_size_ranks_parsed_megabytes(self):
        larger = create_account(username="dash_size_user")
        bigger = create_media(larger, title="dash big upload")
        self.media.size = "not-a-size"
        self.queued.size = "4.5MB"
        bigger.size = "20.0MB"
        Media.objects.bulk_update([self.media, self.queued, bigger], ["size"])

        seven_days_ago = timezone.now() - timedelta(days=7)
        thirty_days_ago = timezone.now() - timedelta(days=30)
        ranked = get_user_statistics(seven_days_ago, thirty_days_ago)["top_uploaders_by_size"]
        self.assertEqual(ranked[0]["username"], larger.username)
        self.assertEqual(ranked[0]["upload_size_label"], "20.0 MB")
        self.assertEqual(ranked[1]["username"], self.admin.username)
        self.assertEqual(ranked[1]["upload_size_label"], "4.5 MB")

    def test_user_changelist_filters_new_and_active_users(self):
        recent = create_account(username="dash_recent_user")
        create_media(recent, title="dash recent upload")
        stale = create_account(username="dash_stale_user")
        stale_media = create_media(stale, title="dash stale upload")
        User.objects.filter(pk=stale.pk).update(date_added=timezone.now() - timedelta(days=10))
        Media.objects.filter(pk=stale_media.pk).update(add_date=timezone.now() - timedelta(days=40))
        self.client.force_login(self.admin)

        joined = self.client.get(reverse("admin:users_user_changelist"), {"joined": "7d"})
        joined_names = {user.username for user in joined.context["cl"].result_list}
        self.assertIn(recent.username, joined_names)
        self.assertNotIn(stale.username, joined_names)

        active = self.client.get(reverse("admin:users_user_changelist"), {"activity": "30d"})
        active_names = {user.username for user in active.context["cl"].result_list}
        self.assertIn(recent.username, active_names)
        self.assertNotIn(stale.username, active_names)

    def test_user_role_counts_recent_registered_and_activity(self):
        inactive = create_account(username="dash_inactive_user")
        inactive.is_active = False
        inactive.save(update_fields=["is_active"])
        editor = create_account(username="dash_editor_user", is_editor=True)
        manager = create_account(username="dash_manager_user", is_manager=True)
        staff = create_account(username="dash_staff_user")
        staff.is_staff = True
        staff.save(update_fields=["is_staff"])
        now = timezone.now()
        User.objects.filter(pk=editor.pk).update(last_login=now - timedelta(minutes=5))
        User.objects.filter(pk=manager.pk).update(last_login=now)

        seven_days_ago = timezone.now() - timedelta(days=7)
        thirty_days_ago = timezone.now() - timedelta(days=30)
        stats = get_user_statistics(seven_days_ago, thirty_days_ago)
        self.assertGreaterEqual(stats["inactive_users"], 1)
        self.assertGreaterEqual(stats["superusers"], 1)
        self.assertGreaterEqual(stats["staff_users"], 1)
        self.assertGreaterEqual(stats["editors"], 1)
        self.assertGreaterEqual(stats["managers"], 1)
        self.assertGreaterEqual(stats["regular_users"], 1)
        registered_names = [user["username"] for user in stats["recent_registered"]]
        self.assertEqual(registered_names[0], staff.username)
        self.assertLessEqual(len(stats["recent_registered"]), 10)
        activity_names = [user["username"] for user in stats["recent_activity"]]
        self.assertLessEqual(len(activity_names), 10)
        self.assertIn(editor.username, activity_names)
        self.assertIn(manager.username, activity_names)
        self.assertEqual(activity_names[0], manager.username)

        self.client.force_login(self.admin)
        regular = self.client.get(reverse("admin:users_user_changelist"), {"role": "regular"})
        regular_names = {user.username for user in regular.context["cl"].result_list}
        self.assertIn(inactive.username, regular_names)
        self.assertNotIn(self.admin.username, regular_names)
        self.assertNotIn(editor.username, regular_names)
        self.assertNotIn(manager.username, regular_names)
        self.assertNotIn(staff.username, regular_names)


class DashboardIndexOrderTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = create_account(username="dash_index_admin", is_superuser=True)

    def setUp(self):
        invalidate_dashboard_stats_cache()
        self.client.force_login(self.admin)

    def test_admin_index_section_order(self):
        response = self.client.get(reverse("admin:index"))
        self.assertEqual(response.status_code, 200)
        content = response.content.decode()
        moderation = content.find("Reported media")
        users = content.find("New users (7 days)")
        media = content.find("Media by type")
        engagement = content.find("Most liked media")
        encoding_status = content.find("Encoding status")
        system = content.find("Channels", engagement)
        self.assertGreater(moderation, -1)
        self.assertGreater(users, moderation)
        self.assertGreater(media, users)
        self.assertGreater(encoding_status, media)
        self.assertGreater(engagement, encoding_status)
        self.assertGreater(system, engagement)
        self.assertNotEqual(system, -1)
        self.assertContains(response, "Reports cleared (7 days)")
        self.assertContains(response, "Reports confirmed (7 days)")
        self.assertContains(response, "Media approved (7 days)")
        self.assertContains(response, "Failed encodings")
        self.assertContains(response, "Encoding queue")
        self.assertNotContains(response, "Encoding failures")
        self.assertContains(response, "Recent video uploads")
        self.assertContains(response, "Recent audio uploads")
        self.assertContains(response, "Recent image uploads")
        self.assertContains(response, "Recent PDF uploads")
        self.assertContains(response, "Recent reports")
        self.assertContains(response, "Recent report audit actions")
        self.assertContains(response, "Recent pending review")
        self.assertContains(response, "Recently approved")
        self.assertNotContains(response, "Recent confirmed reports")
        self.assertNotContains(response, "Recent cleared reports")
        self.assertNotContains(response, "Recent media reviews")
        reports = content.find("Recent reports")
        audits = content.find("Recent report audit actions")
        pending = content.find("Recent pending review")
        approved = content.find("Recently approved")
        self.assertGreater(audits, reports)
        self.assertGreater(pending, audits)
        self.assertGreater(approved, pending)
        self.assertNotContains(response, "Top reviewers")
        self.assertNotContains(response, "Top Videos by Duration")
        self.assertNotContains(response, "Needs Review")
