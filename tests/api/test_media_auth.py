from django.core.cache import cache
from django.core.files import File
from django.test import Client, TestCase

from files.models import Media
from files.tests import create_account

MEDIA_AUTH_URL = '/api/v1/media-auth'


class MediaAuthTest(TestCase):
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

        cache.clear()

    def _auth(self, uri, client=None):
        client = client or Client()
        return client.get(MEDIA_AUTH_URL, HTTP_X_ORIGINAL_URI=uri)

    @property
    def public_uid(self):
        return self.public_media.uid.hex

    @property
    def private_uid(self):
        return self.private_media.uid.hex

    def test_public_media_allowed_for_anonymous(self):
        uri = f'/media/encoded/{self.public_uid}/{self.public_uid}.mp4'
        self.assertEqual(self._auth(uri).status_code, 204)

    def test_private_media_denied_for_anonymous(self):
        uri = f'/media/encoded/23/owner/{self.private_uid}.mp4'
        self.assertEqual(self._auth(uri).status_code, 403)

    def test_private_media_allowed_for_owner(self):
        client = Client()
        client.login(username=self.owner.username, password=self.password)
        uri = f'/media/encoded/23/owner/{self.private_uid}.mp4'
        self.assertEqual(self._auth(uri, client).status_code, 204)

    def test_traversal_with_public_uid_is_denied(self):
        uri = f'/media/encoded/{self.public_uid}/..%2F23%2Fowner%2F{self.private_uid}.mp4'
        self.assertEqual(self._auth(uri).status_code, 403)

    def test_unencoded_traversal_is_denied(self):
        uri = f'/media/encoded/{self.public_uid}/../23/owner/{self.private_uid}.mp4'
        self.assertEqual(self._auth(uri).status_code, 403)

    def test_traversal_denied_even_for_authenticated_owner(self):
        client = Client()
        client.login(username=self.owner.username, password=self.password)
        uri = f'/media/encoded/{self.public_uid}/..%2F23%2Fowner%2F{self.private_uid}.mp4'
        self.assertEqual(self._auth(uri, client).status_code, 403)
