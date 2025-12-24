import glob
import json
import logging
import os
import random
import uuid

import m3u8
from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVectorField
from django.core.files import File
from django.db import models
from django.db.models import Func, Value
from django.db.models.signals import m2m_changed, post_delete, post_save, pre_delete
from django.dispatch import receiver
from django.urls import reverse
from django.utils import timezone
from django.utils.html import strip_tags
from imagekit.models import ProcessedImageField
from imagekit.processors import ResizeToFit

from .. import helpers
from ..stop_words import STOP_WORDS
from .encoding import EncodeProfile, Encoding
from .subtitle import TranscriptionRequest
from .utils import (
    ENCODE_RESOLUTIONS_KEYS,
    MEDIA_ENCODING_STATUS,
    MEDIA_STATES,
    MEDIA_TYPES_SUPPORTED,
    original_media_file_path,
    original_thumbnail_file_path,
)
from .video_data import VideoTrimRequest

logger = logging.getLogger(__name__)


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

    friendly_token = models.CharField(blank=True, max_length=150, db_index=True, unique=True, help_text="Identifier for the Media")

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

    allow_whisper_transcribe = models.BooleanField("Transcribe auto-detected language", default=False)
    allow_whisper_transcribe_and_translate = models.BooleanField("Transcribe auto-detected language and translate to English", default=False)

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
        self.__original_allow_whisper_transcribe = self.allow_whisper_transcribe
        self.__original_allow_whisper_transcribe_and_translate = self.allow_whisper_transcribe_and_translate

    def save(self, *args, **kwargs):
        if not self.title:
            self.title = self.media_file.path.split("/")[-1]

        strip_text_items = ["title", "description"]
        for item in strip_text_items:
            setattr(self, item, strip_tags(getattr(self, item, None)))
        self.title = self.title[:100]

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
                from .. import tasks

                tasks.media_init.apply_async(args=[self.friendly_token], countdown=5)

            # for video files, if user specified a different time
            # to automatically grub thumbnail
            if self.thumbnail_time != self.__original_thumbnail_time:
                self.__original_thumbnail_time = self.thumbnail_time
                self.set_thumbnail(force=True)

            transcription_changed = (
                self.allow_whisper_transcribe != self.__original_allow_whisper_transcribe or self.allow_whisper_transcribe_and_translate != self.__original_allow_whisper_transcribe_and_translate
            )

            if transcription_changed and self.media_type in ["video", "audio"]:
                self.transcribe_function()

            # Update the original values for next comparison
            self.__original_allow_whisper_transcribe = self.allow_whisper_transcribe
            self.__original_allow_whisper_transcribe_and_translate = self.allow_whisper_transcribe_and_translate
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

    def transcribe_function(self):
        to_transcribe = False
        to_transcribe_and_translate = False

        if self.allow_whisper_transcribe or self.allow_whisper_transcribe_and_translate:
            if self.allow_whisper_transcribe and not TranscriptionRequest.objects.filter(media=self, translate_to_english=False).exists():
                to_transcribe = True

            if self.allow_whisper_transcribe_and_translate and not TranscriptionRequest.objects.filter(media=self, translate_to_english=True).exists():
                to_transcribe_and_translate = True

            from .. import tasks

            if to_transcribe:
                TranscriptionRequest.objects.create(media=self, translate_to_english=False)
                tasks.whisper_transcribe.apply_async(
                    args=[self.friendly_token, False],
                    countdown=10,
                )

            if to_transcribe_and_translate:
                TranscriptionRequest.objects.create(media=self, translate_to_english=True)
                tasks.whisper_transcribe.apply_async(
                    args=[self.friendly_token, True],
                    countdown=10,
                )

    def update_search_vector(self):
        """
        Update SearchVector field of SearchModel using raw SQL
        search field is used to store SearchVector
        """

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

        for subtitle in self.subtitles.all():
            items.append(subtitle.subtitle_text)

        items = [item for item in items if item]
        text = " ".join(items)
        text = " ".join([token for token in text.lower().split(" ") if token not in STOP_WORDS])

        text = helpers.clean_query(text)

        Media.objects.filter(id=self.id).update(search=Func(Value('simple'), Value(text), function='to_tsvector'))

        return True

    def media_init(self):
        """Normally this is called when a media is uploaded
        Performs all related tasks, as check for media type,
        video duration, encode
        """
        self.set_media_type()
        from ..methods import is_media_allowed_type

        if not is_media_allowed_type(self):
            helpers.rm_file(self.media_file.path)
            if self.state == "public":
                self.state = "unlisted"
                self.save(update_fields=["state"])
            return False

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
            elif kind == "audio":
                self.media_type = "audio"
            elif kind == "video":
                self.media_type = "video"

        if self.media_type in ["image", "pdf"]:
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
                    # avoid saving the whole object, because something might have been changed
                    # on the meanwhile
                    self.thumbnail.save(content=myfile, name=thumbnail_name, save=False)
                    self.poster.save(content=myfile, name=thumbnail_name, save=False)
                    self.save(update_fields=["thumbnail", "poster"])

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
                # avoid saving the whole object, because something might have been changed
                # on the meanwhile
                self.thumbnail.save(content=myfile, name=thumbnail_name, save=False)
                self.poster.save(content=myfile, name=thumbnail_name, save=False)
                self.save(update_fields=["thumbnail", "poster"])
        helpers.rm_file(tf)
        return True

    def produce_sprite_from_video(self):
        """Start a task that will produce a sprite file
        To be used on the video player
        """

        from .. import tasks

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

        from .. import tasks

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

        self.save(update_fields=["encoding_status", "listable", "preview_file_path"])

        if encoding and encoding.status == "success" and encoding.profile.codec == "h264" and action == "add" and not encoding.chunk:
            from .. import tasks

            tasks.create_hls.delay(self.friendly_token)

            # TODO: ideally would ensure this is run only at the end when the last encoding is done...
            vt_request = VideoTrimRequest.objects.filter(media=self, status="running").first()
            if vt_request:
                tasks.post_trim_action.delay(self.friendly_token)
                vt_request.status = "success"
                vt_request.save(update_fields=["status"])
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
    def trim_video_url(self):
        if self.media_type not in ["video", "audio"]:
            return None

        ret = self.encodings.filter(status="success", profile__extension='mp4', chunk=False).order_by("-profile__resolution").first()
        if ret:
            return helpers.url_from_path(ret.media_file.path)

        # showing the original file
        return helpers.url_from_path(self.media_file.path)

    @property
    def trim_video_path(self):
        if self.media_type not in ["video", "audio"]:
            return None

        ret = self.encodings.filter(status="success", profile__extension='mp4', chunk=False).order_by("-profile__resolution").first()
        if ret:
            return ret.media_file.path

        return None

    @property
    def encodings_info(self, full=False):
        """Property used on serializers"""

        ret = {}

        if self.media_type not in ["video"]:
            return ret
        for key in ENCODE_RESOLUTIONS_KEYS:
            ret[key] = {}

        # if DO_NOT_TRANSCODE_VIDEO enabled, return original file on a way
        # that video.js can consume. Or also if encoding_status is running, do the
        # same so that the video appears on the player
        if settings.DO_NOT_TRANSCODE_VIDEO:
            ret['0-original'] = {"h264": {"url": helpers.url_from_path(self.media_file.path), "status": "success", "progress": 100}}
            return ret

        if self.encoding_status in ["running", "pending"]:
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
        if self.media_type == "audio":
            return helpers.url_from_path("userlogos/poster_audio.jpg")
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
        if self.media_type == "audio":
            return helpers.url_from_path("userlogos/poster_audio.jpg")

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
        valid_resolutions = [144, 240, 360, 480, 720, 1080, 1440, 2160]
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

                            res[f"{resolution}_iframe"] = helpers.url_from_path(uri)
                    for playlist in m3u8_obj.playlists:
                        uri = os.path.join(p, playlist.uri)
                        if os.path.exists(uri):
                            resolution = playlist.stream_info.resolution[1]
                            # same as above
                            if resolution not in valid_resolutions:
                                resolution = playlist.stream_info.resolution[0]

                            res[f"{resolution}_playlist"] = helpers.url_from_path(uri)

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
            return f"{reverse('edit_media')}?m={self.friendly_token}"
        if api:
            return reverse("api_get_media", kwargs={"friendly_token": self.friendly_token})
        else:
            return f"{reverse('get_media')}?m={self.friendly_token}"

    @property
    def edit_url(self):
        return self.get_absolute_url(edit=True)

    @property
    def add_subtitle_url(self):
        return f"/add_subtitle?m={self.friendly_token}"

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

    @property
    def video_chapters_folder(self):
        custom_folder = f"{settings.THUMBNAIL_UPLOAD_DIR}{self.user.username}/{self.friendly_token}_chapters"
        return os.path.join(settings.MEDIA_ROOT, custom_folder)

    @property
    def chapter_data(self):
        data = []
        chapter_data = self.chapters.first()
        if chapter_data:
            return chapter_data.chapter_data
        return data


class MediaPermission(models.Model):
    """Model to store user permissions for media"""

    PERMISSION_CHOICES = (
        ("viewer", "Viewer"),
        ("editor", "Editor"),
        ("owner", "Owner"),
    )

    owner_user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='granted_permissions')
    user = models.ForeignKey('users.User', on_delete=models.CASCADE)
    media = models.ForeignKey('Media', on_delete=models.CASCADE, related_name='permissions')
    permission = models.CharField(max_length=20, choices=PERMISSION_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'media')

    def __str__(self):
        return f"{self.user.username} - {self.media.title} ({self.permission})"


@receiver(post_save, sender=Media)
def media_save(sender, instance, created, **kwargs):
    # media_file path is not set correctly until mode is saved
    # post_save signal will take care of calling a few functions
    # once model is saved
    # SOS: do not put anything here, as if more logic is added,
    # we have to disconnect signal to avoid infinite recursion
    if not instance.friendly_token:
        return False

    if created:
        from ..methods import notify_users

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
