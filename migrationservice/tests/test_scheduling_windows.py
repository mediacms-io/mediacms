from datetime import datetime

from django.test import SimpleTestCase, override_settings
from django.utils import timezone

from migrationservice.scheduling import (
    in_quiet_window,
    parse_clock,
    parse_scheduled_at,
    quiet_window,
    scheduled_at_text,
)


def at(hour, minute=0, day=6):
    return timezone.make_aware(datetime(2026, 10, day, hour, minute), timezone.get_current_timezone())


@override_settings(TIME_ZONE="Europe/Athens")
class TestClockParsing(SimpleTestCase):
    def test_nothing_to_show(self):
        self.assertEqual(scheduled_at_text(None), "")

    def test_text_that_is_not_a_time(self):
        self.assertIsNone(parse_scheduled_at("next tuesday"))
        self.assertIsNone(parse_scheduled_at("  "))
        self.assertIsNone(parse_clock(""))
        self.assertIsNone(parse_clock("25:00"))
        self.assertIsNone(parse_clock("noon"))

    def test_a_clock(self):
        self.assertEqual(parse_clock(" 07:05 "), (7, 5))

    def test_a_stored_time_round_trips_on_the_portal_clock(self):
        self.assertEqual(scheduled_at_text(parse_scheduled_at("2026-10-06T22:30")), "2026-10-06T22:30")


@override_settings(TIME_ZONE="Europe/Athens")
class TestQuietWindow(SimpleTestCase):
    def test_a_window_that_means_nothing_holds_nothing_back(self):
        for options in (
            {"quiet_hours_enabled": False, "quiet_from": "09:00", "quiet_to": "17:00"},
            {"quiet_hours_enabled": True, "quiet_from": "09:00", "quiet_to": "late"},
            {"quiet_hours_enabled": True, "quiet_from": "09:00", "quiet_to": "09:00"},
        ):
            self.assertIsNone(quiet_window(options), options)
            self.assertFalse(in_quiet_window(options, now=at(12)), options)

    def test_a_daytime_window(self):
        options = {"quiet_hours_enabled": True, "quiet_from": "09:00", "quiet_to": "17:00"}
        self.assertTrue(in_quiet_window(options, now=at(9)))
        self.assertTrue(in_quiet_window(options, now=at(16, 59)))
        self.assertFalse(in_quiet_window(options, now=at(17)))
        self.assertFalse(in_quiet_window(options, now=at(8, 59)))

    def test_a_window_over_midnight(self):
        options = {"quiet_hours_enabled": True, "quiet_from": "22:00", "quiet_to": "06:00"}
        self.assertTrue(in_quiet_window(options, now=at(23)))
        self.assertTrue(in_quiet_window(options, now=at(5, 59)))
        self.assertFalse(in_quiet_window(options, now=at(6)))
        self.assertFalse(in_quiet_window(options, now=at(12)))

    def test_weekends_can_run_through_the_window(self):
        options = {"quiet_hours_enabled": True, "quiet_from": "09:00", "quiet_to": "17:00", "run_during_weekends": True}
        self.assertFalse(in_quiet_window(options, now=at(12, day=10)))
        self.assertTrue(in_quiet_window(options, now=at(12, day=6)))
        self.assertTrue(in_quiet_window(dict(options, run_during_weekends=False), now=at(12, day=10)))
