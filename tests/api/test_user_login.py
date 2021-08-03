from django.test import Client, TestCase
from rest_framework.authtoken.models import Token

from files.tests import create_account

API_V1_LOGIN_URL = '/api/v1/login'


class TestUserLogin(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        self.password = 'this_is_a_fake_password'
        self.user = create_account(password=self.password)

    def test_login_endpoint(self):
        client = Client()
        response = client.get(API_V1_LOGIN_URL)
        self.assertEqual(
            response.status_code,
            405,
            "GET not allowed here",
        )

        response = client.post(API_V1_LOGIN_URL, {'username': 'fake', 'password': 'fake'})
        self.assertTrue('User not found' in str(response.content), 'Expected user not to be there')

        user = self.user
        response = client.post(API_V1_LOGIN_URL, {'username': user.username, 'password': self.password})

        self.assertEqual(
            response.status_code,
            200,
            "Expected 200",
        )
        data = response.data

        self.assertEqual(
            data.get('email'),
            user.email,
            "Expected user email",
        )
        self.assertEqual(
            data.get('username'),
            user.username,
            "Expected username",
        )

        token = Token.objects.filter(user=user).first()
        self.assertEqual(
            data.get('token'),
            token.key,
            "Expected valid token",
        )
