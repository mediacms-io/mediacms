from django.test import TestCase

from files.models import Category
from files.models.category import DEFAULT_CATEGORY_THUMBNAIL


class CategoryThumbnailTest(TestCase):
    def test_a_category_with_nothing_to_show_falls_back_to_the_default(self):
        category = Category.objects.create(title="Botany")
        self.assertTrue(category.thumbnail_url.endswith(DEFAULT_CATEGORY_THUMBNAIL))

    def test_a_borrowed_tile_wins_over_the_default(self):
        category = Category.objects.create(title="Zoology", listings_thumbnail="/media/original/thumbnails/abc.jpg")
        self.assertEqual(category.thumbnail_url, "/media/original/thumbnails/abc.jpg")
