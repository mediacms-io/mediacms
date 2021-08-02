from django.test import Client, TestCase
from faker import Factory

from users.models import User

faker = Factory.create()


class TestUserWhoami(TestCase):
    def setUp(self):
        email = faker.email()
        self.username = email.split('a')[0]
        self.password = faker.password()
        user = User.objects.create(username=self.username, email=email, name=faker.name(), description=faker.text(), is_superuser=False)
        user.set_password(self.password)
        user.save()

    def test_whoami_endpoint(self):
        client = Client()
        response = client.get('/api/v1/whoami')
        self.assertEqual(
            response.status_code,
            403,
            "Expected 403",
        )
        user = User.objects.get(username=self.username)
        client.login(username=self.username, password=self.password)
        response = client.get('/api/v1/whoami')
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
