import os
import shutil
import tempfile

from django.conf import settings
from django.test import SimpleTestCase

from files.models import Media

AUDIO_ONLY_MASTER = """#EXTM3U
#EXT-X-VERSION:4
#EXT-X-STREAM-INF:BANDWIDTH=128000,CODECS="mp4a.40.2"
media-1/stream.m3u8
"""

MIXED_MASTER = """#EXTM3U
#EXT-X-VERSION:4
#EXT-X-STREAM-INF:BANDWIDTH=800000,CODECS="avc1.42c01e,mp4a.40.2",RESOLUTION=640x360
media-2/stream.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=128000,CODECS="mp4a.40.2"
media-1/stream.m3u8
"""

MEDIA_PLAYLIST = """#EXTM3U
#EXT-X-VERSION:4
#EXT-X-TARGETDURATION:6
#EXTINF:6.0,
segment-0.ts
#EXT-X-ENDLIST
"""


class TestHlsInfo(SimpleTestCase):
    def setUp(self):
        os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
        self.hls_dir = tempfile.mkdtemp(dir=settings.MEDIA_ROOT)

    def tearDown(self):
        shutil.rmtree(self.hls_dir, ignore_errors=True)

    def write(self, relative_path, content):
        path = os.path.join(self.hls_dir, relative_path)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            f.write(content)
        return path

    def test_audio_only_master_playlist(self):
        master = self.write("master.m3u8", AUDIO_ONLY_MASTER)
        self.write("media-1/stream.m3u8", MEDIA_PLAYLIST)
        media = Media(hls_file=master)

        info = media.hls_info

        self.assertIn("master_file", info)
        self.assertTrue(info["master_file"].endswith("/master.m3u8"))
        self.assertEqual([k for k in info if k.endswith("_playlist")], [])

    def test_video_renditions_keep_their_keys_next_to_audio(self):
        master = self.write("master.m3u8", MIXED_MASTER)
        self.write("media-1/stream.m3u8", MEDIA_PLAYLIST)
        self.write("media-2/stream.m3u8", MEDIA_PLAYLIST)
        media = Media(hls_file=master)

        info = media.hls_info

        self.assertIn("master_file", info)
        self.assertIn("360_playlist", info)
        self.assertTrue(info["360_playlist"].endswith("/media-2/stream.m3u8"))
        self.assertEqual(sorted(k for k in info if k.endswith("_playlist")), ["360_playlist"])
