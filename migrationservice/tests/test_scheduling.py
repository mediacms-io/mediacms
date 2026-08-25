from datetime import timedelta
from unittest import mock

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from files.tests import create_account
from migrationservice.models import MigrationService
from migrationservice.scheduling import parse_scheduled_at, scheduled_at_text
from migrationservice.serializers import MigrationServiceSerializer
from migrationservice.tasks import run_scheduled_migration, schedule_migration

CONNECTION = {"service_url": "https://kaltura.example.edu", "partner_id": "342", "app_token_id": "atok", "app_token": "x"}


def make_service(**options):
    defaults = {"fallback_username": "admin"}
    defaults.update(options)
    return MigrationService.objects.create(name="Kaltura nightly", provider="kaltura", connection=dict(CONNECTION), options=defaults)


def in_hours(hours):
    return scheduled_at_text(timezone.now() + timedelta(hours=hours))


class TestWallClockStrings(TestCase):
    """A stored time has no offset on it. It means the portal's clock, because that is the
    only one the person picking a time and the worker acting on it both know.
    """

    def test_a_naive_string_is_read_in_the_portal_timezone(self):
        parsed = parse_scheduled_at("2099-07-01T09:00")
        self.assertEqual(scheduled_at_text(parsed), "2099-07-01T09:00")

    def test_an_empty_value_means_nothing_is_scheduled(self):
        self.assertIsNone(parse_scheduled_at(""))
        self.assertIsNone(parse_scheduled_at(None))

    def test_rubbish_is_not_a_time(self):
        self.assertIsNone(parse_scheduled_at("tomorrow please"))


class TestScheduleValidation(TestCase):
    def validate(self, **options):
        service = make_service()
        data = {"name": service.name, "provider": "kaltura", "connection": dict(CONNECTION), "options": dict(service.get_options(), **options)}
        return MigrationServiceSerializer(instance=service, data=data, partial=True)

    def test_a_future_time_is_accepted(self):
        self.assertTrue(self.validate(schedule_enabled=True, scheduled_at=in_hours(3)).is_valid())

    def test_a_past_time_is_refused(self):
        serializer = self.validate(schedule_enabled=True, scheduled_at=in_hours(-3))
        self.assertFalse(serializer.is_valid())
        self.assertIn("future", str(serializer.errors["options"]))

    def test_switching_it_on_without_a_time_is_refused(self):
        serializer = self.validate(schedule_enabled=True, scheduled_at="")
        self.assertFalse(serializer.is_valid())

    def test_switching_it_off_clears_any_time_left_behind(self):
        serializer = self.validate(schedule_enabled=False, scheduled_at=in_hours(3))
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data["options"]["scheduled_at"], "")

    def test_a_past_time_is_ignored_while_scheduling_is_off(self):
        self.assertTrue(self.validate(schedule_enabled=False, scheduled_at=in_hours(-3)).is_valid())


class TestArming(TestCase):
    def test_saving_with_a_schedule_queues_a_task_for_that_time(self):
        service = make_service(schedule_enabled=True, scheduled_at=in_hours(3))
        with mock.patch("migrationservice.tasks.run_scheduled_migration.apply_async") as queued:
            schedule_migration(service)
        self.assertEqual(queued.call_count, 1)
        args, kwargs = queued.call_args
        self.assertEqual(kwargs["args"], [service.pk, service.get_options()["scheduled_at"]])
        self.assertEqual(scheduled_at_text(kwargs["eta"]), service.get_options()["scheduled_at"])

    def test_nothing_is_queued_when_scheduling_is_off(self):
        service = make_service(schedule_enabled=False, scheduled_at=in_hours(3))
        with mock.patch("migrationservice.tasks.run_scheduled_migration.apply_async") as queued:
            schedule_migration(service)
        self.assertEqual(queued.call_count, 0)


class TestScheduledRun(TestCase):
    def setUp(self):
        create_account(username="admin")

    def test_a_task_whose_time_still_stands_starts_the_migration(self):
        when = in_hours(-1)
        service = make_service(schedule_enabled=True, scheduled_at=when)
        self.assertTrue(run_scheduled_migration(service.pk, when))
        service.refresh_from_db()
        self.assertNotEqual(service.status, "pending")
        # the time has been used, so it stops being offered
        self.assertFalse(service.get_options()["schedule_enabled"])
        self.assertEqual(service.get_options()["scheduled_at"], "")

    def test_a_task_armed_for_a_time_since_changed_stands_down(self):
        service = make_service(schedule_enabled=True, scheduled_at=in_hours(5))
        self.assertFalse(run_scheduled_migration(service.pk, in_hours(-1)))
        service.refresh_from_db()
        self.assertEqual(service.status, "pending")
        self.assertTrue(service.get_options()["schedule_enabled"])

    def test_a_task_armed_before_scheduling_was_switched_off_stands_down(self):
        when = in_hours(-1)
        service = make_service(schedule_enabled=False, scheduled_at=when)
        self.assertFalse(run_scheduled_migration(service.pk, when))
        service.refresh_from_db()
        self.assertEqual(service.status, "pending")

    def test_a_migration_already_running_is_not_started_again(self):
        when = in_hours(-1)
        service = make_service(schedule_enabled=True, scheduled_at=when)
        MigrationService.objects.filter(pk=service.pk).update(status="running")
        self.assertFalse(run_scheduled_migration(service.pk, when))
        service.refresh_from_db()
        self.assertEqual(service.status, "running")
        self.assertIn("scheduled start skipped", service.log)

    def test_a_duplicate_task_for_the_same_time_does_not_start_it_twice(self):
        when = in_hours(-1)
        service = make_service(schedule_enabled=True, scheduled_at=when)
        self.assertTrue(run_scheduled_migration(service.pk, when))
        self.assertFalse(run_scheduled_migration(service.pk, when))

    def test_a_deleted_migration_is_not_an_error(self):
        self.assertFalse(run_scheduled_migration(999999, in_hours(-1)))


class TestServerTimeEndpoint(TestCase):
    def setUp(self):
        create_account(username="super", is_superuser=True)
        self.client.login(username="super", password="password")

    def test_it_reports_the_portal_clock_not_utc(self):
        response = self.client.get(reverse("migration-server-time"))
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["now"], scheduled_at_text(timezone.now()))
        self.assertEqual(body["timezone"], str(timezone.get_current_timezone()))
