import shutil
import tempfile
from unittest import mock

from django.test import TestCase

from files.models import Category, Media
from files.tests import create_account
from migrationservice.compose import MAX_STREAMS, ComposeError
from migrationservice.models import MigrationRecord, MigrationService
from migrationservice.tasks import combine_streams, import_media_entry
from migrationservice.tests.fakes import FakeProvider

VIDEO = "fixtures/small_video.mp4"

SCREEN = {"id": "0_screen", "width": 1728, "height": 960}
SECOND_SCREEN = {"id": "0_second", "width": 1280, "height": 720}
CAMERA = {"id": "0_camera", "width": 640, "height": 480}

CAMERA_FLAVORS = [
    {"id": "cam_small", "width": 480, "height": 360, "fileExt": "mp4", "isOriginal": False},
    {"id": "cam_big", "width": 640, "height": 480, "fileExt": "mp4", "isOriginal": True},
]
SCREEN_FLAVORS = [
    {"id": "scr_small", "width": 480, "height": 272, "fileExt": "mp4", "isOriginal": False},
    {"id": "scr_big", "width": 1728, "height": 960, "fileExt": "mp4", "isOriginal": True},
]
SECOND_FLAVORS = [
    {"id": "sec_small", "width": 640, "height": 360, "fileExt": "mp4", "isOriginal": False},
    {"id": "sec_big", "width": 1280, "height": 720, "fileExt": "mp4", "isOriginal": True},
]


class FakeMultiStreamProvider:
    def __init__(self):
        self.downloaded = []

    def download_flavor(self, flavor, dest_path):
        self.downloaded.append(flavor["id"])
        with open(dest_path, "wb") as handle:
            handle.write(b"0" * 1024)
        return 1024


def make_service(**options):
    return MigrationService.objects.create(
        name="Kaltura",
        provider="kaltura",
        connection={"service_url": "https://kaltura.example.edu", "partner_id": "342", "app_token_id": "atok", "app_token": "x"},
        options=dict({"source_category_ids": "8812"}, **options),
    )


def stream(entry, flavors):
    return {"entry": entry, "flavors": list(flavors)}


class TestCombineStreams(TestCase):
    def setUp(self):
        self.service = make_service()
        self.data = stream(CAMERA, CAMERA_FLAVORS)
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def combine(self, provider, children, want_renditions, draw=None):
        with mock.patch("migrationservice.tasks.compose_side_by_side", side_effect=draw or (lambda paths, dest, width, height: dest)) as drawn:
            result = combine_streams(self.service, provider, "0_camera", self.data, children, self.tmp, want_renditions)
        return result, drawn

    def test_an_entry_with_no_children_is_left_alone(self):
        provider = FakeMultiStreamProvider()
        result, drawn = self.combine(provider, [], True)
        self.assertIsNone(result)
        self.assertEqual(drawn.call_count, 0)
        self.assertEqual(provider.downloaded, [])

    def test_the_camera_is_fetched_once_and_drawn_beside_every_screen_rung(self):
        provider = FakeMultiStreamProvider()
        (original, flavors, extension), drawn = self.combine(provider, [stream(SCREEN, SCREEN_FLAVORS)], True)

        self.assertEqual(extension, "mp4")
        self.assertEqual(original["id"], "scr_big")
        self.assertEqual((original["width"], original["height"]), (1706, 960))
        self.assertTrue(original["_local_path"].endswith("0_camera.mp4"))
        self.assertEqual(sorted(flavor["id"] for flavor in flavors), ["scr_big", "scr_small"])
        self.assertTrue(all(flavor.get("_local_path") for flavor in flavors))
        self.assertEqual(provider.downloaded.count("cam_small"), 1)
        self.assertNotIn("cam_big", provider.downloaded)
        self.assertEqual(drawn.call_count, 2)
        self.assertEqual([call.args[2:] for call in drawn.call_args_list], [(1706, 960), (484, 272)])
        self.assertTrue(all(call.args[0][-1].endswith("stream_cam_small.mp4") for call in drawn.call_args_list))

    def test_without_renditions_only_the_original_is_drawn(self):
        provider = FakeMultiStreamProvider()
        (original, flavors, _extension), drawn = self.combine(provider, [stream(SCREEN, SCREEN_FLAVORS)], False)
        self.assertEqual([flavor["id"] for flavor in flavors], ["scr_big"])
        self.assertEqual(flavors[0], original)
        self.assertEqual(drawn.call_count, 1)

    def test_three_streams_are_drawn_together_led_by_the_biggest_screen(self):
        provider = FakeMultiStreamProvider()
        children = [stream(SECOND_SCREEN, SECOND_FLAVORS), stream(SCREEN, SCREEN_FLAVORS)]
        (original, _flavors, _extension), drawn = self.combine(provider, children, False)

        self.assertEqual(original["id"], "scr_big")
        paths = drawn.call_args.args[0]
        self.assertEqual(len(paths), 3)
        self.assertTrue(paths[0].endswith("stream_sec_big.mp4"))
        self.assertTrue(paths[2].endswith("stream_cam_big.mp4"))
        self.assertEqual(provider.downloaded.count("sec_big"), 1)

    def test_a_fourth_stream_is_left_out_of_the_picture(self):
        provider = FakeMultiStreamProvider()
        fourth = stream({"id": "0_fourth", "width": 800, "height": 600}, SECOND_FLAVORS)
        children = [stream(SCREEN, SCREEN_FLAVORS), stream(SECOND_SCREEN, SECOND_FLAVORS), fourth]
        (_original, _flavors, _extension), drawn = self.combine(provider, children, False)

        self.assertEqual(MAX_STREAMS, 3)
        self.assertEqual(len(drawn.call_args.args[0]), 3)
        self.service.refresh_from_db()
        self.assertIn("leaving 0_fourth", self.service.log)

    def test_a_rung_that_cannot_be_drawn_does_not_lose_the_media(self):
        provider = FakeMultiStreamProvider()
        calls = []

        def flaky(paths, dest, width, height):
            calls.append(dest)
            if len(calls) > 1:
                raise ComposeError("ffmpeg said no")
            return dest

        (original, flavors, _extension), _drawn = self.combine(provider, [stream(SCREEN, SCREEN_FLAVORS)], True, draw=flaky)

        self.assertEqual([flavor["id"] for flavor in flavors], ["scr_big"])
        self.assertEqual(original["id"], "scr_big")
        self.service.refresh_from_db()
        self.assertIn("could not combine flavor", self.service.log)

    def test_streams_that_cannot_be_drawn_fall_back_to_the_entry_alone(self):
        provider = FakeMultiStreamProvider()

        def broken(paths, dest, width, height):
            raise ComposeError("ffmpeg said no")

        result, _drawn = self.combine(provider, [stream(SCREEN, SCREEN_FLAVORS)], True, draw=broken)

        self.assertIsNone(result)
        self.service.refresh_from_db()
        self.assertIn("could not combine the streams", self.service.log)

    def test_a_stream_with_nothing_playable_falls_back_to_the_entry_alone(self):
        provider = FakeMultiStreamProvider()
        self.data = stream(CAMERA, [{"id": "cam_flv", "width": 640, "height": 480, "fileExt": "flv"}])
        result, drawn = self.combine(provider, [stream(SCREEN, SCREEN_FLAVORS)], True)
        self.assertIsNone(result)
        self.assertEqual(drawn.call_count, 0)


class MultiStreamProvider(FakeProvider):
    def child_entries(self, source_id):
        return [{"id": child_id} for child_id in self.children.get(source_id, [])]


class TestStreamsAsMedia(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        create_account(username="admin")
        self.service = MigrationService.objects.create(
            name="Kaltura",
            provider="kaltura",
            connection={"service_url": "https://kaltura.example.edu", "partner_id": "342", "app_token_id": "atok", "app_token": "x"},
            options={"fallback_username": "admin", "import_captions": False, "skip_transcoding": True, "preserve_publish_state": True},
        )
        self.provider = MultiStreamProvider()
        self.provider.children = {"1_cam": ["1_scr"]}
        gallery = {"id": "8812", "privacy": 1, "fullName": "MediaSpace>site>galleries>Lectures", "fullIds": "1>2>3>8812"}
        self.provider.media = {
            "1_cam": {
                "entry": {"id": "1_cam", "name": "Capture recording", "description": "", "width": 640, "height": 480},
                "flavors": [{"id": "cam_src", "width": 640, "height": 480, "fileExt": "mp4", "isOriginal": True, "status": 2}],
                "captions": [],
                "categories": [gallery],
            },
            "1_scr": {
                "entry": {"id": "1_scr", "name": "Capture recording", "description": "", "width": 1728, "height": 960, "parentEntryId": "1_cam"},
                "flavors": [{"id": "scr_src", "width": 1728, "height": 960, "fileExt": "mp4", "isOriginal": True, "status": 2}],
                "captions": [],
                "categories": [],
            },
        }
        self.provider.categories = {"8812": dict(gallery, name="Lectures", parentName="galleries", owner="", members=[])}
        self.provider.downloads = {"cam_src": VIDEO, "scr_src": VIDEO}

    def run_import(self, draw=None):
        def copy_video(paths, dest, width, height):
            shutil.copyfile(VIDEO, dest)
            return dest

        with mock.patch("migrationservice.tasks.compose_side_by_side", side_effect=draw or copy_video):
            return import_media_entry(self.service, self.provider, "1_cam")

    def stream_media(self, key):
        return MigrationRecord.objects.get(service=self.service, object_type="media", source_id=key).target()

    def test_every_stream_also_becomes_a_media_of_its_own(self):
        recording = self.run_import()

        camera = self.stream_media("1_cam:stream")
        screen = self.stream_media("1_scr")
        self.assertEqual(camera.title, "Capture recording (stream 1)")
        self.assertEqual(screen.title, "Capture recording (stream 2)")
        for item in (camera, screen):
            self.assertEqual(item.user, recording.user)
            self.assertEqual(item.state, recording.state)
            self.assertEqual(item.category.count(), 0)
        self.assertEqual(recording.state, "public")
        self.assertEqual(list(recording.category.values_list("title", flat=True)), ["Lectures"])
        self.assertEqual(Media.objects.count(), 3)

    def test_a_second_run_does_not_duplicate_the_streams(self):
        self.run_import()
        self.run_import()
        self.assertEqual(Media.objects.count(), 3)
        self.assertEqual(Category.objects.filter(title="Lectures").count(), 1)

    def test_without_a_combined_picture_the_entry_is_the_parent_stream_and_only_children_are_added(self):
        def broken(paths, dest, width, height):
            raise ComposeError("ffmpeg said no")

        recording = self.run_import(draw=broken)

        self.assertFalse(MigrationRecord.objects.filter(service=self.service, source_id="1_cam:stream").exists())
        self.assertEqual(self.stream_media("1_scr").title, "Capture recording (stream 2)")
        self.assertEqual(recording.title, "Capture recording")
        self.assertEqual(Media.objects.count(), 2)

    def test_a_stream_that_fails_is_recorded_and_the_recording_survives(self):
        self.provider.media["1_scr"]["flavors"] = []
        recording = self.run_import()

        record = MigrationRecord.objects.get(service=self.service, source_id="1_scr")
        self.assertEqual(record.status, "failed")
        self.assertIn("no downloadable flavor", record.log)
        self.assertEqual(MigrationRecord.objects.get(service=self.service, source_id="1_cam").status, "success")
        self.assertIsNotNone(recording.pk)
