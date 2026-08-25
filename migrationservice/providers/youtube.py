"""Importing video from YouTube, through yt-dlp.

There is no account to sign in to and no catalogue to walk: what a migration names is a list
of things to fetch, which may be video urls or ids, a playlist, or a channel. yt-dlp resolves
all of those through one entry point, so the source is a text field rather than a credential.

YouTube no longer serves a file with video and audio in it. Every stream is one or the other,
so a playable file is always a mux of two, which yt-dlp does with ffmpeg. The video half is
asked for as h264 in mp4 even though better codecs are offered at higher resolutions, because
h264 is what this portal's profiles and its player are built around: the merged file can then
be attached as an encoding as it is, and nothing has to be transcoded. The cost is a ceiling,
since above roughly 1080p YouTube offers only VP9 and AV1.
"""

import logging
import os
import re

from .base import BaseProvider

logger = logging.getLogger(__name__)

# the only captions worth taking. YouTube offers automatic ones in 150+ languages, which
# would attach that many subtitle rows to every video and say nothing extra.
CAPTION_LANGUAGE = "en"

# a bare id, as opposed to a url
VIDEO_ID = re.compile(r"^[\w-]{11}$")


def parse_sources(raw):
    """The things to fetch, one per line or comma separated.

    A bare 11 character id is expanded to a watch url so that yt-dlp does not have to guess
    what it is; everything else is passed through as typed.
    """
    parts = []
    for chunk in re.split(r"[\s,]+", str(raw or "")):
        chunk = chunk.strip()
        if not chunk:
            continue
        parts.append(f"https://www.youtube.com/watch?v={chunk}" if VIDEO_ID.match(chunk) else chunk)
    return parts


def short_side(stream):
    """The number a viewer recognises for a stream: its shorter dimension.

    720x1280 and 1280x720 are both 720. A vertical video read by its height would be filed
    as 1080 when it is a 720, and a ladder planned on height would skip its best stream for
    being "too tall". hls_stream_resolution reads the short side for the same reason.
    """
    width, height = stream.get("width"), stream.get("height")
    if width and height:
        return min(width, height)
    return height or width or None


def pick_profile(resolution, profiles):
    """The encode profile a fetched file of this resolution should be filed under.

    The nearest profile at or below it, never above: a file is allowed to be better than its
    label but never worse, and hls_stream_resolution snaps the same way, so the download
    list and the player's quality menu agree on one number.
    """
    if not resolution:
        return None
    usable = [profile for profile in profiles if profile.resolution and profile.active and profile.resolution <= resolution]
    return max(usable, key=lambda profile: profile.resolution) if usable else None


class YouTubeProvider(BaseProvider):
    name = "youtube"
    label = "YouTube"
    implemented = True

    secret_keys = ("cookies",)
    required_connection_keys = ("sources",)
    retired_connection_keys = ("channel_id", "api_key")

    default_options = {
        # every imported video belongs to this existing MediaCMS user. YouTube uploader
        # names are not accounts here and no attempt is made to turn them into any
        "fallback_username": "admin",
        "import_captions": True,
        "preserve_views": False,
        # attach the merged file as an encoding instead of re-encoding it
        "skip_transcoding": True,
        "max_items": None,
    }

    @classmethod
    def source_system(cls, connection):
        # there is one YouTube, so every migration from it shares an identity and a video
        # already imported by one is skipped by the next
        return "youtube"

    def __init__(self, connection, options):
        super().__init__(connection, options)
        self._cookie_file = None

    # ------------------------------------------------------------------ yt-dlp

    def _ydl_options(self, with_cookies=False, **extra):
        options = {
            "quiet": True,
            "no_warnings": True,
            "noprogress": True,
            "ignoreerrors": False,
        }
        if with_cookies:
            options["cookiefile"] = self._cookies_path()
        options.update(extra)
        return options

    def _attempt(self, work):
        """Run one yt-dlp call, anonymously first and with the cookies only if that fails.

        Cookies are an account's whole session and YouTube rotates them, so a jar exported
        from an ordinary browser window is often dead within hours. Sending it on every
        request meant one stale jar broke public video that needed no credentials at all,
        which is the wrong way round: the credential should rescue a failure, not cause one.

        Public video therefore stays anonymous, and nothing about the account is sent unless
        something actually could not be read without it.
        """
        try:
            return work(False)
        except Exception as anonymous_error:  # noqa: BLE001 - the retry decides what to raise
            if not self._has_cookies():
                raise
            logger.info("youtube: retrying with cookies after %s", str(anonymous_error)[:160])
            try:
                return work(True)
            except Exception as cookie_error:  # noqa: BLE001
                # both failed, so say so: a stale jar and a genuinely unavailable video look
                # nothing alike, and reporting only the second hides which happened
                raise RuntimeError(f"without cookies: {anonymous_error}; with cookies: {cookie_error}") from cookie_error

    def _has_cookies(self):
        return bool((self.connection.get("cookies") or "").strip())

    def _cookies_path(self):
        """The cookies written to a temp file, or None when none were given"""
        cookies = (self.connection.get("cookies") or "").strip()
        if not cookies:
            return None
        if self._cookie_file is None:
            import tempfile

            handle, path = tempfile.mkstemp(suffix=".txt", prefix="ytcookies-")
            with os.fdopen(handle, "w") as out:
                out.write(cookies if cookies.endswith("\n") else cookies + "\n")
            self._cookie_file = path
        return self._cookie_file

    @staticmethod
    def _yt_dlp():
        """yt-dlp, imported on use.

        Every provider is imported when the package is, so importing this at module level
        would make yt-dlp a hard dependency of a portal that migrates nothing, or of one
        migrating from somewhere else. The message is worth catching properly: yt-dlp needs
        upgrading often, because YouTube keeps changing what its pages look like.
        """
        try:
            import yt_dlp
        except ImportError as exc:  # pragma: no cover - depends on the install
            raise RuntimeError("yt-dlp is not installed. pip install -r requirements.txt") from exc
        return yt_dlp

    def _extract(self, url, **extra):
        yt_dlp = self._yt_dlp()

        def work(with_cookies):
            with yt_dlp.YoutubeDL(self._ydl_options(with_cookies=with_cookies, **extra)) as ydl:
                return ydl.extract_info(url, download=False)

        return self._attempt(work)

    # ------------------------------------------------------------------ contract

    def sources(self):
        return parse_sources(self.connection.get("sources"))

    def check_connection(self):
        """Resolve every source and report how many videos they hold between them"""
        sources = self.sources()
        if not sources:
            return {"ok": False, "error": "Give at least one video, playlist or channel.", "stats": {}}

        total = 0
        per_source = {}
        for url in sources:
            try:
                ids = self._video_ids(url)
            except Exception as exc:  # noqa: BLE001 - the button must always answer
                return {"ok": False, "error": f"{url}: {exc}", "stats": {}}
            per_source[url] = len(ids)
            total += len(ids)

        return {
            "ok": True,
            "error": "",
            "stats": {"entries": total, "users": 1, "entries_per_source": per_source},
        }

    def _video_ids(self, url):
        """Every video id one source resolves to, in the order it lists them.

        Listed flat, so a playlist or a channel costs one request rather than one per video.
        """
        info = self._extract(url, extract_flat=True)
        if info is None:
            return []
        if not info.get("entries"):
            return [str(info["id"])] if info.get("id") else []

        ids = []
        for entry in info["entries"]:
            if not entry:
                continue
            # a channel page resolves to its tabs, each of which holds the entries
            if entry.get("entries"):
                ids.extend(str(inner["id"]) for inner in entry["entries"] if inner and inner.get("id"))
            elif entry.get("id"):
                ids.append(str(entry["id"]))
        return ids

    def list_page(self, phase, cursor, page_size):
        if phase != "media":
            raise ValueError(f"Unknown migration phase: {phase}")

        # the whole list is resolved once and paged in memory. A source is a handful of
        # requests at most, and holding the order matters more than holding the memory
        cursor = dict(cursor or {})
        ids = cursor.get("ids")
        if ids is None:
            ids = []
            for url in self.sources():
                for video_id in self._video_ids(url):
                    if video_id not in ids:
                        ids.append(video_id)

        offset = cursor.get("offset") or 0
        page = ids[offset : offset + page_size]
        return page, {"ids": ids, "offset": offset + len(page)}

    def fetch_media(self, source_id):
        """The metadata worth keeping for one video, plus what it takes to fetch the file"""
        info = self._extract(f"https://www.youtube.com/watch?v={source_id}")

        captions = []
        if self.options.get("import_captions", True):
            tracks = (info.get("subtitles") or {}).get(CAPTION_LANGUAGE) or []
            vtt = next((track for track in tracks if track.get("ext") == "vtt"), None)
            if vtt and vtt.get("url"):
                captions.append({"language": CAPTION_LANGUAGE, "url": vtt["url"]})

        return {
            "id": str(info.get("id") or source_id),
            "title": info.get("title") or str(source_id),
            "description": info.get("description") or "",
            "tags": [tag for tag in (info.get("tags") or []) if tag][:20],
            "views": info.get("view_count") or 0,
            "duration": info.get("duration") or 0,
            "captions": captions,
        }

    def h264_streams(self, source_id):
        """The h264 video streams on offer, best one per height, tallest first.

        One per height because YouTube lists several encodes of the same size and only the
        highest bitrate of them is worth having.
        """
        info = self._extract(f"https://www.youtube.com/watch?v={source_id}")
        best = {}
        for stream in info.get("formats") or []:
            if not str(stream.get("vcodec") or "").startswith("avc1"):
                continue
            side = short_side(stream)
            if not side:
                continue
            current = best.get(side)
            if current is None or (stream.get("tbr") or 0) > (current.get("tbr") or 0):
                best[side] = stream
        return [best[side] for side in sorted(best, reverse=True)]

    def download_renditions(self, source_id, dest_dir, wanted_heights):
        """Fetch one mp4 per wanted height, muxed with the audio. [(path, height)].

        Every stream YouTube serves is video only or audio only, so each rendition is its
        own download joined to the same audio by ffmpeg. That is a container change rather
        than a re-encode, so a whole ladder costs bandwidth and almost no CPU, which is the
        point: nothing has to be transcoded.

        Heights are short sides throughout, so a vertical video ladders the same way a
        landscape one does. A wanted size with no stream at or below it is skipped rather
        than upscaled, and two that resolve to the same stream produce one file.
        """
        streams = self.h264_streams(source_id)
        if not streams:
            raise RuntimeError(f"no h264 stream offered for {source_id}")

        chosen = {}
        for wanted in sorted(set(wanted_heights or []), reverse=True):
            match = next((stream for stream in streams if short_side(stream) <= wanted), None)
            if match is not None:
                chosen.setdefault(match["format_id"], match)
        if not chosen:
            # nothing was asked for, or every request was below the smallest stream. Take
            # the best there is, so a media never arrives with no file at all
            chosen[streams[0]["format_id"]] = streams[0]

        produced = []
        for format_id, stream in chosen.items():
            side = short_side(stream)
            target = os.path.join(dest_dir, f"{source_id}-{side}.%(ext)s")
            yt_dlp = self._yt_dlp()

            def fetch(with_cookies, format_id=format_id, target=target):
                options = self._ydl_options(
                    with_cookies=with_cookies,
                    format=f"{format_id}+bestaudio[ext=m4a]/{format_id}+bestaudio",
                    merge_output_format="mp4",
                    outtmpl=target,
                    noplaylist=True,
                )
                with yt_dlp.YoutubeDL(options) as ydl:
                    return ydl.extract_info(f"https://www.youtube.com/watch?v={source_id}", download=True)

            self._attempt(fetch)

            path = os.path.join(dest_dir, f"{source_id}-{side}.mp4")
            if not os.path.exists(path):
                logger.warning("yt-dlp wrote no file for %s at %sp", source_id, side)
                continue
            produced.append((path, side))

        if not produced:
            raise RuntimeError(f"yt-dlp produced no file for {source_id}")
        # tallest first, so the caller stores the best one as the original
        return sorted(produced, key=lambda item: -item[1])

    def cleanup(self):
        if self._cookie_file and os.path.exists(self._cookie_file):
            os.remove(self._cookie_file)
            self._cookie_file = None
