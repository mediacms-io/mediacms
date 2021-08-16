from django.test import TestCase


class TestX(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def test_X(self):
        # test what is the default portal workflow
        # change it and make sure nothing strange happens (public/unlisted/private)

        pass
