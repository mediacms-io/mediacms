import re
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
    get_site_health_checks,
    get_system_statistics,
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
        audit_actions = {item["action"]: item for item in stats["recent_report_audits"]}
        self.assertTrue(set(audit_actions).issubset({"report_cleared", "report_confirmed", "media_unreviewed", "original_deleted"}))
        self.assertNotIn("report", audit_actions)
        self.assertNotIn("media_reviewed", audit_actions)
        self.assertNotIn("metadata_refresh", audit_actions)
        self.assertNotIn("integrity_warning", audit_actions)
        self.assertEqual(audit_actions["report_cleared"]["action_icon"], "fas fa-broom")
        self.assertEqual(audit_actions["report_cleared"]["action_modifier"], "success")
        self.assertEqual(audit_actions["report_confirmed"]["action_icon"], "fas fa-user-shield")
        self.assertEqual(audit_actions["report_confirmed"]["action_modifier"], "fail")
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
        self.assertIn("object_totals", stats["system"])
        self.assertIn("health_checks", stats["system"])
        self.assertIn("configuration", stats["system"])
        self.assertIn("health_counts", stats["system"])

    @override_settings(PORTAL_NAME="Health Portal", FRONTEND_HOST="https://health.example.com")
    def test_site_health_checks_compare_site_and_portal_settings(self):
        from django.contrib.sites.models import Site

        site = Site.objects.get_current()
        site.name = "Wrong Name"
        site.domain = "other.example.com"
        site.save(update_fields=["name", "domain"])

        checks = {check["id"]: check for check in get_site_health_checks()}
        self.assertEqual(checks["site_name"]["status"], "warn")
        self.assertIn("Wrong Name", checks["site_name"]["detail"])
        self.assertIn("Health Portal", checks["site_name"]["detail"])
        self.assertEqual(checks["site_domain"]["status"], "warn")
        self.assertIn("health.example.com", checks["site_domain"]["detail"])

        site.name = "Health Portal"
        site.domain = "health.example.com"
        site.save(update_fields=["name", "domain"])
        checks = {check["id"]: check for check in get_site_health_checks()}
        self.assertEqual(checks["site_name"]["status"], "ok")
        self.assertEqual(checks["site_domain"]["status"], "ok")

        system = get_system_statistics()
        totals = {item["label"]: item for item in system["object_totals"]}
        for expected in ("Media", "Users", "Comments", "Categories", "Channels", "Encode profiles"):
            self.assertIn(expected, totals)
        self.assertEqual(totals["Media"]["icon"], "fas fa-video")
        self.assertEqual(totals["Users"]["icon"], "fas fa-users")
        self.assertEqual(totals["Captions"]["icon"], "fas fa-closed-captioning")
        self.assertEqual(totals["Trim Requests"]["icon"], "fas fa-cut")
        self.assertEqual(totals["Media permissions"]["icon"], "fas fa-user-lock")
        self.assertTrue(all(item.get("icon") for item in totals.values()))
        self.assertGreaterEqual(len(system["configuration"]), 10)

    @override_settings(EMAIL_USE_TLS=True, EMAIL_USE_SSL=True)
    def test_site_health_fails_when_email_tls_and_ssl_both_enabled(self):
        checks = {check["id"]: check for check in get_site_health_checks()}
        self.assertEqual(checks["email_tls_ssl"]["status"], "fail")
        self.assertIn("both True", checks["email_tls_ssl"]["detail"])

    @override_settings(EMAIL_USE_TLS=False, EMAIL_USE_SSL=True)
    def test_site_health_ok_when_only_email_ssl_enabled(self):
        checks = {check["id"]: check for check in get_site_health_checks()}
        self.assertEqual(checks["email_tls_ssl"]["status"], "ok")
        self.assertIn("EMAIL_USE_SSL is True", checks["email_tls_ssl"]["detail"])

    @override_settings(EMAIL_USE_TLS=True, EMAIL_USE_SSL=True, DEBUG=True)
    def test_site_health_checks_sorted_by_severity(self):
        statuses = [check["status"] for check in get_site_health_checks()]
        severity_order = {"fail": 0, "warn": 1, "info": 2, "ok": 3}
        ranked = [severity_order[status] for status in statuses]
        self.assertEqual(ranked, sorted(ranked))
        self.assertIn("fail", statuses)
        self.assertIn("warn", statuses)

    def test_calculate_statistics_caches_payload_and_skips_db_on_hit(self):
        first = calculate_statistics(force_refresh=True)
        self.assertIsNotNone(cache.get(DASHBOARD_STATS_CACHE_KEY))
        with CaptureQueriesContext(connection) as ctx:
            second = calculate_statistics()
        self.assertEqual(len(ctx), 0)
        self.assertEqual(second["media"]["total"], first["media"]["total"])
        self.assertEqual(second["generated_at"], first["generated_at"])
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

        index = self.client.get(reverse("admin:index"))
        self.assertEqual(index.status_code, 200)
        index_content = index.content.decode()
        self.assertIn(reverse("admin:dashboard_section", args=["moderation"]), index_content)
        self.assertNotIn(reverse("admin:dashboard_section", args=["reports"]), index_content)
        self.assertNotIn(reverse("admin:dashboard_section", args=["approval"]), index_content)
        self.assertIn(reverse("admin:dashboard_section", args=["people"]), index_content)
        self.assertIn(reverse("admin:dashboard_section", args=["library"]), index_content)
        self.assertIn(reverse("admin:dashboard_section", args=["processing"]), index_content)
        self.assertIn(reverse("admin:dashboard_section", args=["engagement"]), index_content)
        self.assertNotIn(reverse("admin:dashboard_section", args=["site"]), index_content)
        self.assertNotIn("Top uploaders by count", index_content)
        self.assertNotIn("Most liked media", index_content)

        moderation = self.client.get(reverse("admin:dashboard_section", args=["moderation"]))
        people = self.client.get(reverse("admin:dashboard_section", args=["people"]))
        library = self.client.get(reverse("admin:dashboard_section", args=["library"]))
        processing = self.client.get(reverse("admin:dashboard_section", args=["processing"]))
        engagement = self.client.get(reverse("admin:dashboard_section", args=["engagement"]))
        for response in (moderation, people, library, processing, engagement):
            self.assertEqual(response.status_code, 200)

        content = moderation.content.decode() + people.content.decode() + library.content.decode() + processing.content.decode() + engagement.content.decode()
        self.assertNotIn('class="btn btn-xs btn-primary"', content)
        self.assertNotIn('class="btn btn-sm btn-outline-info"', content)
        self.assertIn("Open on site", content)

        media_change = reverse("admin:files_media_change", args=[self.media.pk])
        self.assertIn(f"{media_change}#audit-log-tab", content)
        self.assertIn("Open reported media", content)
        self.assertIn("Open above report limit", content)
        actions = reverse("admin:actions_mediaaction_changelist")
        self.assertIn(f"{actions}?action__exact=report", content)
        self.assertIn(f"{actions}?action__exact=media_reviewed", content)
        moderation_html = moderation.content.decode()
        self.assertIn(f'href="{actions}?action__exact=report"', moderation_html)
        self.assertIn(f'href="{actions}?action__exact=media_reviewed"', moderation_html)
        self.assertLess(moderation_html.find('id="moderation-reports"'), moderation_html.find('id="moderation-approval"'))
        self.assertLess(moderation_html.find("Recent reports"), moderation_html.find("Recent pending review"))
        self.assertRegex(moderation_html, rf'href="{re.escape(media_change)}#audit-log-tab"[^>]*>\s*{re.escape(self.media.title)}')
        self.assertIn(reverse("admin:users_user_change", args=[self.admin.pk]), content)

        media_list = reverse("admin:files_media_changelist")
        for status in ("pending", "running", "success", "fail"):
            self.assertIn(f"{media_list}?encoding_status__exact={status}", processing.content.decode())

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
        people_content = people.content.decode()
        self.assertIn(f"{users_list}?joined=7d", people_content)
        self.assertIn(f"{users_list}?activity=30d", people_content)
        self.assertIn(f"{users_list}?is_active__exact=0", people_content)
        self.assertIn(f"{users_list}?is_superuser__exact=1", people_content)
        self.assertIn(f"{users_list}?is_staff__exact=1", people_content)
        self.assertIn(f"{users_list}?is_editor__exact=1", people_content)
        self.assertIn(f"{users_list}?is_manager__exact=1", people_content)
        self.assertIn(f"{users_list}?role=regular", people_content)
        self.assertIn("Top uploaders by count", people_content)
        self.assertIn("Top uploaders by size", people_content)
        self.assertIn("Recently registered", people_content)
        self.assertIn("User activity", people_content)
        engagement_content = engagement.content.decode()
        self.assertIn(f'{actions}?action__exact=like"', engagement_content)
        self.assertIn(f'{actions}?action__exact=dislike"', engagement_content)
        self.assertIn(f'{actions}?action__exact=watch"', engagement_content)

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


@override_settings(SECURE_SSL_REDIRECT=False)
class DashboardIndexOrderTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = create_account(username="dash_index_admin", is_superuser=True)

    def setUp(self):
        invalidate_dashboard_stats_cache()
        self.client.force_login(self.admin)

    def test_admin_index_is_slim_health_overview(self):
        response = self.client.get(reverse("admin:index"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "fa-heartbeat")
        self.assertContains(response, "fa-chart-bar")
        self.assertContains(response, "Reported media")
        self.assertContains(response, "Failed encodings")
        self.assertContains(response, "Encoding queue")
        self.assertContains(response, "Site check warnings")
        self.assertContains(response, reverse("admin:dashboard_section", args=["health"]))
        self.assertContains(response, reverse("admin:dashboard_section", args=["moderation"]))
        self.assertNotContains(response, reverse("admin:dashboard_section", args=["reports"]))
        self.assertNotContains(response, reverse("admin:dashboard_section", args=["approval"]))
        self.assertContains(response, reverse("admin:dashboard_section", args=["people"]))
        self.assertContains(response, reverse("admin:dashboard_section", args=["library"]))
        self.assertContains(response, reverse("admin:dashboard_section", args=["processing"]))
        self.assertContains(response, reverse("admin:dashboard_section", args=["engagement"]))
        self.assertNotContains(response, reverse("admin:dashboard_section", args=["site"]))
        self.assertNotContains(response, "Recent video uploads")
        self.assertNotContains(response, "Most liked media")
        self.assertNotContains(response, "Top uploaders by count")
        self.assertNotContains(response, "Encoding failures")
        self.assertNotContains(response, "Needs Review")

    def test_dashboard_section_pages_keep_detailed_tables(self):
        media = create_media(self.admin, title="dash audit icon media")
        MediaAction.objects.create(user=self.admin, media=media, action="report_cleared")
        invalidate_dashboard_stats_cache()
        moderation = self.client.get(reverse("admin:dashboard_section", args=["moderation"]))
        removed_reports = self.client.get(reverse("admin:dashboard_section", args=["reports"]))
        removed_approval = self.client.get(reverse("admin:dashboard_section", args=["approval"]))
        people = self.client.get(reverse("admin:dashboard_section", args=["people"]))
        library = self.client.get(reverse("admin:dashboard_section", args=["library"]))
        processing = self.client.get(reverse("admin:dashboard_section", args=["processing"]))
        engagement = self.client.get(reverse("admin:dashboard_section", args=["engagement"]))
        site = self.client.get(reverse("admin:dashboard_section", args=["site"]))
        for response in (moderation, people, library, processing, engagement):
            self.assertEqual(response.status_code, 200)
        self.assertEqual(removed_reports.status_code, 404)
        self.assertEqual(removed_approval.status_code, 404)
        self.assertEqual(site.status_code, 404)

        self.assertContains(moderation, "Reports cleared (7 days)")
        self.assertContains(moderation, "Reports confirmed (7 days)")
        self.assertContains(moderation, "Media approved (7 days)")
        self.assertContains(moderation, "Recent pending review")
        self.assertContains(moderation, "Recent reports")
        self.assertContains(moderation, "Recent report actions")
        self.assertContains(moderation, "fas fa-broom")
        self.assertContains(moderation, 'aria-label="Report cleared"')
        self.assertContains(moderation, "Recently approved")
        self.assertContains(moderation, "Media not reviewed")
        self.assertNotContains(moderation, "Recent confirmed reports")
        self.assertNotContains(moderation, "Recent cleared reports")
        self.assertNotContains(moderation, "Recent media reviews")
        self.assertNotContains(moderation, "Top reviewers")

        moderation_content = moderation.content.decode()
        recent_reports = moderation_content.find("Recent reports")
        audits = moderation_content.find("Recent report actions")
        pending_review = moderation_content.find("Recent pending review")
        self.assertGreater(audits, recent_reports)
        self.assertGreater(pending_review, audits)
        self.assertLess(moderation_content.find('id="moderation-reports"'), moderation_content.find('id="moderation-approval"'))

        self.assertContains(moderation, "Passing checks")
        self.assertContains(moderation, "Open reports")
        self.assertContains(moderation, "Reports above limit")
        self.assertContains(moderation, "Media waiting for review")
        self.assertContains(moderation, '<details class="dashboard-collapse card card-outline card-secondary">')
        self.assertLess(moderation_content.find("Passing checks"), recent_reports)
        self.assertContains(people, "Passing checks")
        self.assertContains(people, "Inactive users")
        self.assertContains(people, '<details class="dashboard-collapse')
        self.assertContains(library, "Passing checks")
        self.assertContains(library, "Listable flag mismatch")
        self.assertContains(engagement, "Passing checks")
        self.assertContains(engagement, "Recent comments")
        self.assertContains(engagement, '<details class="dashboard-collapse')
        self.assertContains(processing, "Passing checks")
        self.assertContains(processing, "Encoding failures")
        self.assertContains(library, "Total media")
        self.assertContains(library, "Categories")
        self.assertContains(library, "Tags")
        self.assertContains(library, "Playlists")
        self.assertContains(library, "Channels")
        self.assertContains(library, "Featured")
        self.assertContains(library, "New media (7 days)")
        self.assertContains(library, "Duplicate md5sum")
        self.assertContains(library, "Duplicate names")
        self.assertContains(library, "integrity=duplicate_md5")
        self.assertContains(library, "integrity=duplicate_name")
        self.assertContains(library, "Media by type")
        self.assertContains(library, "Recent video uploads")
        self.assertContains(library, "Recent audio uploads")
        self.assertContains(library, "Recent image uploads")
        self.assertContains(library, "Recent PDF uploads")
        self.assertNotContains(library, "Encoding status")
        self.assertIn("added_last_7_days", calculate_statistics()["media"])
        self.assertIn("duplicate_md5", calculate_statistics()["media"])
        self.assertIn("duplicate_names", calculate_statistics()["media"])
        self.assertIn("total_tags", calculate_statistics()["system"])
        self.assertContains(processing, "Failed encodings")
        self.assertContains(processing, "Encoding queue")
        self.assertContains(processing, "encoding-queue-breakdown")
        self.assertNotContains(processing, "Encoding status")
        self.assertNotContains(processing, "Recent video uploads")
        self.assertContains(engagement, "Most liked media")
        health = self.client.get(reverse("admin:dashboard_section", args=["health"]))
        configuration = self.client.get(reverse("admin:dashboard_section", args=["configuration"]))
        system = self.client.get(reverse("admin:dashboard_section", args=["system"]))
        support = self.client.get(reverse("admin:dashboard_section", args=["support"]))
        self.assertEqual(health.status_code, 200)
        self.assertEqual(configuration.status_code, 200)
        self.assertEqual(system.status_code, 200)
        self.assertEqual(support.status_code, 200)
        self.assertContains(system, "Passing checks")
        self.assertContains(system, "Cache / Redis reachable")
        self.assertContains(system, '<details class="dashboard-collapse card card-outline card-secondary">')
        self.assertContains(health, "Health checks")
        self.assertContains(health, "Passing checks")
        self.assertContains(health, "Warnings")
        self.assertContains(health, "Failures")
        self.assertContains(health, "Info checks")
        self.assertContains(health, 'id="health-checks"')
        self.assertContains(health, "Site name matches PORTAL_NAME")
        self.assertContains(health, "Duplicate md5sum")
        self.assertContains(health, "Duplicate names")
        self.assertContains(health, "integrity=duplicate_md5")
        self.assertContains(health, "integrity=duplicate_name")
        self.assertContains(health, "Copy text")
        self.assertContains(health, "Copy CSV")
        self.assertContains(health, "Copy Markdown")
        self.assertContains(configuration, "Passing checks")
        self.assertContains(configuration, "Health checks")
        self.assertContains(configuration, 'id="configuration-health-checks"')
        configuration_counts = configuration.context["dashboard_stats"]["system"]["configuration_counts"]
        if configuration_counts["fail"] or configuration_counts["warn"]:
            self.assertContains(configuration, 'id="configuration-health-checks" open')
        else:
            self.assertNotContains(configuration, 'id="configuration-health-checks" open')
        self.assertContains(configuration, "Site name matches PORTAL_NAME")
        self.assertContains(configuration, "Configuration")
        self.assertContains(configuration, "PORTAL_NAME")
        self.assertContains(configuration, "PORTAL_WORKFLOW")
        self.assertContains(configuration, "Copy CSV")
        self.assertContains(
            configuration,
            '<details class="card card-outline card-info dashboard-collapse mb-0">',
        )
        configuration_body = configuration.content.decode()
        self.assertLess(
            configuration_body.find("Health checks"),
            configuration_body.find("PORTAL_WORKFLOW"),
        )
        self.assertContains(system, "Python")
        self.assertContains(system, "MediaCMS installation")
        system_body = system.content.decode()
        self.assertLess(system_body.find("MediaCMS installation"), system_body.find("Python"))
        if 'id="mediacms-installation"' in system_body:
            self.assertNotIn('id="mediacms-installation" open', system_body)
        self.assertContains(system, "Copy Markdown")
        self.assertContains(support, "Get Support")
        self.assertContains(support, "Download as text")
        self.assertContains(support, "Download as Markdown")
        self.assertContains(support, "Missing translation")
        self.assertContains(support, "Transcoding failure")
        self.assertContains(support, "Media not viewable")
        self.assertContains(support, "Emails not sent")
        self.assertContains(support, "Reverse proxy")
        self.assertContains(support, "Other / general")
        self.assertContains(health, "Expand all")
        self.assertContains(health, "Collapse all")
        self.assertContains(health, reverse("admin:dashboard_section", args=["support"]))
        self.assertNotContains(library, "Top Videos by Duration")
        self.assertNotContains(moderation, "Needs Review")

    @override_settings(DEBUG=True, EMAIL_USE_TLS=False, EMAIL_USE_SSL=False)
    def test_health_check_table_opens_for_a_warning(self):
        invalidate_dashboard_stats_cache()
        configuration = self.client.get(reverse("admin:dashboard_section", args=["configuration"]))
        self.assertEqual(configuration.status_code, 200)
        counts = configuration.context["dashboard_stats"]["system"]["configuration_counts"]
        self.assertGreater(counts["warn"], 0)
        self.assertContains(configuration, 'id="configuration-health-checks" open')

    @override_settings(EMAIL_USE_TLS=True, EMAIL_USE_SSL=True)
    def test_health_check_table_opens_for_a_failure(self):
        invalidate_dashboard_stats_cache()
        configuration = self.client.get(reverse("admin:dashboard_section", args=["configuration"]))
        self.assertEqual(configuration.status_code, 200)
        self.assertContains(configuration, 'id="configuration-health-checks" open')

    def test_integrations_overview_is_before_site(self):
        index = self.client.get(reverse("admin:index"))
        integrations = self.client.get(reverse("admin:dashboard_section", args=["integrations"]))
        self.assertEqual(index.status_code, 200)
        self.assertEqual(integrations.status_code, 200)
        self.assertContains(integrations, "Migrations")
        self.assertContains(integrations, "Migration records")
        self.assertContains(integrations, "Pending")
        self.assertContains(integrations, "Error")
        self.assertContains(integrations, "Failed")
        self.assertContains(integrations, "Migration errors")
        self.assertContains(integrations, "Migration record failures")
        self.assertContains(integrations, "Health checks")
        self.assertNotContains(integrations, "Social apps")
        self.assertNotContains(integrations, "LTI Platforms")
        self.assertContains(index, "Migrations Pending")
        self.assertContains(index, "Migration records Failed")
        self.assertContains(index, "Passing checks")
        self.assertNotContains(index, "FRONTEND_HOST")
        self.assertNotContains(index, "ffmpeg")
        integrations_url = reverse("admin:dashboard_section", args=["integrations"])
        health_url = reverse("admin:dashboard_section", args=["health"])
        content = integrations.content.decode()
        self.assertLess(content.find(integrations_url), content.find(health_url))
        self.assertNotIn(reverse("admin:dashboard_section", args=["site"]), index.content.decode())
        self.assertIn("migrations_in_error", calculate_statistics()["integrations"])

    @override_settings(USE_IDENTITY_PROVIDERS=True, USE_SAML=True, USE_LTI=True)
    def test_integrations_overview_lists_enabled_objects(self):
        import importlib

        from django.contrib import admin
        from django.urls import clear_url_caches, set_urlconf

        import cms.urls
        from identity_providers.admin import (
            IdentityProviderUserLogAdmin,
            LoginOptionAdmin,
        )
        from identity_providers.models import IdentityProviderUserLog, LoginOption
        from saml_auth.admin import SAMLConfigurationAdmin
        from saml_auth.models import SAMLConfiguration

        def reload_admin_urls():
            importlib.reload(cms.urls)
            clear_url_caches()
            set_urlconf(None)

        registered = []
        for model, model_admin in (
            (LoginOption, LoginOptionAdmin),
            (IdentityProviderUserLog, IdentityProviderUserLogAdmin),
            (SAMLConfiguration, SAMLConfigurationAdmin),
        ):
            if model not in admin.site._registry:
                admin.site.register(model, model_admin)
                registered.append(model)
        reload_admin_urls()
        invalidate_dashboard_stats_cache()
        try:
            response = self.client.get(reverse("admin:dashboard_section", args=["integrations"]))
            self.assertEqual(response.status_code, 200)
            self.assertContains(response, "Social apps")
            self.assertContains(response, "Social accounts")
            self.assertContains(response, "Login Options")
            self.assertContains(response, "Active login options")
            self.assertContains(response, "Identity Provider User Logs")
            self.assertContains(response, "Identity provider logs (7 days)")
            self.assertContains(response, "active__exact=1")
            self.assertContains(response, "SAML Configurations")
            self.assertContains(response, "LTI Platforms")
            self.assertContains(response, "LTI Resource Links")
            self.assertContains(response, "LTI User Mappings")
            self.assertContains(response, "LTI Role Mappings")
            self.assertContains(response, "LTI Tool Keys")
            self.assertContains(response, "LTI Launch Logs")
            self.assertContains(response, "Successful launches")
            self.assertContains(response, "Failed launches")
            self.assertContains(response, "Launches (7 days)")
            self.assertContains(response, "success__exact=0")
            self.assertContains(response, reverse("admin:socialaccount_socialapp_changelist"))
            self.assertContains(response, reverse("admin:identity_providers_loginoption_changelist"))
            self.assertContains(response, reverse("admin:saml_auth_samlconfiguration_changelist"))
            self.assertContains(response, reverse("admin:lti_ltiplatform_changelist"))
            index = self.client.get(reverse("admin:index"))
            self.assertContains(index, "Social accounts")
            self.assertContains(index, "LTI Platforms")
            self.assertContains(index, "Failed launches")
        finally:
            for model in registered:
                admin.site.unregister(model)
            reload_admin_urls()
            invalidate_dashboard_stats_cache()
