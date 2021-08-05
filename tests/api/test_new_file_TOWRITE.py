from django.test import TestCase


class TestX(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def test_X(self):
        # add new file, check it is added and more (eg for videos it is transcoded etc)
        pass
