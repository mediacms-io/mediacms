from unittest import mock

from django.test import TestCase

from files.models import Category, Media
from files.tests import create_account
from migrationservice.models import MigrationRecord, MigrationService
from migrationservice.tasks import (
    abort_migration,
    pause_migration,
    restart_migration,
    start_migration,
)
from migrationservice.tests.fakes import FakeProvider
from users.models import User

VIDEO = "fixtures/small_video.mp4"


def make_service(name="Kaltura production", **options):
    defaults = {
        # these cases describe the on demand behaviour: owners and categories created as
        # the media that need them arrive. TestPhases covers the two sweeping phases.
        "migrate_all_users": False,
        "create_users": True,
        "migrate_all_categories": False,
        "map_permissions": True,
        "import_captions": False,
        "skip_transcoding": True,
        "fallback_username": "admin",
    }
    defaults.update(options)
    return MigrationService.objects.create(
        name=name,
        provider="kaltura",
        connection={"service_url": "https://kaltura.example.edu", "partner_id": "342", "app_token_id": "atok", "app_token": "x", "kms_root_category": "MediaSpace"},
        options=defaults,
    )


def build_provider():
    provider = FakeProvider()
    provider.users = {
        "jdoe": {"id": "jdoe", "email": "jdoe@example.edu", "fullName": "J Doe", "screenName": "", "roleName": ""},
        "asmith": {"id": "asmith", "email": "asmith@example.edu", "fullName": "A Smith", "screenName": "", "roleName": ""},
    }
    provider.categories = {
        "8812": {
            "id": "8812",
            "name": "Electronics",
            "fullName": "MediaSpace>site>galleries>Engineering>Electronics",
            "parentName": "Engineering",
            "privacy": 1,
            "owner": "",
            "members": [],
        }
    }
    provider.media = {}
    for source_id in ["1_a", "1_b"]:
        provider.media[source_id] = {
            "entry": {"id": source_id, "name": f"Lecture {source_id}", "userId": "jdoe", "tags": ""},
            "flavors": [{"id": f"src-{source_id}", "height": 720, "fileExt": "mp4", "isOriginal": True, "status": 2}],
            "captions": [],
            "categories": [{"id": "8812", "privacy": 1}],
        }
        provider.downloads[f"src-{source_id}"] = VIDEO
    return provider


class OrchestratorTestCase(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        create_account(username="admin")
        self.provider = build_provider()
        self.patcher = mock.patch("migrationservice.tasks.get_provider", return_value=self.provider)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)


class TestFullRun(OrchestratorTestCase):
    def test_everything_is_imported_and_the_migration_succeeds(self):
        service = make_service()
        start_migration(service)
        service.refresh_from_db()

        self.assertEqual(service.status, "success")
        self.assertIsNotNone(service.started_at)
        self.assertIsNotNone(service.ended_at)
        self.assertEqual(Media.objects.count(), 2)
        self.assertEqual(MigrationRecord.objects.filter(service=service, object_type="media", status="success").count(), 2)
        # users are created lazily by the media importer, not by a phase
        self.assertEqual(MigrationRecord.objects.filter(service=service, object_type="user", status="success").count(), 1)
        self.assertEqual(MigrationRecord.objects.filter(service=service, object_type="category", status="success").count(), 1)

    def test_totals_are_counted(self):
        service = make_service()
        start_migration(service)
        service.refresh_from_db()
        self.assertEqual(service.counted_totals().get("media_migrated"), 2)

    def test_disabled_phases_are_skipped(self):
        service = make_service(migrate_all_users=False, create_users=False, migrate_all_categories=False)
        start_migration(service)
        service.refresh_from_db()
        self.assertEqual(service.status, "success")
        self.assertEqual(MigrationRecord.objects.filter(service=service, object_type="user").count(), 0)
        self.assertEqual(MigrationRecord.objects.filter(service=service, object_type="category").count(), 0)
        self.assertEqual(Media.objects.count(), 2)

    def test_max_items_caps_the_media_phase(self):
        service = make_service(max_items=1)
        start_migration(service)
        service.refresh_from_db()
        self.assertEqual(service.status, "success")
        self.assertEqual(Media.objects.count(), 1)


class TestPauseAndResume(OrchestratorTestCase):
    def test_a_paused_migration_does_nothing(self):
        service = make_service()
        service.status = "paused"
        service.save(update_fields=["status"])
        from migrationservice.tasks import run_migration

        run_migration(service.pk)
        self.assertEqual(Media.objects.count(), 0)

    def test_pausing_during_the_media_phase_stops_after_the_current_item(self):
        service = make_service()

        def pause_after_first(svc, provider, source_id):
            from migrationservice.tasks import import_media_entry as real

            media = real(svc, provider, source_id)
            svc.refresh_from_db()
            if svc.status == "running":
                pause_migration(svc)
            return media

        with mock.patch("migrationservice.tasks.IMPORTERS", {"media": pause_after_first}):
            start_migration(service)

        service.refresh_from_db()
        self.assertEqual(service.status, "paused")
        self.assertEqual(Media.objects.count(), 1)
        # the cursor must not have advanced past the page, so a resume replays it
        self.assertFalse(service.cursor.get("created_at"))

    def test_resuming_finishes_the_remaining_items(self):
        service = make_service()

        def pause_after_first(svc, provider, source_id):
            from migrationservice.tasks import import_media_entry as real

            media = real(svc, provider, source_id)
            svc.refresh_from_db()
            if svc.status == "running":
                pause_migration(svc)
            return media

        with mock.patch("migrationservice.tasks.IMPORTERS", {"media": pause_after_first}):
            start_migration(service)

        service.refresh_from_db()
        start_migration(service)
        service.refresh_from_db()

        self.assertEqual(service.status, "success")
        self.assertEqual(Media.objects.count(), 2)

    def test_aborting_keeps_what_was_imported(self):
        service = make_service()
        start_migration(service)
        service.refresh_from_db()
        service.status = "running"
        service.save(update_fields=["status"])
        abort_migration(service)
        service.refresh_from_db()
        self.assertEqual(service.status, "aborted")
        self.assertEqual(Media.objects.count(), 2)

    def test_pausing_mid_page_does_not_skip_the_unprocessed_items(self):
        service = make_service()

        def pause_on_first(svc, provider, source_id):
            from migrationservice.tasks import import_media_entry as real

            svc.refresh_from_db()
            if svc.status == "running":
                media = real(svc, provider, source_id)
                pause_migration(svc)
                return media
            return None

        with mock.patch("migrationservice.tasks.IMPORTERS", {"media": pause_on_first}):
            start_migration(service)

        service.refresh_from_db()
        self.assertEqual(service.status, "paused")

        # the cursor must not have moved past the entries that never ran
        start_migration(service)
        service.refresh_from_db()
        self.assertEqual(service.status, "success")
        self.assertEqual(Media.objects.count(), 2, "an entry was skipped by the pause")

    def test_a_second_start_while_running_is_refused(self):
        service = make_service()
        service.status = "running"
        service.save(update_fields=["status"])
        with self.assertRaises(ValueError):
            start_migration(service)

    def test_finishing_does_not_overwrite_a_pause_that_already_landed(self):
        from migrationservice.tasks import finish_migration

        service = make_service()
        service.status = "paused"
        service.save(update_fields=["status"])

        finish_migration(service, "success", "should not stick")

        service.refresh_from_db()
        self.assertEqual(service.status, "paused")
        self.assertIsNone(service.ended_at)


def _noop(service, provider, source_id):
    return None


class TestPhases(OrchestratorTestCase):
    """migrate_all_users and migrate_all_categories each add a sweeping phase before
    media. With both off the same objects are still created, just on demand.
    """

    def test_all_users_are_migrated_before_any_media(self):
        service = make_service(migrate_all_users=True)
        start_migration(service)
        service.refresh_from_db()

        self.assertEqual(service.status, "success")
        users = MigrationRecord.objects.filter(service=service, object_type="user", status="success")
        # asmith owns nothing, and is migrated anyway because the phase sweeps everyone
        self.assertEqual(sorted(users.values_list("source_id", flat=True)), ["asmith", "jdoe"])

    def test_on_demand_only_creates_the_owners(self):
        service = make_service(migrate_all_users=False, create_users=True)
        start_migration(service)

        users = MigrationRecord.objects.filter(service=service, object_type="user", status="success")
        self.assertEqual(list(users.values_list("source_id", flat=True)), ["jdoe"])

    def test_all_categories_are_migrated_even_with_no_media(self):
        self.provider.categories["9900"] = {
            "id": "9900",
            "name": "Empty gallery",
            "fullName": "MediaSpace>site>galleries>Empty gallery",
            "parentName": "galleries",
            "privacy": 1,
            "owner": "",
            "members": [],
        }
        service = make_service(migrate_all_categories=True)
        start_migration(service)
        service.refresh_from_db()

        self.assertEqual(service.status, "success")
        titles = set(Category.objects.values_list("title", flat=True))
        self.assertIn("Empty gallery", titles)

    def test_on_demand_skips_a_category_with_no_media(self):
        self.provider.categories["9900"] = {
            "id": "9900",
            "name": "Empty gallery",
            "fullName": "MediaSpace>site>galleries>Empty gallery",
            "parentName": "galleries",
            "privacy": 1,
            "owner": "",
            "members": [],
        }
        service = make_service(migrate_all_categories=False)
        start_migration(service)

        titles = set(Category.objects.values_list("title", flat=True))
        self.assertNotIn("Empty gallery", titles)
        # the one that does have media is still created
        self.assertIn("Electronics", titles)


class TestRerun(OrchestratorTestCase):
    """A finished run can be swept again to retry what failed."""

    def test_a_re_run_imports_nothing_twice(self):
        service = make_service()
        start_migration(service)
        service.refresh_from_db()
        self.assertEqual(service.status, "success")

        restart_migration(service)
        service.refresh_from_db()

        self.assertEqual(service.status, "success")
        self.assertEqual(Media.objects.count(), 2)
        self.assertEqual(MigrationRecord.objects.filter(service=service, object_type="media").count(), 2)

    def test_a_re_run_retries_a_failed_item_without_touching_the_others(self):
        service = make_service()
        # the source is unreachable for this one entry on the first pass
        broken = self.provider.downloads.pop("src-1_b")
        start_migration(service)
        service.refresh_from_db()

        self.assertEqual(Media.objects.count(), 1)
        self.assertEqual(MigrationRecord.objects.get(service=service, source_id="1_b").status, "failed")

        self.provider.downloads["src-1_b"] = broken
        self.provider.calls = []
        restart_migration(service)
        service.refresh_from_db()

        self.assertEqual(service.status, "success")
        self.assertEqual(Media.objects.count(), 2)
        self.assertEqual(MigrationRecord.objects.get(service=service, source_id="1_b").status, "success")
        # the entry that already came over is skipped without a single source call
        self.assertNotIn(("fetch_media", "1_a"), self.provider.calls)
        self.assertIn(("fetch_media", "1_b"), self.provider.calls)

    def test_a_re_run_picks_up_an_entry_added_since(self):
        service = make_service()
        start_migration(service)

        self.provider.media["1_c"] = {
            "entry": {"id": "1_c", "name": "Lecture 1_c", "userId": "asmith", "tags": ""},
            "flavors": [{"id": "src-1_c", "height": 720, "fileExt": "mp4", "isOriginal": True, "status": 2}],
            "captions": [],
            "categories": [{"id": "8812", "privacy": 1}],
        }
        self.provider.downloads["src-1_c"] = self.provider.downloads["src-1_a"]

        restart_migration(service)
        service.refresh_from_db()

        self.assertEqual(service.status, "success")
        self.assertEqual(Media.objects.count(), 3)

    def test_a_running_migration_cannot_be_re_run(self):
        service = make_service()
        service.status = "running"
        service.save(update_fields=["status"])

        with self.assertRaises(ValueError):
            restart_migration(service)


class TestIdempotency(OrchestratorTestCase):
    def test_running_the_same_migration_twice_imports_nothing_new(self):
        service = make_service()
        start_migration(service)
        service.refresh_from_db()

        service.cursor = {}
        service.status = "pending"
        service.save(update_fields=["cursor", "status"])
        start_migration(service)

        self.assertEqual(Media.objects.count(), 2)
        self.assertEqual(User.objects.filter(email="jdoe@example.edu").count(), 1)

    def test_a_second_migration_on_the_same_source_skips_what_exists(self):
        first = make_service(name="first pass")
        start_migration(first)

        second = make_service(name="second pass")
        start_migration(second)
        second.refresh_from_db()

        self.assertEqual(Media.objects.count(), 2)
        skipped = MigrationRecord.objects.filter(service=second, object_type="media", status="skipped")
        self.assertEqual(skipped.count(), 2)
        self.assertIn("first pass", skipped.first().log)

    def test_a_second_migration_does_not_duplicate_categories(self):
        from files.models import Category

        first = make_service(name="first pass")
        start_migration(first)
        after_first = Category.objects.count()
        self.assertGreater(after_first, 0)

        second = make_service(name="second pass")
        start_migration(second)

        self.assertEqual(Category.objects.count(), after_first, "the second migration duplicated categories")

    def test_a_deleted_media_is_imported_again(self):
        first = make_service(name="first pass")
        start_migration(first)
        Media.objects.all().delete()

        second = make_service(name="second pass")
        start_migration(second)

        self.assertEqual(Media.objects.count(), 2)


class TestFailures(OrchestratorTestCase):
    def test_a_failing_item_is_recorded_and_the_run_continues(self):
        service = make_service()
        self.provider.media["1_a"]["flavors"] = []

        start_migration(service)
        service.refresh_from_db()

        self.assertEqual(service.status, "success")
        self.assertEqual(Media.objects.count(), 1)
        failed = MigrationRecord.objects.get(service=service, object_type="media", source_id="1_a")
        self.assertEqual(failed.status, "failed")
        self.assertIn("no downloadable flavor", failed.log)

    def test_a_failed_item_is_retried_on_a_rerun(self):
        service = make_service()
        self.provider.media["1_a"]["flavors"] = []
        start_migration(service)

        self.provider.media["1_a"]["flavors"] = [{"id": "src-1_a", "height": 720, "fileExt": "mp4", "isOriginal": True, "status": 2}]
        service.refresh_from_db()
        service.cursor = {"phase": "media"}
        service.status = "pending"
        service.save(update_fields=["cursor", "status"])
        start_migration(service)

        self.assertEqual(Media.objects.count(), 2)
        row = MigrationRecord.objects.get(service=service, object_type="media", source_id="1_a")
        self.assertEqual(row.status, "success")


class TestRerunBookkeeping(OrchestratorTestCase):
    def test_a_rerun_leaves_the_success_records_intact(self):
        service = make_service()
        start_migration(service)

        before = {(row.object_type, row.source_id): row.status for row in MigrationRecord.objects.filter(service=service)}

        service.refresh_from_db()
        service.cursor = {}
        service.status = "pending"
        service.save(update_fields=["cursor", "status"])
        start_migration(service)

        after = {(row.object_type, row.source_id): row.status for row in MigrationRecord.objects.filter(service=service)}
        self.assertEqual(before, after, "a rerun rewrote the audit trail")
