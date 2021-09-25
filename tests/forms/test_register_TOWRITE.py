from django.test import TestCase


class TestX(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def test_X(self):
        # test register form that stores user data correctly
        # check upon setting change that it is not allowed
        pass
