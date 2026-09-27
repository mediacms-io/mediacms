import importlib

from django.core.cache import cache
from django.core.files import File
from django.test import TestCase, override_settings
from django.urls import clear_url_caches

from files.models import Media
from files.tests import create_account


def reload_urls():
    import cms.urls
    import files.urls

    importlib.reload(files.urls)
    importlib.reload(cms.urls)
    clear_url_caches()


class TestSitemap(TestCase):
    """With GENERATE_SITEMAP on, /sitemap.xml lists public media only"""

    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        # files/urls.py reads GENERATE_SITEMAP at import time
        override = override_settings(GENERATE_SITEMAP=True)
        override.enable()
        self.addCleanup(reload_urls)
        self.addCleanup(override.disable)
        reload_urls()

        cache.clear()
        self.owner = create_account(username='sitemapowner', password='this_is_a_fake_password')
        self.other = create_account(username='sitemapother', password='this_is_a_fake_password')
        with open('fixtures/test_image.png', 'rb') as fp:
            self.public_media = Media.objects.create(title='public image', user=self.owner, media_file=File(fp))
        with open('fixtures/test_image.png', 'rb') as fp:
            self.private_media = Media.objects.create(title='private image', user=self.other, media_file=File(fp))
        Media.objects.filter(pk=self.public_media.pk).update(state='public', encoding_status='success', is_reviewed=True, listable=True)
        Media.objects.filter(pk=self.private_media.pk).update(state='private', listable=False)

    def test_sitemap_is_served(self):
        response = self.client.get('/sitemap.xml')
        self.assertEqual(response.status_code, 200)
        self.assertIn('xml', response['Content-Type'])
        self.assertContains(response, '<urlset')

    def test_sitemap_lists_public_media_only(self):
        response = self.client.get('/sitemap.xml')
        self.assertContains(response, f'/view?m={self.public_media.friendly_token}')
        self.assertNotContains(response, self.private_media.friendly_token)

    def test_sitemap_lists_no_users(self):
        response = self.client.get('/sitemap.xml')
        self.assertNotContains(response, 'sitemapowner')
        self.assertNotContains(response, 'sitemapother')
        self.assertNotContains(response, '/user/')
