import glob
import json
import logging
import os
import random
import re
import tempfile
import uuid

import m3u8
from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVectorField
from django.core.exceptions import ValidationError
from django.core.files import File
from django.db import connection, models
from django.db.models.signals import m2m_changed, post_delete, post_save, pre_delete
from django.dispatch import receiver
from django.urls import reverse
from django.utils import timezone
from django.utils.html import strip_tags
from imagekit.models import ProcessedImageField
from imagekit.processors import ResizeToFit
from mptt.models import MPTTModel, TreeForeignKey

from . import helpers
from .stop_words import STOP_WORDS

logger = logging.getLogger(__name__)

RE_TIMECODE = re.compile(r"(\d+:\d+:\d+.\d+)")

# this is used by Media and Encoding models
# reflects media encoding status for objects
MEDIA_ENCODING_STATUS = (
    ("pending", "Pending"),
    ("running", "Running"),
    ("fail", "Fail"),
    ("success", "Success"),
)

# the media state of a Media object
# this is set by default according to the portal workflow
MEDIA_STATES = (
    ("private", "Private"),
    ("public", "Public"),
    ("unlisted", "Unlisted"),
)

# each uploaded Media gets a media_type hint
# by helpers.get_file_type

MEDIA_TYPES_SUPPORTED = (
    ("video", "Video"),
    ("image", "Image"),
    ("pdf", "Pdf"),
    ("audio", "Audio"),
)

ENCODE_EXTENSIONS = (
    ("mp4", "mp4"),
    ("webm", "webm"),
    ("gif", "gif"),
)

ENCODE_RESOLUTIONS = (
    (2160, "2160"),
    (1440, "1440"),
    (1080, "1080"),
    (720, "720"),
    (480, "480"),
    (360, "360"),
    (240, "240"),
)

CODECS = (
    ("h265", "h265"),
    ("h264", "h264"),
    ("vp9", "vp9"),
)

ENCODE_EXTENSIONS_KEYS = [extension for extension, name in ENCODE_EXTENSIONS]
ENCODE_RESOLUTIONS_KEYS = [resolution for resolution, name in ENCODE_RESOLUTIONS]


def original_media_file_path(instance, filename):
    """Helper function to place original media file"""
    file_name = "{0}.{1}".format(instance.uid.hex, helpers.get_file_name(filename))
    return settings.MEDIA_UPLOAD_DIR + "user/{0}/{1}".format(instance.user.username, file_name)


def encoding_media_file_path(instance, filename):
    """Helper function to place encoded media file"""

    file_name = "{0}.{1}".format(instance.media.uid.hex, helpers.get_file_name(filename))
    return settings.MEDIA_ENCODING_DIR + "{0}/{1}/{2}".format(instance.profile.id, instance.media.user.username, file_name)


def original_thumbnail_file_path(instance, filename):
    """Helper function to place original media thumbnail file"""

    return settings.THUMBNAIL_UPLOAD_DIR + "user/{0}/{1}".format(instance.user.username, filename)


def subtitles_file_path(instance, filename):
    """Helper function to place subtitle file"""

    return settings.SUBTITLES_UPLOAD_DIR + "user/{0}/{1}".format(instance.media.user.username, filename)


def category_thumb_path(instance, filename):
    """Helper function to place category thumbnail file"""

    file_name = "{0}.{1}".format(instance.uid.hex, helpers.get_file_name(filename))
    return settings.MEDIA_UPLOAD_DIR + "categories/{0}".format(file_name)


class Media(models.Model):
    """The most important model for MediaCMS"""

    add_date = models.DateTimeField("Date produced", blank=True, null=True, db_index=True)

    allow_download = models.BooleanField(default=True, help_text="Whether option to download media is shown")

    category = models.ManyToManyField("Category", blank=True, help_text="Media can be part of one or more categories")

    channel = models.ForeignKey(
        "users.Channel",
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        help_text="Media can exist in one or no Channels",
    )

    description = models.TextField(blank=True)

    dislikes = models.IntegerField(default=0)

    duration = models.IntegerField(default=0)

    edit_date = models.DateTimeField(auto_now=True)

    enable_comments = models.BooleanField(default=True, help_text="Whether comments will be allowed for this media")

    encoding_status = models.CharField(max_length=20, choices=MEDIA_ENCODING_STATUS, default="pending", db_index=True)

    featured = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Whether media is globally featured by a MediaCMS editor",
    )

    friendly_token = models.CharField(blank=True, max_length=12, db_index=True, help_text="Identifier for the Media")

    hls_file = models.CharField(max_length=1000, blank=True, help_text="Path to HLS file for videos")

    is_reviewed = models.BooleanField(
        default=settings.MEDIA_IS_REVIEWED,
        db_index=True,
        help_text="Whether media is reviewed, so it can appear on public listings",
    )

    license = models.ForeignKey("License", on_delete=models.CASCADE, db_index=True, blank=True, null=True)

    likes = models.IntegerField(db_index=True, default=1)

    listable = models.BooleanField(default=False, help_text="Whether it will appear on listings")

    md5sum = models.CharField(max_length=50, blank=True, null=True, help_text="Not exposed, used internally")

    media_file = models.FileField(
        "media file",
        upload_to=original_media_file_path,
        max_length=500,
        help_text="media file",
    )

    media_info = models.TextField(blank=True, help_text="extracted media metadata info")

    media_type = models.CharField(
        max_length=20,
        blank=True,
        choices=MEDIA_TYPES_SUPPORTED,
        db_index=True,
        default="video",
    )

    password = models.CharField(max_length=100, blank=True, help_text="password for private media")

    preview_file_path = models.CharField(
        max_length=500,
        blank=True,
        help_text="preview gif for videos, path in filesystem",
    )

    poster = ProcessedImageField(
        upload_to=original_thumbnail_file_path,
        processors=[ResizeToFit(width=720, height=None)],
        format="JPEG",
        options={"quality": 95},
        blank=True,
        max_length=500,
        help_text="media extracted big thumbnail, shown on media page",
    )

    rating_category = models.ManyToManyField(
        "RatingCategory",
        blank=True,
        help_text="Rating category, if media Rating is allowed",
    )

    reported_times = models.IntegerField(default=0, help_text="how many time a media is reported")

    search = SearchVectorField(
        null=True,
        help_text="used to store all searchable info and metadata for a Media",
    )

    size = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="media size in bytes, automatically calculated",
    )

    sprites = models.FileField(
        upload_to=original_thumbnail_file_path,
        blank=True,
        max_length=500,
        help_text="sprites file, only for videos, displayed on the video player",
    )

    state = models.CharField(
        max_length=20,
        choices=MEDIA_STATES,
        default=helpers.get_portal_workflow(),
        db_index=True,
        help_text="state of Media",
    )

    tags = models.ManyToManyField("Tag", blank=True, help_text="select one or more out of the existing tags")

    title = models.CharField(max_length=100, help_text="media title", blank=True, db_index=True)

    thumbnail = ProcessedImageField(
        upload_to=original_thumbnail_file_path,
        processors=[ResizeToFit(width=344, height=None)],
        format="JPEG",
        options={"quality": 95},
        blank=True,
        max_length=500,
        help_text="media extracted small thumbnail, shown on listings",
    )

    thumbnail_time = models.FloatField(blank=True, null=True, help_text="Time on video that a thumbnail will be taken")

    uid = models.UUIDField(unique=True, default=uuid.uuid4, help_text="A unique identifier for the Media")

    uploaded_thumbnail = ProcessedImageField(
        upload_to=original_thumbnail_file_path,
        processors=[ResizeToFit(width=344, height=None)],
        format="JPEG",
        options={"quality": 85},
        blank=True,
        max_length=500,
        help_text="thumbnail from uploaded_poster field",
    )

    uploaded_poster = ProcessedImageField(
        verbose_name="Upload image",
        help_text="This image will characterize the media",
        upload_to=original_thumbnail_file_path,
        processors=[ResizeToFit(width=720, height=None)],
        format="JPEG",
        options={"quality": 85},
        blank=True,
        max_length=500,
    )

    user = models.ForeignKey("users.User", on_delete=models.CASCADE, help_text="user that uploads the media")

    user_featured = models.BooleanField(default=False, help_text="Featured by the user")

    video_height = models.IntegerField(default=1)

    views = models.IntegerField(db_index=True, default=1)

    # keep track if media file has changed, on saves
    __original_media_file = None
    __original_thumbnail_time = None
    __original_uploaded_poster = None

    class Meta:
        ordering = ["-add_date"]
        indexes = [
            # TODO: check with pgdash.io or other tool what index need be
            # removed
            GinIndex(fields=["search"])
        ]

    def __str__(self):
        return self.title

    def __init__(self, *args, **kwargs):
        super(Media, self).__init__(*args, **kwargs)
        # keep track if media file has changed, on saves
        # thus know when another media was uploaded
        # or when thumbnail time change - for videos to
        # grep for thumbnail, or even when a new image
        # was added as the media poster
        self.__original_media_file = self.media_file
        self.__original_thumbnail_time = self.thumbnail_time
        self.__original_uploaded_poster = self.uploaded_poster

    def save(self, *args, **kwargs):
        if not self.title:
            self.title = self.media_file.path.split("/")[-1]

        strip_text_items = ["title", "description"]
        for item in strip_text_items:
            setattr(self, item, strip_tags(getattr(self, item, None)))
        self.title = self.title[:99]

        # if thumbnail_time specified, keep up to single digit
        if self.thumbnail_time:
            self.thumbnail_time = round(self.thumbnail_time, 1)

        # by default get an add_date of now
        if not self.add_date:
            self.add_date = timezone.now()

        if not self.friendly_token:
            # get a unique identifier
            while True:
                friendly_token = helpers.produce_friendly_token()
                if not Media.objects.filter(friendly_token=friendly_token):
                    self.friendly_token = friendly_token
                    break

        if self.pk:
            # media exists

            # check case where another media file was uploaded
            if self.media_file != self.__original_media_file:
                # set this otherwise gets to infinite loop
                self.__original_media_file = self.media_file
                self.media_init()

            # for video files, if user specified a different time
            # to automatically grub thumbnail
            if self.thumbnail_time != self.__original_thumbnail_time:
                self.__original_thumbnail_time = self.thumbnail_time
                self.set_thumbnail(force=True)
        else:
            # media is going to be created now
            # after media is saved, post_save signal will call media_init function
            # to take care of post save steps

            self.state = helpers.get_default_state(user=self.user)

        # condition to appear on listings
        if self.state == "public" and self.encoding_status == "success" and self.is_reviewed is True:
            self.listable = True
        else:
            self.listable = False

        super(Media, self).save(*args, **kwargs)

        # produce a thumbnail out of an uploaded poster
        # will run only when a poster is uploaded for the first time
        if self.uploaded_poster and self.uploaded_poster != self.__original_uploaded_poster:
            with open(self.uploaded_poster.path, "rb") as f:
                # set this otherwise gets to infinite loop
                self.__original_uploaded_poster = self.uploaded_poster

                myfile = File(f)
                thumbnail_name = helpers.get_file_name(self.uploaded_poster.path)
                self.uploaded_thumbnail.save(content=myfile, name=thumbnail_name)

    def update_search_vector(self):
        """
        Update SearchVector field of SearchModel using raw SQL
        search field is used to store SearchVector
        """
        db_table = self._meta.db_table

        # first get anything interesting out of the media
        # that needs to be search able

        a_tags = b_tags = ""
        if self.id:
            a_tags = " ".join([tag.title for tag in self.tags.all()])
            b_tags = " ".join([tag.title.replace("-", " ") for tag in self.tags.all()])

        items = [
            self.title,
            self.user.username,
            self.user.email,
            self.user.name,
            self.description,
            a_tags,
            b_tags,
        ]
        items = [item for item in items if item]
        text = " ".join(items)
        text = " ".join([token for token in text.lower().split(" ") if token not in STOP_WORDS])

        text = helpers.clean_query(text)

        sql_code = """
            UPDATE {db_table} SET search = to_tsvector(
                '{config}', '{text}'
            ) WHERE {db_table}.id = {id}
            """.format(
            db_table=db_table, config="simple", text=text, id=self.id
        )

        try:
            with connection.cursor() as cursor:
                cursor.execute(sql_code)
        except BaseException:
            pass  # TODO:add log
        return True

    def media_init(self):
        """Normally this is called when a media is uploaded
        Performs all related tasks, as check for media type,
        video duration, encode
        """
        self.set_media_type()
        if self.media_type == "video":
            self.set_thumbnail(force=True)
            if settings.DO_NOT_TRANSCODE_VIDEO:
                self.encoding_status = "success"
                self.save()
                self.produce_sprite_from_video()
            else:
                self.produce_sprite_from_video()
                self.encode()
        elif self.media_type == "image":
            self.set_thumbnail(force=True)
        return True

    def set_media_type(self, save=True):
        """Sets media type on Media
        Set encoding_status as success for non video
        content since all listings filter for encoding_status success
        """
        kind = helpers.get_file_type(self.media_file.path)
        if kind is not None:
            if kind == "image":
                self.media_type = "image"
            elif kind == "pdf":
                self.media_type = "pdf"

        if self.media_type in ["audio", "image", "pdf"]:
            self.encoding_status = "success"
        else:
            ret = helpers.media_file_info(self.media_file.path)
            if ret.get("fail"):
                self.media_type = ""
                self.encoding_status = "fail"
            elif ret.get("is_video") or ret.get("is_audio"):
                try:
                    self.media_info = json.dumps(ret)
                except TypeError:
                    self.media_info = ""
                self.md5sum = ret.get("md5sum")
                self.size = helpers.show_file_size(ret.get("file_size"))
            else:
                self.media_type = ""
                self.encoding_status = "fail"

            audio_file_with_thumb = False
            # handle case where a file identified as video is actually an
            # audio file with thumbnail
            if ret.get("is_video"):
                # case where Media is video. try to set useful
                # metadata as duration/height
                self.media_type = "video"
                self.duration = int(round(float(ret.get("video_duration", 0))))
                self.video_height = int(ret.get("video_height"))
                if ret.get("video_info", {}).get("codec_name", {}) in ["mjpeg"]:
                    # best guess that this is an audio file with a thumbnail
                    # in other cases, it is not (eg it can be an AVI file)
                    if ret.get("video_info", {}).get("avg_frame_rate", "") == '0/0':
                        audio_file_with_thumb = True

            if ret.get("is_audio") or audio_file_with_thumb:
                self.media_type = "audio"
                self.duration = int(float(ret.get("audio_info", {}).get("duration", 0)))
                self.encoding_status = "success"

        if save:
            self.save(
                update_fields=[
                    "listable",
                    "media_type",
                    "duration",
                    "media_info",
                    "video_height",
                    "size",
                    "md5sum",
                    "encoding_status",
                ]
            )
        return True

    def set_thumbnail(self, force=False):
        """sets thumbnail for media
        For video call function to produce thumbnail and poster
        For image save thumbnail and poster, this will perform
        resize action
        """
        if force or (not self.thumbnail):
            if self.media_type == "video":
                self.produce_thumbnails_from_video()
            if self.media_type == "image":
                with open(self.media_file.path, "rb") as f:
                    myfile = File(f)
                    thumbnail_name = helpers.get_file_name(self.media_file.path) + ".jpg"
                    self.thumbnail.save(content=myfile, name=thumbnail_name)
                    self.poster.save(content=myfile, name=thumbnail_name)
        return True

    def produce_thumbnails_from_video(self):
        """Produce thumbnail and poster for media
        Only for video types. Uses ffmpeg
        """
        if not self.media_type == "video":
            return False

        if self.thumbnail_time and 0 <= self.thumbnail_time < self.duration:
            thumbnail_time = self.thumbnail_time
        else:
            thumbnail_time = round(random.uniform(0, self.duration - 0.1), 1)
            self.thumbnail_time = thumbnail_time  # so that it gets saved

        tf = helpers.create_temp_file(suffix=".jpg")
        command = [
            settings.FFMPEG_COMMAND,
            "-ss",
            str(thumbnail_time),  # -ss need to be firt here otherwise time taken is huge
            "-i",
            self.media_file.path,
            "-vframes",
            "1",
            "-y",
            tf,
        ]
        helpers.run_command(command)

        if os.path.exists(tf) and helpers.get_file_type(tf) == "image":
            with open(tf, "rb") as f:
                myfile = File(f)
                thumbnail_name = helpers.get_file_name(self.media_file.path) + ".jpg"
                self.thumbnail.save(content=myfile, name=thumbnail_name)
                self.poster.save(content=myfile, name=thumbnail_name)
        helpers.rm_file(tf)
        return True

    def produce_sprite_from_video(self):
        """Start a task that will produce a sprite file
        To be used on the video player
        """

        from . import tasks

        tasks.produce_sprite_from_video.delay(self.friendly_token)
        return True

    def encode(self, profiles=[], force=True, chunkize=True):
        """Start video encoding tasks
        Create a task per EncodeProfile object, after checking height
        so that no EncodeProfile for highter heights than the video
        are created
        """

        if not profiles:
            profiles = EncodeProfile.objects.filter(active=True)
        profiles = list(profiles)

        from . import tasks

        # attempt to break media file in chunks
        if self.duration > settings.CHUNKIZE_VIDEO_DURATION and chunkize:
            for profile in profiles:
                if profile.extension == "gif":
                    profiles.remove(profile)
                    encoding = Encoding(media=self, profile=profile)
                    encoding.save()
                    enc_url = settings.SSL_FRONTEND_HOST + encoding.get_absolute_url()
                    tasks.encode_media.apply_async(
                        args=[self.friendly_token, profile.id, encoding.id, enc_url],
                        kwargs={"force": force},
                        priority=0,
                    )
            profiles = [p.id for p in profiles]
            tasks.chunkize_media.delay(self.friendly_token, profiles, force=force)
        else:
            for profile in profiles:
                if profile.extension != "gif":
                    if self.video_height and self.video_height < profile.resolution:
                        if profile.resolution not in settings.MINIMUM_RESOLUTIONS_TO_ENCODE:
                            continue
                encoding = Encoding(media=self, profile=profile)
                encoding.save()
                enc_url = settings.SSL_FRONTEND_HOST + encoding.get_absolute_url()
                if profile.resolution in settings.MINIMUM_RESOLUTIONS_TO_ENCODE:
                    priority = 9
                else:
                    priority = 0
                tasks.encode_media.apply_async(
                    args=[self.friendly_token, profile.id, encoding.id, enc_url],
                    kwargs={"force": force},
                    priority=priority,
                )

        return True

    def post_encode_actions(self, encoding=None, action=None):
        """perform things after encode has run
        whether it has failed or succeeded
        """

        self.set_encoding_status()

        # set a preview url
        if encoding:
            if self.media_type == "video" and encoding.profile.extension == "gif":
                if action == "delete":
                    self.preview_file_path = ""
                else:
                    self.preview_file_path = encoding.media_file.path
                self.save(update_fields=["listable", "preview_file_path"])

        self.save(update_fields=["encoding_status", "listable"])

        if encoding and encoding.status == "success" and encoding.profile.codec == "h264" and action == "add":
            from . import tasks

            tasks.create_hls(self.friendly_token)

        return True

    def set_encoding_status(self):
        """Set encoding_status for videos
        Set success if at least one mp4 or webm exists
        """
        mp4_statuses = set(encoding.status for encoding in self.encodings.filter(profile__extension="mp4", chunk=False))
        webm_statuses = set(encoding.status for encoding in self.encodings.filter(profile__extension="webm", chunk=False))

        if not mp4_statuses and not webm_statuses:
            encoding_status = "pending"
        elif "success" in mp4_statuses or "success" in webm_statuses:
            encoding_status = "success"
        elif "running" in mp4_statuses or "running" in webm_statuses:
            encoding_status = "running"
        else:
            encoding_status = "fail"
        self.encoding_status = encoding_status

        return True

    @property
    def encodings_info(self, full=False):
        """Property used on serializers"""

        ret = {}

        if self.media_type not in ["video"]:
            return ret
        for key in ENCODE_RESOLUTIONS_KEYS:
            ret[key] = {}

        # if this is enabled, return original file on a way
        # that video.js can consume
        if settings.DO_NOT_TRANSCODE_VIDEO:
            ret['0-original'] = {"h264": {"url": helpers.url_from_path(self.media_file.path), "status": "success", "progress": 100}}
            return ret

        for encoding in self.encodings.select_related("profile").filter(chunk=False):
            if encoding.profile.extension == "gif":
                continue
            enc = self.get_encoding_info(encoding, full=full)
            resolution = encoding.profile.resolution
            ret[resolution][encoding.profile.codec] = enc

        # TODO: the following code is untested/needs optimization

        # if a file is broken in chunks and they are being
        # encoded, the final encoding file won't appear until
        # they are finished. Thus, produce the info for these
        if full:
            extra = []
            for encoding in self.encodings.select_related("profile").filter(chunk=True):
                resolution = encoding.profile.resolution
                if not ret[resolution].get(encoding.profile.codec):
                    extra.append(encoding.profile.codec)
            for codec in extra:
                ret[resolution][codec] = {}
                v = self.encodings.filter(chunk=True, profile__codec=codec).values("progress")
                ret[resolution][codec]["progress"] = sum([p["progress"] for p in v]) / v.count()
                # TODO; status/logs/errors
        return ret

    def get_encoding_info(self, encoding, full=False):
        """Property used on serializers"""

        ep = {}
        ep["title"] = encoding.profile.name
        ep["url"] = encoding.media_encoding_url
        ep["progress"] = encoding.progress
        ep["size"] = encoding.size
        ep["encoding_id"] = encoding.id
        ep["status"] = encoding.status

        if full:
            ep["logs"] = encoding.logs
            ep["worker"] = encoding.worker
            ep["retries"] = encoding.retries
            if encoding.total_run_time:
                ep["total_run_time"] = encoding.total_run_time
            if encoding.commands:
                ep["commands"] = encoding.commands
            ep["time_started"] = encoding.add_date
            ep["updated_time"] = encoding.update_date
        return ep

    @property
    def categories_info(self):
        """Property used on serializers"""

        ret = []
        for cat in self.category.all():
            ret.append({"title": cat.title, "url": cat.get_absolute_url()})
        return ret

    @property
    def tags_info(self):
        """Property used on serializers"""

        ret = []
        for tag in self.tags.all():
            ret.append({"title": tag.title, "url": tag.get_absolute_url()})
        return ret

    @property
    def original_media_url(self):
        """Property used on serializers"""

        if settings.SHOW_ORIGINAL_MEDIA:
            return helpers.url_from_path(self.media_file.path)
        else:
            return None

    @property
    def thumbnail_url(self):
        """Property used on serializers
        Prioritize uploaded_thumbnail, if exists, then thumbnail
        that is auto-generated
        """

        if self.uploaded_thumbnail:
            return helpers.url_from_path(self.uploaded_thumbnail.path)
        if self.thumbnail:
            return helpers.url_from_path(self.thumbnail.path)
        return None

    @property
    def poster_url(self):
        """Property used on serializers
        Prioritize uploaded_poster, if exists, then poster
        that is auto-generated
        """

        if self.uploaded_poster:
            return helpers.url_from_path(self.uploaded_poster.path)
        if self.poster:
            return helpers.url_from_path(self.poster.path)
        return None

    @property
    def slideshow_items(self):
        slideshow_items = getattr(settings, "SLIDESHOW_ITEMS", 30)
        if self.media_type != "image":
            items = []
        else:
            qs = Media.objects.filter(listable=True, user=self.user, media_type="image").exclude(id=self.id).order_by('id')[:slideshow_items]

            items = [
                {
                    "poster_url": item.poster_url,
                    "url": item.get_absolute_url(),
                    "thumbnail_url": item.thumbnail_url,
                    "title": item.title,
                    "original_media_url": item.original_media_url,
                }
                for item in qs
            ]
            items.insert(
                0,
                {
                    "poster_url": self.poster_url,
                    "url": self.get_absolute_url(),
                    "thumbnail_url": self.thumbnail_url,
                    "title": self.title,
                    "original_media_url": self.original_media_url,
                },
            )
        return items

    @property
    def subtitles_info(self):
        """Property used on serializers
        Returns subtitles info
        """

        ret = []
        # Retrieve all subtitles and sort by the first letter of their associated language's title
        sorted_subtitles = sorted(self.subtitles.all(), key=lambda s: s.language.title[0])
        for subtitle in sorted_subtitles:
            ret.append(
                {
                    "src": helpers.url_from_path(subtitle.subtitle_file.path),
                    "srclang": subtitle.language.code,
                    "label": subtitle.language.title,
                }
            )
        return ret

    @property
    def sprites_url(self):
        """Property used on serializers
        Returns sprites url
        """

        if self.sprites:
            return helpers.url_from_path(self.sprites.path)
        return None

    @property
    def preview_url(self):
        """Property used on serializers
        Returns preview url
        """

        if self.preview_file_path:
            return helpers.url_from_path(self.preview_file_path)

        # get preview_file out of the encodings, since some times preview_file_path
        # is empty but there is the gif encoding!
        preview_media = self.encodings.filter(profile__extension="gif").first()
        if preview_media and preview_media.media_file:
            return helpers.url_from_path(preview_media.media_file.path)
        return None

    @property
    def hls_info(self):
        """Property used on serializers
        Returns hls info, curated to be read by video.js
        """

        res = {}
        valid_resolutions = [240, 360, 480, 720, 1080, 1440, 2160]
        if self.hls_file:
            if os.path.exists(self.hls_file):
                hls_file = self.hls_file
                p = os.path.dirname(hls_file)
                m3u8_obj = m3u8.load(hls_file)
                if os.path.exists(hls_file):
                    res["master_file"] = helpers.url_from_path(hls_file)
                    for iframe_playlist in m3u8_obj.iframe_playlists:
                        uri = os.path.join(p, iframe_playlist.uri)
                        if os.path.exists(uri):
                            resolution = iframe_playlist.iframe_stream_info.resolution[1]
                            # most probably video is vertical, getting the first value to
                            # be the resolution
                            if resolution not in valid_resolutions:
                                resolution = iframe_playlist.iframe_stream_info.resolution[0]

                            res["{}_iframe".format(resolution)] = helpers.url_from_path(uri)
                    for playlist in m3u8_obj.playlists:
                        uri = os.path.join(p, playlist.uri)
                        if os.path.exists(uri):
                            resolution = playlist.stream_info.resolution[1]
                            # same as above
                            if resolution not in valid_resolutions:
                                resolution = playlist.stream_info.resolution[0]

                            res["{}_playlist".format(resolution)] = helpers.url_from_path(uri)
        return res

    @property
    def author_name(self):
        return self.user.name

    @property
    def author_username(self):
        return self.user.username

    def author_profile(self):
        return self.user.get_absolute_url()

    def author_thumbnail(self):
        return helpers.url_from_path(self.user.logo.path)

    def get_absolute_url(self, api=False, edit=False):
        if edit:
            return reverse("edit_media") + "?m={0}".format(self.friendly_token)
        if api:
            return reverse("api_get_media", kwargs={"friendly_token": self.friendly_token})
        else:
            return reverse("get_media") + "?m={0}".format(self.friendly_token)

    @property
    def edit_url(self):
        return self.get_absolute_url(edit=True)

    @property
    def add_subtitle_url(self):
        return "/add_subtitle?m=%s" % self.friendly_token

    @property
    def ratings_info(self):
        """Property used on ratings
        If ratings functionality enabled
        """

        # to be used if user ratings are allowed
        ret = []
        if not settings.ALLOW_RATINGS:
            return []
        for category in self.rating_category.filter(enabled=True):
            ret.append(
                {
                    "score": -1,
                    # default score, means no score. In case user has already
                    # rated for this media, it will be populated
                    "category_id": category.id,
                    "category_title": category.title,
                }
            )
        return ret


class License(models.Model):
    """A Base license model to be used in Media"""

    title = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.title


class Category(models.Model):
    """A Category base model"""

    uid = models.UUIDField(unique=True, default=uuid.uuid4)

    add_date = models.DateTimeField(auto_now_add=True)

    title = models.CharField(max_length=100, unique=True, db_index=True)

    description = models.TextField(blank=True)

    user = models.ForeignKey("users.User", on_delete=models.CASCADE, blank=True, null=True)

    is_global = models.BooleanField(default=False, help_text="global categories or user specific")

    media_count = models.IntegerField(default=0, help_text="number of media")

    thumbnail = ProcessedImageField(
        upload_to=category_thumb_path,
        processors=[ResizeToFit(width=344, height=None)],
        format="JPEG",
        options={"quality": 85},
        blank=True,
    )

    listings_thumbnail = models.CharField(max_length=400, blank=True, null=True, help_text="Thumbnail to show on listings")

    def __str__(self):
        return self.title

    class Meta:
        ordering = ["title"]
        verbose_name_plural = "Categories"

    def get_absolute_url(self):
        return reverse("search") + "?c={0}".format(self.title)

    def update_category_media(self):
        """Set media_count"""

        self.media_count = Media.objects.filter(listable=True, category=self).count()
        self.save(update_fields=["media_count"])
        return True

    @property
    def thumbnail_url(self):
        """Return thumbnail for category
        prioritize processed value of listings_thumbnail
        then thumbnail
        """

        if self.listings_thumbnail:
            return self.listings_thumbnail
        if self.thumbnail:
            return helpers.url_from_path(self.thumbnail.path)

        media = Media.objects.filter(category=self, state="public").order_by("-views").first()
        if media:
            return media.thumbnail_url

        return None

    def save(self, *args, **kwargs):
        strip_text_items = ["title", "description"]
        for item in strip_text_items:
            setattr(self, item, strip_tags(getattr(self, item, None)))
        super(Category, self).save(*args, **kwargs)


class Tag(models.Model):
    """A Tag model"""

    title = models.CharField(max_length=100, unique=True, db_index=True)

    user = models.ForeignKey("users.User", on_delete=models.CASCADE, blank=True, null=True)

    media_count = models.IntegerField(default=0, help_text="number of media")

    listings_thumbnail = models.CharField(
        max_length=400,
        blank=True,
        null=True,
        help_text="Thumbnail to show on listings",
        db_index=True,
    )

    def __str__(self):
        return self.title

    class Meta:
        ordering = ["title"]

    def get_absolute_url(self):
        return reverse("search") + "?t={0}".format(self.title)

    def update_tag_media(self):
        self.media_count = Media.objects.filter(state="public", is_reviewed=True, tags=self).count()
        self.save(update_fields=["media_count"])
        return True

    def save(self, *args, **kwargs):
        self.title = helpers.get_alphanumeric_only(self.title)
        self.title = self.title[:99]
        super(Tag, self).save(*args, **kwargs)

    @property
    def thumbnail_url(self):
        if self.listings_thumbnail:
            return self.listings_thumbnail
        media = Media.objects.filter(tags=self, state="public").order_by("-views").first()
        if media:
            return media.thumbnail_url

        return None


class EncodeProfile(models.Model):
    """Encode Profile model
    keeps information for each profile
    """

    name = models.CharField(max_length=90)

    extension = models.CharField(max_length=10, choices=ENCODE_EXTENSIONS)

    resolution = models.IntegerField(choices=ENCODE_RESOLUTIONS, blank=True, null=True)

    codec = models.CharField(max_length=10, choices=CODECS, blank=True, null=True)

    description = models.TextField(blank=True, help_text="description")

    active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["resolution"]


class Encoding(models.Model):
    """Encoding Media Instances"""

    add_date = models.DateTimeField(auto_now_add=True)

    commands = models.TextField(blank=True, help_text="commands run")

    chunk = models.BooleanField(default=False, db_index=True, help_text="is chunk?")

    chunk_file_path = models.CharField(max_length=400, blank=True)

    chunks_info = models.TextField(blank=True)

    logs = models.TextField(blank=True)

    md5sum = models.CharField(max_length=50, blank=True, null=True)

    media = models.ForeignKey(Media, on_delete=models.CASCADE, related_name="encodings")

    media_file = models.FileField("encoding file", upload_to=encoding_media_file_path, blank=True, max_length=500)

    profile = models.ForeignKey(EncodeProfile, on_delete=models.CASCADE)

    progress = models.PositiveSmallIntegerField(default=0)

    update_date = models.DateTimeField(auto_now=True)

    retries = models.IntegerField(default=0)

    size = models.CharField(max_length=20, blank=True)

    status = models.CharField(max_length=20, choices=MEDIA_ENCODING_STATUS, default="pending")

    temp_file = models.CharField(max_length=400, blank=True)

    task_id = models.CharField(max_length=100, blank=True)

    total_run_time = models.IntegerField(default=0)

    worker = models.CharField(max_length=100, blank=True)

    @property
    def media_encoding_url(self):
        if self.media_file:
            return helpers.url_from_path(self.media_file.path)
        return None

    @property
    def media_chunk_url(self):
        if self.chunk_file_path:
            return helpers.url_from_path(self.chunk_file_path)
        return None

    def save(self, *args, **kwargs):
        if self.media_file:
            cmd = ["stat", "-c", "%s", self.media_file.path]
            stdout = helpers.run_command(cmd).get("out")
            if stdout:
                size = int(stdout.strip())
                self.size = helpers.show_file_size(size)
        if self.chunk_file_path and not self.md5sum:
            cmd = ["md5sum", self.chunk_file_path]
            stdout = helpers.run_command(cmd).get("out")
            if stdout:
                md5sum = stdout.strip().split()[0]
                self.md5sum = md5sum

        super(Encoding, self).save(*args, **kwargs)

    def set_progress(self, progress, commit=True):
        if isinstance(progress, int):
            if 0 <= progress <= 100:
                self.progress = progress
                self.save(update_fields=["progress"])
                return True
        return False

    def __str__(self):
        return "{0}-{1}".format(self.profile.name, self.media.title)

    def get_absolute_url(self):
        return reverse("api_get_encoding", kwargs={"encoding_id": self.id})


class Language(models.Model):
    """Language model
    to be used with Subtitles
    """

    code = models.CharField(max_length=12, help_text="language code")

    title = models.CharField(max_length=100, help_text="language code")

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return "{0}-{1}".format(self.code, self.title)


class Subtitle(models.Model):
    """Subtitles model"""

    language = models.ForeignKey(Language, on_delete=models.CASCADE)

    media = models.ForeignKey(Media, on_delete=models.CASCADE, related_name="subtitles")

    subtitle_file = models.FileField(
        "Subtitle/CC file",
        help_text="File has to be WebVTT format",
        upload_to=subtitles_file_path,
        max_length=500,
    )

    user = models.ForeignKey("users.User", on_delete=models.CASCADE)

    def __str__(self):
        return "{0}-{1}".format(self.media.title, self.language.title)


class RatingCategory(models.Model):
    """Rating Category
    Facilitate user ratings.
    One or more rating categories per Category can exist
    will be shown to the media if they are enabled
    """

    description = models.TextField(blank=True)

    enabled = models.BooleanField(default=True)

    title = models.CharField(max_length=200, unique=True, db_index=True)

    class Meta:
        verbose_name_plural = "Rating Categories"

    def __str__(self):
        return "{0}".format(self.title)


def validate_rating(value):
    if -1 >= value or value > 5:
        raise ValidationError("score has to be between 0 and 5")


class Rating(models.Model):
    """User Rating"""

    add_date = models.DateTimeField(auto_now_add=True)

    media = models.ForeignKey(Media, on_delete=models.CASCADE, related_name="ratings")

    rating_category = models.ForeignKey(RatingCategory, on_delete=models.CASCADE)

    score = models.IntegerField(validators=[validate_rating])

    user = models.ForeignKey("users.User", on_delete=models.CASCADE)

    class Meta:
        verbose_name_plural = "Ratings"
        indexes = [
            models.Index(fields=["user", "media"]),
        ]
        unique_together = ("user", "media", "rating_category")

    def __str__(self):
        return "{0}, rate for {1} for category {2}".format(self.user.username, self.media.title, self.rating_category.title)


class Playlist(models.Model):
    """Playlists model"""

    add_date = models.DateTimeField(auto_now_add=True, db_index=True)

    description = models.TextField(blank=True, help_text="description")

    friendly_token = models.CharField(blank=True, max_length=12, db_index=True)

    media = models.ManyToManyField(Media, through="playlistmedia", blank=True)

    title = models.CharField(max_length=100, db_index=True)

    uid = models.UUIDField(unique=True, default=uuid.uuid4)

    user = models.ForeignKey("users.User", on_delete=models.CASCADE, db_index=True, related_name="playlists")

    def __str__(self):
        return self.title

    @property
    def media_count(self):
        return self.media.count()

    def get_absolute_url(self, api=False):
        if api:
            return reverse("api_get_playlist", kwargs={"friendly_token": self.friendly_token})
        else:
            return reverse("get_playlist", kwargs={"friendly_token": self.friendly_token})

    @property
    def url(self):
        return self.get_absolute_url()

    @property
    def api_url(self):
        return self.get_absolute_url(api=True)

    def user_thumbnail_url(self):
        if self.user.logo:
            return helpers.url_from_path(self.user.logo.path)
        return None

    def set_ordering(self, media, ordering):
        if media not in self.media.all():
            return False
        pm = PlaylistMedia.objects.filter(playlist=self, media=media).first()
        if pm and isinstance(ordering, int) and 0 < ordering:
            pm.ordering = ordering
            pm.save()
            return True
        return False

    def save(self, *args, **kwargs):
        strip_text_items = ["title", "description"]
        for item in strip_text_items:
            setattr(self, item, strip_tags(getattr(self, item, None)))
        self.title = self.title[:99]

        if not self.friendly_token:
            while True:
                friendly_token = helpers.produce_friendly_token()
                if not Playlist.objects.filter(friendly_token=friendly_token):
                    self.friendly_token = friendly_token
                    break
        super(Playlist, self).save(*args, **kwargs)

    @property
    def thumbnail_url(self):
        pm = self.playlistmedia_set.first()
        if pm and pm.media.thumbnail:
            return helpers.url_from_path(pm.media.thumbnail.path)
        return None


class PlaylistMedia(models.Model):
    """Helper model to store playlist specific media"""

    action_date = models.DateTimeField(auto_now=True)

    media = models.ForeignKey(Media, on_delete=models.CASCADE)

    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE)

    ordering = models.IntegerField(default=1)

    class Meta:
        ordering = ["ordering", "-action_date"]


class Comment(MPTTModel):
    """Comments model"""

    add_date = models.DateTimeField(auto_now_add=True)

    media = models.ForeignKey(Media, on_delete=models.CASCADE, db_index=True, related_name="comments")

    parent = TreeForeignKey("self", on_delete=models.CASCADE, null=True, blank=True, related_name="children")

    text = models.TextField(help_text="text")

    uid = models.UUIDField(unique=True, default=uuid.uuid4)

    user = models.ForeignKey("users.User", on_delete=models.CASCADE, db_index=True)

    class MPTTMeta:
        order_insertion_by = ["add_date"]

    def __str__(self):
        return "On {0} by {1}".format(self.media.title, self.user.username)

    def save(self, *args, **kwargs):
        strip_text_items = ["text"]
        for item in strip_text_items:
            setattr(self, item, strip_tags(getattr(self, item, None)))

        if self.text:
            self.text = self.text[: settings.MAX_CHARS_FOR_COMMENT]

        super(Comment, self).save(*args, **kwargs)

    def get_absolute_url(self):
        return reverse("get_media") + "?m={0}".format(self.media.friendly_token)

    @property
    def media_url(self):
        return self.get_absolute_url()


@receiver(post_save, sender=Media)
def media_save(sender, instance, created, **kwargs):
    # media_file path is not set correctly until mode is saved
    # post_save signal will take care of calling a few functions
    # once model is saved
    # SOS: do not put anything here, as if more logic is added,
    # we have to disconnect signal to avoid infinite recursion
    if created:
        from .methods import notify_users

        instance.media_init()
        notify_users(friendly_token=instance.friendly_token, action="media_added")

    instance.user.update_user_media()
    if instance.category.all():
        # this won't catch when a category
        # is removed from a media, which is what we want...
        for category in instance.category.all():
            category.update_category_media()

    if instance.tags.all():
        for tag in instance.tags.all():
            tag.update_tag_media()

    instance.update_search_vector()


@receiver(pre_delete, sender=Media)
def media_file_pre_delete(sender, instance, **kwargs):
    if instance.category.all():
        for category in instance.category.all():
            instance.category.remove(category)
            category.update_category_media()
    if instance.tags.all():
        for tag in instance.tags.all():
            instance.tags.remove(tag)
            tag.update_tag_media()


@receiver(post_delete, sender=Media)
def media_file_delete(sender, instance, **kwargs):
    """
    Deletes file from filesystem
    when corresponding `Media` object is deleted.
    """

    if instance.media_file:
        helpers.rm_file(instance.media_file.path)
    if instance.thumbnail:
        helpers.rm_file(instance.thumbnail.path)
    if instance.poster:
        helpers.rm_file(instance.poster.path)
    if instance.uploaded_thumbnail:
        helpers.rm_file(instance.uploaded_thumbnail.path)
    if instance.uploaded_poster:
        helpers.rm_file(instance.uploaded_poster.path)
    if instance.sprites:
        helpers.rm_file(instance.sprites.path)
    if instance.hls_file:
        p = os.path.dirname(instance.hls_file)
        helpers.rm_dir(p)
    instance.user.update_user_media()

    # remove extra zombie thumbnails
    if instance.thumbnail:
        thumbnails_path = os.path.dirname(instance.thumbnail.path)
        thumbnails = glob.glob(f'{thumbnails_path}/{instance.uid.hex}.*')
        for thumbnail in thumbnails:
            helpers.rm_file(thumbnail)


@receiver(m2m_changed, sender=Media.category.through)
def media_m2m(sender, instance, **kwargs):
    if instance.category.all():
        for category in instance.category.all():
            category.update_category_media()
    if instance.tags.all():
        for tag in instance.tags.all():
            tag.update_tag_media()


@receiver(post_save, sender=Encoding)
def encoding_file_save(sender, instance, created, **kwargs):
    """Performs actions on encoding file delete
    For example, if encoding is a chunk file, with encoding_status success,
    perform a check if this is the final chunk file of a media, then
    concatenate chunks, create final encoding file and delete chunks
    """

    if instance.chunk and instance.status == "success":
        # a chunk got completed

        # check if all chunks are OK
        # then concatenate to new Encoding - and remove chunks
        # this should run only once!
        if instance.media_file:
            try:
                orig_chunks = json.loads(instance.chunks_info).keys()
            except BaseException:
                instance.delete()
                return False

            chunks = Encoding.objects.filter(
                media=instance.media,
                profile=instance.profile,
                chunks_info=instance.chunks_info,
                chunk=True,
            ).order_by("add_date")

            complete = True

            # perform validation, make sure everything is there
            for chunk in orig_chunks:
                if not chunks.filter(chunk_file_path=chunk):
                    complete = False
                    break

            for chunk in chunks:
                if not (chunk.media_file and chunk.media_file.path):
                    complete = False
                    break

            if complete:
                # concatenate chunks and create final encoding file
                chunks_paths = [f.media_file.path for f in chunks]

                with tempfile.TemporaryDirectory(dir=settings.TEMP_DIRECTORY) as temp_dir:
                    seg_file = helpers.create_temp_file(suffix=".txt", dir=temp_dir)
                    tf = helpers.create_temp_file(suffix=".{0}".format(instance.profile.extension), dir=temp_dir)
                    with open(seg_file, "w") as ff:
                        for f in chunks_paths:
                            ff.write("file {}\n".format(f))
                    cmd = [
                        settings.FFMPEG_COMMAND,
                        "-y",
                        "-f",
                        "concat",
                        "-safe",
                        "0",
                        "-i",
                        seg_file,
                        "-c",
                        "copy",
                        "-pix_fmt",
                        "yuv420p",
                        "-movflags",
                        "faststart",
                        tf,
                    ]
                    stdout = helpers.run_command(cmd)

                    encoding = Encoding(
                        media=instance.media,
                        profile=instance.profile,
                        status="success",
                        progress=100,
                    )
                    all_logs = "\n".join([st.logs for st in chunks])
                    encoding.logs = "{0}\n{1}\n{2}".format(chunks_paths, stdout, all_logs)
                    workers = list(set([st.worker for st in chunks]))
                    encoding.worker = json.dumps({"workers": workers})

                    start_date = min([st.add_date for st in chunks])
                    end_date = max([st.update_date for st in chunks])
                    encoding.total_run_time = (end_date - start_date).seconds
                    encoding.save()

                    with open(tf, "rb") as f:
                        myfile = File(f)
                        output_name = "{0}.{1}".format(
                            helpers.get_file_name(instance.media.media_file.path),
                            instance.profile.extension,
                        )
                        encoding.media_file.save(content=myfile, name=output_name)

                    # encoding is saved, deleting chunks
                    # and any other encoding that might exist
                    # first perform one last validation
                    # to avoid that this is run twice
                    if (
                        len(orig_chunks)
                        == Encoding.objects.filter(  # noqa
                            media=instance.media,
                            profile=instance.profile,
                            chunks_info=instance.chunks_info,
                        ).count()
                    ):
                        # if two chunks are finished at the same time, this
                        # will be changed
                        who = Encoding.objects.filter(media=encoding.media, profile=encoding.profile).exclude(id=encoding.id)
                        who.delete()
                    else:
                        encoding.delete()
                    if not Encoding.objects.filter(chunks_info=instance.chunks_info):
                        # TODO: in case of remote workers, files should be deleted
                        # example
                        # for worker in workers:
                        #    for chunk in json.loads(instance.chunks_info).keys():
                        #        remove_media_file.delay(media_file=chunk)
                        for chunk in json.loads(instance.chunks_info).keys():
                            helpers.rm_file(chunk)
                    instance.media.post_encode_actions(encoding=instance, action="add")

    elif instance.chunk and instance.status == "fail":
        encoding = Encoding(media=instance.media, profile=instance.profile, status="fail", progress=100)

        chunks = Encoding.objects.filter(media=instance.media, chunks_info=instance.chunks_info, chunk=True).order_by("add_date")

        chunks_paths = [f.media_file.path for f in chunks]

        all_logs = "\n".join([st.logs for st in chunks])
        encoding.logs = "{0}\n{1}".format(chunks_paths, all_logs)
        workers = list(set([st.worker for st in chunks]))
        encoding.worker = json.dumps({"workers": workers})
        start_date = min([st.add_date for st in chunks])
        end_date = max([st.update_date for st in chunks])
        encoding.total_run_time = (end_date - start_date).seconds
        encoding.save()

        who = Encoding.objects.filter(media=encoding.media, profile=encoding.profile).exclude(id=encoding.id)

        who.delete()
        # TODO: merge with above if, do not repeat code
    else:
        if instance.status in ["fail", "success"]:
            instance.media.post_encode_actions(encoding=instance, action="add")

        encodings = set([encoding.status for encoding in Encoding.objects.filter(media=instance.media)])
        if ("running" in encodings) or ("pending" in encodings):
            return


@receiver(post_delete, sender=Encoding)
def encoding_file_delete(sender, instance, **kwargs):
    """
    Deletes file from filesystem
    when corresponding `Encoding` object is deleted.
    """

    if instance.media_file:
        helpers.rm_file(instance.media_file.path)
        if not instance.chunk:
            instance.media.post_encode_actions(encoding=instance, action="delete")
    # delete local chunks, and remote chunks + media file. Only when the
    # last encoding of a media is complete
