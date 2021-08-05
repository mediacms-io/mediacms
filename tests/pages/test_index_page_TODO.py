from django.test import TestCase


class TestX(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def test_X(self):
        # check that all links exist, on anonymous user
        # check that all links exist, on logged in user, plus the user specific
        # for editor/manager/admin, check that the related links exist
        pass
