from django.test import TestCase


class TestX(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def test_X(self):
        # test extra things editor can do
        # test extra things manager can do
        # test extra things admin can do
        # test what single user cannot do (eg mess with other users content!)

        pass
