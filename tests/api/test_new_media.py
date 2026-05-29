import uuid

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase
from rest_framework.test import APIClient

from files.models import Encoding, Language, Media, Subtitle, Tag
from files.tests import create_account

API_V1_LOGIN_URL = '/api/v1/login'


class TestX(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        self.password = 'this_is_a_fake_password'

        self.user = create_account(password=self.password)

    def test_file_upload(self):
        client = Client()
        client.login(username=self.user.username, password=self.password)

        # use both ways, form + API to upload a new media file
        # while video transcoding through ffmpeg takes place asynchronously
        # (through celery workers), inside tests ffmpeg runs synchronously
        # because celery is started with setting task_always_eager
        # practically this means that this testing will take some time, but
        # ensures that video transcoding completes well
        with open('fixtures/small_video.mp4', 'rb') as fp:
            client.post('/api/v1/media', {'title': 'small video file test', 'media_file': fp})

        with open('fixtures/test_image.png', 'rb') as fp:
            client.post('/api/v1/media', {'title': 'image file test', 'media_file': fp})

        with open('fixtures/medium_video.mp4', 'rb') as fp:
            client.post('/fu/upload/', {'qqfile': fp, 'qqfilename': 'medium_video.mp4', 'qquuid': str(uuid.uuid4())})

        self.assertEqual(Media.objects.all().count(), 3, "Problem with file upload")
        # by default the portal_workflow is public, so anything uploaded gets public
        self.assertEqual(Media.objects.filter(state='public').count(), 3, "Expected all media to be public, as per the default portal workflow")
        self.assertEqual(Media.objects.filter(media_type='video', encoding_status='success').count(), 2, "Encoding did not finish well")
        self.assertEqual(Media.objects.filter(media_type='video').count(), 2, "Media identification failed")
        self.assertEqual(Media.objects.filter(media_type='image').count(), 1, "Media identification failed")
        self.assertEqual(Media.objects.filter(user=self.user).count(), 3, "User assignment failed")
        medium_video = Media.objects.get(title="medium_video.mp4")
        self.assertEqual(len(medium_video.hls_info), 13, "Problem with HLS info")

        # using the provided EncodeProfiles, these two files should produce 9 Encoding objects.
        # if new EncodeProfiles are added and enabled, this will break!
        self.assertEqual(Encoding.objects.filter(status='success').count(), 10, "Not all video transcodings finished well")

    def test_external_m3u8_upload(self):
        client = Client()
        client.login(username=self.user.username, password=self.password)

        external_url = "https://example.com/path/master.m3u8"
        response = client.post(
            '/api/v1/media',
            {
                'title': 'external hls media',
                'external_m3u8_url': external_url,
            },
        )

        self.assertEqual(response.status_code, 201)
        media = Media.objects.get(title='external hls media')
        self.assertEqual(media.external_hls_url, external_url)
        self.assertEqual(media.media_type, 'video')
        self.assertEqual(media.encoding_status, 'success')
        self.assertEqual(media.hls_info.get('master_file'), external_url)

    def test_external_m3u8_upload_with_comments_download_and_tags(self):
        client = Client()
        client.login(username=self.user.username, password=self.password)

        response = client.post(
            '/api/v1/media',
            {
                'title': 'external hls media with options',
                'external_m3u8_url': 'https://example.com/path/master.m3u8',
                'enable_comments': 'false',
                'allow_download': '0',
                'tags': 'news,events',
            },
        )

        self.assertEqual(response.status_code, 201)

        media = Media.objects.get(title='external hls media with options')
        self.assertFalse(media.enable_comments)
        self.assertFalse(media.allow_download)
        self.assertSetEqual(set(media.tags.values_list('title', flat=True)), {'news', 'events'})

    def test_media_update_with_subtitle_upload(self):
        client = APIClient()
        client.login(username=self.user.username, password=self.password)

        with open('fixtures/test_image.png', 'rb') as fp:
            client.post('/api/v1/media', {'title': 'caption target media', 'media_file': fp}, format='multipart')

        media = Media.objects.get(title='caption target media')
        language = Language.objects.create(code='en', title='English')

        subtitle_content = b"1\n00:00:00,000 --> 00:00:02,000\nHello from API captions\n"
        subtitle_file = SimpleUploadedFile('captions.srt', subtitle_content, content_type='text/plain')

        response = client.put(
            f'/api/v1/media/{media.friendly_token}',
            {
                'title': 'caption target media updated',
                'subtitle_file': subtitle_file,
                'subtitle_language': str(language.id),
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 201)

        media.refresh_from_db()
        self.assertEqual(media.title, 'caption target media updated')
        self.assertTrue(Subtitle.objects.filter(media=media, language=language).exists())

    def test_media_update_with_comments_download_and_tags(self):
        client = APIClient()
        client.login(username=self.user.username, password=self.password)

        with open('fixtures/test_image.png', 'rb') as fp:
            client.post('/api/v1/media', {'title': 'media update options target', 'media_file': fp}, format='multipart')

        media = Media.objects.get(title='media update options target')
        Tag.objects.create(title='oldtag', user=self.user)
        media.tags.add(Tag.objects.get(title='oldtag'))

        response = client.put(
            f'/api/v1/media/{media.friendly_token}',
            {
                'title': 'media update options target',
                'enable_comments': 'false',
                'allow_download': 'false',
                'tags': 'alpha,beta',
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 201)
        media.refresh_from_db()
        self.assertFalse(media.enable_comments)
        self.assertFalse(media.allow_download)
        self.assertSetEqual(set(media.tags.values_list('title', flat=True)), {'alpha', 'beta'})
