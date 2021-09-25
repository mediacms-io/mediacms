from django.test import TestCase


class TestX(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def test_X(self):
        # check that links exist from index page and pages are loading and only admins/editors/managers can see them
        pass
