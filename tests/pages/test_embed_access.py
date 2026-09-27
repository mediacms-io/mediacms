from django.core.cache import cache
from django.core.files import File
from django.test import Client, TestCase

from files.models import Media
from files.tests import create_account


class TestEmbedAccess(TestCase):
    """The embed view applies the media access rules"""

    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        cache.clear()
        self.password = 'this_is_a_fake_password'
        self.owner = create_account(username='owner', password=self.password)
        self.other = create_account(username='other', password=self.password)

        with open('fixtures/test_image.png', 'rb') as fp:
            self.public_media = Media.objects.create(title='public image', user=self.other, media_file=File(fp))
        self.public_media.state = 'public'
        self.public_media.save()

        with open('fixtures/test_image.png', 'rb') as fp:
            self.private_media = Media.objects.create(title='private image', user=self.owner, media_file=File(fp))
        self.private_media.state = 'private'
        self.private_media.save()

    def test_public_media_for_anonymous(self):
        response = self.client.get(f'/embed?m={self.public_media.friendly_token}')
        self.assertEqual(response.status_code, 200)

    def test_private_media_for_anonymous(self):
        response = self.client.get(f'/embed?m={self.private_media.friendly_token}')
        self.assertEqual(response.status_code, 404)
        self.assertNotContains(response, self.private_media.friendly_token, status_code=404)

    def test_private_media_for_other_user(self):
        client = Client()
        client.login(username=self.other.username, password=self.password)
        response = client.get(f'/embed?m={self.private_media.friendly_token}')
        self.assertEqual(response.status_code, 404)

    def test_private_media_for_owner(self):
        client = Client()
        client.login(username=self.owner.username, password=self.password)
        response = client.get(f'/embed?m={self.private_media.friendly_token}')
        self.assertEqual(response.status_code, 200)

    def test_unknown_media(self):
        response = self.client.get('/embed?m=doesnotexist')
        self.assertEqual(response.status_code, 404)
