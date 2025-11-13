# Kudos to Werner Robitza, AVEQ GmbH, for helping with ffmpeg
# related content

import itertools
import logging
import os
import random
import re
import subprocess
from datetime import datetime

from django.conf import settings
from django.core.cache import cache
from django.core.files import File
from django.core.mail import EmailMessage
from django.db.models import Q
from django.utils import timezone

from cms import celery_app

from . import helpers, models
from .helpers import mask_ip

logger = logging.getLogger(__name__)


def get_user_or_session(request):
    """Return a dictionary with user info
    whether user is authenticated or not
    this is used in action calculations, example for
    increasing the watch counter of a media
    """

    ret = {}
    if request.user.is_authenticated:
        ret["user_id"] = request.user.id
    else:
        if not request.session.session_key:
            request.session.save()
        ret["user_session"] = request.session.session_key
    if settings.MASK_IPS_FOR_ACTIONS:
        ret["remote_ip_addr"] = mask_ip(request.META.get("REMOTE_ADDR"))
    else:
        ret["remote_ip_addr"] = request.META.get("REMOTE_ADDR")
    return ret


def pre_save_action(media, user, session_key, action, remote_ip):
    """This will perform some checkes
    example threshold checks, before performing an action
    """

    from actions.models import MediaAction

    if user:
        query = MediaAction.objects.filter(media=media, action=action, user=user)
    else:
        query = MediaAction.objects.filter(media=media, action=action, session_key=session_key)
    query = query.order_by("-action_date")

    if query:
        query = query.first()
        if action in ["like", "dislike", "report"]:
            return False  # has alread done action once
        elif action == "watch" and user:
            # increase the number of times a media is viewed
            if media.duration:
                now = datetime.now(query.action_date.tzinfo)
                if (now - query.action_date).seconds > media.duration:
                    return True
    else:
        if user:  # first time action
            return True

    if not user:
        # perform some checking for requests where no session
        # id is specified (and user is anonymous) to avoid spam
        # eg allow for the same remote_ip for a specific number of actions
        query = MediaAction.objects.filter(media=media, action=action, remote_ip=remote_ip).filter(user=None).order_by("-action_date")
        if query:
            query = query.first()
            now = datetime.now(query.action_date.tzinfo)
            if action == "watch":
                if not (now - query.action_date).seconds > media.duration:
                    return False
            if (now - query.action_date).seconds > settings.TIME_TO_ACTION_ANONYMOUS:
                return True
        else:
            return True

    return False


def is_mediacms_editor(user):
    """Whether user is MediaCMS editor"""

    editor = False
    try:
        if user.is_superuser or user.is_manager or user.is_editor:
            editor = True
    except BaseException:
        pass
    return editor


def is_mediacms_manager(user):
    """Whether user is MediaCMS manager"""

    manager = False
    try:
        if user.is_superuser or user.is_manager:
            manager = True
    except BaseException:
        pass
    return manager


def get_next_state(user, current_state, next_state):
    """Return valid state, given a current and next state
    and the user object.
    Users may themselves perform only allowed transitions
    """

    if next_state not in ["public", "private", "unlisted"]:
        next_state = settings.PORTAL_WORKFLOW  # get default state

    if is_mediacms_editor(user):
        # allow any transition
        return next_state

    if settings.PORTAL_WORKFLOW == "private":
        if next_state in ["private", "unlisted"]:
            next_state = next_state
        else:
            next_state = current_state

    if settings.PORTAL_WORKFLOW == "unlisted":
        # don't allow to make media public in this case
        if next_state == "public":
            next_state = current_state

    return next_state


def notify_users(friendly_token=None, action=None, extra=None):
    """Notify users through email, for a set of actions"""

    notify_items = []
    media = None
    if friendly_token:
        media = models.Media.objects.filter(friendly_token=friendly_token).first()
        if not media:
            return False
        media_url = settings.SSL_FRONTEND_HOST + media.get_absolute_url()

    if action == "media_reported" and media:
        msg = """
Media %s was reported.
Reason: %s\n
Total times this media has been reported: %s\n
Media becomes private if it gets reported %s times\n
        """ % (
            media_url,
            extra,
            media.reported_times,
            settings.REPORTED_TIMES_THRESHOLD,
        )

        if settings.ADMINS_NOTIFICATIONS.get("MEDIA_REPORTED", False):
            title = f"[{settings.PORTAL_NAME}] - Media was reported"
            d = {}
            d["title"] = title
            d["msg"] = msg
            d["to"] = settings.ADMIN_EMAIL_LIST
            notify_items.append(d)
        if settings.USERS_NOTIFICATIONS.get("MEDIA_REPORTED", False):
            title = f"[{settings.PORTAL_NAME}] - Media was reported"
            d = {}
            d["title"] = title
            d["msg"] = msg
            d["to"] = [media.user.email]
            notify_items.append(d)

    if action == "media_added" and media:
        if settings.ADMINS_NOTIFICATIONS.get("MEDIA_ADDED", False):
            title = f"[{settings.PORTAL_NAME}] - Media was added"
            msg = """
Media %s was added by user %s.
""" % (
                media_url,
                media.user,
            )
            d = {}
            d["title"] = title
            d["msg"] = msg
            d["to"] = settings.ADMIN_EMAIL_LIST
            notify_items.append(d)
        if settings.USERS_NOTIFICATIONS.get("MEDIA_ADDED", False):
            title = f"[{settings.PORTAL_NAME}] - Your media was added"
            msg = """
Your media has been added! It will be encoded and will be available soon.
URL: %s
            """ % (
                media_url
            )
            d = {}
            d["title"] = title
            d["msg"] = msg
            d["to"] = [media.user.email]
            notify_items.append(d)

    for item in notify_items:
        email = EmailMessage(item["title"], item["msg"], settings.DEFAULT_FROM_EMAIL, item["to"])
        email.send(fail_silently=True)
    return True


def show_recommended_media(request, limit=100):
    """Return a list of recommended media
    used on the index page
    """

    basic_query = Q(listable=True)
    pmi = cache.get("popular_media_ids")
    # produced by task get_list_of_popular_media and cached
    if pmi:
        media = list(models.Media.objects.filter(friendly_token__in=pmi).filter(basic_query).prefetch_related("user")[:limit])
    else:
        media = list(models.Media.objects.filter(basic_query).order_by("-views", "-likes").prefetch_related("user")[:limit])
    random.shuffle(media)
    return media


def show_related_media(media, request=None, limit=100):
    """Return a list of related media"""

    if settings.RELATED_MEDIA_STRATEGY == "calculated":
        return show_related_media_calculated(media, request, limit)
    elif settings.RELATED_MEDIA_STRATEGY == "author":
        return show_related_media_author(media, request, limit)

    return show_related_media_content(media, request, limit)


def show_related_media_content(media, request, limit):
    """Return a list of related media based on simple calculations"""

    # Create list with author items
    # then items on same category, then some random(latest)
    # Aim is to always show enough (limit) videos
    # and include author videos in any case

    q_author = Q(listable=True, user=media.user)
    m = list(models.Media.objects.filter(q_author).order_by().prefetch_related("user")[:limit])

    # order by random criteria so that it doesn't bring the same results
    # attention: only fields that are indexed make sense here! also need
    # find a way for indexes with more than 1 field
    order_criteria = [
        "-views",
        "views",
        "add_date",
        "-add_date",
        "featured",
        "-featured",
        "user_featured",
        "-user_featured",
    ]
    # TODO: Make this mess more readable, and add TAGS support - aka related
    # tags rather than random media
    if len(m) < limit:
        category = media.category.first()
        if category:
            q_category = Q(listable=True, category=category)
            # Fix: Ensure slice index is never negative
            remaining = max(0, limit - len(m))
            q_res = models.Media.objects.filter(q_category).order_by(order_criteria[random.randint(0, len(order_criteria) - 1)]).prefetch_related("user")[:remaining]
            m = list(itertools.chain(m, q_res))

        if len(m) < limit:
            q_generic = Q(listable=True)
            # Fix: Ensure slice index is never negative
            remaining = max(0, limit - len(m))
            q_res = models.Media.objects.filter(q_generic).order_by(order_criteria[random.randint(0, len(order_criteria) - 1)]).prefetch_related("user")[:remaining]
            m = list(itertools.chain(m, q_res))

    m = list(set(m[:limit]))  # remove duplicates

    try:
        m.remove(media)  # remove media from results
    except ValueError:
        pass

    random.shuffle(m)
    return m


def show_related_media_author(media, request, limit):
    """Return a list of related media form the same author"""

    q_author = Q(listable=True, user=media.user)
    m = list(models.Media.objects.filter(q_author).order_by().prefetch_related("user")[:limit])

    # order by random criteria so that it doesn't bring the same results
    # attention: only fields that are indexed make sense here! also need
    # find a way for indexes with more than 1 field

    m = list(set(m[:limit]))  # remove duplicates

    try:
        m.remove(media)  # remove media from results
    except ValueError:
        pass

    random.shuffle(m)
    return m


def show_related_media_calculated(media, request, limit):
    """Return a list of related media based on ML recommendations
    A big todo!
    """

    return []


def update_user_ratings(user, media, user_ratings):
    """Populate user ratings for a media"""

    for rating in user_ratings:
        user_rating = models.Rating.objects.filter(user=user, media_id=media, rating_category_id=rating.get("category_id")).only("score").first()
        if user_rating:
            rating["score"] = user_rating.score
    return user_ratings


def notify_user_on_comment(friendly_token):
    """Notify users through email, for a set of actions"""
    media = models.Media.objects.filter(friendly_token=friendly_token).first()
    if not media:
        return False

    user = media.user
    media_url = settings.SSL_FRONTEND_HOST + media.get_absolute_url()

    if user.notification_on_comments:
        title = f"[{settings.PORTAL_NAME}] - A comment was added"
        msg = """
A comment has been added to your media %s .
View it on %s
        """ % (
            media.title,
            media_url,
        )
        email = EmailMessage(title, msg, settings.DEFAULT_FROM_EMAIL, [media.user.email])
        email.send(fail_silently=True)
    return True


def notify_user_on_mention(friendly_token, user_mentioned, cleaned_comment):
    from users.models import User

    media = models.Media.objects.filter(friendly_token=friendly_token).first()
    if not media:
        return False

    user = User.objects.filter(username=user_mentioned).first()
    media_url = settings.SSL_FRONTEND_HOST + media.get_absolute_url()

    if user.notification_on_comments:
        title = f"[{settings.PORTAL_NAME}] - You were mentioned in a comment"
        msg = """
You were mentioned in a comment on  %s .
View it on %s

Comment : %s
        """ % (
            media.title,
            media_url,
            cleaned_comment,
        )
        email = EmailMessage(title, msg, settings.DEFAULT_FROM_EMAIL, [user.email])
        email.send(fail_silently=True)
    return True


def check_comment_for_mention(friendly_token, comment_text):
    """Check the comment for any mentions, and notify each mentioned users"""
    cleaned_comment = ''

    matches = re.findall('@\\(_(.+?)_\\)', comment_text)
    if matches:
        cleaned_comment = clean_comment(comment_text)

    for match in list(dict.fromkeys(matches)):
        notify_user_on_mention(friendly_token, match, cleaned_comment)


def clean_comment(raw_comment):
    """Clean the comment fromn ID and username Mentions for preview purposes"""

    cleaned_comment = re.sub('@\\(_(.+?)_\\)', '', raw_comment)
    cleaned_comment = cleaned_comment.replace("[_", '')
    cleaned_comment = cleaned_comment.replace("_]", '')

    return cleaned_comment


def user_allowed_to_upload(request):
    """Any custom logic for whether a user is allowed
    to upload content lives here
    """

    if request.user.is_anonymous:
        return False
    if is_mediacms_editor(request.user):
        return True

    # Check if user has reached the maximum number of uploads
    if hasattr(settings, 'NUMBER_OF_MEDIA_USER_CAN_UPLOAD'):
        if models.Media.objects.filter(user=request.user).count() >= settings.NUMBER_OF_MEDIA_USER_CAN_UPLOAD:
            return False

    if settings.CAN_ADD_MEDIA == "all":
        return True
    elif settings.CAN_ADD_MEDIA == "email_verified":
        if request.user.email_is_verified:
            return True
    elif settings.CAN_ADD_MEDIA == "advancedUser":
        if request.user.advancedUser:
            return True
    return False


def can_transcribe_video(user):
    """Checks if a user can transcribe a video."""
    if not getattr(settings, 'USE_WHISPER_TRANSCRIBE', False):
        return False

    if is_mediacms_editor(user):
        return True
    if getattr(settings, 'USER_CAN_TRANSCRIBE_VIDEO', False):
        return True
    return False


def kill_ffmpeg_process(filepath):
    """Kill ffmpeg process that is processing a specific file

    Args:
        filepath: Path to the file being processed by ffmpeg

    Returns:
        subprocess.CompletedProcess: Result of the kill command
    """
    if not filepath:
        return False
    cmd = "ps aux|grep 'ffmpeg'|grep %s|grep -v grep |awk '{print $2}'" % filepath
    result = subprocess.run(cmd, stdout=subprocess.PIPE, shell=True)
    pid = result.stdout.decode("utf-8").strip()
    if pid:
        cmd = "kill -9 %s" % pid
        result = subprocess.run(cmd, stdout=subprocess.PIPE, shell=True)
    return result


def copy_video(original_media, copy_encodings=True, title_suffix="(Trimmed)"):
    """Create a copy of a media object

    Args:
        original_media: Original Media object to copy
        copy_encodings: Whether to copy the encodings too

    Returns:
        New Media object
    """

    while True:
        friendly_token = helpers.produce_friendly_token()
        if not models.Media.objects.filter(friendly_token=friendly_token).exists():
            break

    with open(original_media.media_file.path, "rb") as f:
        myfile = File(f)
        new_media = models.Media(
            media_file=myfile,
            friendly_token=friendly_token,
            title=f"{original_media.title} {title_suffix}",
            description=original_media.description,
            user=original_media.user,
            media_type=original_media.media_type,
            enable_comments=original_media.enable_comments,
            allow_download=original_media.allow_download,
            state=helpers.get_default_state(user=original_media.user),
            is_reviewed=original_media.is_reviewed,
            encoding_status=original_media.encoding_status,
            add_date=timezone.now(),
            video_height=original_media.video_height,
            size=original_media.size,
            duration=original_media.duration,
            media_info=original_media.media_info,
        )
        models.Media.objects.bulk_create([new_media])
        # avoids calling signals since signals will call media_init and we don't want that

    if copy_encodings:
        for encoding in original_media.encodings.filter(chunk=False, status="success"):
            if encoding.media_file:
                with open(encoding.media_file.path, "rb") as f:
                    myfile = File(f)
                    new_encoding = models.Encoding(
                        media_file=myfile, media=new_media, profile=encoding.profile, size=encoding.size, status="success", progress=100, chunk=False, logs=f"Copied from encoding {encoding.id}"
                    )
                    models.Encoding.objects.bulk_create([new_encoding])
                    # avoids calling signals as this is still not ready

    # Copy categories and tags
    for category in original_media.category.all():
        new_media.category.add(category)

    for tag in original_media.tags.all():
        new_media.tags.add(tag)

    if original_media.thumbnail:
        with open(original_media.thumbnail.path, 'rb') as f:
            thumbnail_name = helpers.get_file_name(original_media.thumbnail.path)
            new_media.thumbnail.save(thumbnail_name, File(f))

    if original_media.poster:
        with open(original_media.poster.path, 'rb') as f:
            poster_name = helpers.get_file_name(original_media.poster.path)
            new_media.poster.save(poster_name, File(f))

    if original_media.uploaded_thumbnail:
        with open(original_media.uploaded_thumbnail.path, 'rb') as f:
            thumbnail_name = helpers.get_file_name(original_media.uploaded_thumbnail.path)
            new_media.uploaded_thumbnail.save(thumbnail_name, File(f))

    if original_media.uploaded_poster:
        with open(original_media.uploaded_poster.path, 'rb') as f:
            poster_name = helpers.get_file_name(original_media.uploaded_poster.path)
            new_media.uploaded_poster.save(poster_name, File(f))

    if original_media.sprites:
        with open(original_media.sprites.path, 'rb') as f:
            sprites_name = helpers.get_file_name(original_media.sprites.path)
            new_media.sprites.save(sprites_name, File(f))

    if original_media.hls_file and os.path.exists(original_media.hls_file):
        p = os.path.dirname(original_media.hls_file)
        if os.path.exists(p):
            new_hls_file = original_media.hls_file.replace(original_media.uid.hex, new_media.uid.hex)
            models.Media.objects.filter(id=new_media.id).update(hls_file=new_hls_file)
            new_p = p.replace(original_media.uid.hex, new_media.uid.hex)

            if not os.path.exists(new_p):
                os.makedirs(new_p, exist_ok=True)
            cmd = f"cp -r {p}/* {new_p}/"
            subprocess.run(cmd, stdout=subprocess.PIPE, shell=True)

    return new_media


def create_video_trim_request(media, data):
    """Create a video trim request for a media

    Args:
        media: Media object
        data: Dictionary with trim request data

    Returns:
        VideoTrimRequest object
    """

    video_action = "replace"
    if data.get('saveIndividualSegments'):
        video_action = "create_segments"
    elif data.get('saveAsCopy'):
        video_action = "save_new"

    video_trim_request = models.VideoTrimRequest.objects.create(media=media, status="initial", video_action=video_action, media_trim_style='no_encoding', timestamps=data.get('segments', {}))

    return video_trim_request


def list_tasks():
    """Lists celery tasks
    To be used in an admin dashboard
    """

    i = celery_app.control.inspect([])
    ret = {}
    temp = {}
    task_ids = []
    media_profile_pairs = []

    temp["active"] = i.active()
    temp["reserved"] = i.reserved()
    temp["scheduled"] = i.scheduled()

    for state, state_dict in temp.items():
        ret[state] = {}
        ret[state]["tasks"] = []
        for worker, worker_dict in state_dict.items():
            for task in worker_dict:
                task_dict = {}
                task_dict["worker"] = worker
                task_dict["task_id"] = task.get("id")
                task_ids.append(task.get("id"))
                task_dict["args"] = task.get("args")
                task_dict["name"] = task.get("name")
                task_dict["time_start"] = task.get("time_start")
                if task.get("name") == "encode_media":
                    task_args = task.get("args")
                    for bad in "(),'":
                        task_args = task_args.replace(bad, "")
                    friendly_token = task_args.split()[0]
                    profile_id = task_args.split()[1]

                    media = models.Media.objects.filter(friendly_token=friendly_token).first()
                    if media:
                        profile = models.EncodeProfile.objects.filter(id=profile_id).first()
                        if profile:
                            media_profile_pairs.append((media.friendly_token, profile.id))
                            task_dict["info"] = {}
                            task_dict["info"]["profile name"] = profile.name
                            task_dict["info"]["media title"] = media.title
                            encoding = models.Encoding.objects.filter(task_id=task.get("id")).first()
                            if encoding:
                                task_dict["info"]["encoding progress"] = encoding.progress

                ret[state]["tasks"].append(task_dict)
    ret["task_ids"] = task_ids
    ret["media_profile_pairs"] = media_profile_pairs
    return ret


def handle_video_chapters(media, chapters):
    video_chapter = models.VideoChapterData.objects.filter(media=media).first()
    if video_chapter:
        video_chapter.data = chapters
        video_chapter.save()
    else:
        video_chapter = models.VideoChapterData.objects.create(media=media, data=chapters)

    return {'chapters': media.chapter_data}


def change_media_owner(media_id, new_user):
    """Change the owner of a media

    Args:
        media_id: ID of the media to change owner
        new_user: New user object to set as owner

    Returns:
        Media object or None if media not found
    """
    media = models.Media.objects.filter(id=media_id).first()
    if not media:
        return None

    # Change the owner
    # previous_user = media.user
    # keep original user as owner by adding a models.MediaPermission entry with permission=owner
    # if not models.MediaPermission.objects.filter(media=media, user=previous_user, permission="owner").exists():
    #    models.MediaPermission.objects.create(media=media, user=previous_user, owner_user=new_user, permission="owner")

    media.user = new_user
    media.save(update_fields=["user"])

    # Optimize: Update any related permissions in bulk instead of loop
    models.MediaPermission.objects.filter(media=media).update(owner_user=new_user)

    # remove any existing permissions for the new user, since they are now owner
    models.MediaPermission.objects.filter(media=media, user=new_user).delete()

    return media


def copy_media(media):
    """Create a copy of a media

    Args:
        media: Media object to copy

    Returns:
        None
    """
    if media.media_type in ["video", "audio"]:
        new_media = copy_video(media, title_suffix="(Copy)")
    else:
        # check if media.media_file.path exists actually in disk
        if not os.path.exists(media.media_file.path):
            return None

        while True:
            friendly_token = helpers.produce_friendly_token()
            if not models.Media.objects.filter(friendly_token=friendly_token).exists():
                break

        with open(media.media_file.path, "rb") as f:
            myfile = File(f)
            new_media = models.Media.objects.create(
                media_file=myfile,
                friendly_token=friendly_token,
                title=f"{media.title} (Copy)",
                description=media.description,
                user=media.user,
                media_type=media.media_type,
                enable_comments=media.enable_comments,
                allow_download=media.allow_download,
                state=helpers.get_default_state(user=media.user),
                is_reviewed=media.is_reviewed,
                encoding_status=media.encoding_status,
                add_date=timezone.now(),
            )

        # Copy categories and tags
        for category in media.category.all():
            new_media.category.add(category)

        for tag in media.tags.all():
            new_media.tags.add(tag)

        return new_media


def is_media_allowed_type(media):
    if "all" in settings.ALLOWED_MEDIA_UPLOAD_TYPES:
        return True
    return media.media_type in settings.ALLOWED_MEDIA_UPLOAD_TYPES
