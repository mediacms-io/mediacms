"""Combining a multi-stream recording into one picture.

Kaltura Capture records the screen and the camera as two entries linked by parentEntryId.
A normal sweep only ever returns the parent, so the second stream is lost unless it is
asked for by name. Both are brought over and drawn as one video, the camera inset over the
screen, because MediaCMS plays one file per media.

Compositing always re-encodes: overlay decodes both inputs and writes a new picture, and
there is no stream copy that combines two of them.
"""

import logging
import os
import subprocess

from django.conf import settings

logger = logging.getLogger(__name__)

# the camera, over the screen's bottom right corner, at a quarter of its width
INSET_RATIO = 0.25
INSET_MARGIN_RATIO = 1 / 72

# parent plus one child. Three pictures in one frame is nobody's idea of a recording
MAX_STREAMS = 2

COMPOSE_TIMEOUT = 60 * 60


class ComposeError(Exception):
    """ffmpeg could not draw the two streams as one"""


def stream_area(entry):
    return (entry.get("width") or 0) * (entry.get("height") or 0)


def pick_base_and_inset(entries):
    """(screen, camera) of a multi-stream recording.

    The screen capture is the bigger picture of the two, and the one worth reading, so it
    is the one that keeps its size.
    """
    ordered = sorted(entries, key=stream_area, reverse=True)
    return ordered[0], ordered[1]


def inset_width_for(base_width):
    width = int((base_width or 0) * INSET_RATIO)
    return max(2, width - (width % 2))


def pick_inset_flavor(flavors, needed_width):
    """The smallest flavor wide enough to be the inset, or the widest there is.

    The inset is a quarter of the frame, so one camera file serves every rendition of the
    screen: there is no reason to fetch a 1080p camera to draw it 432 wide.
    """
    playable = [flavor for flavor in flavors if (flavor.get("fileExt") or "").lower() in ("mp4", "webm")]
    if not playable:
        return None
    wide_enough = [flavor for flavor in playable if (flavor.get("width") or 0) >= needed_width]
    if wide_enough:
        return min(wide_enough, key=lambda flavor: flavor.get("width") or 0)
    return max(playable, key=lambda flavor: flavor.get("width") or 0)


def compose_pip(base_path, inset_path, dest_path, base_width=0):
    """Draw inset_path over base_path and write dest_path.

    The audio is the screen's, falling back to the camera's: both streams carry the same
    microphone, so mixing them would play everything twice. shortest stops a stream that
    runs a few frames long from leaving a frozen tail.
    """
    base_width = base_width or probe_width(base_path)
    width = inset_width_for(base_width)
    margin = max(8, int(base_width * INSET_MARGIN_RATIO))
    audio = "0:a" if has_audio(base_path) else ("1:a" if has_audio(inset_path) else "")

    command = [
        getattr(settings, "FFMPEG_COMMAND", "ffmpeg"),
        "-v",
        "error",
        "-y",
        "-i",
        base_path,
        "-i",
        inset_path,
        "-filter_complex",
        f"[1:v]scale={width}:-2[pip];[0:v][pip]overlay=W-w-{margin}:H-h-{margin}:shortest=1[v]",
        "-map",
        "[v]",
    ]
    if audio:
        command += ["-map", audio, "-c:a", "aac"]
    command += [
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-movflags",
        "+faststart",
        dest_path,
    ]

    try:
        result = subprocess.run(command, capture_output=True, timeout=COMPOSE_TIMEOUT)
    except subprocess.TimeoutExpired as exc:
        raise ComposeError(f"combining the streams timed out after {COMPOSE_TIMEOUT}s") from exc

    if result.returncode != 0 or not os.path.exists(dest_path) or not os.path.getsize(dest_path):
        detail = (result.stderr or b"").decode("utf-8", "replace").strip().splitlines()
        raise ComposeError(detail[-1] if detail else f"ffmpeg exited {result.returncode}")

    return dest_path


def has_audio(path):
    command = [
        getattr(settings, "FFPROBE_COMMAND", "ffprobe"),
        "-v",
        "error",
        "-select_streams",
        "a",
        "-show_entries",
        "stream=codec_type",
        "-of",
        "csv=p=0",
        path,
    ]
    try:
        result = subprocess.run(command, capture_output=True, timeout=60)
        return b"audio" in (result.stdout or b"")
    except subprocess.SubprocessError:
        return False


def probe_width(path):
    command = [
        getattr(settings, "FFPROBE_COMMAND", "ffprobe"),
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width",
        "-of",
        "csv=p=0",
        path,
    ]
    try:
        result = subprocess.run(command, capture_output=True, timeout=60)
        return int((result.stdout or b"").decode().strip().rstrip(",") or 0)
    except (ValueError, subprocess.SubprocessError):
        return 0
