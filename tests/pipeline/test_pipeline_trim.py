import os
import uuid
from unittest import mock

from django.core.files.base import ContentFile
from django.test import TestCase

from files import helpers, tasks
from files.models import EncodeProfile, Encoding, Media, VideoTrimRequest
from files.tests import create_account, create_media
from files.tests.media_utils import SMALL_VIDEO, fixture_path


def file_duration(path):
    return float(helpers.media_file_info(path)["video_duration"])


class VideoTrimTaskTest(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.user = create_account()
        EncodeProfile.objects.exclude(name="h264-240").update(active=False)
        with open(fixture_path(SMALL_VIDEO), "rb") as handle:
            cls.source = handle.read()

    def setUp(self):
        self.video = create_media(self.user, SMALL_VIDEO, title=f"pipeline trim {uuid.uuid4().hex[:6]}")
        rendition = Encoding(media=self.video, profile=EncodeProfile.objects.get(name="h264-240"), status="success", progress=100)
        rendition.media_file.save("pipeline_240.mp4", ContentFile(self.source), save=False)
        Encoding.objects.bulk_create([rendition])

    def trim_request(self, action, *ranges):
        timestamps = [{"startTime": start, "endTime": end} for start, end in ranges]
        return VideoTrimRequest.objects.create(media=self.video, video_action=action, timestamps=timestamps)

    def rendition_of(self, media):
        return media.encodings.get(profile__name="h264-240")

    def test_replace_trims_the_original_and_its_rendition_in_place(self):
        request = self.trim_request("replace", ("00:00:05.000", "00:00:15.000"))

        self.assertTrue(tasks.video_trim_task(request.id))

        self.video.refresh_from_db()
        self.assertTrue(9 <= self.video.duration <= 16, self.video.duration)
        self.assertLess(file_duration(self.rendition_of(self.video).media_file.path), 17)
        request.refresh_from_db()
        self.assertEqual(request.status, "success")
        self.assertEqual(request.media, self.video)
        self.assertEqual(Media.objects.filter(user=self.user).count(), 1)

    def test_post_trim_refreshes_thumbnails_sprites_and_hls(self):
        request = self.trim_request("replace", ("00:00:02.000", "00:00:08.000"))

        tasks.video_trim_task(request.id)

        self.video.refresh_from_db()
        self.assertTrue(os.path.exists(self.video.thumbnail.path))
        self.assertTrue(self.video.sprites)
        self.assertTrue(os.path.exists(self.video.hls_file))
        self.assertTrue(self.rendition_of(self.video).size.endswith("MB"))

    def test_a_trim_from_the_start_keeps_the_head_of_the_video(self):
        request = self.trim_request("replace", ("00:00:00.000", "00:00:06.000"))

        tasks.video_trim_task(request.id)

        self.video.refresh_from_db()
        self.assertTrue(5 <= self.video.duration <= 7, self.video.duration)

    def test_save_new_leaves_the_original_alone_and_trims_a_copy(self):
        request = self.trim_request("save_new", ("00:00:05.000", "00:00:15.000"))

        self.assertTrue(tasks.video_trim_task(request.id))

        self.video.refresh_from_db()
        self.assertEqual(self.video.duration, 27)
        self.assertAlmostEqual(file_duration(self.rendition_of(self.video).media_file.path), 27.2, delta=0.5)

        copy = Media.objects.get(user=self.user, title=f"{self.video.title} (Trimmed)")
        self.assertTrue(9 <= copy.duration <= 16, copy.duration)
        self.assertLess(file_duration(self.rendition_of(copy).media_file.path), 17)
        request.refresh_from_db()
        self.assertEqual(request.media, copy)
        self.assertEqual(request.status, "success")

    def test_create_segments_with_one_range_behaves_like_save_new(self):
        request = self.trim_request("create_segments", ("00:00:05.000", "00:00:15.000"))

        tasks.video_trim_task(request.id)

        self.video.refresh_from_db()
        self.assertEqual(self.video.duration, 27)
        self.assertTrue(Media.objects.filter(user=self.user, title=f"{self.video.title} (Trimmed)").exists())

    def test_create_segments_makes_one_new_media_per_range(self):
        request = self.trim_request("create_segments", ("00:00:02.000", "00:00:06.000"), ("00:00:15.000", "00:00:25.000"))

        self.assertTrue(tasks.video_trim_task(request.id))

        first = Media.objects.get(title=f"{self.video.title} (Trimmed) 1")
        second = Media.objects.get(title=f"{self.video.title} (Trimmed) 2")
        self.assertLess(first.duration, second.duration)
        self.assertTrue(3 <= first.duration <= 7, first.duration)
        self.assertTrue(9 <= second.duration <= 14, second.duration)
        for segment in (first, second):
            self.assertEqual(segment.trim_requests.get().status, "success")
        request.refresh_from_db()
        self.assertEqual(request.status, "success")
        self.video.refresh_from_db()
        self.assertEqual(self.video.duration, 27)

    def test_a_request_without_usable_timestamps_fails(self):
        request = VideoTrimRequest.objects.create(media=self.video, video_action="replace", timestamps=[{"start": 1}])

        self.assertFalse(tasks.video_trim_task(request.id))

        request.refresh_from_db()
        self.assertEqual(request.status, "fail")
        self.video.refresh_from_db()
        self.assertEqual(self.video.duration, 27)

    def test_an_unknown_trim_request_is_ignored(self):
        self.assertFalse(tasks.video_trim_task(999999))

    def test_trim_drops_renditions_that_were_still_encoding(self):
        pending = Encoding.objects.create(media=self.video, profile=EncodeProfile.objects.get(name="h264-144"), status="running", temp_file="/tmp/pipeline-never-exists.mp4")
        request = self.trim_request("replace", ("00:00:05.000", "00:00:15.000"))

        tasks.video_trim_task(request.id)

        self.assertFalse(Encoding.objects.filter(pk=pending.pk).exists())
        self.assertTrue(self.video.encodings.filter(profile__name="h264-240", status="success").exists())


class TrimHelpersTest(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.video = create_media(create_account(), SMALL_VIDEO)

    def test_handle_pending_running_encodings_keeps_only_finished_ones(self):
        h144 = EncodeProfile.objects.get(name="h264-144")
        h240 = EncodeProfile.objects.get(name="h264-240")
        pending = Encoding.objects.create(media=self.video, profile=h144, status="pending", chunk_file_path=self.video.media_file.path)
        done = Encoding.objects.create(media=self.video, profile=h240, status="success")

        self.assertTrue(tasks.handle_pending_running_encodings(self.video))

        self.assertFalse(Encoding.objects.filter(pk=pending.pk).exists())
        self.assertTrue(Encoding.objects.filter(pk=done.pk).exists())
        self.assertFalse(tasks.handle_pending_running_encodings(self.video))

    def test_pre_trim_re_encodes_when_a_fitting_profile_is_missing(self):
        with mock.patch.object(Media, "encode") as encode:
            tasks.pre_trim_video_actions(self.video)

        encode.assert_called_once_with()

    def test_pre_trim_does_nothing_when_every_fitting_profile_is_encoded(self):
        for name in ("h264-144", "h264-240"):
            encoding = Encoding(media=self.video, profile=EncodeProfile.objects.get(name=name), status="success")
            encoding.media_file.save(f"pipeline_{name}.mp4", ContentFile(b"x"), save=False)
            Encoding.objects.bulk_create([encoding])

        with mock.patch.object(Media, "encode") as encode:
            tasks.pre_trim_video_actions(self.video)

        encode.assert_not_called()

    def test_post_trim_action_without_renditions_only_closes_the_request(self):
        request = VideoTrimRequest.objects.create(media=self.video, video_action="replace", status="running", timestamps=[])

        with mock.patch.object(tasks.create_hls, "delay") as create_hls:
            self.assertTrue(tasks.post_trim_action(self.video.friendly_token))

        create_hls.assert_not_called()
        request.refresh_from_db()
        self.assertEqual(request.status, "success")

    def test_post_trim_action_for_unknown_media_is_ignored(self):
        self.assertFalse(tasks.post_trim_action("nosuchtoken"))
