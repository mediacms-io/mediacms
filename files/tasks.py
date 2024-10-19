import json
import os
import re
import shutil
import subprocess
import tempfile
from datetime import datetime, timedelta

from celery import Task
from celery import shared_task as task
from celery.exceptions import SoftTimeLimitExceeded
from celery.signals import task_revoked

# from celery.task.control import revoke
from celery.utils.log import get_task_logger
from django.conf import settings
from django.core.cache import cache
from django.core.files import File
from django.db.models import Q

from actions.models import USER_MEDIA_ACTIONS, MediaAction
from users.models import User

from .backends import FFmpegBackend
from .exceptions import VideoEncodingError
from .helpers import calculate_seconds, create_temp_file, get_file_name, get_file_type, media_file_info, produce_ffmpeg_commands, produce_friendly_token, rm_file, run_command
from .methods import list_tasks, notify_users, pre_save_action
from .models import Category, EncodeProfile, Encoding, Media, Rating, Tag

logger = get_task_logger(__name__)

VALID_USER_ACTIONS = [action for action, name in USER_MEDIA_ACTIONS]

ERRORS_LIST = [
    "Output file is empty, nothing was encoded",
    "Invalid data found when processing input",
    "Unable to find a suitable output format for",
]


@task(name="chunkize_media", bind=True, queue="short_tasks", soft_time_limit=60 * 30)
def chunkize_media(self, friendly_token, profiles, force=True):
    """Break media in chunks and start encoding tasks"""

    profiles = [EncodeProfile.objects.get(id=profile) for profile in profiles]
    media = Media.objects.get(friendly_token=friendly_token)
    cwd = os.path.dirname(os.path.realpath(media.media_file.path))
    file_name = media.media_file.path.split("/")[-1]
    random_prefix = produce_friendly_token()
    file_format = "{0}_{1}".format(random_prefix, file_name)
    chunks_file_name = "%02d_{0}".format(file_format)
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
        logger.info("Failed to break file {0} in chunks." " Putting to normal encode queue".format(friendly_token))
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

    logger.info("got {0} chunks and will encode to {1} profiles".format(len(chunks), to_profiles))
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

    logger.info("Encode Media started, friendly token {0}, profile id {1}, force {2}".format(friendly_token, profile_id, force))

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
        tf = create_temp_file(suffix=".{0}".format(profile.extension), dir=temp_dir)
        tfpass = create_temp_file(suffix=".{0}".format(profile.extension), dir=temp_dir)
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
                                try:
                                    encoding.save(update_fields=["progress", "update_date"])
                                    logger.info("Saved {0}".format(round(percent, 2)))
                                except BaseException:
                                    pass
                            n_times += 1
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
                if isinstance(e, SoftTimeLimitExceeded):
                    kill_ffmpeg_process(encoding.temp_file)
                encoding.logs = output
                encoding.status = "fail"
                encoding.save(update_fields=["status", "logs"])
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
                    output_name = "{0}.{1}".format(get_file_name(original_media_path), profile.extension)
                    encoding.media_file.save(content=myfile, name=output_name)
                encoding.total_run_time = (encoding.update_date - encoding.add_date).seconds

        try:
            encoding.save(update_fields=["status", "logs", "progress", "total_run_time"])
        # this will raise a django.db.utils.DatabaseError error when task is revoked,
        # since we delete the encoding at that stage
        except BaseException:
            pass

        return success


@task(name="produce_sprite_from_video", queue="long_tasks")
def produce_sprite_from_video(friendly_token):
    """Produces a sprites file for a video, uses ffmpeg"""

    try:
        media = Media.objects.get(friendly_token=friendly_token)
    except BaseException:
        logger.info("failed to get media with friendly_token %s" % friendly_token)
        return False

    with tempfile.TemporaryDirectory(dir=settings.TEMP_DIRECTORY) as tmpdirname:
        try:
            tmpdir_image_files = tmpdirname + "/img%03d.jpg"
            output_name = tmpdirname + "/sprites.jpg"

            fps = getattr(settings, 'SPRITE_NUM_SECS', 10)
            ffmpeg_cmd = [
                settings.FFMPEG_COMMAND,
                "-i", media.media_file.path,
                "-f", "image2",
                "-vf", f"fps=1/{fps}, scale=160:90",
                tmpdir_image_files
            ]
            run_command(ffmpeg_cmd)
            image_files = [f for f in os.listdir(tmpdirname) if f.startswith("img") and f.endswith(".jpg")]
            image_files = sorted(image_files, key=lambda x: int(re.search(r'\d+', x).group()))
            image_files = [os.path.join(tmpdirname, f) for f in image_files]
            cmd_convert = [
                "convert",
                *image_files,  # image files, unpacked into the list
                "-append",
                output_name
            ]

            run_command(cmd_convert)

            if os.path.exists(output_name) and get_file_type(output_name) == "image":
                with open(output_name, "rb") as f:
                    myfile = File(f)
                    media.sprites.save(
                        content=myfile,
                        name=get_file_name(media.media_file.path) + "sprites.jpg",
                    )
        except BaseException:
            pass
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
        logger.info("failed to get media with friendly_token %s" % friendly_token)
        return False

    p = media.uid.hex
    output_dir = os.path.join(settings.HLS_DIR, p)
    encodings = media.encodings.filter(profile__extension="mp4", status="success", chunk=False, profile__codec="h264")
    if encodings:
        existing_output_dir = None
        if os.path.exists(output_dir):
            existing_output_dir = output_dir
            output_dir = os.path.join(settings.HLS_DIR, p + produce_friendly_token())
        files = " ".join([f.media_file.path for f in encodings if f.media_file])
        cmd = [
            settings.MP4HLS_COMMAND,
            '--segment-duration=4',
            f'--output-dir={output_dir}',
            files
        ]
        run_command(cmd)

        if existing_output_dir:
            # override content with -T !
            cmd = "cp -rT {0} {1}".format(output_dir, existing_output_dir)
            run_command(cmd)

            shutil.rmtree(output_dir)
            output_dir = existing_output_dir
        pp = os.path.join(output_dir, "master.m3u8")
        if os.path.exists(pp):
            if media.hls_file != pp:
                media.hls_file = pp
                media.save(update_fields=["hls_file"])
    return True


@task(name="check_running_states", queue="short_tasks")
def check_running_states():
    # Experimental - unused
    """Check stale running encodings and delete/reencode media"""

    encodings = Encoding.objects.filter(status="running")

    logger.info("got {0} encodings that are in state running".format(encodings.count()))
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
        logger.info("changed from running to pending on {0} items".format(changed))
    return True


@task(name="check_media_states", queue="short_tasks")
def check_media_states():
    # Experimental - unused
    # check encoding status of not success media
    media = Media.objects.filter(Q(encoding_status="running") | Q(encoding_status="fail") | Q(encoding_status="pending"))

    logger.info("got {0} media that are not in state success".format(media.count()))

    changed = 0
    for m in media:
        m.set_encoding_status()
        m.save(update_fields=["encoding_status"])
        changed += 1
    if changed:
        logger.info("changed encoding status to {0} media items".format(changed))
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
        logger.info("set to the encode queue {0} encodings that were on pending state".format(changed))
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
        logger.info("set to the encode queue {0} profiles".format(changed))
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
    qs = Category.objects.filter().order_by("-media_count")
    for object in qs:
        media = Media.objects.exclude(friendly_token__in=used_media).filter(category=object, state="public", is_reviewed=True).order_by("-views").first()
        if media:
            object.listings_thumbnail = media.thumbnail_url
            object.save(update_fields=["listings_thumbnail"])
            used_media.append(media.friendly_token)
            saved += 1
    logger.info("updated {} categories".format(saved))

    # Tags
    used_media = []
    saved = 0
    qs = Tag.objects.filter().order_by("-media_count")
    for object in qs:
        media = Media.objects.exclude(friendly_token__in=used_media).filter(tags=object, state="public", is_reviewed=True).order_by("-views").first()
        if media:
            object.listings_thumbnail = media.thumbnail_url
            object.save(update_fields=["listings_thumbnail"])
            used_media.append(media.friendly_token)
            saved += 1
    logger.info("updated {} tags".format(saved))

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


def kill_ffmpeg_process(filepath):
    # this is not ideal, ffmpeg pid could be linked to the Encoding object
    cmd = "ps aux|grep 'ffmpeg'|grep %s|grep -v grep |awk '{print $2}'" % filepath
    result = subprocess.run(cmd, stdout=subprocess.PIPE, shell=True)
    pid = result.stdout.decode("utf-8").strip()
    if pid:
        cmd = "kill -9 %s" % pid
        result = subprocess.run(cmd, stdout=subprocess.PIPE, shell=True)
    return result


@task(name="remove_media_file", base=Task, queue="long_tasks")
def remove_media_file(media_file=None):
    rm_file(media_file)
    return True


# TODO LIST
# 1 chunks are deleted from original server when file is fully encoded.
# however need to enter this logic in cases of fail as well
# 2 script to delete chunks in fail status
# (and check for their encdings, and delete them as well, along with
# all chunks)
# 3 beat task, remove chunks
