from django.test import TestCase, override_settings
from django.urls import reverse

from admin_customizations.admin import get_site_health_checks
from admin_customizations.processing_stats import (
    get_migration_status_groups,
    get_processing_status_groups,
)
from files.models import EncodeProfile, Encoding, TranscriptionRequest, VideoTrimRequest
from files.tests import create_account, create_media
from migrationservice.models import MigrationRecord, MigrationService


def _checks():
    return {check["id"]: check for check in get_site_health_checks()}


class StatusHealthChecksTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = create_account(username="status_health_user")
        cls.media = create_media(cls.user, title="status health media")
        cls.profile = EncodeProfile.objects.create(name="status health profile", extension="mp4", resolution=240, codec="h264")

    def test_failure_statuses_are_ok_when_empty(self):
        checks = _checks()
        for check_id, detail in (
            ("trim_request_failures", "No failed trim requests."),
            ("caption_request_failures", "No failed caption requests."),
            ("encode_job_failures", "No failed encode jobs."),
            ("migration_errors", "No migrations in error."),
            ("migration_record_failures", "No failed migration records."),
        ):
            self.assertEqual(checks[check_id]["status"], "ok")
            self.assertEqual(checks[check_id]["detail"], detail)
            self.assertTrue(checks[check_id]["link"])

    def test_failure_statuses_warn_and_link_to_filtered_changelists(self):
        VideoTrimRequest.objects.create(media=self.media, status="fail", video_action="replace", timestamps=[{"start": 0, "end": 1}])
        VideoTrimRequest.objects.create(media=self.media, status="success", video_action="replace", timestamps=[{"start": 0, "end": 1}])
        TranscriptionRequest.objects.create(media=self.media, status="fail")
        Encoding.objects.create(media=self.media, profile=self.profile, status="fail")
        service = MigrationService.objects.create(name="status health migration", status="error")
        MigrationRecord.objects.create(service=service, object_type="media", source_id="status-health-1", status="failed", log="boom")
        MigrationRecord.objects.create(service=service, object_type="media", source_id="status-health-2", status="success")

        checks = _checks()
        expectations = {
            "trim_request_failures": ("1 trim request(s) failed.", "status__exact=fail"),
            "caption_request_failures": ("1 caption request(s) failed.", "status__exact=fail"),
            "encode_job_failures": ("1 encode job(s) failed.", "status__exact=fail"),
            "migration_errors": ("1 migration(s) ended in error.", "status__exact=error"),
            "migration_record_failures": ("1 migration record(s) failed.", "status__exact=failed"),
        }
        for check_id, (detail, query) in expectations.items():
            self.assertEqual(checks[check_id]["status"], "warn", check_id)
            self.assertEqual(checks[check_id]["detail"], detail)
            self.assertIn(query, checks[check_id]["link"])


@override_settings(SECURE_SSL_REDIRECT=False)
class ProcessingStatusMetricsTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = create_account(username="processing_stats_admin", is_superuser=True, is_staff=True)
        cls.media = create_media(cls.user, title="processing stats media")

    def test_status_groups_count_each_pipeline_status(self):
        VideoTrimRequest.objects.create(media=self.media, status="fail", video_action="replace", timestamps=[{"start": 0, "end": 1}])
        VideoTrimRequest.objects.create(media=self.media, status="initial", video_action="replace", timestamps=[{"start": 0, "end": 1}])
        TranscriptionRequest.objects.create(media=self.media, status="fail")
        TranscriptionRequest.objects.create(media=self.media, status="success")
        service = MigrationService.objects.create(name="processing stats migration", status="error")
        MigrationRecord.objects.create(service=service, object_type="media", source_id="processing-stats-1", status="failed")
        MigrationRecord.objects.create(service=service, object_type="media", source_id="processing-stats-2", status="skipped")

        groups = {group["key"]: group for group in get_processing_status_groups()}
        migrations = {group["key"]: group for group in get_migration_status_groups()}
        self.assertEqual(groups["trim_requests"]["statuses"][0]["key"], "initial")
        counts = {key: {item["key"]: item["count"] for item in group["statuses"]} for key, group in groups.items()}
        migration_counts = {key: {item["key"]: item["count"] for item in group["statuses"]} for key, group in migrations.items()}
        self.assertEqual(counts["trim_requests"]["fail"], 1)
        self.assertEqual(counts["trim_requests"]["initial"], 1)
        self.assertEqual(counts["caption_requests"]["fail"], 1)
        self.assertEqual(counts["caption_requests"]["success"], 1)
        self.assertNotIn("encode_jobs", groups)
        self.assertNotIn("migrations", groups)
        self.assertNotIn("migration_records", groups)
        self.assertEqual(migration_counts["migrations"]["error"], 1)
        self.assertEqual(migration_counts["migration_records"]["failed"], 1)
        self.assertEqual(migration_counts["migration_records"]["skipped"], 1)
        self.assertEqual(migrations["migrations"]["total"], 1)
        self.assertIn("status__exact=fail", groups["trim_requests"]["statuses"][3]["url"])
        self.assertIn("status__exact=error", migrations["migrations"]["statuses"][4]["url"])

    def test_processing_overview_links_each_status(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("admin:dashboard_section", args=["processing"]), {"refresh_stats": "1"})
        self.assertEqual(response.status_code, 200)
        content = response.content.decode()
        for url_name, status in (
            ("admin:files_transcriptionrequest_changelist", "fail"),
            ("admin:files_videotrimrequest_changelist", "initial"),
        ):
            self.assertIn(f"{reverse(url_name)}?status__exact={status}", content)
        self.assertNotIn("status__exact=aborted", content)
        self.assertNotIn("status__exact=skipped", content)
        self.assertNotIn('card-title">Migrations', content)
        self.assertNotIn('card-title">Migration records', content)
        self.assertIn("encoding-queue-breakdown", content)
        self.assertIn("fa-check-circle", content)
        self.assertIn("fa-times-circle", content)
        self.assertNotIn("Encoding status", content)
        self.assertNotIn(f"{reverse('admin:files_encoding_changelist')}?status__exact=pending", content)
        for label in ("Encodings", "Caption Requests", "Trim Requests"):
            self.assertIn(label, content)
        self.assertNotIn("Paused", content)
