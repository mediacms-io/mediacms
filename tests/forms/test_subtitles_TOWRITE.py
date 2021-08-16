from django.test import TestCase


class TestX(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def test_X(self):
        # test that adding a subtitle works for a video - needs to have a language set on Admin
        pass
