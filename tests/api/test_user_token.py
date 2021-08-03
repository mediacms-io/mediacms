from django.test import Client, TestCase
from rest_framework.authtoken.models import Token

from files.tests import create_account

API_V1_USER_TOKEN_URL = '/api/v1/user/token'


class TestUserToken(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        self.password = 'this_is_a_fake_password'
        self.user = create_account(password=self.password)

    def test_user_token_endpoint(self):
        client = Client()
        response = client.get(API_V1_USER_TOKEN_URL)
        self.assertEqual(
            response.status_code,
            403,
            "FORBIDDEN",
        )

        user = self.user
        client.force_login(user=user)

        response = client.post(API_V1_USER_TOKEN_URL)
        self.assertEqual(
            response.status_code,
            405,
            "method not allowed here",
        )

        response = client.get(API_V1_USER_TOKEN_URL)
        data = response.data

        self.assertEqual(
            response.status_code,
            200,
            "expected 200",
        )

        token = Token.objects.filter(user=user).first()
        self.assertEqual(
            data.get('token'),
            token.key,
            "Expected valid token",
        )
