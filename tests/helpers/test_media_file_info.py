import json
import tempfile
from unittest import mock

from django.test import SimpleTestCase

from files import helpers

MJPEG_COVER = {
    "index": 3,
    "codec_name": "mjpeg",
    "codec_type": "video",
    "width": 960,
    "height": 540,
    "r_frame_rate": "90000/1",
    "avg_frame_rate": "0/0",
    "duration": "13.279933",
    "disposition": {"attached_pic": 1},
}


def stream(index, codec_type, codec_name, **extra):
    return {"index": index, "codec_type": codec_type, "codec_name": codec_name, "disposition": {"attached_pic": 0}, **extra}


H264 = stream(0, "video", "h264", width=1920, height=1080, r_frame_rate="30000/1001", avg_frame_rate="30000/1001", duration="13.279933")
# the telemetry tracks of a DJI clip: ffprobe reports them as data streams with no codec
DATA = [stream(1, "data", "unknown", duration="13.279933"), stream(2, "data", "unknown", duration="13.279933")]
AAC = stream(1, "audio", "aac", sample_rate="44100", channels=2, duration="30.0", bit_rate="128000")


def probe(streams):
    """media_file_info() on a temp file, with ffprobe, stat and md5sum answered from `streams`."""

    def run_command(cmd, cwd=None):
        if "-show_streams" in cmd:
            return {"out": json.dumps({"streams": streams, "format": {"format_name": "mov,mp4,m4a,3gp,3g2,mj2"}})}
        if cmd[0] == "stat":
            return {"out": "1000\n"}
        if cmd[0] == "md5sum":
            return {"out": "d41d8cd98f00b204e9800998ecf8427e  file\n"}
        return {"out": "1000|\n2000|\n"}  # video packet sizes, for the bitrate

    with tempfile.NamedTemporaryFile() as f, mock.patch.object(helpers, "run_command", run_command):
        return helpers.media_file_info(f.name)


class MediaFileInfoAttachedPicTests(SimpleTestCase):
    def test_embedded_thumbnail_after_the_video_does_not_replace_it(self):
        # DJI drones: h264 video, two data tracks, then an mjpeg thumbnail (attached_pic) as the last stream
        info = probe([H264, *DATA, MJPEG_COVER])

        self.assertTrue(info["is_video"])
        self.assertEqual(info["video_codec"], "h264")
        self.assertEqual((info["video_width"], info["video_height"]), (1920, 1080))
        self.assertEqual((info["video_frame_rate_n"], info["video_frame_rate_d"]), ("30000", "1001"))
        self.assertEqual(info["video_info"]["avg_frame_rate"], "30000/1001")

    def test_embedded_thumbnail_before_the_video_does_not_win_either(self):
        cover_first = {**MJPEG_COVER, "index": 0}
        info = probe([cover_first, {**H264, "index": 1}])

        self.assertEqual(info["video_codec"], "h264")
        self.assertEqual(info["video_height"], 1080)

    def test_audio_file_with_cover_art_keeps_the_mjpeg_stream(self):
        # nothing else to prefer: the existing "audio file with a thumbnail" detection depends on this
        info = probe([AAC, MJPEG_COVER])

        self.assertEqual(info["video_codec"], "mjpeg")
        self.assertEqual(info["video_info"]["avg_frame_rate"], "0/0")
        self.assertTrue(info["has_audio"])

    def test_two_real_video_streams_still_use_the_last_one(self):
        second = {**H264, "index": 1, "width": 1280, "height": 720}

        self.assertEqual(probe([H264, second])["video_height"], 720)
