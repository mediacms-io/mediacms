import uuid

from django.test import Client, TestCase, override_settings

from files.models import Category, Comment, Media
from files.tests import create_account, create_media
from files.tests.media_utils import SMALL_VIDEO
from users.models import User

MANAGE_MEDIA_URL = '/api/v1/manage_media'
MANAGE_COMMENTS_URL = '/api/v1/manage_comments'
MANAGE_USERS_URL = '/api/v1/manage_users'
MANAGE_URLS = (MANAGE_MEDIA_URL, MANAGE_COMMENTS_URL, MANAGE_USERS_URL)


def make_user(**kwargs):
    name = uuid.uuid4().hex[:12]
    return create_account(username=f'u{name}', email=f'{name}@example.com', **kwargs)


def logged_in(user):
    client = Client()
    client.force_login(user)
    return client


class ManageApisAccessTest(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.regular = make_user()
        cls.advanced = make_user()
        cls.advanced.advancedUser = True
        cls.advanced.save()
        cls.editor = make_user(is_editor=True)
        cls.manager = make_user(is_manager=True)
        cls.admin = make_user(is_superuser=True)

    def test_anonymous_users_are_denied_every_manage_api(self):
        for url in MANAGE_URLS:
            with self.subTest(url=url):
                self.assertEqual(Client().get(url).status_code, 403)
                self.assertEqual(Client().delete(url).status_code, 403)

    def test_regular_and_advanced_users_are_denied_every_manage_api(self):
        for user in (self.regular, self.advanced):
            client = logged_in(user)
            for url in MANAGE_URLS:
                with self.subTest(url=url, user=user.username):
                    self.assertEqual(client.get(url).status_code, 403)
                    self.assertEqual(client.delete(url).status_code, 403)

    def test_editors_managers_and_admins_can_list_every_manage_api(self):
        for user in (self.editor, self.manager, self.admin):
            client = logged_in(user)
            for url in MANAGE_URLS:
                with self.subTest(url=url, user=user.username):
                    response = client.get(url)
                    self.assertEqual(response.status_code, 200)
                    self.assertIn('results', response.data)


class ManageMediaTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user()
        cls.editor = make_user(is_editor=True)
        cls.manager = make_user(is_manager=True)
        cls.category = Category.objects.create(title='Managed category')
        cls.public = create_media(cls.owner, title='b public', state='public', featured=True, is_reviewed=True, category=[cls.category])
        cls.private = create_media(cls.owner, title='a private', state='private', is_reviewed=False)
        cls.unlisted = create_media(cls.owner, title='c unlisted', state='unlisted', reported_times=3, encoding_status='fail')
        cls.video = create_media(cls.owner, filename=SMALL_VIDEO, title='d video', state='public')

    def tokens(self, params=None, user=None):
        response = logged_in(user or self.editor).get(MANAGE_MEDIA_URL, params or {})
        self.assertEqual(response.status_code, 200)
        return [m['friendly_token'] for m in response.data['results']]

    def titles(self, params=None):
        response = logged_in(self.editor).get(MANAGE_MEDIA_URL, params or {})
        return [m['title'] for m in response.data['results']]

    def test_lists_media_of_every_state(self):
        self.assertEqual(set(self.tokens()), {self.public.friendly_token, self.private.friendly_token, self.unlisted.friendly_token, self.video.friendly_token})

    def test_filters_by_state(self):
        self.assertEqual(self.tokens({'state': 'private'}), [self.private.friendly_token])
        self.assertEqual(set(self.tokens({'state': 'public'})), {self.public.friendly_token, self.video.friendly_token})

    def test_invalid_filter_values_are_ignored(self):
        self.assertEqual(len(self.tokens({'state': 'secret', 'encoding_status': 'weird', 'media_type': 'hologram', 'featured': 'maybe', 'is_reviewed': 'perhaps'})), 4)

    def test_filters_by_encoding_status(self):
        self.assertEqual(self.tokens({'encoding_status': 'fail'}), [self.unlisted.friendly_token])

    def test_filters_by_media_type(self):
        self.assertEqual(self.tokens({'media_type': 'video'}), [self.video.friendly_token])
        self.assertNotIn(self.video.friendly_token, self.tokens({'media_type': 'image'}))

    def test_filters_by_featured(self):
        self.assertEqual(self.tokens({'featured': 'true'}), [self.public.friendly_token])
        self.assertNotIn(self.public.friendly_token, self.tokens({'featured': 'false'}))

    def test_filters_by_review_status(self):
        self.assertIn(self.private.friendly_token, self.tokens({'is_reviewed': 'false'}))
        self.assertNotIn(self.private.friendly_token, self.tokens({'is_reviewed': 'true'}))
        self.assertIn(self.public.friendly_token, self.tokens({'is_reviewed': 'true'}))

    def test_filters_by_category_uid_or_title(self):
        self.assertEqual(self.tokens({'category': self.category.uid}), [self.public.friendly_token])
        self.assertEqual(self.tokens({'category': 'Managed category'}), [self.public.friendly_token])
        self.assertEqual(self.tokens({'category': 'No such category'}), [])

    def test_sorts_by_requested_field_and_direction(self):
        self.assertEqual(self.titles({'sort_by': 'title', 'ordering': 'asc'}), ['a private', 'b public', 'c unlisted', 'd video'])
        self.assertEqual(self.titles({'sort_by': 'title', 'ordering': 'desc'}), ['d video', 'c unlisted', 'b public', 'a private'])
        self.assertEqual(self.titles({'sort_by': 'reported_times'})[0], 'c unlisted')

    def test_unknown_sort_field_falls_back_to_newest_first(self):
        expected = list(Media.objects.order_by('-add_date').values_list('title', flat=True))
        self.assertEqual(self.titles({'sort_by': 'password'}), expected)

    def test_editors_cannot_bulk_delete_media(self):
        response = logged_in(self.editor).delete(f'{MANAGE_MEDIA_URL}?tokens={self.private.friendly_token}')
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Media.objects.filter(pk=self.private.pk).exists())

    def test_managers_bulk_delete_listed_media_only(self):
        response = logged_in(self.manager).delete(f'{MANAGE_MEDIA_URL}?tokens={self.private.friendly_token},,{self.unlisted.friendly_token},')
        self.assertEqual(response.status_code, 204)
        remaining = set(Media.objects.values_list('friendly_token', flat=True))
        self.assertEqual(remaining, {self.public.friendly_token, self.video.friendly_token})

    def test_admins_bulk_delete_media(self):
        response = logged_in(make_user(is_superuser=True)).delete(f'{MANAGE_MEDIA_URL}?tokens={self.public.friendly_token}')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Media.objects.filter(pk=self.public.pk).exists())

    def test_bulk_delete_without_tokens_deletes_nothing(self):
        response = logged_in(self.manager).delete(MANAGE_MEDIA_URL)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(Media.objects.count(), 4)


class ManageCommentsTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user()
        cls.editor = make_user(is_editor=True)
        media = create_media(cls.owner, state='private')
        cls.first = Comment.objects.create(media=media, user=cls.owner, text='beta comment')
        cls.second = Comment.objects.create(media=media, user=cls.owner, text='alpha comment')
        cls.third = Comment.objects.create(media=media, user=cls.owner, text='gamma comment')

    def texts(self, params=None):
        response = logged_in(self.editor).get(MANAGE_COMMENTS_URL, params or {})
        self.assertEqual(response.status_code, 200)
        return [c['text'] for c in response.data['results']]

    def test_lists_comments_on_any_media_including_private(self):
        self.assertEqual(set(self.texts()), {'alpha comment', 'beta comment', 'gamma comment'})

    def test_sorts_by_text(self):
        self.assertEqual(self.texts({'sort_by': 'text', 'ordering': 'asc'}), ['alpha comment', 'beta comment', 'gamma comment'])
        self.assertEqual(self.texts({'sort_by': 'text'}), ['gamma comment', 'beta comment', 'alpha comment'])

    def test_editors_bulk_delete_comments(self):
        response = logged_in(self.editor).delete(f'{MANAGE_COMMENTS_URL}?comment_ids={self.first.uid},{self.third.uid},')
        self.assertEqual(response.status_code, 204)
        self.assertEqual(list(Comment.objects.values_list('text', flat=True)), ['alpha comment'])

    def test_bulk_delete_without_ids_deletes_nothing(self):
        self.assertEqual(logged_in(self.editor).delete(MANAGE_COMMENTS_URL).status_code, 204)
        self.assertEqual(Comment.objects.count(), 3)

    def test_regular_users_cannot_bulk_delete_comments(self):
        response = logged_in(self.owner).delete(f'{MANAGE_COMMENTS_URL}?comment_ids={self.first.uid}')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Comment.objects.count(), 3)


class ManageUsersTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.editor = create_account(username=f'ed{uuid.uuid4().hex[:8]}', email=f'{uuid.uuid4().hex[:8]}@example.com', name='Mid Editor', is_editor=True)
        cls.manager = create_account(username=f'mg{uuid.uuid4().hex[:8]}', email=f'{uuid.uuid4().hex[:8]}@example.com', name='Zed Manager', is_manager=True)
        cls.approved = create_account(username=f'ap{uuid.uuid4().hex[:8]}', email=f'{uuid.uuid4().hex[:8]}@example.com', name='Ann Approved')
        cls.approved.is_approved = True
        cls.approved.save()
        cls.pending = create_account(username=f'pe{uuid.uuid4().hex[:8]}', email=f'{uuid.uuid4().hex[:8]}@example.com', name='Bob Pending')
        User.objects.filter(pk=cls.pending.pk).update(is_approved=None)

    def usernames(self, params=None, user=None):
        response = logged_in(user or self.editor).get(MANAGE_USERS_URL, params or {})
        self.assertEqual(response.status_code, 200)
        return [u['username'] for u in response.data['results']]

    def test_lists_all_users(self):
        self.assertEqual(set(self.usernames()), {self.editor.username, self.manager.username, self.approved.username, self.pending.username})

    def test_filters_by_role(self):
        self.assertEqual(self.usernames({'role': 'manager'}), [self.manager.username])
        self.assertEqual(self.usernames({'role': 'editor'}), [self.editor.username])
        self.assertEqual(len(self.usernames({'role': 'astronaut'})), 4)

    def test_sorts_by_name(self):
        self.assertEqual(self.usernames({'sort_by': 'name', 'ordering': 'asc'}), [self.approved.username, self.pending.username, self.editor.username, self.manager.username])

    @override_settings(USERS_NEEDS_TO_BE_APPROVED=True)
    def test_filters_by_approval_when_approval_is_required(self):
        admin = create_account(username=f'ad{uuid.uuid4().hex[:8]}', email=f'{uuid.uuid4().hex[:8]}@example.com', is_superuser=True)
        self.assertEqual(self.usernames({'is_approved': 'true'}, user=admin), [self.approved.username])
        self.assertNotIn(self.approved.username, self.usernames({'is_approved': 'false'}, user=admin))
        self.assertIn(self.pending.username, self.usernames({'is_approved': 'false'}, user=admin))

    def test_approval_filter_is_ignored_when_approval_is_not_required(self):
        self.assertEqual(len(self.usernames({'is_approved': 'true'})), 4)

    def test_editors_cannot_delete_users(self):
        response = logged_in(self.editor).delete(f'{MANAGE_USERS_URL}?tokens={self.pending.username}')
        self.assertEqual(response.status_code, 400)
        self.assertTrue(User.objects.filter(pk=self.pending.pk).exists())

    def test_managers_delete_users_by_username(self):
        response = logged_in(self.manager).delete(f'{MANAGE_USERS_URL}?tokens={self.pending.username},{self.approved.username}')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(User.objects.filter(pk__in=[self.pending.pk, self.approved.pk]).exists())
        self.assertTrue(User.objects.filter(pk=self.editor.pk).exists())

    def test_managers_cannot_bulk_delete_a_superuser(self):
        admin = create_account(username=f'ad{uuid.uuid4().hex[:8]}', email=f'{uuid.uuid4().hex[:8]}@example.com', is_superuser=True)
        response = logged_in(self.manager).delete(f'{MANAGE_USERS_URL}?tokens={self.pending.username},{admin.username}')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['detail'], 'You do not have permission to delete a superuser.')
        self.assertEqual(User.objects.filter(pk__in=[admin.pk, self.pending.pk]).count(), 2)

    def test_superusers_can_bulk_delete_superusers(self):
        admin = create_account(username=f'ad{uuid.uuid4().hex[:8]}', email=f'{uuid.uuid4().hex[:8]}@example.com', is_superuser=True)
        root = create_account(username=f'rt{uuid.uuid4().hex[:8]}', email=f'{uuid.uuid4().hex[:8]}@example.com', is_superuser=True)
        self.assertEqual(logged_in(root).delete(f'{MANAGE_USERS_URL}?tokens={admin.username}').status_code, 204)
        self.assertFalse(User.objects.filter(pk=admin.pk).exists())

    def test_delete_without_usernames_deletes_nothing(self):
        self.assertEqual(logged_in(self.manager).delete(MANAGE_USERS_URL).status_code, 204)
        self.assertEqual(User.objects.count(), 4)
