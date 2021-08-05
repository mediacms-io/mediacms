from django.test import TestCase


class TestX(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def test_X(self):
        # test edit media that it works, by setting different values. then check on the API response
        # check that a user cannot set status upon different scenarios (eg on settings PORTAL_WORKFLOW)

        pass
