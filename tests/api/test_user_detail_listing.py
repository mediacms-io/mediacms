from django.test import Client, TestCase, override_settings

from files.tests import create_account


class TestUserDetailListingSetting(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        self.user = create_account(username="profileowner", email="profileowner@example.com", name="Profile Owner Name")
        self.viewer = create_account()
        self.api_url = f"/api/v1/users/{self.user.username}"
        self.page_urls = [
            f"/user/{self.user.username}",
            f"/user/{self.user.username}/about",
            f"/user/{self.user.username}/playlists",
        ]

    def assert_not_disclosed(self, response):
        body = response.content.decode()
        self.assertNotIn(self.user.name, body)
        self.assertNotIn(self.user.email, body)

    @override_settings(ALLOW_ANONYMOUS_USER_LISTING=False)
    def test_anonymous_api_detail_refused_when_listing_disabled(self):
        response = Client().get(self.api_url)
        self.assertIn(response.status_code, (401, 403, 404))
        self.assert_not_disclosed(response)

    @override_settings(ALLOW_ANONYMOUS_USER_LISTING=False)
    def test_anonymous_profile_pages_refused_when_listing_disabled(self):
        for url in self.page_urls:
            response = Client().get(url)
            self.assertIn(response.status_code, (302, 401, 403, 404), url)
            if response.status_code == 302:
                self.assertIn("/accounts/login/", response["Location"], url)
            self.assert_not_disclosed(response)

    @override_settings(ALLOW_ANONYMOUS_USER_LISTING=False)
    def test_authenticated_access_kept_when_listing_disabled(self):
        client = Client()
        client.force_login(self.viewer)
        response = client.get(self.api_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data.get("username"), self.user.username)
        for url in self.page_urls:
            self.assertEqual(client.get(url).status_code, 200, url)

    @override_settings(ALLOW_ANONYMOUS_USER_LISTING=True)
    def test_anonymous_access_kept_by_default(self):
        response = Client().get(self.api_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data.get("username"), self.user.username)
        for url in self.page_urls:
            self.assertEqual(Client().get(url).status_code, 200, url)
