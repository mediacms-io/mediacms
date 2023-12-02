# Kudos to Werner Robitza, AVEQ GmbH, for helping with ffmpeg
# related content

import hashlib
import json
import os
import random
import shutil
import subprocess
import tempfile
from fractions import Fraction

import filetype
from django.conf import settings

CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

CRF_ENCODING_NUM_SECONDS = 2  # 0 * 60 # videos with greater duration will get
# CRF encoding and not two-pass
# Encoding individual chunks may yield quality variations if you use a
# too low bitrate, so if you go for the chunk-based variant
# you should use CRF encoding.

MAX_RATE_MULTIPLIER = 1.5
MIN_RATE_MULTIPLIER = 0.5

BUF_SIZE_MULTIPLIER = 1.5

# in seconds, anything between 2 and 6 makes sense
KEYFRAME_DISTANCE = 4
KEYFRAME_DISTANCE_MIN = 2

# speed presets
# see https://trac.ffmpeg.org/wiki/Encode/H.264
X26x_PRESET = "medium"  # "medium"
X265_PRESET = "medium"
X26x_PRESET_BIG_HEIGHT = "faster"

# VP9_SPEED = 1  # between 0 and 4, lower is slower
VP9_SPEED = 2


VIDEO_CRFS = {
    "h264_baseline": 23,
    "h264": 23,
    "h265": 28,
    "vp9": 32,
}

# video rates for 25 or 60 fps input, for different codecs, in kbps
VIDEO_BITRATES = {
    "h264": {
        25: {
            240: 300,
            360: 500,
            480: 1000,
            720: 2500,
            1080: 4500,
            1440: 9000,
            2160: 18000,
        },
        60: {720: 3500, 1080: 7500, 1440: 18000, 2160: 40000},
    },
    "h265": {
        25: {
            240: 150,
            360: 275,
            480: 500,
            720: 1024,
            1080: 1800,
            1440: 4500,
            2160: 10000,
        },
        60: {720: 1800, 1080: 3000, 1440: 8000, 2160: 18000},
    },
    "vp9": {
        25: {
            240: 150,
            360: 275,
            480: 500,
            720: 1024,
            1080: 1800,
            1440: 4500,
            2160: 10000,
        },
        60: {720: 1800, 1080: 3000, 1440: 8000, 2160: 18000},
    },
}


AUDIO_ENCODERS = {"h264": "aac", "h265": "aac", "vp9": "libopus"}

AUDIO_BITRATES = {"h264": 128, "h265": 128, "vp9": 96}

EXTENSIONS = {"h264": "mp4", "h265": "mp4", "vp9": "webm"}

VIDEO_PROFILES = {"h264": "main", "h265": "main"}


def get_portal_workflow():
    return settings.PORTAL_WORKFLOW


def get_default_state(user=None):
    # possible states given the portal workflow setting
    state = "private"
    if settings.PORTAL_WORKFLOW == "public":
        state = "public"
    if settings.PORTAL_WORKFLOW == "unlisted":
        state = "unlisted"
    if settings.PORTAL_WORKFLOW == "private_verified":
        if user and user.advancedUser:
            state = "unlisted"
    return state


def get_file_name(filename):
    return filename.split("/")[-1]


def get_file_type(filename):
    if not os.path.exists(filename):
        return None
    file_type = None
    kind = filetype.guess(filename)
    if kind is not None:
        if kind.mime.startswith("video"):
            file_type = "video"
        elif kind.mime.startswith("image"):
            file_type = "image"
        elif kind.mime.startswith("audio"):
            file_type = "audio"
        elif "pdf" in kind.mime:
            file_type = "pdf"
    else:
        # TODO: do something for files not supported by filetype lib
        pass
    return file_type


def rm_file(filename):
    if os.path.isfile(filename):
        try:
            os.remove(filename)
            return True
        except OSError:
            pass
    return False


def rm_files(filenames):
    if isinstance(filenames, list):
        for filename in filenames:
            rm_file(filename)
    return True


def rm_dir(directory):
    if os.path.isdir(directory):
        # refuse to delete a dir inside project BASE_DIR
        if directory.startswith(settings.BASE_DIR):
            try:
                shutil.rmtree(directory)
                return True
            except (FileNotFoundError, PermissionError):
                pass
    return False


def url_from_path(filename):
    # TODO: find a way to preserver http - https ...
    return "{0}{1}".format(settings.MEDIA_URL, filename.replace(settings.MEDIA_ROOT, ""))


def create_temp_file(suffix=None, dir=settings.TEMP_DIRECTORY):
    tf = tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=dir)
    return tf.name


def create_temp_dir(suffix=None, dir=settings.TEMP_DIRECTORY):
    td = tempfile.mkdtemp(dir=dir)
    return td


def produce_friendly_token(token_len=settings.FRIENDLY_TOKEN_LEN):
    token = ""
    while len(token) != token_len:
        token += CHARS[random.randint(0, len(CHARS) - 1)]
    return token


def clean_friendly_token(token):
    # cleans token
    for char in token:
        if char not in CHARS:
            token.replace(char, "")
    return token


def mask_ip(ip_address):
    return hashlib.md5(ip_address.encode("utf-8")).hexdigest()


def run_command(cmd, cwd=None):
    """
    Run a command directly
    """
    if isinstance(cmd, str):
        cmd = cmd.split()
    ret = {}
    if cwd:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=cwd)
    else:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    stdout, stderr = process.communicate()
    # TODO: catch unicodedecodeerrors here...
    if process.returncode == 0:
        try:
            ret["out"] = stdout.decode("utf-8")
        except BaseException:
            ret["out"] = ""
        try:
            ret["error"] = stderr.decode("utf-8")
        except BaseException:
            ret["error"] = ""
    else:
        try:
            ret["error"] = stderr.decode("utf-8")
        except BaseException:
            ret["error"] = ""
    return ret


def media_file_info(input_file):
    """
    Get the info about an input file, as determined by ffprobe

    Returns a dict, with the keys:
    - `filename`: Filename
    - `file_size`: Size of the file in bytes
    - `video_duration`: Duration of the video in `s.msec`
    - `video_frame_rate_d`: Framerate franction denominator
    - `video_frame_rate_n`: Framerate fraction nominator
    - `video_bitrate`: Bitrate of the video stream in kBit/s
    - `video_width`: Width in pixels
    - `video_height`: Height in pixels
    - `interlaced` : True if the video is interlaced
    - `video_codec`: Video codec
    - `audio_duration`: Duration of the audio in `s.msec`
    - `audio_sample_rate`: Audio sample rate in Hz
    - `audio_codec`: Audio codec name (`aac`)
    - `audio_bitrate`: Bitrate of the video stream in kBit/s

    Also returns the video and audio info raw from ffprobe.
    """
    ret = {}

    if not os.path.isfile(input_file):
        ret["fail"] = True
        return ret

    video_info = {}
    audio_info = {}
    cmd = ["stat", "-c", "%s", input_file]

    stdout = run_command(cmd).get("out")
    if stdout:
        file_size = int(stdout.strip())
    else:
        ret["fail"] = True
        return ret

    cmd = ["md5sum", input_file]
    stdout = run_command(cmd).get("out")
    if stdout:
        md5sum = stdout.split()[0]
    else:
        md5sum = ""

    cmd = [
        settings.FFPROBE_COMMAND,
        "-loglevel",
        "error",
        "-show_streams",
        "-show_entries",
        "format=format_name",
        "-of",
        "json",
        input_file,
    ]
    stdout = run_command(cmd).get("out")
    try:
        info = json.loads(stdout)
    except TypeError:
        ret["fail"] = True
        return ret

    has_video = False
    has_audio = False
    for stream_info in info["streams"]:
        if stream_info["codec_type"] == "video":
            video_info = stream_info
            has_video = True
            if info.get("format") and info["format"].get("format_name", "") in [
                "tty",
                "image2",
                "image2pipe",
                "bin",
                "png_pipe",
                "gif",
            ]:
                ret["fail"] = True
                return ret
        elif stream_info["codec_type"] == "audio":
            audio_info = stream_info
            has_audio = True

    if not has_video:
        ret["is_video"] = False
        ret["is_audio"] = has_audio
        ret["audio_info"] = audio_info
        return ret

    if "duration" in video_info.keys():
        video_duration = float(video_info["duration"])
    elif "tags" in video_info.keys() and "DURATION" in video_info["tags"]:
        duration_str = video_info["tags"]["DURATION"]
        try:
            hms, msec = duration_str.split(".")
        except ValueError:
            hms, msec = duration_str.split(",")

        total_dur = sum(int(x) * 60**i for i, x in enumerate(reversed(hms.split(":"))))
        video_duration = total_dur + float("0." + msec)
    else:
        # fallback to format, eg for webm
        cmd = [
            settings.FFPROBE_COMMAND,
            "-loglevel",
            "error",
            "-show_format",
            "-of",
            "json",
            input_file,
        ]
        stdout = run_command(cmd).get("out")
        format_info = json.loads(stdout)["format"]
        try:
            video_duration = float(format_info["duration"])
        except KeyError:
            ret["fail"] = True
            return ret

    if "bit_rate" in video_info.keys():
        video_bitrate = round(float(video_info["bit_rate"]) / 1024.0, 2)
    else:
        cmd = [
            settings.FFPROBE_COMMAND,
            "-loglevel",
            "error",
            "-select_streams",
            "v",
            "-show_entries",
            "packet=size",
            "-of",
            "compact=p=0:nk=1",
            input_file,
        ]
        stdout = run_command(cmd).get("out")
        stream_size = sum([int(line.replace("|", "")) for line in stdout.split("\n") if line != ""])
        video_bitrate = round((stream_size * 8 / 1024.0) / video_duration, 2)

    if "r_frame_rate" in video_info.keys():
        video_frame_rate = video_info["r_frame_rate"].partition("/")
        video_frame_rate_n = video_frame_rate[0]
        video_frame_rate_d = video_frame_rate[2]

    interlaced = False
    if video_info.get("field_order") in ("tt", "tb", "bt", "bb"):
        interlaced = True

    ret = {
        "filename": input_file,
        "file_size": file_size,
        "video_duration": video_duration,
        "video_frame_rate_n": video_frame_rate_n,
        "video_frame_rate_d": video_frame_rate_d,
        "video_bitrate": video_bitrate,
        "video_width": video_info["width"],
        "video_height": video_info["height"],
        "video_codec": video_info["codec_name"],
        "has_video": has_video,
        "has_audio": has_audio,
        "color_range": video_info.get("color_range"),
        "color_space": video_info.get("color_space"),
        "color_transfer": video_info.get("color_space"),
        "color_primaries": video_info.get("color_primaries"),
        "interlaced": interlaced,
        "display_aspect_ratio": video_info.get("display_aspect_ratio"),
        "sample_aspect_ratio": video_info.get("sample_aspect_ratio"),
    }

    if has_audio:
        if "duration" in audio_info.keys():
            audio_duration = float(audio_info["duration"])
        elif "tags" in audio_info.keys() and "DURATION" in audio_info["tags"]:
            duration_str = audio_info["tags"]["DURATION"]
            try:
                hms, msec = duration_str.split(".")
            except ValueError:
                hms, msec = duration_str.split(",")
            total_dur = sum(int(x) * 60**i for i, x in enumerate(reversed(hms.split(":"))))
            audio_duration = total_dur + float("0." + msec)
        else:
            # fallback to format, eg for webm
            cmd = [
                settings.FFPROBE_COMMAND,
                "-loglevel",
                "error",
                "-show_format",
                "-of",
                "json",
                input_file,
            ]
            stdout = run_command(cmd).get("out")
            format_info = json.loads(stdout)["format"]
            audio_duration = float(format_info["duration"])

        if "bit_rate" in audio_info.keys():
            audio_bitrate = round(float(audio_info["bit_rate"]) / 1024.0, 2)
        else:
            # fall back to calculating from accumulated frame duration
            cmd = [
                settings.FFPROBE_COMMAND,
                "-loglevel",
                "error",
                "-select_streams",
                "a",
                "-show_entries",
                "packet=size",
                "-of",
                "compact=p=0:nk=1",
                input_file,
            ]
            stdout = run_command(cmd).get("out")
            # ffprobe appends a pipe at the end of the output, thus we have to remove it
            stream_size = sum([int(line.replace("|", "")) for line in stdout.split("\n") if line != ""])
            audio_bitrate = round((stream_size * 8 / 1024.0) / audio_duration, 2)

        ret.update(
            {
                "audio_duration": audio_duration,
                "audio_sample_rate": audio_info["sample_rate"],
                "audio_codec": audio_info["codec_name"],
                "audio_bitrate": audio_bitrate,
                "audio_channels": audio_info["channels"],
            }
        )

    ret["video_info"] = video_info
    ret["audio_info"] = audio_info
    ret["is_video"] = True
    ret["md5sum"] = md5sum
    return ret


def calculate_seconds(duration):
    # returns seconds, given a ffmpeg extracted string
    ret = 0
    if isinstance(duration, str):
        duration = duration.split(":")
        if len(duration) != 3:
            return ret
    else:
        return ret

    ret += int(float(duration[2]))
    ret += int(float(duration[1])) * 60
    ret += int(float(duration[0])) * 60 * 60
    return ret


def show_file_size(size):
    if size:
        size = size / 1000000
        size = round(size, 1)
        size = "{0}MB".format(str(size))
    return size


def get_base_ffmpeg_command(
    input_file,
    output_file,
    has_audio,
    codec,
    encoder,
    audio_encoder,
    target_fps,
    interlaced,
    target_height,
    target_rate,
    target_rate_audio,
    pass_file,
    pass_number,
    enc_type,
    chunk,
):
    """Get the base command for a specific codec, height/rate, and pass

    Arguments:
        input_file {str} -- input file name
        output_file {str} -- output file name
        has_audio {bool} -- does the input have audio?
        codec {str} -- video codec
        encoder {str} -- video encoder
        audio_encoder {str} -- audio encoder
        target_fps {fractions.Fraction} -- target FPS
        interlaced {bool} -- true if interlaced
        target_height {int} -- height
        target_rate {int} -- target bitrate in kbps
        target_rate_audio {int} -- audio target bitrate
        pass_file {str} -- path to temp pass file
        pass_number {int} -- number of passes
        enc_type {str} -- encoding type (twopass or crf)
    """

    # avoid very high frame rates
    while target_fps > 60:
        target_fps = target_fps / 2

    if target_fps < 1:
        target_fps = 1

    filters = []

    if interlaced:
        filters.append("yadif")

    target_width = round(target_height * 16 / 9)
    scale_filter_opts = [
        f"if(lt(iw\\,ih)\\,{target_height}\\,{target_width})",  # noqa
        f"if(lt(iw\\,ih)\\,{target_width}\\,{target_height})",  # noqa
        "force_original_aspect_ratio=decrease",
        "force_divisible_by=2",
        "flags=lanczos",
    ]
    scale_filter_str = "scale=" + ":".join(scale_filter_opts)
    filters.append(scale_filter_str)

    fps_str = f"fps=fps={target_fps}"
    filters.append(fps_str)

    filters_str = ",".join(filters)

    base_cmd = [
        settings.FFMPEG_COMMAND,
        "-y",
        "-i",
        input_file,
        "-c:v",
        encoder,
        "-filter:v",
        filters_str,
        "-pix_fmt",
        "yuv420p",
    ]

    if enc_type == "twopass":
        base_cmd.extend(["-b:v", str(target_rate) + "k"])
    elif enc_type == "crf":
        base_cmd.extend(["-crf", str(VIDEO_CRFS[codec])])
        if encoder == "libvpx-vp9":
            base_cmd.extend(["-b:v", str(target_rate) + "k"])

    if has_audio:
        base_cmd.extend(
            [
                "-c:a",
                audio_encoder,
                "-b:a",
                str(target_rate_audio) + "k",
                # stereo audio only, see https://trac.ffmpeg.org/ticket/5718
                "-ac",
                "2",
            ]
        )

    # get keyframe distance in frames
    keyframe_distance = int(target_fps * KEYFRAME_DISTANCE)

    # start building the command
    cmd = base_cmd[:]

    # preset settings
    if encoder == "libvpx-vp9":
        if pass_number == 1:
            speed = 4
        else:
            speed = VP9_SPEED
    elif encoder in ["libx264"]:
        preset = X26x_PRESET
    elif encoder in ["libx265"]:
        preset = X265_PRESET
    if target_height >= 720:
        preset = X26x_PRESET_BIG_HEIGHT

    if encoder == "libx264":
        level = "4.2" if target_height <= 1080 else "5.2"

        x264_params = [
            "keyint=" + str(keyframe_distance * 2),
            "keyint_min=" + str(keyframe_distance),
        ]

        cmd.extend(
            [
                "-maxrate",
                str(int(int(target_rate) * MAX_RATE_MULTIPLIER)) + "k",
                "-bufsize",
                str(int(int(target_rate) * BUF_SIZE_MULTIPLIER)) + "k",
                "-force_key_frames",
                "expr:gte(t,n_forced*" + str(KEYFRAME_DISTANCE) + ")",
                "-x264-params",
                ":".join(x264_params),
                "-preset",
                preset,
                "-profile:v",
                VIDEO_PROFILES[codec],
                "-level",
                level,
            ]
        )

        if enc_type == "twopass":
            cmd.extend(["-passlogfile", pass_file, "-pass", pass_number])

    elif encoder == "libx265":
        x265_params = [
            "vbv-maxrate=" + str(int(int(target_rate) * MAX_RATE_MULTIPLIER)),
            "vbv-bufsize=" + str(int(int(target_rate) * BUF_SIZE_MULTIPLIER)),
            "keyint=" + str(keyframe_distance * 2),
            "keyint_min=" + str(keyframe_distance),
        ]

        if enc_type == "twopass":
            x265_params.extend(["stats=" + str(pass_file), "pass=" + str(pass_number)])

        cmd.extend(
            [
                "-force_key_frames",
                "expr:gte(t,n_forced*" + str(KEYFRAME_DISTANCE) + ")",
                "-x265-params",
                ":".join(x265_params),
                "-preset",
                preset,
                "-profile:v",
                VIDEO_PROFILES[codec],
            ]
        )
    elif encoder == "libvpx-vp9":
        cmd.extend(
            [
                "-g",
                str(keyframe_distance),
                "-keyint_min",
                str(keyframe_distance),
                "-maxrate",
                str(int(int(target_rate) * MAX_RATE_MULTIPLIER)) + "k",
                "-minrate",
                str(int(int(target_rate) * MIN_RATE_MULTIPLIER)) + "k",
                "-bufsize",
                str(int(int(target_rate) * BUF_SIZE_MULTIPLIER)) + "k",
                "-speed",
                speed,
                #            '-deadline', 'realtime',
            ]
        )

        if enc_type == "twopass":
            cmd.extend(["-passlogfile", pass_file, "-pass", pass_number])

    cmd.extend(
        [
            "-strict",
            "-2",
        ]
    )

    # end of the command
    if pass_number == 1:
        cmd.extend(["-an", "-f", "null", "/dev/null"])
    elif pass_number == 2:
        if output_file.endswith("mp4") and chunk:
            cmd.extend(["-movflags", "+faststart"])
        cmd.extend([output_file])

    return cmd


def produce_ffmpeg_commands(media_file, media_info, resolution, codec, output_filename, pass_file, chunk=False):
    try:
        media_info = json.loads(media_info)
    except BaseException:
        media_info = {}

    if codec == "h264":
        encoder = "libx264"
        # ext = "mp4"
    elif codec in ["h265", "hevc"]:
        encoder = "libx265"
        # ext = "mp4"
    elif codec == "vp9":
        encoder = "libvpx-vp9"
        # ext = "webm"
    else:
        return False

    target_fps = Fraction(int(media_info.get("video_frame_rate_n", 30)), int(media_info.get("video_frame_rate_d", 1)))
    if target_fps <= 30:
        target_rate = VIDEO_BITRATES[codec][25].get(resolution)
    else:
        target_rate = VIDEO_BITRATES[codec][60].get(resolution)
    if not target_rate:  # INVESTIGATE MORE!
        target_rate = VIDEO_BITRATES[codec][25].get(resolution)
    if not target_rate:
        return False

    if media_info.get("video_height") < resolution:
        if resolution not in [240, 360]:  # always get these two
            return False

    #    if codec == "h264_baseline":
    #        target_fps = 25
    #    else:

    if media_info.get("video_duration") > CRF_ENCODING_NUM_SECONDS:
        enc_type = "crf"
    else:
        enc_type = "twopass"

    if enc_type == "twopass":
        passes = [1, 2]
    elif enc_type == "crf":
        passes = [2]

    interlaced = media_info.get("interlaced")

    cmds = []
    for pass_number in passes:
        cmds.append(
            get_base_ffmpeg_command(
                media_file,
                output_file=output_filename,
                has_audio=media_info.get("has_audio"),
                codec=codec,
                encoder=encoder,
                audio_encoder=AUDIO_ENCODERS[codec],
                target_fps=target_fps,
                interlaced=interlaced,
                target_height=resolution,
                target_rate=target_rate,
                target_rate_audio=AUDIO_BITRATES[codec],
                pass_file=pass_file,
                pass_number=pass_number,
                enc_type=enc_type,
                chunk=chunk,
            )
        )
    return cmds


def clean_query(query):
    """This is used to clear text in order to comply with SearchQuery
    known exception cases

    :param query: str - the query text that we want to clean
    :return:
    """

    if not query:
        return ""

    chars = ["^", "{", "}", "&", "|", "<", ">", '"', ")", "(", "!", ":", ";", "'", "#"]
    for char in chars:
        query = query.replace(char, "")

    return query.lower()


def get_alphanumeric_only(string):
    """Returns a query that contains only alphanumeric characters
    This include characters other than the English alphabet too
    """
    string = "".join([char for char in string if char.isalnum()])
    return string.lower()
