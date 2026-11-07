import hashlib
import json
import os
import shutil
import tempfile
import wave
from fractions import Fraction
from unittest import mock

from django.conf import settings
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils.safestring import SafeString

from files import helpers
from files.tests import create_account, fixture_path


def write_wav(path, seconds=1):
    with wave.open(path, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(8000)
        wav.writeframes(b"\x00\x00" * 8000 * seconds)
    return path


class TempDirMixin:
    def make_temp_dir(self):
        path = tempfile.mkdtemp(prefix="helpers-test-")
        self.addCleanup(shutil.rmtree, path, True)
        return path

    def write_file(self, name, content):
        path = os.path.join(self.make_temp_dir(), name)
        with open(path, "wb") as fp:
            fp.write(content)
        return path


class DefaultStateTests(TestCase):
    @override_settings(PORTAL_WORKFLOW="public")
    def test_public_workflow_gives_public_state(self):
        self.assertEqual(helpers.get_default_state(), "public")

    @override_settings(PORTAL_WORKFLOW="unlisted")
    def test_unlisted_workflow_gives_unlisted_state(self):
        self.assertEqual(helpers.get_default_state(), "unlisted")

    @override_settings(PORTAL_WORKFLOW="private")
    def test_private_workflow_gives_private_state(self):
        self.assertEqual(helpers.get_default_state(), "private")

    @override_settings(PORTAL_WORKFLOW="private_verified")
    def test_private_verified_workflow_gives_unlisted_only_to_advanced_users(self):
        advanced = create_account(username="helpers_advanced", email="helpers_advanced@example.com")
        advanced.advancedUser = True
        regular = create_account(username="helpers_regular", email="helpers_regular@example.com")

        self.assertEqual(helpers.get_default_state(user=advanced), "unlisted")
        self.assertEqual(helpers.get_default_state(user=regular), "private")
        self.assertEqual(helpers.get_default_state(), "private")

    @override_settings(PORTAL_WORKFLOW="unlisted")
    def test_get_portal_workflow_reflects_setting(self):
        self.assertEqual(helpers.get_portal_workflow(), "unlisted")


class FileTypeTests(TempDirMixin, SimpleTestCase):
    def test_png_and_jpg_are_images(self):
        self.assertEqual(helpers.get_file_type(fixture_path("test_image.png")), "image")
        self.assertEqual(helpers.get_file_type(fixture_path("test_image2.jpg")), "image")

    def test_mp4_is_video(self):
        self.assertEqual(helpers.get_file_type(fixture_path("small_video.mp4")), "video")

    def test_pdf_is_detected_by_its_magic_bytes(self):
        path = self.write_file("doc.bin", b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\n%%EOF\n")
        self.assertEqual(helpers.get_file_type(path), "pdf")

    def test_wav_is_audio(self):
        path = write_wav(os.path.join(self.make_temp_dir(), "sound.wav"))
        self.assertEqual(helpers.get_file_type(path), "audio")

    def test_plain_text_has_no_type(self):
        path = self.write_file("notes.txt", b"just some text")
        self.assertIsNone(helpers.get_file_type(path))

    def test_missing_file_has_no_type(self):
        self.assertIsNone(helpers.get_file_type("/nonexistent/path/file.mp4"))

    def test_get_file_name_returns_last_path_component(self):
        self.assertEqual(helpers.get_file_name("a/b/c/video.mp4"), "video.mp4")
        self.assertEqual(helpers.get_file_name("video.mp4"), "video.mp4")


class FileRemovalTests(TempDirMixin, SimpleTestCase):
    def test_rm_file_removes_an_existing_file(self):
        path = self.write_file("x.txt", b"x")
        self.assertTrue(helpers.rm_file(path))
        self.assertFalse(os.path.exists(path))

    def test_rm_file_returns_false_for_missing_files_and_directories(self):
        directory = self.make_temp_dir()
        self.assertFalse(helpers.rm_file(os.path.join(directory, "missing")))
        self.assertFalse(helpers.rm_file(directory))
        self.assertTrue(os.path.isdir(directory))

    def test_rm_files_removes_every_file_of_a_list(self):
        first = self.write_file("a.txt", b"a")
        second = self.write_file("b.txt", b"b")
        self.assertTrue(helpers.rm_files([first, second]))
        self.assertFalse(os.path.exists(first))
        self.assertFalse(os.path.exists(second))

    def test_rm_files_ignores_anything_but_a_list(self):
        path = self.write_file("a.txt", b"a")
        self.assertTrue(helpers.rm_files(path))
        self.assertTrue(os.path.exists(path))

    def test_rm_dir_refuses_directories_outside_the_project(self):
        directory = self.make_temp_dir()
        self.assertFalse(helpers.rm_dir(directory))
        self.assertTrue(os.path.isdir(directory))

    def test_rm_dir_removes_a_directory_inside_the_project(self):
        directory = tempfile.mkdtemp(prefix=".helpers-test-", dir=settings.BASE_DIR)
        self.addCleanup(shutil.rmtree, directory, True)
        with open(os.path.join(directory, "f"), "w") as fp:
            fp.write("x")

        self.assertTrue(helpers.rm_dir(directory))
        self.assertFalse(os.path.exists(directory))

    def test_rm_dir_returns_false_for_a_missing_directory(self):
        self.assertFalse(helpers.rm_dir(os.path.join(settings.BASE_DIR, "no-such-dir-for-helpers-tests")))


class PathAndTokenTests(SimpleTestCase):
    def test_url_from_path_replaces_media_root_with_media_url(self):
        path = os.path.join(settings.MEDIA_ROOT, "original/user/x/file.mp4")
        self.assertEqual(helpers.url_from_path(path), f"{settings.MEDIA_URL}original/user/x/file.mp4")

    def test_url_from_path_prefixes_relative_paths(self):
        self.assertEqual(helpers.url_from_path("userlogos/poster_audio.jpg"), f"{settings.MEDIA_URL}userlogos/poster_audio.jpg")

    def test_create_temp_file_creates_a_file_with_the_suffix(self):
        path = helpers.create_temp_file(suffix=".jpg")
        self.addCleanup(helpers.rm_file, path)
        self.assertTrue(os.path.isfile(path))
        self.assertTrue(path.endswith(".jpg"))
        self.assertTrue(path.startswith(settings.TEMP_DIRECTORY))

    def test_create_temp_dir_creates_a_directory(self):
        path = helpers.create_temp_dir()
        self.addCleanup(shutil.rmtree, path, True)
        self.assertTrue(os.path.isdir(path))

    def test_friendly_token_has_the_configured_length_and_allowed_chars(self):
        token = helpers.produce_friendly_token()
        self.assertEqual(len(token), settings.FRIENDLY_TOKEN_LEN)
        self.assertTrue(set(token) <= set(helpers.CHARS))

    def test_friendly_token_honours_a_custom_length(self):
        self.assertEqual(len(helpers.produce_friendly_token(token_len=20)), 20)

    def test_friendly_tokens_are_not_repeated(self):
        tokens = {helpers.produce_friendly_token() for _ in range(50)}
        self.assertEqual(len(tokens), 50)

    def test_clean_friendly_token_keeps_a_valid_token(self):
        self.assertEqual(helpers.clean_friendly_token("abcXYZ123"), "abcXYZ123")

    def test_mask_ip_is_the_md5_hexdigest(self):
        self.assertEqual(helpers.mask_ip("10.0.0.1"), hashlib.md5(b"10.0.0.1").hexdigest())
        self.assertNotEqual(helpers.mask_ip("10.0.0.1"), helpers.mask_ip("10.0.0.2"))


class RunCommandTests(TempDirMixin, SimpleTestCase):
    def test_successful_command_returns_stdout(self):
        ret = helpers.run_command(["echo", "hello"])
        self.assertEqual(ret["out"], "hello\n")
        self.assertEqual(ret["error"], "")

    def test_string_commands_are_split_on_whitespace(self):
        self.assertEqual(helpers.run_command("echo one two")["out"], "one two\n")

    def test_failing_command_returns_only_the_error(self):
        ret = helpers.run_command(["ls", "/nonexistent-dir-for-helpers-tests"])
        self.assertNotIn("out", ret)
        self.assertTrue(ret["error"])

    def test_command_runs_in_the_given_directory(self):
        directory = self.make_temp_dir()
        self.assertEqual(helpers.run_command(["pwd"], cwd=directory)["out"].strip(), os.path.realpath(directory))


class MediaFileInfoTests(TempDirMixin, SimpleTestCase):
    def test_missing_file_fails(self):
        self.assertEqual(helpers.media_file_info("/nonexistent/file.mp4"), {"fail": True})

    def test_video_info_is_extracted(self):
        info = helpers.media_file_info(fixture_path("small_video.mp4"))

        self.assertTrue(info["is_video"])
        self.assertTrue(info["has_video"])
        self.assertEqual(info["file_size"], os.path.getsize(fixture_path("small_video.mp4")))
        self.assertGreater(info["video_duration"], 20)
        self.assertGreater(info["video_height"], 0)
        self.assertGreater(info["video_width"], 0)
        self.assertEqual(len(info["md5sum"]), 32)
        self.assertIn("codec_name", info["video_info"])

    def test_still_image_is_not_treated_as_video(self):
        self.assertTrue(helpers.media_file_info(fixture_path("test_image.png")).get("fail"))

    def test_audio_only_file_reports_audio(self):
        path = write_wav(os.path.join(self.make_temp_dir(), "sound.wav"))
        info = helpers.media_file_info(path)
        self.assertFalse(info["is_video"])
        self.assertTrue(info["is_audio"])
        self.assertEqual(info["audio_info"]["codec_type"], "audio")

    def test_unrecognised_file_fails(self):
        path = self.write_file("notes.txt", b"not a media file")
        self.assertTrue(helpers.media_file_info(path).get("fail"))


class CalculationTests(SimpleTestCase):
    def test_calculate_seconds_parses_ffmpeg_durations(self):
        self.assertEqual(helpers.calculate_seconds("01:02:03.75"), 3723)
        self.assertEqual(helpers.calculate_seconds("00:00:09.99"), 9)

    def test_calculate_seconds_returns_zero_for_unparseable_input(self):
        self.assertEqual(helpers.calculate_seconds("02:03"), 0)
        self.assertEqual(helpers.calculate_seconds(125), 0)
        self.assertEqual(helpers.calculate_seconds(None), 0)

    def test_show_file_size_formats_megabytes(self):
        self.assertEqual(helpers.show_file_size(2_540_000), "2.5MB")
        self.assertEqual(helpers.show_file_size(1_000_000), "1.0MB")

    def test_show_file_size_passes_empty_values_through(self):
        self.assertIsNone(helpers.show_file_size(None))
        self.assertEqual(helpers.show_file_size(0), 0)

    def test_timestamp_to_seconds(self):
        self.assertAlmostEqual(helpers.timestamp_to_seconds("01:01:01.500"), 3661.5)
        self.assertAlmostEqual(helpers.timestamp_to_seconds("00:00:00.000"), 0)

    def test_seconds_to_timestamp(self):
        self.assertEqual(helpers.seconds_to_timestamp(3661.5), "01:01:01.500")
        self.assertEqual(helpers.seconds_to_timestamp(0), "00:00:00.000")

    def test_timestamp_conversion_round_trips(self):
        for timestamp in ["00:00:05.250", "00:10:00.000", "02:30:45.125"]:
            self.assertEqual(helpers.seconds_to_timestamp(helpers.timestamp_to_seconds(timestamp)), timestamp)


class TextCleanupTests(SimpleTestCase):
    def test_clean_query_strips_tsquery_operators_and_lowercases(self):
        self.assertEqual(helpers.clean_query("Hello & (World) | !Foo: 'bar'; #x <y> {z} ^\""), "hello  world  foo bar x y z ")

    def test_clean_query_of_empty_input_is_empty(self):
        self.assertEqual(helpers.clean_query(""), "")
        self.assertEqual(helpers.clean_query(None), "")

    def test_alphanumeric_only_keeps_unicode_letters_and_lowercases(self):
        self.assertEqual(helpers.get_alphanumeric_only("Héllo, Wörld! 42"), "héllowörld42")

    def test_alphanumeric_and_spaces_collapses_whitespace(self):
        self.assertEqual(helpers.get_alphanumeric_and_spaces("  Hello,   World!!  Ελλάδα\t2 "), "Hello World Ελλάδα 2")


class JsonForScriptTests(SimpleTestCase):
    def test_markup_characters_are_escaped_so_a_string_cannot_end_the_script_block(self):
        rendered = helpers.json_for_script([{"title": "</script x"}, {"title": "a > b & c"}])
        self.assertNotIn("<", rendered)
        self.assertNotIn(">", rendered)
        self.assertNotIn("&", rendered)
        self.assertIn("\\u003C/script x", rendered)

    def test_the_escaped_json_decodes_to_the_original_value(self):
        value = {"title": "</script><img src=x onerror=alert(1)>", "n": [1, 2], "amp": "R&D"}
        self.assertEqual(json.loads(helpers.json_for_script(value)), value)

    def test_the_result_is_marked_safe_for_templates(self):
        self.assertIsInstance(helpers.json_for_script([]), SafeString)


class FfmpegCommandTests(SimpleTestCase):
    def media_info(self, **overrides):
        info = {
            "video_frame_rate_n": 30,
            "video_frame_rate_d": 1,
            "video_height": 720,
            "video_duration": 60,
            "has_audio": True,
            "interlaced": False,
        }
        info.update(overrides)
        return helpers.json.dumps(info)

    def test_long_h264_video_gets_a_single_crf_pass(self):
        cmds = helpers.produce_ffmpeg_commands("in.mp4", self.media_info(), 480, "h264", "out.mp4", "pass")

        self.assertEqual(len(cmds), 1)
        cmd = cmds[0]
        self.assertEqual(cmd[cmd.index("-c:v") + 1], "libx264")
        self.assertEqual(cmd[cmd.index("-crf") + 1], str(helpers.VIDEO_CRFS["h264"]))
        self.assertEqual(cmd[cmd.index("-maxrate") + 1], f"{int(helpers.VIDEO_BITRATES['h264'][25][480] * 1.5)}k")
        self.assertEqual(cmd[cmd.index("-c:a") + 1], "aac")
        self.assertEqual(cmd[cmd.index("-level") + 1], "4.2")
        self.assertEqual(cmd[-1], "out.mp4")
        self.assertNotIn("-pass", cmd)

    def test_short_video_gets_two_pass_encoding(self):
        cmds = helpers.produce_ffmpeg_commands("in.mp4", self.media_info(video_duration=1), 480, "h264", "out.mp4", "passfile")

        self.assertEqual(len(cmds), 2)
        first, second = cmds
        self.assertEqual(first[first.index("-pass") + 1], 1)
        self.assertEqual(first[-4:], ["-an", "-f", "null", "/dev/null"])
        self.assertEqual(second[second.index("-pass") + 1], 2)
        self.assertEqual(second[second.index("-passlogfile") + 1], "passfile")
        self.assertEqual(second[second.index("-b:v") + 1], f"{helpers.VIDEO_BITRATES['h264'][25][480]}k")
        self.assertEqual(second[-1], "out.mp4")

    def test_vp9_uses_libvpx_with_opus_and_a_bitrate_cap(self):
        cmd = helpers.produce_ffmpeg_commands("in.mp4", self.media_info(), 360, "vp9", "out.webm", "pass")[0]

        self.assertEqual(cmd[cmd.index("-c:v") + 1], "libvpx-vp9")
        self.assertEqual(cmd[cmd.index("-c:a") + 1], "libopus")
        self.assertEqual(cmd[cmd.index("-speed") + 1], helpers.VP9_SPEED)
        self.assertIn("-minrate", cmd)
        self.assertEqual(cmd[cmd.index("-b:v") + 1], f"{helpers.VIDEO_BITRATES['vp9'][25][360]}k")

    def test_short_vp9_first_pass_uses_the_fast_speed(self):
        first = helpers.produce_ffmpeg_commands("in.mp4", self.media_info(video_duration=1), 360, "vp9", "out.webm", "pass")[0]
        self.assertEqual(first[first.index("-speed") + 1], 4)

    def test_h265_uses_libx265_params(self):
        cmd = helpers.produce_ffmpeg_commands("in.mp4", self.media_info(video_duration=1), 480, "h265", "out.mp4", "stats")[1]
        params = cmd[cmd.index("-x265-params") + 1]
        self.assertEqual(cmd[cmd.index("-c:v") + 1], "libx265")
        self.assertIn("stats=stats", params)
        self.assertIn("pass=2", params)

    def test_unknown_codec_is_rejected(self):
        self.assertFalse(helpers.produce_ffmpeg_commands("in.mp4", self.media_info(), 480, "av1", "out.mp4", "pass"))

    def test_resolution_without_a_bitrate_is_rejected(self):
        self.assertFalse(helpers.produce_ffmpeg_commands("in.mp4", self.media_info(), 999, "h264", "out.mp4", "pass"))

    def test_upscaling_is_refused_except_for_minimum_resolutions(self):
        info = self.media_info(video_height=200)
        self.assertFalse(helpers.produce_ffmpeg_commands("in.mp4", info, 480, "h264", "out.mp4", "pass"))
        self.assertTrue(helpers.produce_ffmpeg_commands("in.mp4", info, 240, "h264", "out.mp4", "pass"))

    def test_high_frame_rate_uses_the_60fps_bitrate(self):
        cmd = helpers.produce_ffmpeg_commands("in.mp4", self.media_info(video_frame_rate_n=60, video_height=1080), 1080, "h264", "out.mp4", "pass")[0]
        self.assertEqual(cmd[cmd.index("-maxrate") + 1], f"{int(helpers.VIDEO_BITRATES['h264'][60][1080] * 1.5)}k")
        self.assertIn("fps=fps=60", cmd[cmd.index("-filter:v") + 1])

    def test_high_frame_rate_falls_back_to_25fps_bitrate_when_60fps_has_none(self):
        cmd = helpers.produce_ffmpeg_commands("in.mp4", self.media_info(video_frame_rate_n=60), 480, "h264", "out.mp4", "pass")[0]
        self.assertEqual(cmd[cmd.index("-maxrate") + 1], f"{int(helpers.VIDEO_BITRATES['h264'][25][480] * 1.5)}k")

    def test_interlaced_video_is_deinterlaced(self):
        cmd = helpers.produce_ffmpeg_commands("in.mp4", self.media_info(interlaced=True), 480, "h264", "out.mp4", "pass")[0]
        self.assertTrue(cmd[cmd.index("-filter:v") + 1].startswith("yadif,"))

    def test_base_command_halves_very_high_frame_rates_and_floors_low_ones(self):
        common = dict(
            input_file="in.mp4",
            output_file="out.mp4",
            has_audio=False,
            codec="h264",
            encoder="libx264",
            audio_encoder="aac",
            interlaced=False,
            target_height=1440,
            target_rate=9000,
            target_rate_audio=128,
            pass_file="p",
            pass_number=2,
            enc_type="crf",
            chunk=True,
        )
        fast = helpers.get_base_ffmpeg_command(target_fps=Fraction(240), **common)
        slow = helpers.get_base_ffmpeg_command(target_fps=Fraction(1, 2), **common)

        self.assertIn("fps=fps=60", fast[fast.index("-filter:v") + 1])
        self.assertIn("fps=fps=1", slow[slow.index("-filter:v") + 1])
        self.assertNotIn("-c:a", fast)
        self.assertEqual(fast[fast.index("-level") + 1], "5.2")
        self.assertEqual(fast[-3:], ["-movflags", "+faststart", "out.mp4"])


class TrimTimestampTests(SimpleTestCase):
    def test_non_list_input_gives_nothing(self):
        self.assertEqual(helpers.get_trim_timestamps("file.mp4", "00:00:01.000"), [])

    def test_items_without_start_and_end_are_dropped(self):
        self.assertEqual(helpers.get_trim_timestamps("file.mp4", [{"startTime": "00:00:01.000"}, "x"]), [])

    def test_single_segment_from_the_start_is_returned_untouched(self):
        timestamps = [{"startTime": "00:00:00.000", "endTime": "00:00:05.000", "extra": 1}]
        self.assertIs(helpers.get_trim_timestamps("file.mp4", timestamps), timestamps)

    def test_segments_keep_their_start_time_without_ffprobe(self):
        timestamps = [{"startTime": "00:00:02.000", "endTime": "00:00:05.000"}, {"startTime": "00:00:07.000", "endTime": "00:00:09.000"}]
        self.assertEqual(helpers.get_trim_timestamps("file.mp4", timestamps), timestamps)

    def test_ffprobe_moves_start_to_the_last_preceding_i_frame(self):
        output = {"out": "1.000000,I\n1.500000,P\n2.500000,I\n2.900000,B\n"}
        with mock.patch.object(helpers, "run_command", return_value=output) as run:
            result = helpers.get_trim_timestamps("file.mp4", [{"startTime": "00:00:03.000", "endTime": "00:00:05.000"}], run_ffprobe=True)

        self.assertEqual(result, [{"startTime": "00:00:02.500", "endTime": "00:00:05.000"}])
        self.assertIn("file.mp4", run.call_args[0][0])

    def test_ffprobe_without_i_frames_keeps_the_start_time(self):
        with mock.patch.object(helpers, "run_command", return_value={"out": ""}):
            result = helpers.get_trim_timestamps("file.mp4", [{"startTime": "00:00:03.000", "endTime": "00:00:05.000"}], run_ffprobe=True)
        self.assertEqual(result, [{"startTime": "00:00:03.000", "endTime": "00:00:05.000"}])


class TrimVideoMethodTests(TempDirMixin, SimpleTestCase):
    def copy_video(self):
        path = os.path.join(self.make_temp_dir(), "video.mp4")
        shutil.copy(fixture_path("small_video.mp4"), path)
        return path

    def duration(self, path):
        return helpers.media_file_info(path)["video_duration"]

    def test_invalid_timestamps_or_missing_file_are_rejected(self):
        self.assertFalse(helpers.trim_video_method("/nonexistent.mp4", [{"startTime": "00:00:00.000", "endTime": "00:00:01.000"}]))
        self.assertFalse(helpers.trim_video_method(fixture_path("small_video.mp4"), []))
        self.assertFalse(helpers.trim_video_method(fixture_path("small_video.mp4"), "nope"))

    def test_single_segment_replaces_the_file_with_the_trimmed_part(self):
        path = self.copy_video()
        self.assertTrue(helpers.trim_video_method(path, [{"startTime": "00:00:00.000", "endTime": "00:00:05.000"}]))
        self.assertLess(self.duration(path), 10)

    def test_multiple_segments_are_concatenated(self):
        path = self.copy_video()
        segments = [{"startTime": "00:00:00.000", "endTime": "00:00:04.000"}, {"startTime": "00:00:10.000", "endTime": "00:00:14.000"}]
        self.assertTrue(helpers.trim_video_method(path, segments))
        self.assertLess(self.duration(path), 15)

    def test_failed_segment_leaves_the_original_untouched(self):
        path = self.copy_video()
        size = os.path.getsize(path)
        with mock.patch.object(helpers, "run_command", return_value={}):
            self.assertFalse(helpers.trim_video_method(path, [{"startTime": "00:00:00.000", "endTime": "00:00:05.000"}]))
        self.assertEqual(os.path.getsize(path), size)
