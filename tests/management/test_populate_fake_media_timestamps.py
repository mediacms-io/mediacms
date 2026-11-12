from datetime import timedelta

from django.core.management import load_command_class
from django.test import TestCase
from django.utils import timezone

from files.models import Category, Media
from files.tests import create_account, create_media
from files.tests.media_utils import SMALL_VIDEO


class PopulateFakeMediaTimestampTest(TestCase):
    def setUp(self):
        self.command = load_command_class("files", "populate_fake_media")
        self.command._init_time_horizon()
        self.command._init_content_locales(
            rtl_language="ar",
            secondary_language="el",
            cjk_language="ja",
            single_language=None,
        )
        self.user = create_account(username="ts_user")

    def test_setup_categories_spreads_add_date(self):
        Category.objects.all().delete()
        categories = self.command.setup_categories()
        self.assertGreaterEqual(len(categories), 2)

        dates = sorted(Category.objects.filter(pk__in=[c.pk for c in categories]).values_list("add_date", flat=True))
        for when in dates:
            self.assertGreaterEqual(when, self.command._horizon_start)
            self.assertLessEqual(when, timezone.now())
        self.assertGreaterEqual((dates[-1] - dates[0]).days, 1)
        self.assertGreaterEqual(len({d.date() for d in dates}), 2)

    def test_post_process_aligns_media_edit_date(self):
        media = create_media(
            self.user,
            filename=SMALL_VIDEO,
            title="edit date media",
            encoding_status="success",
            state="public",
            is_reviewed=True,
        )
        add_date = self.command._horizon_start + timedelta(days=40)
        Media.objects.filter(pk=media.pk).update(add_date=add_date)
        # Simulate a populate-run save that stamped edit_date as "now".
        Media.objects.filter(pk=media.pk).update(edit_date=timezone.now())
        media.refresh_from_db()

        self.command.post_process([media], tags=[], categories=[])
        media.refresh_from_db()
        self.assertGreaterEqual(media.edit_date, media.add_date)
        self.assertLessEqual(media.edit_date, timezone.now())
        # Should not remain stuck at the immediate "now" cluster from the fake bump.
        self.assertLess((timezone.now() - media.edit_date).total_seconds(), 365 * 24 * 3600)

    def test_create_pages_backdates_edit_date(self):
        create_account(username="page_ts_admin", is_superuser=True)
        pages = self.command.create_pages()
        for page in pages:
            page.refresh_from_db()
            self.assertIsNotNone(page.add_date)
            self.assertIsNotNone(page.edit_date)
            self.assertGreaterEqual(page.edit_date, page.add_date)
            self.assertLessEqual(page.edit_date, timezone.now())
