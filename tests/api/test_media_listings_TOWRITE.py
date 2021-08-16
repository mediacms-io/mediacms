from django.test import TestCase


class TestX(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def test_X(self):
        # test a number of listings works (index, featured, user etc)

        pass
