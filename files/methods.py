# Kudos to Werner Robitza, AVEQ GmbH, for helping with ffmpeg
# related content

import itertools
import logging
import random
import re
from datetime import datetime

from django.conf import settings
from django.core.cache import cache
from django.core.mail import EmailMessage
from django.db.models import Q

from cms import celery_app

from . import models
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
            title = "[{}] - Media was reported".format(settings.PORTAL_NAME)
            d = {}
            d["title"] = title
            d["msg"] = msg
            d["to"] = settings.ADMIN_EMAIL_LIST
            notify_items.append(d)
        if settings.USERS_NOTIFICATIONS.get("MEDIA_REPORTED", False):
            title = "[{}] - Media was reported".format(settings.PORTAL_NAME)
            d = {}
            d["title"] = title
            d["msg"] = msg
            d["to"] = [media.user.email]
            notify_items.append(d)

    if action == "media_added" and media:
        if settings.ADMINS_NOTIFICATIONS.get("MEDIA_ADDED", False):
            title = "[{}] - Media was added".format(settings.PORTAL_NAME)
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
            title = "[{}] - Your media was added".format(settings.PORTAL_NAME)
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
    # TODO: MAke this mess more readable, and add TAGS support - aka related
    # tags rather than random media
    if len(m) < limit:
        category = media.category.first()
        if category:
            q_category = Q(listable=True, category=category)
            q_res = models.Media.objects.filter(q_category).order_by(order_criteria[random.randint(0, len(order_criteria) - 1)]).prefetch_related("user")[: limit - media.user.media_count]
            m = list(itertools.chain(m, q_res))

        if len(m) < limit:
            q_generic = Q(listable=True)
            q_res = models.Media.objects.filter(q_generic).order_by(order_criteria[random.randint(0, len(order_criteria) - 1)]).prefetch_related("user")[: limit - media.user.media_count]
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
        title = "[{}] - A comment was added".format(settings.PORTAL_NAME)
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
        title = "[{}] - You were mentioned in a comment".format(settings.PORTAL_NAME)
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
