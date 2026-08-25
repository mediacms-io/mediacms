from unittest import mock

from django.test import TestCase

from files.tests import create_account
from migrationservice.models import MigrationService
from migrationservice.tasks import start_migration
from migrationservice.tests.fakes import FakeProvider


def make_service():
    return MigrationService.objects.create(
        name="Kaltura production",
        provider="kaltura",
        connection={"service_url": "https://kaltura.example.edu", "partner_id": "342", "app_token_id": "atok", "app_token": "x"},
        options={"migrate_all_users": False, "create_users": False, "migrate_all_categories": False, "fallback_username": "admin"},
    )


class TestDiscoveryTotals(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        create_account(username="admin")
        self.provider = FakeProvider()
        self.provider.check_connection = mock.Mock(return_value={"ok": True, "error": "", "stats": {"entries": 11960, "users": 214, "categories": 87}})
        patcher = mock.patch("migrationservice.tasks.get_provider", return_value=self.provider)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_discovery_totals_are_stored_on_start(self):
        service = make_service()
        start_migration(service)
        service.refresh_from_db()
        self.assertEqual(service.totals["media_discovered"], 11960)
        # users and categories are no longer phases, so they have no denominator
        self.assertNotIn("user_discovered", service.totals)
        self.assertNotIn("category_discovered", service.totals)

    def test_a_failing_connection_check_does_not_stop_the_migration(self):
        service = make_service()
        self.provider.check_connection = mock.Mock(side_effect=RuntimeError("kaboom"))
        start_migration(service)
        service.refresh_from_db()
        self.assertEqual(service.status, "success")
        self.assertIn("could not read source totals", service.log)

    def test_a_restricted_run_logs_the_count_per_user(self):
        service = make_service()
        self.provider.check_connection = mock.Mock(
            return_value={
                "ok": True,
                "error": "",
                "stats": {"entries": 25, "users": 214, "categories": 87, "entries_per_user": {"jdoe": 25, "typo": 0}},
            }
        )
        start_migration(service)
        service.refresh_from_db()

        self.assertEqual(service.totals["media_discovered"], 25)
        self.assertIn("jdoe: 25", service.log)
        self.assertIn("warning: no media found for typo", service.log)
        self.assertEqual(service.status, "success")

    def test_a_restriction_that_matches_nothing_is_an_error_not_a_success(self):
        """Kaltura answers an unknown user id with zero rather than an error, so a
        mistyped list would otherwise finish as a clean success having done nothing.
        """
        service = make_service()
        self.provider.check_connection = mock.Mock(return_value={"ok": True, "error": "", "stats": {"entries": 0, "users": 214, "categories": 87, "entries_per_user": {"typo": 0, "alsotypo": 0}}})
        start_migration(service)
        service.refresh_from_db()

        self.assertEqual(service.status, "error")
        self.assertIn("no media found for any listed user", service.log)
        self.assertEqual(self.provider.calls, [], "the run went ahead and called the source anyway")

    def test_resuming_does_not_reset_the_totals(self):
        service = make_service()
        start_migration(service)
        service.refresh_from_db()
        service.status = "paused"
        service.save(update_fields=["status"])

        self.provider.check_connection = mock.Mock(return_value={"ok": True, "error": "", "stats": {"entries": 1}})
        start_migration(service)
        service.refresh_from_db()
        self.assertEqual(service.totals["media_discovered"], 11960)
