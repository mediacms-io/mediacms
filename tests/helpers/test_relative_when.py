from datetime import datetime, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.template import Context, Template
from django.test import SimpleTestCase
from django.utils import timezone

from files.frontend_translations import translation_strings
from files.templatetags.custom_filters import describe_relative_when, relative_when

ZONE = ZoneInfo("America/New_York")
# Thursday 12 November 2026, 15:00 local.
NOW = datetime(2026, 11, 12, 15, 0, tzinfo=ZONE)


class DescribeRelativeWhenTests(SimpleTestCase):
    def labels(self, value, language_code="en"):
        with timezone.override(ZONE):
            return describe_relative_when(value, now=NOW, language_code=language_code)

    def test_missing_value_is_empty(self):
        self.assertIsNone(describe_relative_when(None, now=NOW))
        self.assertEqual(relative_when(None), "")

    def test_under_a_minute_is_recently(self):
        parts = self.labels(NOW - timedelta(seconds=50))
        self.assertEqual((parts["full"], parts["mid"], parts["short"]), ("recently", "recent", "now"))
        self.assertEqual(parts["exact"], "2026-11-12 14:59")

    def test_minutes_hours_weeks_months_and_years(self):
        cases = {
            timedelta(minutes=45): ("45 minutes ago", "45m ago", "45m"),
            timedelta(minutes=1): ("1 minute ago", "1m ago", "1m"),
            timedelta(hours=2): ("2 hours ago", "2h ago", "2h"),
            timedelta(hours=1): ("1 hour ago", "1h ago", "1h"),
            timedelta(hours=4): ("4 hours ago", "4h ago", "4h"),
            timedelta(days=7): ("1 week ago", "1w ago", "1w"),
            timedelta(days=14): ("2 weeks ago", "2w ago", "2w"),
        }
        for delta, expected in cases.items():
            parts = self.labels(NOW - delta)
            self.assertEqual((parts["full"], parts["mid"], parts["short"]), expected, delta)

    def test_calendar_words(self):
        eight_hours = self.labels(NOW - timedelta(hours=8))
        self.assertEqual(eight_hours["full"], "today")
        self.assertEqual((eight_hours["mid"], eight_hours["short"]), ("tod.", "tdy"))

        yesterday = self.labels(NOW - timedelta(days=1))
        self.assertEqual((yesterday["full"], yesterday["mid"], yesterday["short"]), ("yesterday", "yest.", "yday"))

        last_monday = self.labels(datetime(2026, 11, 9, 9, 0, tzinfo=ZONE))
        self.assertEqual((last_monday["full"], last_monday["mid"], last_monday["short"]), ("last Monday", "last Mon", "lMon"))

        last_friday = self.labels(datetime(2026, 11, 6, 18, 0, tzinfo=ZONE))
        self.assertEqual((last_friday["full"], last_friday["mid"], last_friday["short"]), ("last Friday", "last Fri", "lFri"))

        two_months = self.labels(datetime(2026, 9, 12, 15, 0, tzinfo=ZONE))
        self.assertEqual((two_months["full"], two_months["mid"], two_months["short"]), ("2 months ago", "2mo ago", "2mo"))

        last_year = self.labels(datetime(2025, 11, 12, 15, 0, tzinfo=ZONE))
        self.assertEqual((last_year["full"], last_year["mid"], last_year["short"]), ("last year", "last yr", "1y"))

        two_years = self.labels(datetime(2024, 11, 12, 15, 0, tzinfo=ZONE))
        self.assertEqual((two_years["full"], two_years["mid"], two_years["short"]), ("2 years ago", "2y ago", "2y"))

    def test_future_timestamps_are_recently(self):
        parts = self.labels(NOW + timedelta(minutes=5))
        self.assertEqual(parts["full"], "recently")
        self.assertEqual((parts["mid"], parts["short"]), ("recent", "now"))

    def test_login_sentence_can_move_the_link(self):
        from django.template import Context, Template

        es = translation_strings.setdefault("es", {})
        with patch.dict(
            es,
            {
                "If you have not created an account yet, then please {link} first.": "{link} primero.",
                "sign up": "regístrese",
            },
        ):
            html = str(
                Template('{% load custom_filters %}{% translate_link "es" "If you have not created an account yet, then please {link} first." "sign up" "/accounts/signup/" %}').render(Context({}))
            )
        self.assertTrue(html.startswith('<a href="/accounts/signup/">regístrese</a>'))

    def test_width_keys_can_differ_in_translation(self):
        es = translation_strings.setdefault("es", {})
        with patch.dict(es, {"recently": "hace un momento", "recent": "reciente", "now": "ya"}):
            parts = self.labels(NOW - timedelta(seconds=20), language_code="es")
        self.assertEqual((parts["full"], parts["mid"], parts["short"]), ("hace un momento", "reciente", "ya"))

    def test_count_placeholder_can_move_in_translation(self):
        es = translation_strings.setdefault("es", {})
        with patch.dict(es, {"{count} minutes ago": "hace {count} minutos"}):
            parts = self.labels(NOW - timedelta(minutes=45), language_code="es")
        self.assertEqual(parts["full"], "hace 45 minutos")

    def test_filter_renders_all_three_widths(self):
        with timezone.override(ZONE), patch("files.templatetags.custom_filters.timezone.now", return_value=NOW):
            html = str(relative_when(NOW - timedelta(minutes=45)))
        self.assertIn('class="when-full">45 minutes ago<', html)
        self.assertIn('class="when-mid">45m ago<', html)
        self.assertIn('class="when-short">45m<', html)
        self.assertIn('title="2026-11-12 14:15"', html)
        self.assertIn('aria-label="45 minutes ago"', html)

    def test_filter_is_usable_from_templates(self):
        rendered = Template("{% load custom_filters %}{{ value|relative_when }}").render(Context({"value": None}))
        self.assertEqual(rendered, "")
