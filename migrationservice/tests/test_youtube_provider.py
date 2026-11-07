import os
import shutil
import tempfile
from types import SimpleNamespace
from unittest import mock

from django.test import SimpleTestCase

from migrationservice.providers import get_provider_class
from migrationservice.providers.youtube import (
    YouTubeProvider,
    is_bot_check,
    parse_sources,
    pick_profile,
    short_side,
)

BOT_CHECK = "ERROR: [youtube] abc: Sign in to confirm you're not a bot. Use --cookies-from-browser"

COOKIES = "# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tabc"


class FakeYtDlp:
    def __init__(self, answer):
        self.answer = answer
        self.calls = []

    def YoutubeDL(self, options):
        return FakeYoutubeDL(self, options)


class FakeYoutubeDL:
    def __init__(self, owner, options):
        self.owner = owner
        self.options = options

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def extract_info(self, url, download=False):
        self.owner.calls.append({"url": url, "download": download, "options": self.options})
        return self.owner.answer(url, self.options)


def make_provider(sources="", cookies="", **options):
    connection = {"sources": sources}
    if cookies:
        connection["cookies"] = cookies
    return YouTubeProvider(connection, options)


class YtDlpTestCase(SimpleTestCase):
    def use(self, provider, answer):
        fake = FakeYtDlp(answer)
        patcher = mock.patch.object(YouTubeProvider, "_yt_dlp", return_value=fake)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(provider.cleanup)
        return fake


class TestBotCheck(SimpleTestCase):
    def test_the_messages_youtube_sends_a_server_are_recognised(self):
        self.assertTrue(is_bot_check(BOT_CHECK))
        self.assertTrue(is_bot_check(Exception("Please use --cookies for the authentication")))

    def test_an_ordinary_failure_is_not(self):
        self.assertFalse(is_bot_check("Video unavailable. This video is private"))
        self.assertFalse(is_bot_check(None))


class TestParseSources(SimpleTestCase):
    def test_a_bare_id_becomes_a_watch_url(self):
        self.assertEqual(parse_sources("dQw4w9WgXcQ"), ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"])

    def test_urls_pass_through_and_any_separator_splits(self):
        raw = "https://www.youtube.com/playlist?list=PL123 ,\n https://www.youtube.com/@somechannel,,abcdefghijk"
        self.assertEqual(
            parse_sources(raw),
            ["https://www.youtube.com/playlist?list=PL123", "https://www.youtube.com/@somechannel", "https://www.youtube.com/watch?v=abcdefghijk"],
        )

    def test_something_that_is_not_eleven_characters_is_not_taken_for_an_id(self):
        self.assertEqual(parse_sources("short"), ["short"])

    def test_nothing_given(self):
        self.assertEqual(parse_sources(None), [])
        self.assertEqual(parse_sources("  \n , "), [])


class TestShortSide(SimpleTestCase):
    def test_landscape_and_portrait_of_one_size_agree(self):
        self.assertEqual(short_side({"width": 1280, "height": 720}), 720)
        self.assertEqual(short_side({"width": 720, "height": 1280}), 720)

    def test_one_dimension_is_used_when_the_other_is_missing(self):
        self.assertEqual(short_side({"height": 480}), 480)
        self.assertEqual(short_side({"width": 640}), 640)

    def test_no_dimensions(self):
        self.assertIsNone(short_side({}))


class TestPickProfile(SimpleTestCase):
    profiles = [
        SimpleNamespace(resolution=360, active=True),
        SimpleNamespace(resolution=720, active=True),
        SimpleNamespace(resolution=1080, active=False),
        SimpleNamespace(resolution=None, active=True),
    ]

    def test_the_nearest_active_profile_at_or_below_is_chosen(self):
        self.assertEqual(pick_profile(720, self.profiles).resolution, 720)
        self.assertEqual(pick_profile(1080, self.profiles).resolution, 720)
        self.assertEqual(pick_profile(500, self.profiles).resolution, 360)

    def test_a_file_smaller_than_every_profile_is_filed_under_none(self):
        self.assertIsNone(pick_profile(240, self.profiles))

    def test_an_unknown_resolution_is_filed_under_none(self):
        self.assertIsNone(pick_profile(None, self.profiles))
        self.assertIsNone(pick_profile(0, self.profiles))


class TestIdentity(SimpleTestCase):
    def test_it_is_registered_and_every_migration_shares_one_identity(self):
        self.assertIs(get_provider_class("youtube"), YouTubeProvider)
        self.assertEqual(YouTubeProvider.source_system({"sources": "a"}), "youtube")
        self.assertEqual(YouTubeProvider.source_system({}), "youtube")

    def test_the_cookies_are_the_secret(self):
        self.assertEqual(YouTubeProvider.secret_keys, ("cookies",))
        self.assertEqual(YouTubeProvider.required_connection_keys, ("sources",))


class TestCookies(SimpleTestCase):
    def test_no_cookies_means_no_cookie_file(self):
        provider = make_provider(cookies="   ")
        self.assertFalse(provider._has_cookies())
        self.assertIsNone(provider._cookies_path())
        self.assertIsNone(provider._ydl_options(with_cookies=True)["cookiefile"])

    def test_the_cookies_are_written_once_and_end_with_a_newline(self):
        provider = make_provider(cookies=COOKIES)
        self.addCleanup(provider.cleanup)

        path = provider._cookies_path()
        self.assertEqual(provider._cookies_path(), path)
        with open(path) as written:
            self.assertEqual(written.read(), COOKIES + "\n")
        self.assertEqual(provider._ydl_options(with_cookies=True)["cookiefile"], path)

    def test_an_anonymous_request_carries_no_cookie_file(self):
        provider = make_provider(cookies=COOKIES)
        self.assertNotIn("cookiefile", provider._ydl_options(with_cookies=False, extract_flat=True))
        self.assertIsNone(provider._cookie_file)

    def test_cleanup_removes_the_cookie_file(self):
        provider = make_provider(cookies=COOKIES)
        path = provider._cookies_path()
        provider.cleanup()
        self.assertFalse(os.path.exists(path))
        self.assertIsNone(provider._cookie_file)
        provider.cleanup()


class TestAttempt(YtDlpTestCase):
    def test_a_public_video_is_read_without_the_cookies(self):
        provider = make_provider(sources="abcdefghijk", cookies=COOKIES)
        fake = self.use(provider, lambda url, options: {"id": "abcdefghijk"})

        self.assertEqual(provider._video_ids("https://www.youtube.com/watch?v=abcdefghijk"), ["abcdefghijk"])
        self.assertEqual(len(fake.calls), 1)
        self.assertNotIn("cookiefile", fake.calls[0]["options"])

    def test_without_cookies_an_ordinary_failure_is_raised_as_it_came(self):
        provider = make_provider()

        def answer(url, options):
            raise ValueError("Video unavailable")

        self.use(provider, answer)
        with self.assertRaisesMessage(ValueError, "Video unavailable"):
            provider._extract("https://www.youtube.com/watch?v=abcdefghijk")

    def test_without_cookies_a_bot_check_explains_what_is_needed(self):
        provider = make_provider()

        def answer(url, options):
            raise RuntimeError(BOT_CHECK)

        self.use(provider, answer)
        with self.assertRaises(RuntimeError) as caught:
            provider._extract("https://www.youtube.com/watch?v=abcdefghijk")
        self.assertIn("cookies.txt", str(caught.exception))
        self.assertIn("not a bot", str(caught.exception))

    def test_a_refusal_is_retried_with_the_cookies(self):
        provider = make_provider(cookies=COOKIES)

        def answer(url, options):
            if "cookiefile" not in options:
                raise RuntimeError("HTTP Error 403: Forbidden")
            return {"id": "abcdefghijk", "title": "Members only"}

        fake = self.use(provider, answer)
        self.assertEqual(provider._extract("u")["title"], "Members only")
        self.assertEqual([("cookiefile" in call["options"]) for call in fake.calls], [False, True])

    def test_when_both_fail_the_error_names_both(self):
        provider = make_provider(cookies=COOKIES)

        def answer(url, options):
            raise RuntimeError("expired cookies" if "cookiefile" in options else "HTTP Error 403")

        self.use(provider, answer)
        with self.assertRaises(RuntimeError) as caught:
            provider._extract("u")
        self.assertEqual(str(caught.exception), "without cookies: HTTP Error 403; with cookies: expired cookies")

    def test_after_one_bot_check_the_anonymous_try_is_skipped(self):
        provider = make_provider(cookies=COOKIES)

        def answer(url, options):
            if "cookiefile" not in options:
                raise RuntimeError(BOT_CHECK)
            return {"id": url[-11:]}

        fake = self.use(provider, answer)
        provider._extract("https://www.youtube.com/watch?v=aaaaaaaaaaa")
        provider._extract("https://www.youtube.com/watch?v=bbbbbbbbbbb")

        self.assertEqual([("cookiefile" in call["options"]) for call in fake.calls], [False, True, True])


class TestListing(YtDlpTestCase):
    PLAYLIST = "https://www.youtube.com/playlist?list=PL1"
    CHANNEL = "https://www.youtube.com/@channel"

    def answers(self, url, options):
        listings = {
            self.PLAYLIST: {"id": "PL1", "entries": [{"id": "aaaaaaaaaaa"}, None, {"title": "no id"}, {"id": "bbbbbbbbbbb"}]},
            self.CHANNEL: {
                "id": "UC1",
                "entries": [
                    {"id": "videos", "entries": [{"id": "bbbbbbbbbbb"}, None, {"id": "ccccccccccc"}]},
                    {"id": "shorts", "entries": [{"id": "ddddddddddd"}, {"title": "no id"}]},
                ],
            },
            "https://www.youtube.com/watch?v=eeeeeeeeeee": {"id": "eeeeeeeeeee", "title": "One video"},
            "https://gone.example/": None,
            "https://empty.example/": {"entries": []},
        }
        if url == "https://broken.example/":
            raise RuntimeError("Unsupported URL")
        return listings[url]

    def test_a_flat_listing_is_asked_for(self):
        provider = make_provider()
        fake = self.use(provider, self.answers)
        provider._video_ids(self.PLAYLIST)
        self.assertTrue(fake.calls[0]["options"]["extract_flat"])
        self.assertFalse(fake.calls[0]["download"])

    def test_a_playlist_skips_entries_with_no_id(self):
        provider = make_provider()
        self.use(provider, self.answers)
        self.assertEqual(provider._video_ids(self.PLAYLIST), ["aaaaaaaaaaa", "bbbbbbbbbbb"])

    def test_a_channel_is_read_through_its_tabs(self):
        provider = make_provider()
        self.use(provider, self.answers)
        self.assertEqual(provider._video_ids(self.CHANNEL), ["bbbbbbbbbbb", "ccccccccccc", "ddddddddddd"])

    def test_a_single_video_is_its_own_listing(self):
        provider = make_provider()
        self.use(provider, self.answers)
        self.assertEqual(provider._video_ids("https://www.youtube.com/watch?v=eeeeeeeeeee"), ["eeeeeeeeeee"])

    def test_nothing_resolved_is_an_empty_listing(self):
        provider = make_provider()
        self.use(provider, self.answers)
        self.assertEqual(provider._video_ids("https://gone.example/"), [])
        self.assertEqual(provider._video_ids("https://empty.example/"), [])

    def test_the_sweep_lists_every_source_once_and_drops_duplicates(self):
        provider = make_provider(sources=f"{self.PLAYLIST}\n{self.CHANNEL}\neeeeeeeeeee")
        fake = self.use(provider, self.answers)

        first, cursor = provider.list_page("media", {}, 3)
        self.assertEqual(first, ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"])
        second, cursor = provider.list_page("media", cursor, 3)
        self.assertEqual(second, ["ddddddddddd", "eeeeeeeeeee"])
        last, cursor = provider.list_page("media", cursor, 3)
        self.assertEqual(last, [])
        self.assertEqual(cursor["offset"], 5)
        self.assertEqual(len(fake.calls), 3)

    def test_a_phase_other_than_media_is_refused(self):
        with self.assertRaises(ValueError):
            make_provider(sources="eeeeeeeeeee").list_page("users", {}, 10)

    def test_check_connection_counts_each_source(self):
        provider = make_provider(sources=f"{self.PLAYLIST},{self.CHANNEL}")
        self.use(provider, self.answers)
        self.assertEqual(
            provider.check_connection(),
            {"ok": True, "error": "", "stats": {"entries": 5, "users": 1, "entries_per_source": {self.PLAYLIST: 2, self.CHANNEL: 3}}},
        )

    def test_check_connection_with_nothing_to_fetch(self):
        result = make_provider(sources=" ").check_connection()
        self.assertFalse(result["ok"])
        self.assertIn("at least one", result["error"])

    def test_check_connection_names_the_source_that_failed(self):
        provider = make_provider(sources=f"{self.PLAYLIST},https://broken.example/")
        self.use(provider, self.answers)
        self.assertEqual(provider.check_connection(), {"ok": False, "error": "https://broken.example/: Unsupported URL", "stats": {}})


class TestFetchMedia(YtDlpTestCase):
    INFO = {
        "id": "abcdefghijk",
        "title": "Lecture one",
        "description": "the first",
        "tags": ["", "biology"] + [f"tag{number}" for number in range(30)],
        "view_count": 1234,
        "duration": 61,
        "subtitles": {
            "en": [{"ext": "json3", "url": "https://yt.example/en.json3"}, {"ext": "vtt", "url": "https://yt.example/en.vtt"}],
            "de": [{"ext": "vtt", "url": "https://yt.example/de.vtt"}],
        },
    }

    def test_the_metadata_worth_keeping(self):
        provider = make_provider()
        fake = self.use(provider, lambda url, options: self.INFO)
        media = provider.fetch_media("abcdefghijk")

        self.assertEqual(fake.calls[0]["url"], "https://www.youtube.com/watch?v=abcdefghijk")
        self.assertEqual(media["id"], "abcdefghijk")
        self.assertEqual(media["title"], "Lecture one")
        self.assertEqual(media["description"], "the first")
        self.assertEqual(media["views"], 1234)
        self.assertEqual(media["duration"], 61)
        self.assertEqual(len(media["tags"]), 20)
        self.assertEqual(media["tags"][0], "biology")

    def test_only_the_english_vtt_caption_is_taken(self):
        provider = make_provider()
        self.use(provider, lambda url, options: self.INFO)
        self.assertEqual(provider.fetch_media("abcdefghijk")["captions"], [{"language": "en", "url": "https://yt.example/en.vtt"}])

    def test_captions_switched_off(self):
        provider = make_provider(import_captions=False)
        self.use(provider, lambda url, options: self.INFO)
        self.assertEqual(provider.fetch_media("abcdefghijk")["captions"], [])

    def test_a_vtt_track_with_no_url_is_not_a_caption(self):
        provider = make_provider()
        self.use(provider, lambda url, options: {"id": "abcdefghijk", "subtitles": {"en": [{"ext": "vtt"}]}})
        self.assertEqual(provider.fetch_media("abcdefghijk")["captions"], [])

    def test_a_video_that_says_almost_nothing(self):
        provider = make_provider()
        self.use(provider, lambda url, options: {})
        self.assertEqual(
            provider.fetch_media("abcdefghijk"),
            {"id": "abcdefghijk", "title": "abcdefghijk", "description": "", "tags": [], "views": 0, "duration": 0, "captions": []},
        )


def stream(format_id, width, height, vcodec="avc1.640028", tbr=1000):
    return {"format_id": format_id, "width": width, "height": height, "vcodec": vcodec, "tbr": tbr}


FORMATS = [
    stream("137", 1920, 1080, tbr=4000),
    stream("137b", 1920, 1080, tbr=2500),
    stream("248", 1920, 1080, vcodec="vp9"),
    stream("136", 1280, 720, tbr=None),
    stream("135", 854, 480),
    stream("140", None, None, vcodec="none"),
    stream("avc-no-size", None, None),
]


class TestH264Streams(YtDlpTestCase):
    def test_the_best_h264_stream_per_size_tallest_first(self):
        provider = make_provider()
        self.use(provider, lambda url, options: {"formats": FORMATS})
        self.assertEqual([item["format_id"] for item in provider.h264_streams("abcdefghijk")], ["137", "136", "135"])

    def test_a_video_with_no_formats(self):
        provider = make_provider()
        self.use(provider, lambda url, options: {})
        self.assertEqual(provider.h264_streams("abcdefghijk"), [])


class TestDownloadRenditions(YtDlpTestCase):
    def setUp(self):
        self.dest = tempfile.mkdtemp(prefix="yt-test-")
        self.addCleanup(shutil.rmtree, self.dest, True)

    def downloader(self, formats=FORMATS, skip_sides=()):

        def answer(url, options):
            if "outtmpl" not in options:
                return {"formats": formats}
            path = options["outtmpl"].replace("%(ext)s", "mp4")
            if not any(path.endswith(f"-{side}.mp4") for side in skip_sides):
                with open(path, "wb") as out:
                    out.write(b"video")
            return {"id": "abcdefghijk"}

        return answer

    def downloads(self, fake):
        return [call["options"] for call in fake.calls if call["download"]]

    def test_one_file_per_wanted_size_largest_first(self):
        provider = make_provider()
        fake = self.use(provider, self.downloader())
        produced = provider.download_renditions("abcdefghijk", self.dest, [480, 720, 1080])

        self.assertEqual(
            produced, [(os.path.join(self.dest, "abcdefghijk-1080.mp4"), 1080), (os.path.join(self.dest, "abcdefghijk-720.mp4"), 720), (os.path.join(self.dest, "abcdefghijk-480.mp4"), 480)]
        )
        first = self.downloads(fake)[0]
        self.assertEqual(first["format"], "137+bestaudio[ext=m4a]/137+bestaudio")
        self.assertEqual(first["merge_output_format"], "mp4")
        self.assertTrue(first["noplaylist"])

    def test_a_size_with_no_exact_stream_takes_the_next_one_down_once(self):
        provider = make_provider()
        fake = self.use(provider, self.downloader())
        produced = provider.download_renditions("abcdefghijk", self.dest, [1440, 1080, 900])

        self.assertEqual([side for _, side in produced], [1080, 720])
        self.assertEqual(len(self.downloads(fake)), 2)

    def test_when_nothing_wanted_fits_the_best_stream_is_fetched(self):
        provider = make_provider()
        self.use(provider, self.downloader())
        self.assertEqual([side for _, side in provider.download_renditions("abcdefghijk", self.dest, [240])], [1080])
        self.assertEqual([side for _, side in provider.download_renditions("abcdefghijk", self.dest, None)], [1080])

    def test_a_size_yt_dlp_wrote_nothing_for_is_left_out(self):
        provider = make_provider()
        self.use(provider, self.downloader(skip_sides=(720,)))
        self.assertEqual([side for _, side in provider.download_renditions("abcdefghijk", self.dest, [720, 1080])], [1080])

    def test_no_file_at_all_is_an_error(self):
        provider = make_provider()
        self.use(provider, self.downloader(skip_sides=(1080, 720)))
        with self.assertRaisesMessage(RuntimeError, "yt-dlp produced no file for abcdefghijk"):
            provider.download_renditions("abcdefghijk", self.dest, [720, 1080])

    def test_a_video_with_no_h264_stream_is_an_error(self):
        provider = make_provider()
        self.use(provider, self.downloader(formats=[stream("248", 1920, 1080, vcodec="vp9")]))
        with self.assertRaisesMessage(RuntimeError, "no h264 stream offered for abcdefghijk"):
            provider.download_renditions("abcdefghijk", self.dest, [1080])

    def test_a_download_refused_anonymously_is_retried_with_the_cookies(self):
        provider = make_provider(cookies=COOKIES)
        write = self.downloader()

        def answer(url, options):
            if "outtmpl" in options and "cookiefile" not in options:
                raise RuntimeError("HTTP Error 403")
            return write(url, options)

        fake = self.use(provider, answer)
        self.assertEqual([side for _, side in provider.download_renditions("abcdefghijk", self.dest, [480])], [480])
        self.assertEqual([("cookiefile" in options) for options in self.downloads(fake)], [False, True])
