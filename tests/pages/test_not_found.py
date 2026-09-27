from django.core.cache import cache
from django.core.files import File
from django.test import TestCase

from files.models import Media
from files.tests import create_account


class TestNotFoundStatus(TestCase):
    """Unknown pages, media and playlists answer 404"""

    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        cache.clear()
        self.user = create_account(username='owner', password='this_is_a_fake_password')
        with open('fixtures/test_image.png', 'rb') as fp:
            self.media = Media.objects.create(title='public image', user=self.user, media_file=File(fp))
        self.media.state = 'public'
        self.media.save()

    def test_unknown_page_slug(self):
        response = self.client.get('/zzz-nonexistent-slug')
        self.assertEqual(response.status_code, 404)

    def test_unknown_media(self):
        response = self.client.get('/view?m=doesnotexist')
        self.assertEqual(response.status_code, 404)

    def test_unknown_playlist(self):
        response = self.client.get('/playlist/doesnotexist')
        self.assertEqual(response.status_code, 404)

    def test_existing_media(self):
        response = self.client.get(f'/view?m={self.media.friendly_token}')
        self.assertEqual(response.status_code, 200)
