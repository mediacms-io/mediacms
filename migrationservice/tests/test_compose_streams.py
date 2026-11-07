import os
import shutil
import subprocess
import tempfile
from unittest import mock

from django.test import SimpleTestCase

from migrationservice import compose
from migrationservice.compose import (
    COMPOSE_TIMEOUT,
    DEFAULT_FRAME_RATE,
    ComposeError,
    canvas_size,
    compose_side_by_side,
    has_audio,
    layout_boxes,
    pick_flavor_for_width,
    probe_frame_rate,
    stream_area,
)

VIDEO = "fixtures/small_video.mp4"


def finished(returncode=0, stdout=b"", stderr=b""):
    return subprocess.CompletedProcess(args=[], returncode=returncode, stdout=stdout, stderr=stderr)


class TestLayout(SimpleTestCase):
    def test_the_area_of_a_stream(self):
        self.assertEqual(stream_area({"width": 1920, "height": 1080}), 1920 * 1080)
        self.assertEqual(stream_area({"width": 1920}), 0)
        self.assertEqual(stream_area({}), 0)

    def test_the_canvas_is_wide_and_even(self):
        self.assertEqual(canvas_size(1080), (1920, 1080))
        self.assertEqual(canvas_size(960), (1706, 960))
        self.assertEqual(canvas_size(271), (480, 270))
        self.assertEqual(canvas_size(None), (4, 2))

    def test_two_streams_put_the_child_large_left_and_the_parent_small_right(self):
        self.assertEqual(layout_boxes(2, 1920, 1080), [(0, 0, 1440, 1080), (1440, 0, 480, 1080)])

    def test_three_streams_stack_the_children_left_and_centre_the_parent_right(self):
        self.assertEqual(layout_boxes(3, 1920, 1080), [(0, 0, 960, 540), (0, 540, 960, 540), (1120, 0, 640, 1080)])

    def test_the_boxes_fill_an_odd_sized_canvas(self):
        boxes = layout_boxes(2, 1706, 960)
        self.assertEqual(boxes, [(0, 0, 1278, 960), (1278, 0, 428, 960)])

    def test_there_is_no_layout_for_four_streams_yet(self):
        with self.assertRaises(ValueError):
            layout_boxes(4, 1920, 1080)


class TestPickFlavorForWidth(SimpleTestCase):
    FLAVORS = [
        {"id": "f1080", "width": 1920, "fileExt": "mp4"},
        {"id": "f720", "width": 1280, "fileExt": "MP4"},
        {"id": "f480", "width": 854, "fileExt": "webm"},
        {"id": "fflv", "width": 500, "fileExt": "flv"},
        {"id": "fnoext", "width": 490},
    ]

    def test_the_smallest_flavor_wide_enough(self):
        self.assertEqual(pick_flavor_for_width(self.FLAVORS, 480)["id"], "f480")
        self.assertEqual(pick_flavor_for_width(self.FLAVORS, 1000)["id"], "f720")

    def test_the_extension_is_matched_whatever_its_case(self):
        self.assertEqual(pick_flavor_for_width([{"id": "a", "width": 900, "fileExt": "MP4"}], 480)["id"], "a")

    def test_when_none_is_wide_enough_the_widest_playable_one(self):
        self.assertEqual(pick_flavor_for_width(self.FLAVORS, 4000)["id"], "f1080")

    def test_nothing_playable(self):
        self.assertIsNone(pick_flavor_for_width([{"id": "fflv", "width": 900, "fileExt": "flv"}, {"id": "x"}], 480))
        self.assertIsNone(pick_flavor_for_width([], 480))


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

    def test_the_frame_rate_as_ffprobe_prints_it(self):
        for stdout, rate in (
            (b"30/1\n", "30/1"),
            (b"30000/1001,\n", "30000/1001"),
            (b"25\n", "25"),
            (b"", DEFAULT_FRAME_RATE),
            (None, DEFAULT_FRAME_RATE),
            (b"0/0", DEFAULT_FRAME_RATE),
            (b"N/A", DEFAULT_FRAME_RATE),
        ):
            with mock.patch.object(compose.subprocess, "run", return_value=finished(stdout=stdout)):
                self.assertEqual(probe_frame_rate("/x.mp4"), rate, stdout)

    def test_a_frame_rate_probe_that_fails_is_the_default(self):
        with mock.patch.object(compose.subprocess, "run", side_effect=subprocess.SubprocessError("boom")):
            self.assertEqual(probe_frame_rate("/x.mp4"), DEFAULT_FRAME_RATE)

    def test_the_real_fixture(self):
        self.assertEqual(probe_frame_rate(VIDEO), "30/1")
        self.assertTrue(has_audio(VIDEO))


class TestComposeSideBySide(SimpleTestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix="compose-test-")
        self.addCleanup(shutil.rmtree, self.dir, True)
        self.dest = os.path.join(self.dir, "out.mp4")

    def run_with(self, audio=("/child.mp4", "/parent.mp4"), ffmpeg=None, paths=("/child.mp4", "/parent.mp4"), size=(1706, 960)):
        ffmpeg_calls = []

        def run(command, **kwargs):
            if command[0] == "ffprobe" and "a" in command:
                return finished(stdout=b"audio" if command[-1] in audio else b"")
            if command[0] == "ffprobe":
                return finished(stdout=b"30/1\n")
            ffmpeg_calls.append((command, kwargs))
            if ffmpeg is not None:
                return ffmpeg(command)
            with open(command[-1], "wb") as out:
                out.write(b"video")
            return finished()

        with self.settings(FFMPEG_COMMAND="ffmpeg", FFPROBE_COMMAND="ffprobe"), mock.patch.object(compose.subprocess, "run", side_effect=run):
            result = compose_side_by_side(list(paths), self.dest, *size)
        return result, ffmpeg_calls

    def test_two_streams_are_drawn_into_their_boxes_on_a_black_canvas(self):
        result, calls = self.run_with()
        command, kwargs = calls[0]

        self.assertEqual(result, self.dest)
        self.assertEqual(
            command[command.index("-filter_complex") + 1],
            "color=c=black:s=1706x960:r=30/1[c0];"
            "[0:v]scale=1278:960:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1[s0];"
            "[c0][s0]overlay=x=0+(1278-w)/2:y=0+(960-h)/2:shortest=1[c1];"
            "[1:v]scale=428:960:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1[s1];"
            "[c1][s1]overlay=x=1278+(428-w)/2:y=0+(960-h)/2:shortest=1[c2]",
        )
        self.assertEqual([command[index + 1] for index, part in enumerate(command) if part == "-i"], ["/child.mp4", "/parent.mp4"])
        self.assertEqual(command[command.index("-map") + 1], "[c2]")
        self.assertEqual(command[-1], self.dest)
        self.assertIn("libx264", command)
        self.assertEqual(kwargs["timeout"], COMPOSE_TIMEOUT)

    def test_three_streams_draw_every_input(self):
        _, calls = self.run_with(paths=("/a.mp4", "/b.mp4", "/parent.mp4"), audio=("/parent.mp4",), size=(1920, 1080))
        command = calls[0][0]
        graph = command[command.index("-filter_complex") + 1]
        self.assertIn("[c2][s2]overlay=x=1120+(640-w)/2:y=0+(1080-h)/2:shortest=1[c3]", graph)
        self.assertEqual(command[command.index("-map") + 1], "[c3]")

    def test_the_parents_audio_is_used(self):
        _, calls = self.run_with()
        command = calls[0][0]
        self.assertEqual(command[command.index("-map", command.index("-map") + 1) + 1], "1:a")

    def test_a_childs_audio_when_the_parent_has_none(self):
        _, calls = self.run_with(audio=("/child.mp4",))
        command = calls[0][0]
        self.assertEqual(command[command.index("-map", command.index("-map") + 1) + 1], "0:a")

    def test_no_audio_anywhere_is_a_silent_video(self):
        _, calls = self.run_with(audio=())
        command = calls[0][0]
        self.assertNotIn("-c:a", command)
        self.assertEqual(command.count("-map"), 1)

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

        self.assertEqual(compose_side_by_side([VIDEO, VIDEO], dest, *canvas_size(240)), dest)
        self.assertGreater(os.path.getsize(dest), 0)
        self.assertEqual(probe_frame_rate(dest), "30/1")
        self.assertTrue(has_audio(dest))
