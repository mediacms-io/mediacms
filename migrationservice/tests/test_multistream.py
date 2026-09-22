import shutil
import tempfile
from unittest import mock

from django.test import TestCase

from migrationservice.compose import (
    MAX_STREAMS,
    inset_width_for,
    pick_base_and_inset,
    pick_inset_flavor,
)
from migrationservice.models import MigrationService
from migrationservice.tasks import combine_streams

SCREEN = {"id": "0_screen", "width": 1728, "height": 960}
CAMERA = {"id": "0_camera", "width": 640, "height": 480}

CAMERA_FLAVORS = [
    {"id": "cam_small", "width": 480, "height": 360, "fileExt": "mp4", "isOriginal": False},
    {"id": "cam_big", "width": 640, "height": 480, "fileExt": "mp4", "isOriginal": True},
]
SCREEN_FLAVORS = [
    {"id": "scr_small", "width": 480, "height": 272, "fileExt": "mp4", "isOriginal": False},
    {"id": "scr_big", "width": 1728, "height": 960, "fileExt": "mp4", "isOriginal": True},
]


class TestPickingStreams(TestCase):
    def test_the_bigger_picture_is_the_one_kept_full_size(self):
        base, inset = pick_base_and_inset([CAMERA, SCREEN])
        self.assertEqual(base["id"], "0_screen")
        self.assertEqual(inset["id"], "0_camera")

    def test_the_inset_is_a_quarter_of_the_frame_and_even(self):
        self.assertEqual(inset_width_for(1728), 432)
        self.assertEqual(inset_width_for(1727), 430)
        self.assertEqual(inset_width_for(0), 2)

    def test_the_smallest_camera_flavor_wide_enough_is_used(self):
        # drawn 432 wide, so the 480 wide flavor is plenty and the 640 is a wasted download
        self.assertEqual(pick_inset_flavor(CAMERA_FLAVORS, 432)["id"], "cam_small")

    def test_the_widest_is_used_when_none_is_wide_enough(self):
        self.assertEqual(pick_inset_flavor(CAMERA_FLAVORS, 4000)["id"], "cam_big")

    def test_a_stream_with_nothing_playable_offers_no_inset(self):
        self.assertIsNone(pick_inset_flavor([{"id": "x", "fileExt": "flv", "width": 800}], 100))


class FakeMultiStreamProvider:
    def __init__(self, children):
        self._children = children
        self.downloaded = []

    def child_entries(self, source_id):
        return self._children

    def fetch_media(self, source_id):
        return {"entry": SCREEN, "flavors": list(SCREEN_FLAVORS)}

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


class TestCombineStreams(TestCase):
    def setUp(self):
        self.service = make_service()
        self.data = {"entry": CAMERA, "flavors": list(CAMERA_FLAVORS)}
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def combine(self, provider, want_renditions):
        with mock.patch("migrationservice.tasks.compose_pip", side_effect=lambda base, inset, dest, base_width=0: dest) as drawn:
            result = combine_streams(self.service, provider, "0_camera", self.data, self.tmp, want_renditions)
        return result, drawn

    def test_an_entry_with_no_children_is_left_alone(self):
        provider = FakeMultiStreamProvider([])
        result, drawn = self.combine(provider, True)
        self.assertIsNone(result)
        self.assertEqual(drawn.call_count, 0)
        self.assertEqual(provider.downloaded, [])

    def test_the_camera_is_fetched_once_and_drawn_over_every_screen_rung(self):
        provider = FakeMultiStreamProvider([SCREEN])
        (original, flavors, extension), drawn = self.combine(provider, True)

        self.assertEqual(extension, "mp4")
        self.assertEqual(original["id"], "scr_big")
        self.assertTrue(original["_local_path"].endswith("0_camera.mp4"))
        # both screen rungs, each with a local file, and the camera downloaded once
        self.assertEqual(sorted(flavor["id"] for flavor in flavors), ["scr_big", "scr_small"])
        self.assertTrue(all(flavor.get("_local_path") for flavor in flavors))
        self.assertEqual(provider.downloaded.count("cam_small"), 1)
        self.assertEqual(drawn.call_count, 2)

    def test_without_renditions_only_the_original_is_drawn(self):
        provider = FakeMultiStreamProvider([SCREEN])
        (original, flavors, _extension), drawn = self.combine(provider, False)
        self.assertEqual([flavor["id"] for flavor in flavors], ["scr_big"])
        self.assertEqual(flavors[0], original)
        self.assertEqual(drawn.call_count, 1)

    def test_a_third_stream_is_left_behind_rather_than_squeezed_in(self):
        third = {"id": "0_third", "width": 1280, "height": 720}
        provider = FakeMultiStreamProvider([SCREEN, third])
        result, _drawn = self.combine(provider, False)
        self.assertIsNotNone(result)
        self.service.refresh_from_db()
        self.assertIn("0_third", self.service.log)
        self.assertEqual(MAX_STREAMS, 2)

    def test_a_rung_that_cannot_be_drawn_does_not_lose_the_media(self):
        provider = FakeMultiStreamProvider([SCREEN])
        calls = []

        def flaky(base, inset, dest, base_width=0):
            calls.append(dest)
            if len(calls) > 1:
                raise RuntimeError("ffmpeg said no")
            return dest

        with mock.patch("migrationservice.tasks.compose_pip", side_effect=flaky):
            original, flavors, _extension = combine_streams(self.service, provider, "0_camera", self.data, self.tmp, True)

        self.assertEqual([flavor["id"] for flavor in flavors], ["scr_big"])
        self.assertEqual(original["id"], "scr_big")
        self.service.refresh_from_db()
        self.assertIn("could not combine flavor", self.service.log)
