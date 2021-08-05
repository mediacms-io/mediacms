from django.test import TestCase


class TestX(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def test_X(self):
        # test login form that allows user to login
        # test login form that redirect has worked (if on a page that required redirect for login, eg edit profile?)
        # check upon setting change that it is not allowed

        pass
