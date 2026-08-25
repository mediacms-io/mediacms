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
            24,
            "Problem with Encode Profile fixtures",
        )
        profiles = EncodeProfile.objects.filter(active=True)
        self.assertEqual(
            profiles.count(),
            7,
            "Problem with Encode Profile fixtures, not as active as expected",
        )
        # the legacy gif preview is kept but switched off, and the mp4 one replaces it,
        # so the active count is unchanged and only the total proves the change landed
        previews = EncodeProfile.objects.filter(name="preview")
        self.assertEqual(sorted(previews.values_list("extension", flat=True)), ["gif", "mp4"])
        self.assertFalse(previews.get(extension="gif").active)
        self.assertTrue(previews.get(extension="mp4").active)
