from django.test import TestCase

from files.models.media import add_hls_stream, hls_stream_resolution


class StreamInfo:
    """Stands in for the m3u8 library's stream_info tuple."""

    def __init__(self, resolution, bandwidth=0, average_bandwidth=None):
        self.resolution = resolution
        self.bandwidth = bandwidth
        self.average_bandwidth = average_bandwidth


class TestHlsStreamResolution(TestCase):
    def test_standard_landscape_sizes_keep_their_height(self):
        self.assertEqual(hls_stream_resolution((640, 360)), 360)
        self.assertEqual(hls_stream_resolution((1280, 720)), 720)
        self.assertEqual(hls_stream_resolution((1920, 1080)), 1080)

    def test_vertical_video_reports_its_width(self):
        # the case the old height-then-width fallback existed for
        self.assertEqual(hls_stream_resolution((1080, 1920)), 1080)
        self.assertEqual(hls_stream_resolution((720, 1280)), 720)

    def test_a_non_standard_height_snaps_to_the_nearest_standard(self):
        # renditions this portal did not transcode, e.g. imported from Kaltura
        self.assertEqual(hls_stream_resolution((480, 272)), 240)
        self.assertEqual(hls_stream_resolution((1024, 576)), 480)

    def test_a_non_standard_height_never_reports_the_width(self):
        # 480x272 is a 240p file: advertising it as 480p put it above the real
        # 360p rendition in the quality menu
        self.assertNotEqual(hls_stream_resolution((480, 272)), 480)
        self.assertNotEqual(hls_stream_resolution((1024, 576)), 1024)

    def test_a_stream_without_a_resolution_is_skipped(self):
        self.assertIsNone(hls_stream_resolution(None))


class TestAddHlsStream(TestCase):
    def test_streams_are_keyed_by_resolution_and_suffix(self):
        res, bandwidths = {}, {}
        add_hls_stream(res, bandwidths, "playlist", StreamInfo((1280, 720), bandwidth=100), "/media/hls/x/media-1/stream.m3u8")
        self.assertIn("720_playlist", res)

    def test_two_streams_of_one_resolution_keep_the_higher_bitrate(self):
        """Bento4 can emit two renditions of the same resolution. The dict is keyed
        by resolution, so without this the second silently replaced the first and
        one stream vanished from the quality menu.
        """
        res, bandwidths = {}, {}
        add_hls_stream(res, bandwidths, "playlist", StreamInfo((640, 360), average_bandwidth=652934), "/media/hls/x/media-1/stream.m3u8")
        add_hls_stream(res, bandwidths, "playlist", StreamInfo((640, 360), average_bandwidth=728037), "/media/hls/x/media-6/stream.m3u8")

        self.assertEqual(len(res), 1)
        self.assertIn("media-6", res["360_playlist"])

    def test_a_lower_bitrate_duplicate_does_not_replace_the_kept_one(self):
        res, bandwidths = {}, {}
        add_hls_stream(res, bandwidths, "playlist", StreamInfo((640, 360), average_bandwidth=728037), "/media/hls/x/media-6/stream.m3u8")
        add_hls_stream(res, bandwidths, "playlist", StreamInfo((640, 360), average_bandwidth=652934), "/media/hls/x/media-1/stream.m3u8")

        self.assertIn("media-6", res["360_playlist"])

    def test_distinct_resolutions_all_survive(self):
        res, bandwidths = {}, {}
        for resolution in [(480, 272), (640, 360), (1024, 576), (1280, 720), (1920, 1080)]:
            add_hls_stream(res, bandwidths, "playlist", StreamInfo(resolution, bandwidth=1), f"/media/hls/x/{resolution[1]}/stream.m3u8")

        self.assertEqual(
            sorted(res.keys()),
            ["1080_playlist", "240_playlist", "360_playlist", "480_playlist", "720_playlist"],
        )
