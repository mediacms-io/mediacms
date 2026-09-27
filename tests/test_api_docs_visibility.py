import importlib

from django.test import Client, TestCase, override_settings
from django.urls import Resolver404, clear_url_caches, resolve

import cms.urls
from files.tests import create_account

# the swagger UI loads the schema from /swagger/?format=openapi
DOCS_URLS = ["/swagger/", "/swagger/?format=openapi", "/docs/api/"]


def reload_urlconf():
    # the URLconf is built at import time, so settings read there need a reload
    importlib.reload(cms.urls)
    clear_url_caches()


class TestDebugRoutes(TestCase):
    def tearDown(self):
        reload_urlconf()

    @override_settings(DEBUG=False)
    def test_debug_routes_not_mounted_without_debug(self):
        reload_urlconf()
        with self.assertRaises(Resolver404):
            resolve("/__debug__/render_panel/")

    @override_settings(DEBUG=True)
    def test_debug_routes_mounted_in_debug_mode(self):
        reload_urlconf()
        self.assertEqual(resolve("/__debug__/render_panel/").url_name, "render_panel")


class TestApiDocsVisibility(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        self.user = create_account()

    def test_api_docs_public_by_default(self):
        for url in DOCS_URLS:
            self.assertEqual(Client().get(url).status_code, 200, url)

    @override_settings(ALLOW_ANONYMOUS_API_DOCS=False)
    def test_anonymous_api_docs_refused_when_disabled(self):
        for url in DOCS_URLS:
            self.assertIn(Client().get(url).status_code, (401, 403, 404), url)

    @override_settings(ALLOW_ANONYMOUS_API_DOCS=False)
    def test_authenticated_api_docs_kept_when_disabled(self):
        client = Client()
        client.force_login(self.user)
        for url in DOCS_URLS:
            self.assertEqual(client.get(url).status_code, 200, url)
