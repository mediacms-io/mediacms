"""Combining a multi-stream recording into one picture.

Kaltura Capture records the camera and the screens as entries linked by parentEntryId.
A normal sweep only ever returns the parent, so the other streams are lost unless they are
asked for by name. They are brought over and drawn side by side in one video, because
MediaCMS plays one file per media.

Compositing always re-encodes: overlay decodes every input and writes a new picture, and
there is no stream copy that combines them.
"""

import logging
import os
import subprocess

from django.conf import settings

logger = logging.getLogger(__name__)

MAX_STREAMS = 3

CANVAS_ASPECT = 16 / 9
DEFAULT_FRAME_RATE = "30"

COMPOSE_TIMEOUT = 60 * 60


class ComposeError(Exception):
    """ffmpeg could not draw the streams as one"""


def stream_area(entry):
    return (entry.get("width") or 0) * (entry.get("height") or 0)


def even(value):
    value = int(value or 0)
    return max(2, value - (value % 2))


def canvas_size(height):
    height = even(height)
    return even(round(height * CANVAS_ASPECT)), height


def layout_boxes(stream_count, width, height):
    if stream_count == 2:
        child_width = even(width * 3 // 4)
        return [(0, 0, child_width, height), (child_width, 0, width - child_width, height)]
    if stream_count == 3:
        half_width, half_height = even(width // 2), even(height // 2)
        parent_width = even(width // 3)
        parent_x = half_width + (width - half_width - parent_width) // 2
        return [(0, 0, half_width, half_height), (0, half_height, half_width, height - half_height), (parent_x, 0, parent_width, height)]
    raise ValueError(f"no layout for {stream_count} streams")


def pick_flavor_for_width(flavors, needed_width):
    """The smallest flavor wide enough for its box, or the widest there is.

    One file of each smaller stream serves every rendition of the canvas: there is no reason
    to fetch a 1080p camera to draw it 480 wide.
    """
    playable = [flavor for flavor in flavors if (flavor.get("fileExt") or "").lower() in ("mp4", "webm")]
    if not playable:
        return None
    wide_enough = [flavor for flavor in playable if (flavor.get("width") or 0) >= needed_width]
    if wide_enough:
        return min(wide_enough, key=lambda flavor: flavor.get("width") or 0)
    return max(playable, key=lambda flavor: flavor.get("width") or 0)


def compose_side_by_side(paths, dest_path, width, height):
    """Draw paths, the children in order and then the parent, side by side into dest_path.

    The audio is the parent's, falling back to a child's: every stream carries the same
    microphone, so mixing them would play everything twice. shortest stops a stream that
    runs a few frames long from leaving a frozen tail.
    """
    boxes = layout_boxes(len(paths), width, height)
    parent_first = [paths[-1]] + paths[:-1]
    audio_path = next((path for path in parent_first if has_audio(path)), None)

    filters = [f"color=c=black:s={width}x{height}:r={probe_frame_rate(paths[0])}[c0]"]
    for index, (x, y, box_width, box_height) in enumerate(boxes):
        filters.append(f"[{index}:v]scale={box_width}:{box_height}:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1[s{index}]")
        filters.append(f"[c{index}][s{index}]overlay=x={x}+({box_width}-w)/2:y={y}+({box_height}-h)/2:shortest=1[c{index + 1}]")

    command = [getattr(settings, "FFMPEG_COMMAND", "ffmpeg"), "-v", "error", "-y"]
    for path in paths:
        command += ["-i", path]
    command += ["-filter_complex", ";".join(filters), "-map", f"[c{len(boxes)}]"]
    if audio_path:
        command += ["-map", f"{paths.index(audio_path)}:a", "-c:a", "aac"]
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


def probe_frame_rate(path):
    command = [
        getattr(settings, "FFPROBE_COMMAND", "ffprobe"),
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=r_frame_rate",
        "-of",
        "csv=p=0",
        path,
    ]
    try:
        result = subprocess.run(command, capture_output=True, timeout=60)
    except subprocess.SubprocessError:
        return DEFAULT_FRAME_RATE
    rate = (result.stdout or b"").decode().strip().rstrip(",")
    numerator, _, denominator = rate.partition("/")
    if not numerator.isdigit() or int(numerator) == 0 or (denominator and (not denominator.isdigit() or int(denominator) == 0)):
        return DEFAULT_FRAME_RATE
    return rate
