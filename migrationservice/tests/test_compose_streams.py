import os
import shutil
import subprocess
import tempfile
from unittest import mock

from django.test import SimpleTestCase

from migrationservice import compose
from migrationservice.compose import (
    COMPOSE_TIMEOUT,
    ComposeError,
    compose_pip,
    has_audio,
    inset_width_for,
    pick_base_and_inset,
    pick_inset_flavor,
    probe_width,
    stream_area,
)

VIDEO = "fixtures/small_video.mp4"


def finished(returncode=0, stdout=b"", stderr=b""):
    return subprocess.CompletedProcess(args=[], returncode=returncode, stdout=stdout, stderr=stderr)


class TestPickingTheStreams(SimpleTestCase):
    def test_the_area_of_a_stream(self):
        self.assertEqual(stream_area({"width": 1920, "height": 1080}), 1920 * 1080)
        self.assertEqual(stream_area({"width": 1920}), 0)
        self.assertEqual(stream_area({}), 0)

    def test_the_bigger_picture_is_the_base_whatever_the_order(self):
        screen = {"id": "screen", "width": 1920, "height": 1080}
        camera = {"id": "camera", "width": 640, "height": 360}
        self.assertEqual(pick_base_and_inset([camera, screen]), (screen, camera))
        self.assertEqual(pick_base_and_inset([screen, camera]), (screen, camera))

    def test_the_inset_is_a_quarter_wide_and_even(self):
        self.assertEqual(inset_width_for(1920), 480)
        self.assertEqual(inset_width_for(1282), 320)
        self.assertEqual(inset_width_for(1290), 322)

    def test_an_unknown_width_still_gives_a_drawable_inset(self):
        self.assertEqual(inset_width_for(0), 2)
        self.assertEqual(inset_width_for(None), 2)


class TestPickInsetFlavor(SimpleTestCase):
    FLAVORS = [
        {"id": "f1080", "width": 1920, "fileExt": "mp4"},
        {"id": "f720", "width": 1280, "fileExt": "MP4"},
        {"id": "f480", "width": 854, "fileExt": "webm"},
        {"id": "fflv", "width": 500, "fileExt": "flv"},
        {"id": "fnoext", "width": 490},
    ]

    def test_the_smallest_flavor_wide_enough(self):
        self.assertEqual(pick_inset_flavor(self.FLAVORS, 480)["id"], "f480")
        self.assertEqual(pick_inset_flavor(self.FLAVORS, 1000)["id"], "f720")

    def test_the_extension_is_matched_whatever_its_case(self):
        self.assertEqual(pick_inset_flavor([{"id": "a", "width": 900, "fileExt": "MP4"}], 480)["id"], "a")

    def test_when_none_is_wide_enough_the_widest_playable_one(self):
        self.assertEqual(pick_inset_flavor(self.FLAVORS, 4000)["id"], "f1080")

    def test_nothing_playable(self):
        self.assertIsNone(pick_inset_flavor([{"id": "fflv", "width": 900, "fileExt": "flv"}, {"id": "x"}], 480))
        self.assertIsNone(pick_inset_flavor([], 480))


class TestProbes(SimpleTestCase):
    def test_audio_is_found_by_ffprobe(self):
        with mock.patch.object(compose.subprocess, "run", return_value=finished(stdout=b"audio\n")) as run:
            self.assertTrue(has_audio("/x.mp4"))
        command = run.call_args.args[0]
        self.assertEqual(command[-1], "/x.mp4")
        self.assertIn("a", command)

    def test_no_audio_stream(self):
        with mock.patch.object(compose.subprocess, "run", return_value=finished(stdout=None)):
            self.assertFalse(has_audio("/x.mp4"))

    def test_a_probe_that_fails_means_no_audio(self):
        with mock.patch.object(compose.subprocess, "run", side_effect=subprocess.TimeoutExpired("ffprobe", 60)):
            self.assertFalse(has_audio("/x.mp4"))

    def test_the_width_as_ffprobe_prints_it(self):
        for stdout, width in ((b"1920\n", 1920), (b"1280,\n", 1280), (b"", 0), (None, 0), (b"N/A", 0)):
            with mock.patch.object(compose.subprocess, "run", return_value=finished(stdout=stdout)):
                self.assertEqual(probe_width("/x.mp4"), width, stdout)

    def test_a_width_probe_that_fails_is_zero(self):
        with mock.patch.object(compose.subprocess, "run", side_effect=subprocess.SubprocessError("boom")):
            self.assertEqual(probe_width("/x.mp4"), 0)

    def test_the_real_fixture(self):
        self.assertEqual(probe_width(VIDEO), 426)
        self.assertTrue(has_audio(VIDEO))


class TestComposePip(SimpleTestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix="compose-test-")
        self.addCleanup(shutil.rmtree, self.dir, True)
        self.dest = os.path.join(self.dir, "out.mp4")

    def run_with(self, base_audio=True, inset_audio=True, ffmpeg=None, base_width=1920):
        ffmpeg_calls = []

        def run(command, **kwargs):
            if command[0] == "ffprobe" and "a" in command:
                return finished(stdout=b"audio" if (base_audio if command[-1] == "/base.mp4" else inset_audio) else b"")
            if command[0] == "ffprobe":
                return finished(stdout=b"1280\n")
            ffmpeg_calls.append((command, kwargs))
            if ffmpeg is not None:
                return ffmpeg(command)
            with open(command[-1], "wb") as out:
                out.write(b"video")
            return finished()

        with self.settings(FFMPEG_COMMAND="ffmpeg", FFPROBE_COMMAND="ffprobe"), mock.patch.object(compose.subprocess, "run", side_effect=run):
            result = compose_pip("/base.mp4", "/inset.mp4", self.dest, base_width=base_width)
        return result, ffmpeg_calls

    def test_the_camera_is_drawn_into_the_bottom_right_corner(self):
        result, calls = self.run_with()
        command, kwargs = calls[0]

        self.assertEqual(result, self.dest)
        self.assertEqual(command[command.index("-filter_complex") + 1], "[1:v]scale=480:-2[pip];[0:v][pip]overlay=W-w-26:H-h-26:shortest=1[v]")
        self.assertEqual(command[command.index("-i") + 1], "/base.mp4")
        self.assertEqual(command[-1], self.dest)
        self.assertIn("libx264", command)
        self.assertEqual(kwargs["timeout"], COMPOSE_TIMEOUT)

    def test_the_screens_audio_is_used(self):
        _, calls = self.run_with()
        command = calls[0][0]
        self.assertEqual(command[command.index("[v]") + 1 : command.index("[v]") + 6], ["-map", "0:a", "-c:a", "aac", "-c:v"])

    def test_the_cameras_audio_when_the_screen_has_none(self):
        _, calls = self.run_with(base_audio=False)
        command = calls[0][0]
        self.assertEqual(command[command.index("-map", command.index("[v]")) + 1], "1:a")

    def test_no_audio_anywhere_is_a_silent_video(self):
        _, calls = self.run_with(base_audio=False, inset_audio=False)
        command = calls[0][0]
        self.assertNotIn("-c:a", command)
        self.assertEqual(command.count("-map"), 1)

    def test_an_unknown_base_width_is_probed(self):
        _, calls = self.run_with(base_width=0)
        command = calls[0][0]
        self.assertIn("[1:v]scale=320:-2[pip];[0:v][pip]overlay=W-w-17:H-h-17", command[command.index("-filter_complex") + 1])

    def test_a_small_base_keeps_a_minimum_margin(self):
        _, calls = self.run_with(base_width=320)
        command = calls[0][0]
        self.assertIn("overlay=W-w-8:H-h-8", command[command.index("-filter_complex") + 1])

    def test_ffmpegs_last_complaint_is_the_error(self):
        with self.assertRaisesMessage(ComposeError, "Invalid data found when processing input"):
            self.run_with(ffmpeg=lambda command: finished(returncode=1, stderr=b"first line\nInvalid data found when processing input\n"))

    def test_a_silent_failure_names_the_exit_code(self):
        with self.assertRaisesMessage(ComposeError, "ffmpeg exited 1"):
            self.run_with(ffmpeg=lambda command: finished(returncode=1, stderr=None))

    def test_a_success_that_wrote_nothing_is_a_failure(self):
        with self.assertRaisesMessage(ComposeError, "ffmpeg exited 0"):
            self.run_with(ffmpeg=lambda command: finished())

    def test_an_empty_output_file_is_a_failure(self):
        def empty(command):
            open(command[-1], "wb").close()
            return finished()

        with self.assertRaises(ComposeError):
            self.run_with(ffmpeg=empty)

    def test_a_compose_that_runs_too_long(self):
        def hang(command):
            raise subprocess.TimeoutExpired(command, COMPOSE_TIMEOUT)

        with self.assertRaisesMessage(ComposeError, "timed out"):
            self.run_with(ffmpeg=hang)


class TestComposeForReal(SimpleTestCase):
    def test_two_streams_become_one_playable_file(self):
        dest_dir = tempfile.mkdtemp(prefix="compose-real-")
        self.addCleanup(shutil.rmtree, dest_dir, True)
        dest = os.path.join(dest_dir, "combined.mp4")

        self.assertEqual(compose_pip(VIDEO, VIDEO, dest), dest)
        self.assertGreater(os.path.getsize(dest), 0)
        self.assertEqual(probe_width(dest), 426)
        self.assertTrue(has_audio(dest))
