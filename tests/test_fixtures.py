from django.test import TestCase

from files.models import Category, EncodeProfile


class TestFixtures(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def test_categories_fixtures(self):
        categories = Category.objects.all()
        self.assertEqual(
            categories.count(),
            6,
            "Problem with category fixtures",
        )
        categories = Category.objects.filter().order_by('id')
        self.assertEqual(
            categories.first().title,
            'Art',
            "Problem with category fixtures",
        )

    def test_encodeprofile_fixtures(self):
        profiles = EncodeProfile.objects.all()
        self.assertEqual(
            profiles.count(),
            23,
            "Problem with Encode Profile fixtures",
        )
        profiles = EncodeProfile.objects.filter(active=True)
        self.assertEqual(
            profiles.count(),
            7,
            "Problem with Encode Profile fixtures, not as active as expected",
        )
