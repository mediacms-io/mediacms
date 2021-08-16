from django.test import TestCase


class TestX(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def test_X(self):
        # test media upload, using the form.
        # 1. upload a file and then check that it appears on the listing
        # 2. check that the page has been created
        # 3. check that encodings are ok for videos
        # 4. check other things (eg pdf/audio/image)
        pass
