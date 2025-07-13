from django.test import TestCase


class TestX(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def test_X(self):
        # check only managers/editors/admins have access here!!!

        pass
