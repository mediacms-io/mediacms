from django.core.cache import cache
from django.core.files import File
from django.test import TestCase

from files.models import Media
from files.tests import create_account


class TestFrameOptions(TestCase):
    """Pages deny framing by default, the embed view can be framed"""

    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        cache.clear()
        self.user = create_account(username='owner', password='this_is_a_fake_password')
        with open('fixtures/test_image.png', 'rb') as fp:
            self.media = Media.objects.create(title='public image', user=self.user, media_file=File(fp))
        self.media.state = 'public'
        self.media.save()

    def test_login_page_denies_framing(self):
        response = self.client.get('/accounts/login/')
        self.assertEqual(response.get('X-Frame-Options'), 'DENY')

    def test_embed_page_can_be_framed(self):
        response = self.client.get(f'/embed?m={self.media.friendly_token}')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('X-Frame-Options', response)
