import uuid

from django.test import Client, TestCase

from files.models import Playlist, PlaylistMedia
from files.tests import create_account, create_media


def make_user(**kwargs):
    name = uuid.uuid4().hex[:12]
    return create_account(username=f'u{name}', email=f'{name}@example.com', **kwargs)


def logged_in(user):
    client = Client()
    client.force_login(user)
    return client


def membership_url(media):
    return f'/api/v1/media/{media.friendly_token}/playlists'


class MediaPlaylistMembershipTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user()
        cls.other = make_user()
        cls.media = create_media(user=cls.owner)
        cls.with_media = Playlist.objects.create(title='with media', user=cls.owner)
        cls.without_media = Playlist.objects.create(title='without media', user=cls.owner)
        cls.others_playlist = Playlist.objects.create(title='others', user=cls.other)
        PlaylistMedia.objects.create(playlist=cls.with_media, media=cls.media, ordering=1)
        PlaylistMedia.objects.create(playlist=cls.others_playlist, media=cls.media, ordering=1)

    def test_anonymous_user_is_rejected(self):
        response = Client().get(membership_url(self.media))
        self.assertIn(response.status_code, (401, 403))

    def test_returns_only_requesting_users_playlists_containing_media(self):
        response = logged_in(self.owner).get(membership_url(self.media))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['results'], [{'friendly_token': self.with_media.friendly_token}])

    def test_other_user_sees_only_their_own_playlist(self):
        response = logged_in(self.other).get(membership_url(self.media))
        self.assertEqual(response.data['results'], [{'friendly_token': self.others_playlist.friendly_token}])

    def test_user_without_matching_playlists_gets_empty_results(self):
        response = logged_in(make_user()).get(membership_url(self.media))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['results'], [])

    def test_unknown_media_token_returns_404(self):
        response = logged_in(self.owner).get('/api/v1/media/doesnotexist/playlists')
        self.assertEqual(response.status_code, 404)

    def test_post_is_not_allowed(self):
        response = logged_in(self.owner).post(membership_url(self.media))
        self.assertEqual(response.status_code, 405)
