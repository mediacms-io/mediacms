import json
import uuid

from django.test import Client, TestCase, override_settings

from files.models import Category, MediaPermission, Playlist, PlaylistMedia
from files.tests import create_account, create_media
from rbac.models import RBACGroup, RBACMembership

PLAYLISTS_URL = '/api/v1/playlists'


def make_user(**kwargs):
    name = uuid.uuid4().hex[:12]
    return create_account(username=f'u{name}', email=f'{name}@example.com', **kwargs)


def playlist_url(playlist):
    return f'/api/v1/playlists/{playlist.friendly_token}'


def logged_in(user):
    client = Client()
    client.force_login(user)
    return client


def put_json(client, url, data):
    return client.put(url, data=json.dumps(data), content_type='application/json')


class PlaylistListTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user()
        cls.other = make_user()
        cls.owner_playlist = Playlist.objects.create(title='owner playlist', user=cls.owner)
        cls.other_playlist = Playlist.objects.create(title='other playlist', user=cls.other)

    def test_anonymous_users_can_list_all_playlists(self):
        response = Client().get(PLAYLISTS_URL)
        self.assertEqual(response.status_code, 200)
        titles = {p['title'] for p in response.data['results']}
        self.assertEqual(titles, {'owner playlist', 'other playlist'})

    def test_listing_can_be_filtered_by_author(self):
        response = Client().get(PLAYLISTS_URL, {'author': f' {self.owner.username} '})
        self.assertEqual([p['title'] for p in response.data['results']], ['owner playlist'])
        self.assertEqual(response.data['results'][0]['user'], self.owner.username)

    def test_anonymous_users_cannot_create_playlists(self):
        response = Client().post(PLAYLISTS_URL, {'title': 'nope'})
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Playlist.objects.filter(title='nope').exists())

    def test_authenticated_user_creates_playlist_owned_by_them(self):
        response = logged_in(self.other).post(PLAYLISTS_URL, {'title': 'fresh playlist', 'description': '<b>bold</b> words'})
        self.assertEqual(response.status_code, 201)
        playlist = Playlist.objects.get(title='fresh playlist')
        self.assertEqual(playlist.user, self.other)
        self.assertEqual(playlist.description, 'bold words')
        self.assertEqual(response.data['friendly_token'], playlist.friendly_token)

    def test_a_client_supplied_token_is_ignored_so_another_playlist_cannot_be_squatted(self):
        response = logged_in(self.other).post(PLAYLISTS_URL, {'title': 'squat', 'friendly_token': self.owner_playlist.friendly_token})
        self.assertEqual(response.status_code, 201)
        self.assertNotEqual(response.data['friendly_token'], self.owner_playlist.friendly_token)
        self.assertEqual(Playlist.objects.filter(friendly_token=self.owner_playlist.friendly_token).count(), 1)
        self.assertEqual(logged_in(self.owner).get(playlist_url(self.owner_playlist)).status_code, 200)

    def test_tokens_that_cannot_be_reversed_into_a_url_are_never_stored(self):
        for token in ('bad.token', 'a/b', 'a b', '%41', "a'b<"):
            with self.subTest(token=token):
                response = logged_in(self.other).post(PLAYLISTS_URL, {'title': f'odd {token}', 'friendly_token': token})
                self.assertEqual(response.status_code, 201)
                self.assertRegex(Playlist.objects.get(title=f'odd {token}').friendly_token, r'^[\w-]+$')
        self.assertEqual(Client().get(PLAYLISTS_URL).status_code, 200)

    def test_creating_playlist_without_title_is_rejected(self):
        response = logged_in(self.other).post(PLAYLISTS_URL, {'description': 'no title'})
        self.assertEqual(response.status_code, 400)
        self.assertIn('title', response.data)

    @override_settings(CAN_ADD_MEDIA='advancedUser')
    def test_users_not_allowed_to_upload_cannot_create_playlists(self):
        response = logged_in(self.other).post(PLAYLISTS_URL, {'title': 'not advanced'})
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Playlist.objects.filter(title='not advanced').exists())


class PlaylistDetailVisibilityTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user()
        cls.media_owner = make_user()
        cls.shared_with = make_user()
        cls.editor = make_user(is_editor=True)
        cls.rbac_member = make_user()

        cls.public_media = create_media(cls.media_owner, title='public one', state='public')
        cls.unlisted_media = create_media(cls.media_owner, title='unlisted one', state='unlisted')
        cls.private_media = create_media(cls.media_owner, title='private one', state='private')
        cls.shared_media = create_media(cls.media_owner, title='shared one', state='private')
        MediaPermission.objects.create(owner_user=cls.media_owner, user=cls.shared_with, media=cls.shared_media, permission='viewer')

        cls.rbac_category = Category.objects.create(title='rbac playlist category', is_rbac_category=True)
        cls.rbac_media = create_media(cls.media_owner, title='rbac one', state='private', category=[cls.rbac_category])
        group = RBACGroup.objects.create(name='playlist group')
        group.categories.add(cls.rbac_category)
        RBACMembership.objects.create(user=cls.rbac_member, rbac_group=group, role='member')

        cls.playlist = Playlist.objects.create(title='mixed playlist', user=cls.owner)
        for ordering, media in enumerate([cls.public_media, cls.unlisted_media, cls.private_media, cls.shared_media, cls.rbac_media], start=1):
            PlaylistMedia.objects.create(playlist=cls.playlist, media=media, ordering=ordering)

    def titles_seen_by(self, client):
        response = client.get(playlist_url(self.playlist))
        self.assertEqual(response.status_code, 200)
        return {m['title'] for m in response.data['playlist_media']}

    def test_missing_playlist_returns_error(self):
        response = Client().get('/api/v1/playlists/doesnotexist')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['detail'], 'Playlist does not exist')

    def test_a_duplicated_token_is_a_server_error_not_a_fake_not_found(self):
        twin = Playlist.objects.create(title='twin', user=self.owner)
        Playlist.objects.filter(pk=twin.pk).update(friendly_token=self.playlist.friendly_token)
        client = Client(raise_request_exception=False)
        self.assertEqual(client.get(playlist_url(self.playlist)).status_code, 500)
        self.assertEqual(client.get(f'/playlists/{self.playlist.friendly_token}').status_code, 500)

    def test_anonymous_users_see_only_public_and_unlisted_media(self):
        self.assertEqual(self.titles_seen_by(Client()), {'public one', 'unlisted one'})

    def test_playlist_owner_does_not_see_private_media_of_others(self):
        self.assertEqual(self.titles_seen_by(logged_in(self.owner)), {'public one', 'unlisted one'})

    def test_media_owner_sees_own_private_media(self):
        self.assertEqual(self.titles_seen_by(logged_in(self.media_owner)), {'public one', 'unlisted one', 'private one', 'shared one', 'rbac one'})

    def test_user_with_media_permission_sees_shared_media(self):
        self.assertEqual(self.titles_seen_by(logged_in(self.shared_with)), {'public one', 'unlisted one', 'shared one'})

    def test_editors_see_all_media(self):
        self.assertEqual(self.titles_seen_by(logged_in(self.editor)), {'public one', 'unlisted one', 'private one', 'shared one', 'rbac one'})

    @override_settings(USE_RBAC=True)
    def test_rbac_members_see_private_media_of_their_categories(self):
        self.assertEqual(self.titles_seen_by(logged_in(self.rbac_member)), {'public one', 'unlisted one', 'rbac one'})

    def test_rbac_membership_is_ignored_when_rbac_is_off(self):
        self.assertEqual(self.titles_seen_by(logged_in(self.rbac_member)), {'public one', 'unlisted one'})

    def test_detail_includes_playlist_metadata(self):
        response = Client().get(playlist_url(self.playlist))
        self.assertEqual(response.data['title'], 'mixed playlist')
        self.assertEqual(response.data['user'], self.owner.username)


class PlaylistEditTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user()
        cls.other = make_user()
        cls.editor = make_user(is_editor=True)
        cls.manager = make_user(is_manager=True)
        cls.admin = make_user(is_superuser=True)
        cls.public_media = create_media(cls.other, title='public media', state='public')
        cls.second_media = create_media(cls.other, title='second media', state='public')
        cls.others_private = create_media(cls.other, title='others private', state='private')
        cls.own_private = create_media(cls.owner, title='own private', state='private')

    def setUp(self):
        self.playlist = Playlist.objects.create(title='editable', user=self.owner)

    def test_owner_can_update_title_and_description(self):
        response = logged_in(self.owner).post(playlist_url(self.playlist), {'title': 'renamed', 'description': 'new description'})
        self.assertEqual(response.status_code, 201)
        self.playlist.refresh_from_db()
        self.assertEqual(self.playlist.title, 'renamed')
        self.assertEqual(self.playlist.description, 'new description')

    def test_owner_update_with_invalid_data_is_rejected(self):
        response = logged_in(self.owner).post(playlist_url(self.playlist), {'title': ''})
        self.assertEqual(response.status_code, 400)
        self.playlist.refresh_from_db()
        self.assertEqual(self.playlist.title, 'editable')

    def test_other_users_cannot_update_playlist(self):
        response = logged_in(self.other).post(playlist_url(self.playlist), {'title': 'hijacked'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['detail'], 'not enough permissions')
        self.playlist.refresh_from_db()
        self.assertEqual(self.playlist.title, 'editable')

    def test_editors_managers_and_admins_editing_a_playlist_keep_its_owner(self):
        for moderator in (self.editor, self.manager, self.admin):
            with self.subTest(moderator=moderator.username):
                response = logged_in(moderator).post(playlist_url(self.playlist), {'title': f'renamed by {moderator.username}'})
                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.data['user'], self.owner.username)
                self.playlist.refresh_from_db()
                self.assertEqual(self.playlist.user, self.owner)
                self.assertEqual(self.playlist.title, f'renamed by {moderator.username}')

    def test_anonymous_users_cannot_update_playlist(self):
        response = Client().post(playlist_url(self.playlist), {'title': 'hijacked'})
        self.assertEqual(response.status_code, 403)

    def test_owner_adds_public_media(self):
        response = put_json(logged_in(self.owner), playlist_url(self.playlist), {'type': 'add', 'media_friendly_token': self.public_media.friendly_token})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(list(self.playlist.media.all()), [self.public_media])

    def test_adding_the_same_media_twice_keeps_one_entry(self):
        client = logged_in(self.owner)
        for _ in range(2):
            response = put_json(client, playlist_url(self.playlist), {'type': 'add', 'media_friendly_token': self.public_media.friendly_token})
            self.assertEqual(response.status_code, 201)
        self.assertEqual(PlaylistMedia.objects.filter(playlist=self.playlist, media=self.public_media).count(), 1)
        detail = logged_in(self.owner).get(playlist_url(self.playlist))
        self.assertEqual([item['friendly_token'] for item in detail.data['playlist_media']], [self.public_media.friendly_token])

    def test_added_media_are_appended_in_order(self):
        client = logged_in(self.owner)
        put_json(client, playlist_url(self.playlist), {'type': 'add', 'media_friendly_token': self.public_media.friendly_token})
        put_json(client, playlist_url(self.playlist), {'type': 'add', 'media_friendly_token': self.second_media.friendly_token})
        orderings = dict(PlaylistMedia.objects.filter(playlist=self.playlist).values_list('media__title', 'ordering'))
        self.assertEqual(orderings, {'public media': 1, 'second media': 2})

    def test_owner_can_add_own_private_media(self):
        response = put_json(logged_in(self.owner), playlist_url(self.playlist), {'type': 'add', 'media_friendly_token': self.own_private.friendly_token})
        self.assertEqual(response.status_code, 201)
        self.assertTrue(self.playlist.media.filter(pk=self.own_private.pk).exists())

    def test_owner_cannot_add_private_media_of_others(self):
        response = put_json(logged_in(self.owner), playlist_url(self.playlist), {'type': 'add', 'media_friendly_token': self.others_private.friendly_token})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['detail'], 'media is not valid')
        self.assertFalse(self.playlist.media.exists())

    def test_editor_can_add_private_media_of_others_to_own_playlist(self):
        playlist = Playlist.objects.create(title='editor playlist', user=self.editor)
        response = put_json(logged_in(self.editor), playlist_url(playlist), {'type': 'add', 'media_friendly_token': self.others_private.friendly_token})
        self.assertEqual(response.status_code, 201)
        self.assertTrue(playlist.media.filter(pk=self.others_private.pk).exists())

    def test_adding_unknown_media_is_rejected(self):
        response = put_json(logged_in(self.owner), playlist_url(self.playlist), {'type': 'add', 'media_friendly_token': 'missing'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['detail'], 'media is not valid')

    @override_settings(MAX_MEDIA_PER_PLAYLIST=1)
    def test_adding_beyond_playlist_limit_is_rejected(self):
        PlaylistMedia.objects.create(playlist=self.playlist, media=self.public_media)
        response = put_json(logged_in(self.owner), playlist_url(self.playlist), {'type': 'add', 'media_friendly_token': self.second_media.friendly_token})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['detail'], 'max number of media for a Playlist reached')
        self.assertEqual(self.playlist.media.count(), 1)

    def test_owner_removes_media(self):
        PlaylistMedia.objects.create(playlist=self.playlist, media=self.public_media)
        PlaylistMedia.objects.create(playlist=self.playlist, media=self.second_media, ordering=2)
        response = put_json(logged_in(self.owner), playlist_url(self.playlist), {'type': 'remove', 'media_friendly_token': self.public_media.friendly_token})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(list(self.playlist.media.all()), [self.second_media])

    def test_owner_reorders_media(self):
        PlaylistMedia.objects.create(playlist=self.playlist, media=self.public_media, ordering=1)
        PlaylistMedia.objects.create(playlist=self.playlist, media=self.second_media, ordering=2)
        response = put_json(logged_in(self.owner), playlist_url(self.playlist), {'type': 'ordering', 'media_friendly_token': self.public_media.friendly_token, 'ordering': '3'})
        self.assertEqual(response.status_code, 201)
        self.assertEqual([m.title for m in self.playlist.media.order_by('playlistmedia__ordering')], ['second media', 'public media'])

    def test_non_numeric_ordering_is_rejected(self):
        PlaylistMedia.objects.create(playlist=self.playlist, media=self.public_media, ordering=1)
        response = put_json(logged_in(self.owner), playlist_url(self.playlist), {'type': 'ordering', 'media_friendly_token': self.public_media.friendly_token, 'ordering': 'first'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['detail'], 'invalid or not specified action')
        self.assertEqual(PlaylistMedia.objects.get(playlist=self.playlist).ordering, 1)

    def test_unknown_action_is_rejected(self):
        response = put_json(logged_in(self.owner), playlist_url(self.playlist), {'type': 'shuffle', 'media_friendly_token': self.public_media.friendly_token})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['detail'], 'invalid or not specified action')

    def test_other_users_cannot_add_media(self):
        response = put_json(logged_in(self.other), playlist_url(self.playlist), {'type': 'add', 'media_friendly_token': self.public_media.friendly_token})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['detail'], 'not enough permissions')
        self.assertFalse(self.playlist.media.exists())

    def test_manager_can_remove_media_from_any_playlist(self):
        PlaylistMedia.objects.create(playlist=self.playlist, media=self.public_media)
        response = put_json(logged_in(self.manager), playlist_url(self.playlist), {'type': 'remove', 'media_friendly_token': self.public_media.friendly_token})
        self.assertEqual(response.status_code, 201)
        self.assertFalse(self.playlist.media.exists())


class PlaylistDeleteTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user()
        cls.other = make_user()

    def setUp(self):
        self.playlist = Playlist.objects.create(title='doomed', user=self.owner)

    def test_owner_deletes_playlist(self):
        response = logged_in(self.owner).delete(playlist_url(self.playlist))
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Playlist.objects.filter(pk=self.playlist.pk).exists())

    def test_other_users_cannot_delete_playlist(self):
        response = logged_in(self.other).delete(playlist_url(self.playlist))
        self.assertEqual(response.status_code, 400)
        self.assertTrue(Playlist.objects.filter(pk=self.playlist.pk).exists())

    def test_anonymous_users_cannot_delete_playlist(self):
        response = Client().delete(playlist_url(self.playlist))
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Playlist.objects.filter(pk=self.playlist.pk).exists())

    def test_editors_managers_and_admins_can_delete_any_playlist(self):
        for kwargs in ({'is_editor': True}, {'is_manager': True}, {'is_superuser': True}):
            with self.subTest(**kwargs):
                playlist = Playlist.objects.create(title='to remove', user=self.owner)
                response = logged_in(make_user(**kwargs)).delete(playlist_url(playlist))
                self.assertEqual(response.status_code, 204)
                self.assertFalse(Playlist.objects.filter(pk=playlist.pk).exists())

    def test_deleting_missing_playlist_returns_error(self):
        response = logged_in(self.owner).delete('/api/v1/playlists/doesnotexist')
        self.assertEqual(response.status_code, 400)
