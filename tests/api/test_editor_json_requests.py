import json
from unittest import mock

from django.core.cache import cache
from django.core.files import File
from django.test import Client, TestCase

from files.models import Media, VideoChapterData, VideoTrimRequest
from files.tests import create_account

CHAPTERS = {'chapters': [{'startTime': '00:00:00.000', 'endTime': '00:00:05.000', 'chapterTitle': 'Intro'}]}
TRIM = {'segments': [{'startTime': '00:00:00.000', 'endTime': '00:00:05.000'}]}


class TestEditorJsonRequests(TestCase):
    """The chapter and trim endpoints only accept JSON requests

    Both views are csrf_exempt. A cross-site HTML form can send a text/plain body
    with the session cookie, a JSON request needs a CORS preflight.
    """

    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        cache.clear()
        self.user = create_account(username='owner', password='this_is_a_fake_password')
        with open('fixtures/test_image.png', 'rb') as fp:
            self.media = Media.objects.create(title='owned media', user=self.user, media_file=File(fp))
        self.client = Client(enforce_csrf_checks=True)
        self.client.force_login(self.user)

    def post(self, action, data, content_type):
        return self.client.post(f'/api/v1/media/{self.media.friendly_token}/{action}', data=json.dumps(data), content_type=content_type)

    def test_chapters_text_plain_refused(self):
        response = self.post('chapters', CHAPTERS, 'text/plain')
        self.assertEqual(response.status_code, 415)

    def test_chapters_text_plain_not_saved(self):
        self.post('chapters', CHAPTERS, 'text/plain')
        self.assertFalse(VideoChapterData.objects.filter(media=self.media).exists())

    def test_chapters_json_saved(self):
        response = self.post('chapters', CHAPTERS, 'application/json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(VideoChapterData.objects.filter(media=self.media).exists())

    @mock.patch('files.views.pages.video_trim_task.delay')
    def test_trim_text_plain_refused(self, delay):
        response = self.post('trim_video', TRIM, 'text/plain')
        self.assertEqual(response.status_code, 415)

    @mock.patch('files.views.pages.video_trim_task.delay')
    def test_trim_text_plain_not_queued(self, delay):
        self.post('trim_video', TRIM, 'text/plain')
        self.assertFalse(VideoTrimRequest.objects.filter(media=self.media).exists())

    @mock.patch('files.views.pages.video_trim_task.delay')
    def test_trim_json_queued(self, delay):
        response = self.post('trim_video', TRIM, 'application/json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(VideoTrimRequest.objects.filter(media=self.media).exists())
