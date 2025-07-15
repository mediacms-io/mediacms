import uuid

from django.test import Client, TestCase

from files.models import Encoding, Media
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
