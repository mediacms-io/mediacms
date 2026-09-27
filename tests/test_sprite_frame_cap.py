import os
from unittest import mock

from django.conf import settings
from django.test import SimpleTestCase

from files import tasks
from files.models import Media

# a JPEG image cannot be more than 65,535 pixels high; frames are 90 pixels high
JPEG_MAX_HEIGHT = 65535
FRAME_HEIGHT = 90
MAX_FRAMES = JPEG_MAX_HEIGHT // FRAME_HEIGHT


class FakeCommands:
    """Stands in for run_command: ffmpeg writes one frame per SPRITE_NUM_SECS
    (honouring -frames:v like the real one), convert only records its input."""

    def __init__(self, duration):
        self.duration = duration
        self.ffmpeg_cmd = None
        self.convert_cmd = None

    def __call__(self, cmd, cwd=None):
        if cmd[0] == settings.FFMPEG_COMMAND:
            self.ffmpeg_cmd = cmd
            frames = self.duration // settings.SPRITE_NUM_SECS + 1
            if "-frames:v" in cmd:
                frames = min(frames, int(cmd[cmd.index("-frames:v") + 1]))
            pattern = cmd[-1]
            for i in range(1, frames + 1):
                open(pattern % i, "wb").close()
        elif cmd[0] == "convert":
            self.convert_cmd = cmd
        return {"out": "", "error": ""}

    def frames_appended(self):
        return [arg for arg in self.convert_cmd[1:] if arg.endswith(".jpg") and os.path.basename(arg).startswith("img")]


class TestSpriteFrameCap(SimpleTestCase):
    def produce_sprite(self, duration):
        media = Media(friendly_token="notsaved01", media_type="video", duration=duration, media_file="original/video.mp4")
        fake = FakeCommands(duration)
        with mock.patch("files.tasks.Media") as media_model, mock.patch("files.tasks.run_command", side_effect=fake):
            media_model.objects.get.return_value = media
            self.assertTrue(tasks.produce_sprite_from_video("notsaved01"))
        return fake

    def test_long_video_sprite_stays_below_jpeg_height_limit(self):
        fake = self.produce_sprite(20000)

        self.assertIsNotNone(fake.convert_cmd)
        frames = fake.frames_appended()
        self.assertLessEqual(len(frames) * FRAME_HEIGHT, JPEG_MAX_HEIGHT)
        self.assertEqual(len(frames), MAX_FRAMES)
        self.assertIn("-frames:v", fake.ffmpeg_cmd)
        self.assertLessEqual(int(fake.ffmpeg_cmd[fake.ffmpeg_cmd.index("-frames:v") + 1]), MAX_FRAMES)
        # frame size is unchanged: the player expects 160x90 frames every SPRITE_NUM_SECS
        self.assertIn(f"fps=1/{settings.SPRITE_NUM_SECS}, scale=160:90", fake.ffmpeg_cmd)

    def test_short_video_keeps_every_frame(self):
        fake = self.produce_sprite(600)

        frames = fake.frames_appended()
        self.assertEqual(len(frames), 600 // settings.SPRITE_NUM_SECS + 1)
        self.assertEqual(frames, sorted(frames, key=lambda f: int(os.path.basename(f)[3:-4])))
        self.assertIn(f"fps=1/{settings.SPRITE_NUM_SECS}, scale=160:90", fake.ffmpeg_cmd)
