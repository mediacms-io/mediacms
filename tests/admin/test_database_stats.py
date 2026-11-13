import gzip
import json
import re
from datetime import timedelta
from unittest.mock import patch

from django.core import serializers
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from actions.models import MediaAction
from admin_customizations.database_backup import database_backup_filename
from admin_customizations.database_stats import get_database_statistics
from files.models import EncodeProfile, Encoding, TranscriptionRequest, VideoTrimRequest
from files.tests import create_account, create_media
from users.models import User

BACKUP_NAME = re.compile(r"mediacms-database-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json\.gz")
LIMITATION = (
    "Does not export non-audit media actions (watch, like, dislike, and similar). "
    "Only reports and audit records are exported. Failed encodings, trim requests, "
    "and caption requests are not exported. Sessions, notifications, and operational logs are not exported."
)


class DatabaseStatisticsTest(TestCase):
    def test_postgres_snapshot_includes_health_counters(self):
        stats = get_database_statistics()
        labels = [row["label"] for row in stats["rows"]]
        self.assertTrue(stats["available"])
        self.assertIn(stats["status"], ("ok", "warn", "fail"))
        self.assertIn("Server version", labels)
        self.assertIn("Cache hit ratio", labels)
        self.assertIn("Connections used", labels)
        self.assertIn("Transaction ID age", labels)
        self.assertTrue(stats["summary"]["database_size"])

    def test_non_postgres_is_unavailable(self):
        with patch("admin_customizations.database_stats.connection") as conn:
            conn.vendor = "sqlite"
            stats = get_database_statistics()
        self.assertFalse(stats["available"])
        self.assertEqual(stats["rows"][0]["value"], "Unavailable")
        self.assertEqual(stats["health_checks"][0]["status"], "fail")
        self.assertEqual(stats["health_counts"]["fail"], 1)

    def test_connection_pressure_is_a_failure(self):
        def fake(sql):
            if "pg_stat_activity" in sql:
                return {
                    "total_connections": 95,
                    "active": 1,
                    "idle": 94,
                    "idle_in_xact": 0,
                    "long_running": 0,
                    "max_connections": 100,
                }
            if "datfrozenxid" in sql:
                return {
                    "server_version": "17.0",
                    "uptime": timedelta(hours=1),
                    "database_size": "8 MB",
                    "xid_age": 10,
                }
            if "pg_stat_database" in sql:
                return {
                    "numbackends": 1,
                    "xact_commit": 1,
                    "xact_rollback": 0,
                    "deadlocks": 0,
                    "temp_files": 0,
                    "temp_size": "0 bytes",
                    "blks_hit": 100,
                    "blks_read": 0,
                    "stats_reset": None,
                }
            if "pg_stat_checkpointer" in sql:
                return {"checkpoints_timed": 3, "checkpoints_req": 1}
            if "pg_stat_replication" in sql:
                return {"replicas": 0, "replay_lag": None}
            return None

        with patch("admin_customizations.database_stats._query", side_effect=fake):
            stats = get_database_statistics()
        self.assertEqual(stats["status"], "fail")
        self.assertEqual(stats["summary"]["connections_used"], "95.0%")
        self.assertEqual(stats["summary"]["cache_hit"], "100.00%")
        checks = {check["id"]: check for check in stats["health_checks"]}
        self.assertEqual(checks["connection_use"]["status"], "fail")
        self.assertEqual(checks["idle_in_transaction"]["status"], "ok")
        self.assertEqual(checks["cache_hit_ratio"]["status"], "info")
        self.assertEqual(checks["replication_lag"]["status"], "info")
        self.assertEqual(stats["health_counts"]["fail"], 1)
        self.assertIn("Using 95 of 100 connections (95.0%).", checks["connection_use"]["detail"])


@override_settings(SECURE_SSL_REDIRECT=False)
class DatabaseDashboardTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = create_account(username="database_page_admin", is_superuser=True)
        cls.staff = create_account(username="database_page_staff")
        cls.staff.is_staff = True
        cls.staff.save(update_fields=["is_staff"])
        cls.media = create_media(cls.admin, title="database backup media")
        profile = EncodeProfile.objects.create(name="Backup profile", extension="mp4")
        cls.success = Encoding.objects.create(media=cls.media, profile=profile, status="success", chunk=False)
        cls.failed = Encoding.objects.create(media=cls.media, profile=profile, status="fail", chunk=False)
        cls.trim = VideoTrimRequest.objects.create(
            media=cls.media,
            status="initial",
            video_action="replace",
            timestamps=[{"startTime": 0, "endTime": 1}],
        )
        cls.caption = TranscriptionRequest.objects.create(media=cls.media, status="pending")
        MediaAction.objects.create(user=cls.admin, media=cls.media, action="like")
        MediaAction.objects.create(user=cls.admin, media=cls.media, action="watch")
        MediaAction.objects.create(user=cls.admin, media=cls.media, action="report", extra_info="keep me")
        MediaAction.objects.create(user=cls.admin, media=cls.media, action="report_cleared")

    def test_database_page_follows_system_and_notes_limits(self):
        self.client.force_login(self.admin)
        response = self.client.get(reverse("admin:dashboard_section", args=["database"]))
        self.assertEqual(response.status_code, 200)
        content = response.content.decode()
        self.assertIn(LIMITATION, content)
        self.assertIn("Health checks", content)
        self.assertIn("Connection use", content)
        self.assertIn("Cache hit ratio", content)
        self.assertIn("Database restore", content)
        self.assertIn("Database restore is turned off until this database is an initial installation.", content)
        self.assertNotIn('name="backup_file"', content)
        self.assertIn('<details class="card card-outline card-secondary database-restore mb-0">', content)
        self.assertIn(reverse("admin:database_backup"), content)
        switcher = content.split('class="dashboard-switcher', 1)[1]
        system_url = reverse("admin:dashboard_section", args=["system"])
        database_url = reverse("admin:dashboard_section", args=["database"])
        self.assertLess(switcher.find(system_url), switcher.find(database_url))

        self.client.force_login(self.staff)
        staff_page = self.client.get(reverse("admin:dashboard_section", args=["database"]))
        self.assertEqual(staff_page.status_code, 200)
        self.assertContains(staff_page, LIMITATION)
        self.assertContains(staff_page, "Only a superuser can restore a database backup.")
        self.assertNotContains(staff_page, reverse("admin:database_backup"))
        self.assertNotContains(staff_page, 'name="backup_file"')

    def test_backup_omits_operational_rows_and_stamps_the_filename(self):
        self.client.force_login(self.staff)
        denied = self.client.get(reverse("admin:database_backup"))
        self.assertEqual(denied.status_code, 403)

        before = timezone.localtime()
        self.client.force_login(self.admin)
        response = self.client.get(reverse("admin:database_backup"))
        after = timezone.localtime()
        self.assertEqual(response.status_code, 200)
        disposition = response["Content-Disposition"]
        match = BACKUP_NAME.search(disposition)
        self.assertIsNotNone(match)
        stamped = match.group(0)
        self.assertIn(stamped, {database_backup_filename(before), database_backup_filename(after)})

        payload = b"".join(response.streaming_content)
        objects = json.loads(gzip.decompress(payload))
        actions = [item["fields"]["action"] for item in objects if item["model"] == "actions.mediaaction" and item["fields"]["media"] == self.media.pk]
        self.assertCountEqual(actions, ["report", "report_cleared"])
        encodings = [item for item in objects if item["model"] == "files.encoding" and item["fields"]["media"] == self.media.pk]
        self.assertEqual([item["pk"] for item in encodings], [self.success.pk])
        self.assertFalse(any(item["model"] == "files.videotrimrequest" and item["pk"] == self.trim.pk for item in objects))
        self.assertFalse(any(item["model"] == "files.transcriptionrequest" and item["pk"] == self.caption.pk for item in objects))
        self.assertNotIn(self.failed.pk, [item["pk"] for item in encodings])


@override_settings(SECURE_SSL_REDIRECT=False)
class DatabaseRestoreTest(TestCase):
    def setUp(self):
        EncodeProfile.objects.all().delete()
        self.admin = create_account(username="restore_admin", password="restore-pass-1", is_superuser=True)
        self.channel = self.admin.channels.get()

    def _backup(self, extra=None):
        from django.contrib.sites.models import Site

        from files.models.category import Category

        category = Category.objects.create(title="Restored", uid="restore-uid-1")
        payload = serializers.serialize("json", [Site.objects.get(pk=1), self.admin, self.channel, category])
        category.delete()
        objects = json.loads(payload)
        objects.extend(extra or [])
        raw = gzip.compress(json.dumps(objects).encode("utf-8"))
        return SimpleUploadedFile(
            "mediacms-database-backup-2026-11-13-1416.json.gz",
            raw,
            content_type="application/gzip",
        )

    def test_initial_installation_accepts_a_backup(self):
        from admin_customizations.database_restore import vanilla_install_status
        from files.models.category import Category
        from users.models import Channel

        self.assertEqual(vanilla_install_status()["blockers"], [])
        self.client.force_login(self.admin)
        response = self.client.post(reverse("admin:database_restore"), {"backup_file": self._backup()})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse("admin:login"))
        self.assertTrue(Category.objects.filter(uid="restore-uid-1").exists())
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(Channel.objects.count(), 1)
        self.assertTrue(self.client.login(username="restore_admin", password="restore-pass-1"))

    def test_extra_user_keeps_the_database_unchanged(self):
        from files.models.category import Category

        create_account(username="restore_member")
        self.client.force_login(self.admin)
        response = self.client.post(reverse("admin:database_restore"), {"backup_file": self._backup()})
        self.assertRedirects(response, reverse("admin:dashboard_section", args=["database"]))
        self.assertFalse(Category.objects.filter(uid="restore-uid-1").exists())
        self.assertTrue(User.objects.filter(username="restore_member").exists())

    def test_failed_encoding_and_plain_text_are_rejected(self):
        from files.models.category import Category

        self.client.force_login(self.admin)
        failed = self._backup(extra=[{"model": "files.encoding", "pk": 1, "fields": {"status": "fail"}}])
        response = self.client.post(reverse("admin:database_restore"), {"backup_file": failed})
        self.assertRedirects(response, reverse("admin:dashboard_section", args=["database"]))
        self.assertTrue(User.objects.filter(username="restore_admin").exists())
        self.assertFalse(Category.objects.filter(uid="restore-uid-1").exists())

        notes = SimpleUploadedFile("notes.txt", b"not a backup", content_type="text/plain")
        self.client.post(reverse("admin:database_restore"), {"backup_file": notes})
        page = self.client.get(reverse("admin:dashboard_section", args=["database"]))
        self.assertContains(page, "The file is not a gzipped database backup.")

    def test_staff_cannot_restore(self):
        staff = create_account(username="restore_staff")
        staff.is_staff = True
        staff.save(update_fields=["is_staff"])
        self.client.force_login(staff)
        response = self.client.post(reverse("admin:database_restore"), {"backup_file": self._backup()})
        self.assertEqual(response.status_code, 403)
