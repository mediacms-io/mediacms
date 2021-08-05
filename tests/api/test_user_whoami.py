from django.test import Client, TestCase

from files.tests import create_account

API_V1_LOGIN_URL = '/api/v1/whoami'


class TestUserWhoami(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        self.user = create_account()

    def test_whoami_endpoint(self):
        client = Client()
        response = client.get(API_V1_LOGIN_URL)
        self.assertEqual(
            response.status_code,
            403,
            "Expected 403",
        )

        user = self.user
        client.force_login(user=user)
        response = client.get(API_V1_LOGIN_URL)
        self.assertEqual(
            response.status_code,
            200,
            "Expected 200",
        )
        data = response.data
        self.assertEqual(
            data.get('description'),
            user.description,
            "Expected user description",
        )
        self.assertEqual(
            data.get('username'),
            user.username,
            "Expected username",
        )
