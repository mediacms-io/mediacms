import json
import os
import re
import shutil
import tempfile
from datetime import datetime, timedelta

from celery import Task
from celery import shared_task as task
from celery.signals import task_revoked

# from celery.task.control import revoke
from celery.utils.log import get_task_logger
from django.conf import settings
from django.core.cache import cache
from django.core.files import File
from django.db import DatabaseError
from django.db.models import Q

from actions.models import USER_MEDIA_ACTIONS, MediaAction
from users.models import User

from .backends import FFmpegBackend
from .exceptions import VideoEncodingError
from .helpers import (
    calculate_seconds,
    create_temp_file,
    get_file_name,
    get_file_type,
    get_trim_timestamps,
    media_file_info,
    produce_ffmpeg_commands,
    produce_friendly_token,
    rm_file,
    run_command,
    trim_video_method,
)
from .methods import (
    copy_video,
    kill_ffmpeg_process,
    list_tasks,
    notify_users,
    pre_save_action,
)
from .models import (
    Category,
    EncodeProfile,
    Encoding,
    Language,
    Media,
    Rating,
    Subtitle,
    Tag,
    TranscriptionRequest,
    VideoTrimRequest,
)

logger = get_task_logger(__name__)

VALID_USER_ACTIONS = [action for action, name in USER_MEDIA_ACTIONS]

ERRORS_LIST = [
    "Output file is empty, nothing was encoded",
    "Invalid data found when processing input",
    "Unable to find a suitable output format for",
]


def handle_pending_running_encodings(media):
    """Handle pending and running encodings for a media object.

    we are trimming the original file. If there are encodings in success state, this means that the encoding has run
    and has succeeded, so we can keep them (they will be trimmed) or if we dont keep them we dont have to delete them
    here

    However for encodings that are in pending or running phase, just delete them

    Args:
        media: The media object to handle encodings for

    Returns:
        bool: True if any encodings were deleted, False otherwise
    """
    encodings = media.encodings.exclude(status="success")
    deleted = False
    for encoding in encodings:
        if encoding.temp_file:
            kill_ffmpeg_process(encoding.temp_file)
        if encoding.chunk_file_path:
            kill_ffmpeg_process(encoding.chunk_file_path)
        deleted = True
        encoding.delete()

    return deleted


def pre_trim_video_actions(media):
    # the reason for this function is to perform tasks before trimming a video

    # avoid re-running unnecessary encodings (or chunkize_media, which is the first step for them)
    # if the video is already completed
    # however if it is a new video (user uploded the video and starts trimming
    # before the video is processed), this is necessary, so encode has to be called to give it a chance to encode

    # if a video is fully processed (all encodings are success), or if a video is new, then things are clear

    # HOWEVER there is a race condition and this is that some encodings are success and some are pending/running
    # Since we are making speed cutting, we will perform an ffmpeg -c copy on all of them and the result will be
    # that they will end up differently cut, because ffmpeg checks for I-frames
    # The result is fine if playing the video but is bad in case of HLS
    # So we need to delete all encodings inevitably to produce same results, if there are some that are success and some that
    # are still not finished.

    profiles = EncodeProfile.objects.filter(active=True, extension='mp4', resolution__lte=media.video_height)
    media_encodings = EncodeProfile.objects.filter(encoding__in=media.encodings.filter(status="success", chunk=False), extension='mp4').distinct()

    picked = []
    for profile in profiles:
        if profile in media_encodings:
            continue
        else:
            picked.append(profile)

    if picked:
        # by calling encode will re-encode all. The logic is explained above...
        logger.info(f"Encoding media {media.friendly_token} will have to be performed for all profiles")
        media.encode()

    return True


@task(name="chunkize_media", bind=True, queue="short_tasks", soft_time_limit=60 * 30 * 4)
def chunkize_media(self, friendly_token, profiles, force=True):
    """Break media in chunks and start encoding tasks"""

    profiles = [EncodeProfile.objects.get(id=profile) for profile in profiles]
    media = Media.objects.get(friendly_token=friendly_token)
    cwd = os.path.dirname(os.path.realpath(media.media_file.path))
    file_name = media.media_file.path.split("/")[-1]
    random_prefix = produce_friendly_token()
    file_format = f"{random_prefix}_{file_name}"
    chunks_file_name = f"%02d_{file_format}"
    chunks_file_name += ".mkv"
    cmd = [
        settings.FFMPEG_COMMAND,
        "-y",
        "-i",
        media.media_file.path,
        "-c",
        "copy",
        "-f",
        "segment",
        "-segment_time",
        str(settings.VIDEO_CHUNKS_DURATION),
        chunks_file_name,
    ]
    chunks = []
    ret = run_command(cmd, cwd=cwd)

    if "out" in ret.keys():
        for line in ret.get("error").split("\n"):
            ch = re.findall(r"Opening \'([\W\w]+)\' for writing", line)
            if ch:
                chunks.append(ch[0])
    if not chunks:
        # command completely failed to segment file.putting to normal encode
        logger.info(f"Failed to break file {friendly_token} in chunks. Putting to normal encode queue")
        for profile in profiles:
            if media.video_height and media.video_height < profile.resolution:
                if profile.resolution not in settings.MINIMUM_RESOLUTIONS_TO_ENCODE:
                    continue
            encoding = Encoding(media=media, profile=profile)
            encoding.save()
            enc_url = settings.SSL_FRONTEND_HOST + encoding.get_absolute_url()
            encode_media.delay(friendly_token, profile.id, encoding.id, enc_url, force=force)
        return False

    chunks = [os.path.join(cwd, ch) for ch in chunks]
    to_profiles = []
    chunks_dict = {}
    # calculate once md5sums
    for chunk in chunks:
        cmd = ["md5sum", chunk]
        stdout = run_command(cmd).get("out")
        md5sum = stdout.strip().split()[0]
        chunks_dict[chunk] = md5sum

    for profile in profiles:
        if media.video_height and media.video_height < profile.resolution:
            if profile.resolution not in settings.MINIMUM_RESOLUTIONS_TO_ENCODE:
                continue
        to_profiles.append(profile)

        for chunk in chunks:
            encoding = Encoding(
                media=media,
                profile=profile,
                chunk_file_path=chunk,
                chunk=True,
                chunks_info=json.dumps(chunks_dict),
                md5sum=chunks_dict[chunk],
            )

            encoding.save()
            enc_url = settings.SSL_FRONTEND_HOST + encoding.get_absolute_url()
            if profile.resolution in settings.MINIMUM_RESOLUTIONS_TO_ENCODE:
                priority = 0
            else:
                priority = 9
            encode_media.apply_async(
                args=[friendly_token, profile.id, encoding.id, enc_url],
                kwargs={"force": force, "chunk": True, "chunk_file_path": chunk},
                priority=priority,
            )

    logger.info(f"got {len(chunks)} chunks and will encode to {to_profiles} profiles")
    return True


class EncodingTask(Task):
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        # mainly used to run some post failure steps
        # we get here if a task is revoked
        try:
            if hasattr(self, "encoding"):
                self.encoding.status = "fail"
                self.encoding.save(update_fields=["status"])
                kill_ffmpeg_process(self.encoding.temp_file)
                kill_ffmpeg_process(self.encoding.chunk_file_path)
                if hasattr(self.encoding, "media"):
                    self.encoding.media.post_encode_actions()
        except BaseException:
            pass
        return False


@task(
    name="encode_media",
    base=EncodingTask,
    bind=True,
    queue="long_tasks",
    soft_time_limit=settings.CELERY_SOFT_TIME_LIMIT,
)
def encode_media(
    self,
    friendly_token,
    profile_id,
    encoding_id,
    encoding_url,
    force=True,
    chunk=False,
    chunk_file_path="",
):
    """Encode a media to given profile, using ffmpeg, storing progress"""

    logger.info(f"encode_media for {friendly_token}/{profile_id}/{encoding_id}/{force}/{chunk}")
    # TODO: this is new behavior, check whether it performs well. Before that check it would end up saving the Encoding
    # at some point below. Now it exits the task. Could it be that before it would give it a chance to re-run? Or it was
    # not being used at all?
    if not Encoding.objects.filter(id=encoding_id).exists():
        logger.info(f"Exiting for {friendly_token}/{profile_id}/{encoding_id}/{force} since encoding id not found")
        return False

    if self.request.id:
        task_id = self.request.id
    else:
        task_id = None
    try:
        media = Media.objects.get(friendly_token=friendly_token)
        profile = EncodeProfile.objects.get(id=profile_id)
    except BaseException:
        Encoding.objects.filter(id=encoding_id).delete()
        return False

    # break logic with chunk True/False
    if chunk:
        # TODO: in case a video is chunkized and this enters here many times
        # it will always run since chunk_file_path is always different
        # thus find a better way for this check
        if Encoding.objects.filter(media=media, profile=profile, chunk_file_path=chunk_file_path).count() > 1 and force is False:
            Encoding.objects.filter(id=encoding_id).delete()
            return False
        else:
            try:
                encoding = Encoding.objects.get(id=encoding_id)
                encoding.status = "running"
                Encoding.objects.filter(
                    media=media,
                    profile=profile,
                    chunk=True,
                    chunk_file_path=chunk_file_path,
                ).exclude(id=encoding_id).delete()
            except BaseException:
                encoding = Encoding(
                    media=media,
                    profile=profile,
                    status="running",
                    chunk=True,
                    chunk_file_path=chunk_file_path,
                )
    else:
        if Encoding.objects.filter(media=media, profile=profile).count() > 1 and force is False:
            Encoding.objects.filter(id=encoding_id).delete()
            return False
        else:
            try:
                encoding = Encoding.objects.get(id=encoding_id)
                encoding.status = "running"
                Encoding.objects.filter(media=media, profile=profile).exclude(id=encoding_id).delete()
            except BaseException:
                encoding = Encoding(media=media, profile=profile, status="running")

    if task_id:
        encoding.task_id = task_id
    encoding.worker = "localhost"
    encoding.retries = self.request.retries
    encoding.save()

    if profile.extension == "gif":
        tf = create_temp_file(suffix=".gif")
        # -ss 5 start from 5 second. -t 25 until 25 sec
        command = [
            settings.FFMPEG_COMMAND,
            "-y",
            "-ss",
            "3",
            "-i",
            media.media_file.path,
            "-hide_banner",
            "-vf",
            "scale=344:-1:flags=lanczos,fps=1",
            "-t",
            "25",
            "-f",
            "gif",
            tf,
        ]
        ret = run_command(command)
        if os.path.exists(tf) and get_file_type(tf) == "image":
            with open(tf, "rb") as f:
                myfile = File(f)
                encoding.status = "success"
                encoding.media_file.save(content=myfile, name=tf)
                rm_file(tf)
                return True
        else:
            return False

    if chunk:
        original_media_path = chunk_file_path
    else:
        original_media_path = media.media_file.path

    # if not media.duration:
    #    encoding.status = "fail"
    #    encoding.save(update_fields=["status"])
    #    return False

    with tempfile.TemporaryDirectory(dir=settings.TEMP_DIRECTORY) as temp_dir:
        tf = create_temp_file(suffix=f".{profile.extension}", dir=temp_dir)
        tfpass = create_temp_file(suffix=f".{profile.extension}", dir=temp_dir)
        ffmpeg_commands = produce_ffmpeg_commands(
            original_media_path,
            media.media_info,
            resolution=profile.resolution,
            codec=profile.codec,
            output_filename=tf,
            pass_file=tfpass,
            chunk=chunk,
        )
        if not ffmpeg_commands:
            encoding.status = "fail"
            encoding.save(update_fields=["status"])
            return False

        encoding.temp_file = tf
        encoding.commands = str(ffmpeg_commands)

        encoding.save(update_fields=["temp_file", "commands", "task_id"])

        # binding these, so they are available on on_failure
        self.encoding = encoding
        self.media = media
        # can be one-pass or two-pass
        for ffmpeg_command in ffmpeg_commands:
            ffmpeg_command = [str(s) for s in ffmpeg_command]
            encoding_backend = FFmpegBackend()
            try:
                encoding_command = encoding_backend.encode(ffmpeg_command)
                duration, n_times = 0, 0
                output = ""
                while encoding_command:
                    try:
                        # TODO: understand an eternal loop
                        # eg h265 with mv4 file issue, and stop with error
                        output = next(encoding_command)
                        duration = calculate_seconds(output)
                        if duration:
                            percent = duration * 100 / media.duration
                            if n_times % 60 == 0:
                                encoding.progress = percent
                                encoding.save(update_fields=["progress", "update_date"])
                                logger.info(f"Saved {round(percent, 2)}")
                            n_times += 1
                    except DatabaseError:
                        # primary reason for this is that the encoding has been deleted, because
                        # the media file was deleted, or also that there was a trim video request
                        # so it would be redundant to let it complete the encoding
                        kill_ffmpeg_process(encoding.temp_file)
                        kill_ffmpeg_process(encoding.chunk_file_path)
                        return False

                    except StopIteration:
                        break
                    except VideoEncodingError:
                        # ffmpeg error, or ffmpeg was killed
                        raise

            except Exception as e:
                try:
                    # output is empty, fail message is on the exception
                    output = e.message
                except AttributeError:
                    output = ""
                kill_ffmpeg_process(encoding.temp_file)
                kill_ffmpeg_process(encoding.chunk_file_path)
                encoding.logs = output
                encoding.status = "fail"
                try:
                    encoding.save(update_fields=["status", "logs"])
                except DatabaseError:
                    return False
                raise_exception = True
                # if this is an ffmpeg's valid error
                # no need for the task to be re-run
                # otherwise rerun task...
                for error_msg in ERRORS_LIST:
                    if error_msg.lower() in output.lower():
                        raise_exception = False
                if raise_exception:
                    raise self.retry(exc=e, countdown=5, max_retries=1)

        encoding.logs = output
        encoding.progress = 100

        success = False
        encoding.status = "fail"
        if os.path.exists(tf) and os.path.getsize(tf) != 0:
            ret = media_file_info(tf)
            if ret.get("is_video") or ret.get("is_audio"):
                encoding.status = "success"
                success = True

                with open(tf, "rb") as f:
                    myfile = File(f)
                    output_name = f"{get_file_name(original_media_path)}.{profile.extension}"
                    encoding.media_file.save(content=myfile, name=output_name)
                encoding.total_run_time = (encoding.update_date - encoding.add_date).seconds

        try:
            encoding.save(update_fields=["status", "logs", "progress", "total_run_time"])
        # this will raise a django.db.utils.DatabaseError error when task is revoked,
        # since we delete the encoding at that stage
        except BaseException:
            pass

        return success


@task(name="whisper_transcribe", queue="long_tasks", soft_time_limit=60 * 60 * 2)
def whisper_transcribe(friendly_token, translate_to_english=False):
    try:
        media = Media.objects.get(friendly_token=friendly_token)
    except:  # noqa
        logger.info(f"failed to get media {friendly_token}")
        return False

    request = TranscriptionRequest.objects.filter(media=media, status="pending", translate_to_english=translate_to_english).first()
    if not request:
        logger.info(f"No pending transcription request for media {friendly_token}")
        return False

    if translate_to_english:
        language = Language.objects.filter(code="whisper-translation").first()
        if not language:
            language = Language.objects.create(code="whisper-translation", title="English Translation")
    else:
        language = Language.objects.filter(code="whisper").first()
        if not language:
            language = Language.objects.create(code="whisper", title="Transcription")

    cwd = os.path.dirname(os.path.realpath(media.media_file.path))
    request.status = "running"
    request.save(update_fields=["status"])

    with tempfile.TemporaryDirectory(dir=settings.TEMP_DIRECTORY) as tmpdirname:
        video_file_path = get_file_name(media.media_file.name)
        video_file_path = '.'.join(video_file_path.split('.')[:-1])  # needed by whisper without the extension
        subtitle_name = f"{video_file_path}.vtt"
        output_name = f"{tmpdirname}/{subtitle_name}"

        cmd = f"whisper /home/mediacms.io/mediacms/media_files/{media.media_file.name} --model {settings.WHISPER_MODEL} --output_dir {tmpdirname}"
        if translate_to_english:
            cmd += " --task translate"

        logger.info(f"Whisper transcribe: ready to run command {cmd}")

        start_time = datetime.now()
        ret = run_command(cmd, cwd=cwd)  # noqa
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        if os.path.exists(output_name):
            subtitle = Subtitle.objects.create(media=media, user=media.user, language=language)

            with open(output_name, 'rb') as f:
                subtitle.subtitle_file.save(subtitle_name, File(f))

            request.status = "success"
            request.logs = f"Transcription took {duration:.2f} seconds."  # noqa
            request.save(update_fields=["status", "logs"])
            return True

        request.status = "fail"
        request.logs = f"Transcription failed after {duration:.2f} seconds. Error: {ret.get('error')}"  # noqa
        request.save(update_fields=["status", "logs"])

        return False


@task(name="update_search_vector", queue="short_tasks")
def update_search_vector(friendly_token):
    try:
        media = Media.objects.get(friendly_token=friendly_token)
        media.update_search_vector()
    except:  # noqa
        return False

    return True


@task(name="produce_sprite_from_video", queue="long_tasks")
def produce_sprite_from_video(friendly_token):
    """Produces a sprites file for a video, uses ffmpeg"""

    try:
        media = Media.objects.get(friendly_token=friendly_token)
    except BaseException:
        logger.info(f"failed to get media with friendly_token {friendly_token}")
        return False

    with tempfile.TemporaryDirectory(dir=settings.TEMP_DIRECTORY) as tmpdirname:
        try:
            tmpdir_image_files = tmpdirname + "/img%03d.jpg"
            output_name = tmpdirname + "/sprites.jpg"

            fps = getattr(settings, 'SPRITE_NUM_SECS', 10)
            ffmpeg_cmd = [settings.FFMPEG_COMMAND, "-i", media.media_file.path, "-f", "image2", "-vf", f"fps=1/{fps}, scale=160:90", tmpdir_image_files]  # noqa
            run_command(ffmpeg_cmd)
            image_files = [f for f in os.listdir(tmpdirname) if f.startswith("img") and f.endswith(".jpg")]
            image_files = sorted(image_files, key=lambda x: int(re.search(r'\d+', x).group()))
            image_files = [os.path.join(tmpdirname, f) for f in image_files]
            cmd_convert = ["convert", *image_files, "-append", output_name]  # image files, unpacked into the list
            ret = run_command(cmd_convert)  # noqa

            if os.path.exists(output_name) and get_file_type(output_name) == "image":
                with open(output_name, "rb") as f:
                    myfile = File(f)
                    # SOS: avoid race condition, since this runs for a long time and will replace any other media changes on the meanwhile!!!
                    media.sprites.save(content=myfile, name=get_file_name(media.media_file.path) + "sprites.jpg", save=False)
                    media.save(update_fields=["sprites"])

        except Exception as e:
            print(e)
    return True


@task(name="create_hls", queue="long_tasks")
def create_hls(friendly_token):
    """Creates HLS file for media, uses Bento4 mp4hls command"""

    if not hasattr(settings, "MP4HLS_COMMAND"):
        logger.info("Bento4 mp4hls command is missing from configuration")
        return False

    if not os.path.exists(settings.MP4HLS_COMMAND):
        logger.info("Bento4 mp4hls command is missing")
        return False

    try:
        media = Media.objects.get(friendly_token=friendly_token)
    except BaseException:
        logger.info(f"failed to get media with friendly_token {friendly_token}")
        return False

    p = media.uid.hex
    output_dir = os.path.join(settings.HLS_DIR, p)
    encodings = media.encodings.filter(profile__extension="mp4", status="success", chunk=False, profile__codec="h264")

    if encodings:
        existing_output_dir = None
        if os.path.exists(output_dir):
            existing_output_dir = output_dir
            output_dir = os.path.join(settings.HLS_DIR, p + produce_friendly_token())
        files = [f.media_file.path for f in encodings if f.media_file]
        cmd = [settings.MP4HLS_COMMAND, '--segment-duration=4', f'--output-dir={output_dir}', *files]
        run_command(cmd)

        if existing_output_dir:
            # override content with -T !
            cmd = ["cp", "-rT", output_dir, existing_output_dir]
            run_command(cmd)

            try:
                shutil.rmtree(output_dir)
            except:  # noqa
                # this was breaking in some cases where it was already deleted
                # because create_hls was running multiple times
                pass
            output_dir = existing_output_dir
        pp = os.path.join(output_dir, "master.m3u8")
        if os.path.exists(pp):
            if media.hls_file != pp:
                Media.objects.filter(pk=media.pk).update(hls_file=pp)
    return True


@task(name="media_init", queue="short_tasks")
def media_init(friendly_token):
    try:
        media = Media.objects.get(friendly_token=friendly_token)
    except:  # noqa
        logger.info("failed to get media with friendly_token %s" % friendly_token)
        return False
    media.media_init()

    return True


@task(name="check_running_states", queue="short_tasks")
def check_running_states():
    # Experimental - unused
    """Check stale running encodings and delete/reencode media"""

    encodings = Encoding.objects.filter(status="running")

    logger.info(f"got {encodings.count()} encodings that are in state running")
    changed = 0
    for encoding in encodings:
        now = datetime.now(encoding.update_date.tzinfo)
        if (now - encoding.update_date).seconds > settings.RUNNING_STATE_STALE:
            media = encoding.media
            profile = encoding.profile
            # task_id = encoding.task_id
            # terminate task
            # TODO: not imported
            # if task_id:
            #    revoke(task_id, terminate=True)
            encoding.delete()
            media.encode(profiles=[profile])
            # TODO: allign with new code + chunksize...
            changed += 1
    if changed:
        logger.info(f"changed from running to pending on {changed} items")
    return True


@task(name="check_media_states", queue="short_tasks")
def check_media_states():
    # Experimental - unused
    # check encoding status of not success media
    media = Media.objects.filter(Q(encoding_status="running") | Q(encoding_status="fail") | Q(encoding_status="pending"))

    logger.info(f"got {media.count()} media that are not in state success")

    changed = 0
    for m in media:
        m.set_encoding_status()
        m.save(update_fields=["encoding_status"])
        changed += 1
    if changed:
        logger.info(f"changed encoding status to {changed} media items")
    return True


@task(name="check_pending_states", queue="short_tasks")
def check_pending_states():
    # Experimental - unused
    # check encoding profiles that are on state pending and not on a queue
    encodings = Encoding.objects.filter(status="pending")

    if not encodings:
        return True

    changed = 0
    tasks = list_tasks()
    task_ids = tasks["task_ids"]
    media_profile_pairs = tasks["media_profile_pairs"]
    for encoding in encodings:
        if encoding.task_id and encoding.task_id in task_ids:
            # encoding is in one of the active/reserved/scheduled tasks list
            continue
        elif (
            encoding.media.friendly_token,
            encoding.profile.id,
        ) in media_profile_pairs:
            continue
            # encoding is in one of the reserved/scheduled tasks list.
            # has no task_id but will be run, so need to re-enter the queue
        else:
            media = encoding.media
            profile = encoding.profile
            encoding.delete()
            media.encode(profiles=[profile], force=False)
            changed += 1
    if changed:
        logger.info(f"set to the encode queue {changed} encodings that were on pending state")
    return True


@task(name="check_missing_profiles", queue="short_tasks")
def check_missing_profiles():
    # Experimental - unused

    # check if video files have missing profiles. If so, add them
    media = Media.objects.filter(media_type="video")
    profiles = list(EncodeProfile.objects.all())

    changed = 0

    for m in media:
        existing_profiles = [p.profile for p in m.encodings.all()]
        missing_profiles = [p for p in profiles if p not in existing_profiles]
        if missing_profiles:
            m.encode(profiles=missing_profiles, force=False)
            # since we call with force=False
            # encode_media won't delete existing profiles
            # if they appear on the meanwhile (eg on a big queue)
            changed += 1
    if changed:
        logger.info(f"set to the encode queue {changed} profiles")
    return True


@task(name="clear_sessions", queue="short_tasks")
def clear_sessions():
    """Clear expired sessions"""

    try:
        from importlib import import_module

        from django.conf import settings

        engine = import_module(settings.SESSION_ENGINE)
        engine.SessionStore.clear_expired()
    except BaseException:
        return False
    return True


@task(name="save_user_action", queue="short_tasks")
def save_user_action(user_or_session, friendly_token=None, action="watch", extra_info=None):
    """Short task that saves a user action"""

    if action not in VALID_USER_ACTIONS:
        return False

    try:
        media = Media.objects.get(friendly_token=friendly_token)
    except BaseException:
        return False

    user = user_or_session.get("user_id")
    session_key = user_or_session.get("user_session")
    remote_ip = user_or_session.get("remote_ip_addr")

    if user:
        try:
            user = User.objects.get(id=user)
        except BaseException:
            return False

    if not (user or session_key):
        return False

    if action in ["like", "dislike", "watch", "report"]:
        if not pre_save_action(
            media=media,
            user=user,
            session_key=session_key,
            action=action,
            remote_ip=remote_ip,
        ):
            return False

    if action == "watch":
        if user:
            MediaAction.objects.filter(user=user, media=media, action="watch").delete()
        else:
            MediaAction.objects.filter(session_key=session_key, media=media, action="watch").delete()
    if action == "rate":
        try:
            score = extra_info.get("score")
            rating_category = extra_info.get("category_id")
        except BaseException:
            # TODO: better error handling?
            return False
        try:
            rating = Rating.objects.filter(user=user, media=media, rating_category_id=rating_category).first()
            if rating:
                rating.score = score
                rating.save(update_fields=["score"])
            else:
                rating = Rating.objects.create(
                    user=user,
                    media=media,
                    rating_category_id=rating_category,
                    score=score,
                )
        except Exception:
            # TODO: more specific handling, for errors in score, or
            # rating_category?
            return False

    ma = MediaAction(
        user=user,
        session_key=session_key,
        media=media,
        action=action,
        extra_info=extra_info,
        remote_ip=remote_ip,
    )
    ma.save()

    if action == "watch":
        media.views += 1
        Media.objects.filter(friendly_token=friendly_token).update(views=media.views)

        # update field without calling save, to avoid post_save signals being triggered
        # same in other actions

    elif action == "report":
        media.reported_times += 1

        if media.reported_times >= settings.REPORTED_TIMES_THRESHOLD:
            media.state = "private"
        media.save(update_fields=["reported_times", "state"])

        notify_users(
            friendly_token=media.friendly_token,
            action="media_reported",
            extra=extra_info,
        )
    elif action == "like":
        media.likes += 1
        Media.objects.filter(friendly_token=friendly_token).update(likes=media.likes)
    elif action == "dislike":
        media.dislikes += 1
        Media.objects.filter(friendly_token=friendly_token).update(dislikes=media.dislikes)

    return True


@task(name="get_list_of_popular_media", queue="long_tasks")
def get_list_of_popular_media():
    """Experimental task for preparing media listing
    for index page / recommended section
    calculate and return the top 50 popular media, based on two rules
    X = the top 25 videos that have the most views during the last week
    Y = the most recent 25 videos that have been liked over the last 6 months
    """

    valid_media_x = {}
    valid_media_y = {}
    basic_query = Q(listable=True)
    media_x = Media.objects.filter(basic_query).values("friendly_token")

    period_x = datetime.now() - timedelta(days=7)
    period_y = datetime.now() - timedelta(days=30 * 6)

    for media in media_x:
        ft = media["friendly_token"]
        num = MediaAction.objects.filter(action_date__gte=period_x, action="watch", media__friendly_token=ft).count()
        if num:
            valid_media_x[ft] = num
        num = MediaAction.objects.filter(action_date__gte=period_y, action="like", media__friendly_token=ft).count()
        if num:
            valid_media_y[ft] = num

    x = sorted(valid_media_x.items(), key=lambda kv: kv[1], reverse=True)[:25]
    y = sorted(valid_media_y.items(), key=lambda kv: kv[1], reverse=True)[:25]

    media_ids = [a[0] for a in x]
    media_ids.extend([a[0] for a in y])
    media_ids = list(set(media_ids))
    cache.set("popular_media_ids", media_ids, 60 * 60 * 12)
    logger.info("saved popular media ids")

    return True


@task(name="update_listings_thumbnails", queue="long_tasks")
def update_listings_thumbnails():
    """Populate listings_thumbnail field for models"""

    # Categories
    used_media = []
    saved = 0
    qs = Category.objects.filter()
    for object in qs:
        media = Media.objects.exclude(friendly_token__in=used_media).filter(category=object, state="public", is_reviewed=True).order_by("-views").first()
        if media:
            object.listings_thumbnail = media.thumbnail_url
            object.save(update_fields=["listings_thumbnail"])
            used_media.append(media.friendly_token)
            saved += 1
    logger.info(f"updated {saved} categories")

    # Tags
    used_media = []
    saved = 0
    qs = Tag.objects.filter()
    for object in qs:
        media = Media.objects.exclude(friendly_token__in=used_media).filter(tags=object, state="public", is_reviewed=True).order_by("-views").first()
        if media:
            object.listings_thumbnail = media.thumbnail_url
            object.save(update_fields=["listings_thumbnail"])
            used_media.append(media.friendly_token)
            saved += 1
    logger.info(f"updated {saved} tags")

    return True


@task_revoked.connect
def task_sent_handler(sender=None, headers=None, body=None, **kwargs):
    # For encode_media tasks that are revoked,
    # ffmpeg command won't be stopped, since
    # it got started by a subprocess.
    # Need to stop that process
    # Also, removing the Encoding object,
    # since the task that would prepare it was killed
    # Maybe add a killed state for Encoding objects
    try:
        uid = kwargs["request"].task_id
        if uid:
            encoding = Encoding.objects.get(task_id=uid)
            encoding.delete()
            logger.info("deleted the Encoding object")
            if encoding.temp_file:
                kill_ffmpeg_process(encoding.temp_file)

    except BaseException:
        pass

    return True


@task(name="remove_media_file", base=Task, queue="long_tasks")
def remove_media_file(media_file=None):
    rm_file(media_file)
    return True


@task(name="update_encoding_size", queue="short_tasks")
def update_encoding_size(encoding_id):
    """Update the size of an encoding without saving to avoid calling signals"""
    encoding = Encoding.objects.filter(id=encoding_id).first()
    if encoding:
        encoding.update_size_without_save()
        return True
    return False


@task(name="post_trim_action", queue="short_tasks", soft_time_limit=600)
def post_trim_action(friendly_token):
    """Perform post-processing actions after video trimming

    Args:
        friendly_token: The friendly token of the media

    Returns:
        bool: True if successful, False otherwise
    """
    logger.info(f"Post trim action for {friendly_token}")
    try:
        media = Media.objects.get(friendly_token=friendly_token)
    except Media.DoesNotExist:
        logger.info(f"Media with friendly token {friendly_token} not found")
        return False

    media.set_media_type()
    encodings = media.encodings.filter(status="success", profile__extension='mp4', chunk=False)
    # if they are still not encoded, when the first one will be encoded, it will have the chance to
    # call post_trim_action again
    if encodings:
        for encoding in encodings:
            # update encoding size, in case they don't have one, due to the
            # way the copy_video took place
            update_encoding_size(encoding.id)

        media.produce_thumbnails_from_video()
        produce_sprite_from_video.delay(friendly_token)
        create_hls.delay(friendly_token)

    vt_request = VideoTrimRequest.objects.filter(media=media, status="running").first()
    if vt_request:
        vt_request.status = "success"
        vt_request.save(update_fields=["status"])

    return True


@task(name="video_trim_task", bind=True, queue="short_tasks", soft_time_limit=600)
def video_trim_task(self, trim_request_id):
    # SOS: if at some point we move from ffmpeg copy, then this need be changed
    # to long_tasks
    try:
        trim_request = VideoTrimRequest.objects.get(id=trim_request_id)
    except VideoTrimRequest.DoesNotExist:
        logger.info(f"VideoTrimRequest with ID {trim_request_id} not found")
        return False

    trim_request.status = "running"
    trim_request.save(update_fields=["status"])

    timestamps_encodings = get_trim_timestamps(trim_request.media.trim_video_path, trim_request.timestamps)
    timestamps_original = get_trim_timestamps(trim_request.media.media_file.path, trim_request.timestamps)
    if not timestamps_encodings:
        trim_request.status = "fail"
        trim_request.save(update_fields=["status"])
        return False

    target_media = trim_request.media
    original_media = trim_request.media

    # splitting the logic for single file and multiple files
    if trim_request.video_action in ["save_new", "replace"]:
        proceed_with_single_file = True
    if trim_request.video_action == "create_segments":
        if len(timestamps_encodings) == 1:
            proceed_with_single_file = True
        else:
            proceed_with_single_file = False

    if proceed_with_single_file:
        if trim_request.video_action == "save_new" or trim_request.video_action == "create_segments" and len(timestamps_encodings) == 1:
            new_media = copy_video(original_media, copy_encodings=True)

            target_media = new_media
            trim_request.media = new_media
            trim_request.save(update_fields=["media"])

        # processing timestamps differently on encodings and original file, in case we do accuracy trimming (currently not)
        # these have different I-frames and the cut is made based on the I-frames

        original_trim_result = trim_video_method(target_media.media_file.path, timestamps_original)
        if not original_trim_result:
            logger.info(f"Failed to trim original file for media {target_media.friendly_token}")

        deleted_encodings = handle_pending_running_encodings(target_media)
        # the following could be un-necessary, read commend in pre_trim_video_actions to see why
        encodings = target_media.encodings.filter(status="success", profile__extension='mp4', chunk=False)
        for encoding in encodings:
            trim_result = trim_video_method(encoding.media_file.path, timestamps_encodings)
            if not trim_result:
                logger.info(f"Failed to trim encoding {encoding.id} for media {target_media.friendly_token}")
                encoding.delete()

        pre_trim_video_actions(target_media)
        post_trim_action.delay(target_media.friendly_token)

    else:
        for i, timestamp in enumerate(timestamps_encodings, start=1):
            # copy the original file for each of the segments. This could be optimized to avoid the overhead but
            # for now is necessary because the ffmpeg trim command will be run towards the original
            # file on different times.
            target_media = copy_video(original_media, title_suffix=f"(Trimmed) {i}", copy_encodings=True)

            video_trim_request = VideoTrimRequest.objects.create(media=target_media, status="running", video_action="create_segments", media_trim_style='no_encoding', timestamps=[timestamp])  # noqa

            original_trim_result = trim_video_method(target_media.media_file.path, [timestamp])
            deleted_encodings = handle_pending_running_encodings(target_media)  # noqa
            # the following could be un-necessary, read commend in pre_trim_video_actions to see why
            encodings = target_media.encodings.filter(status="success", profile__extension='mp4', chunk=False)
            for encoding in encodings:
                trim_result = trim_video_method(encoding.media_file.path, [timestamp])
                if not trim_result:
                    logger.info(f"Failed to trim encoding {encoding.id} for media {target_media.friendly_token}")
                    encoding.delete()

            pre_trim_video_actions(target_media)
            post_trim_action.delay(target_media.friendly_token)

        # set as completed the initial trim_request
        trim_request.status = "success"
        trim_request.save(update_fields=["status"])

    return True


# TODO LIST
# 1 chunks are deleted from original server when file is fully encoded.
# however need to enter this logic in cases of fail as well
# 2 script to delete chunks in fail status
# (and check for their encdings, and delete them as well, along with
# all chunks)
# 3 beat task, remove chunks
