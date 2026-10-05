import uuid
from unittest.mock import MagicMock, patch

from allauth.socialaccount.models import SocialApp
from django.contrib.auth.models import AnonymousUser
from django.http import Http404
from django.test import Client, RequestFactory, TestCase, override_settings
from rest_framework.request import Request

from actions.models import MediaAction
from cms.custom_pagination import FastPaginationWithoutCount
from files.models import EncodeProfile, Encoding, Media
from files.tests import create_account, create_media
from files.views.auth import custom_login_view, saml_metadata
from identity_providers.models import LoginOption

ENCODE_PROFILES_URL = '/api/v1/encode_profiles/'
TASKS_URL = '/api/v1/tasks'


def make_user(**kwargs):
    name = uuid.uuid4().hex[:12]
    return create_account(username=f'u{name}', email=f'{name}@example.com', **kwargs)


def logged_in(user):
    client = Client()
    client.force_login(user)
    return client


class EncodeProfileListTest(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def test_lists_every_encode_profile_to_anyone(self):
        response = Client().get(ENCODE_PROFILES_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), EncodeProfile.objects.count())
        self.assertEqual(set(response.data[0]), {'name', 'extension', 'resolution', 'codec', 'description'})
        self.assertEqual({p['name'] for p in response.data}, set(EncodeProfile.objects.values_list('name', flat=True)))


class TasksApiTest(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.admin = make_user(is_superuser=True)
        cls.manager = make_user(is_manager=True)
        cls.regular = make_user()

    def test_non_staff_users_cannot_list_or_cancel_tasks(self):
        for client in (Client(), logged_in(self.regular), logged_in(self.manager)):
            self.assertEqual(client.get(TASKS_URL).status_code, 403)
            self.assertEqual(client.delete(f'{TASKS_URL}/some-task-id').status_code, 403)

    def test_admin_cancelling_a_task_gets_a_204(self):
        self.assertEqual(logged_in(self.admin).delete(f'{TASKS_URL}/some-task-id').status_code, 204)

    def test_admin_lists_running_tasks_with_encoding_details(self):
        media = create_media(self.regular, title='being encoded')
        profile = EncodeProfile.objects.filter(active=True).first()
        Encoding.objects.create(media=media, profile=profile, task_id='enc-task', progress=42)
        inspector = MagicMock()
        inspector.active.return_value = {
            'worker1': [{'id': 'enc-task', 'name': 'encode_media', 'args': f"('{media.friendly_token}', {profile.id}, 'x')", 'time_start': 1}],
        }
        inspector.reserved.return_value = {'worker2': [{'id': 'other-task', 'name': 'produce_sprite_from_video', 'args': '()', 'time_start': None}]}
        inspector.scheduled.return_value = {}

        with patch('files.methods.celery_app.control.inspect', return_value=inspector):
            response = logged_in(self.admin).get(TASKS_URL)

        self.assertEqual(response.status_code, 200)
        active = response.data['active']['tasks']
        self.assertEqual(len(active), 1)
        self.assertEqual(active[0]['worker'], 'worker1')
        self.assertEqual(active[0]['info'], {'profile name': profile.name, 'media title': 'being encoded', 'encoding progress': 42})
        self.assertEqual(response.data['reserved']['tasks'][0]['task_id'], 'other-task')
        self.assertNotIn('info', response.data['reserved']['tasks'][0])
        self.assertEqual(response.data['scheduled']['tasks'], [])
        self.assertEqual(response.data['task_ids'], ['enc-task', 'other-task'])
        self.assertEqual(response.data['media_profile_pairs'], [(media.friendly_token, profile.id)])


class UserActionsTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user()
        cls.other = make_user()
        cls.liked_first = create_media(cls.other, title='liked first')
        cls.liked_second = create_media(cls.other, title='liked second')
        cls.watched = create_media(cls.other, title='watched only')
        cls.liked_by_other = create_media(cls.other, title='liked by other')
        MediaAction.objects.create(user=cls.user, media=cls.liked_first, action='like')
        MediaAction.objects.create(user=cls.user, media=cls.liked_second, action='like')
        MediaAction.objects.create(user=cls.user, media=cls.watched, action='watch')
        MediaAction.objects.create(user=cls.other, media=cls.liked_by_other, action='like')

    def titles(self, response):
        self.assertEqual(response.status_code, 200)
        return [m['title'] for m in response.data['results']]

    def test_lists_media_the_user_acted_on_most_recent_first(self):
        self.assertEqual(self.titles(logged_in(self.user).get('/api/v1/user/action/like')), ['liked second', 'liked first'])
        self.assertEqual(self.titles(logged_in(self.user).get('/api/v1/user/action/watch')), ['watched only'])

    def test_unknown_action_returns_nothing(self):
        self.assertEqual(self.titles(logged_in(self.user).get('/api/v1/user/action/steal')), [])

    def test_anonymous_actions_are_tracked_by_session(self):
        client = Client()
        session = client.session
        session['seen'] = True
        session.save()
        MediaAction.objects.create(session_key=session.session_key, media=self.watched, action='watch')
        self.assertEqual(self.titles(client.get('/api/v1/user/action/watch')), ['watched only'])
        self.assertEqual(self.titles(client.get('/api/v1/user/action/like')), [])

    def test_anonymous_users_without_session_get_nothing(self):
        self.assertEqual(self.titles(Client().get('/api/v1/user/action/like')), [])


class SamlMetadataViewTest(TestCase):
    def request(self):
        request = RequestFactory().get('/saml/metadata')
        request.user = AnonymousUser()
        return request

    def test_metadata_is_404_when_saml_is_disabled(self):
        with self.assertRaises(Http404):
            saml_metadata(self.request())

    @override_settings(USE_SAML=True, FRONTEND_HOST='https://media.example.org')
    def test_metadata_lists_an_assertion_consumer_service_per_saml_app(self):
        SocialApp.objects.create(provider='saml', name='first idp', client_id='idp-one')
        SocialApp.objects.create(provider='saml', name='second idp', client_id='idp-two')
        SocialApp.objects.create(provider='google', name='not saml', client_id='google-app')

        response = saml_metadata(self.request())
        body = response.content.decode()

        self.assertEqual(response['Content-Type'], 'application/xml')
        self.assertIn('entityID="https://media.example.org/saml/metadata/"', body)
        self.assertIn('Location="https://media.example.org/accounts/saml/idp-one/acs/"', body)
        self.assertIn('Location="https://media.example.org/accounts/saml/idp-two/acs/"', body)
        self.assertNotIn('google-app', body)
        self.assertEqual(body.count('<md:AssertionConsumerService'), 2)


class CustomLoginViewTest(TestCase):
    def request(self):
        request = RequestFactory().get('/accounts/login')
        request.user = AnonymousUser()
        request.session = {}
        request.LANGUAGE_CODE = 'en'
        return request

    def test_redirects_to_system_login_without_identity_providers(self):
        response = custom_login_view(self.request())
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response['Location'], '/accounts/login')

    @override_settings(USE_IDENTITY_PROVIDERS=True)
    def test_lists_only_active_login_options(self):
        LoginOption.objects.create(title='Login through University', url='/accounts/saml/uni/login/', ordering=1)
        LoginOption.objects.create(title='Retired option', url='/old/', active=False)

        response = custom_login_view(self.request())
        body = response.content.decode()

        self.assertEqual(response.status_code, 200)
        self.assertIn('Login through University', body)
        self.assertIn('/accounts/saml/uni/login/', body)
        self.assertNotIn('Retired option', body)


class FastPaginationWithoutCountTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        owner = make_user()
        for index in range(3):
            create_media(owner, title=f'paged {index}')

    def test_paginated_response_omits_the_count(self):
        paginator = FastPaginationWithoutCount()
        paginator.page_size = 2
        request = Request(RequestFactory().get('/api/v1/media'))
        page = paginator.paginate_queryset(Media.objects.order_by('title'), request)
        response = paginator.get_paginated_response([m.title for m in page])

        self.assertEqual(list(response.data), ['next', 'previous', 'results'])
        self.assertEqual(response.data['results'], ['paged 0', 'paged 1'])
        self.assertIsNone(response.data['previous'])
        self.assertIn('page=2', response.data['next'])
