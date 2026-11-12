from allauth.account.models import EmailAddress
from django.core.management import load_command_class
from django.test import TestCase
from django.utils import timezone

from users.models import User


class PopulateFakeMediaUsersTest(TestCase):
    def setUp(self):
        self.command = load_command_class("files", "populate_fake_media")
        self.command._init_time_horizon()
        self.command._init_content_locales(
            rtl_language="ar",
            secondary_language="el",
            cjk_language="ja",
            single_language=None,
        )

    def test_create_users_includes_inactive_pending_and_related_states(self):
        users = self.command.create_users(media_count=80)
        self.assertGreaterEqual(len(users), 3)

        inactive = [u for u in users if not u.is_active]
        pending = [u for u in users if u.is_approved is False or u.is_approved is None]
        featured = [u for u in users if u.is_featured]
        advanced = [u for u in users if u.advancedUser]
        self.assertGreaterEqual(len(inactive), 1)
        self.assertGreaterEqual(len(pending), 1)
        self.assertGreaterEqual(len(featured), 1)
        self.assertGreaterEqual(len(advanced), 1)

        # Most accounts stay usable for media ownership.
        active_approved = [u for u in users if u.is_active and u.is_approved is True]
        self.assertGreaterEqual(len(active_approved), 1)

        verified = EmailAddress.objects.filter(user__in=users, verified=True).count()
        unverified = EmailAddress.objects.filter(user__in=users, verified=False).count()
        self.assertGreaterEqual(verified, 1)
        self.assertGreaterEqual(unverified, 1)

        # Inactive demo accounts should not look recently logged in.
        for user in inactive:
            user.refresh_from_db()
            self.assertIsNone(user.last_login)

    def test_create_users_covers_states_even_for_tiny_pools(self):
        users = self.command.create_users(media_count=1)
        self.assertTrue(any(not u.is_active for u in users))
        self.assertTrue(any(u.is_approved is False or u.is_approved is None for u in users))
        self.assertTrue(EmailAddress.objects.filter(user__in=users, verified=False).exists())
        # Fresh rows should sit inside the generator horizon.
        for user in users:
            self.assertGreaterEqual(user.date_joined, self.command._horizon_start)
            self.assertLessEqual(user.date_joined, timezone.now())

    def test_create_users_spreads_date_added_not_just_date_joined(self):
        users = self.command.create_users(media_count=100)
        # Reload from DB — admin lists by date_added, which must be backdated.
        pks = [u.pk for u in users]
        rows = list(User.objects.filter(pk__in=pks).values_list("date_added", "date_joined"))
        self.assertGreaterEqual(len(rows), 8)

        for date_added, date_joined in rows:
            self.assertEqual(date_added, date_joined)
            self.assertGreaterEqual(date_added, self.command._horizon_start)
            self.assertLessEqual(date_added, timezone.now())

        added_dates = sorted(date_added for date_added, _ in rows)
        span_days = (added_dates[-1] - added_dates[0]).days
        distinct_days = {d.date() for d in added_dates}
        # Must not collapse onto the populate-run day.
        self.assertGreaterEqual(span_days, 60)
        self.assertGreaterEqual(len(distinct_days), 5)
