import os
import tempfile

import pysubs2
from django.conf import settings
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.urls import reverse

from .. import helpers
from .utils import MEDIA_ENCODING_STATUS, subtitles_file_path


class Language(models.Model):
    """Language model
    to be used with Subtitles
    """

    code = models.CharField(max_length=30, help_text="language code")

    title = models.CharField(max_length=100, help_text="language code")

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.code}-{self.title}"


class Subtitle(models.Model):
    """Subtitles model"""

    language = models.ForeignKey(Language, on_delete=models.CASCADE)

    media = models.ForeignKey("Media", on_delete=models.CASCADE, related_name="subtitles")

    subtitle_file = models.FileField(
        "Subtitle/CC file",
        help_text="File has to be WebVTT format",
        upload_to=subtitles_file_path,
        max_length=500,
    )

    user = models.ForeignKey("users.User", on_delete=models.CASCADE)

    class Meta:
        verbose_name = "Caption"
        verbose_name_plural = "Captions"
        ordering = ["language__title"]

    def __str__(self):
        return f"{self.media.title}-{self.language.title}"

    def get_absolute_url(self):
        return f"{reverse('edit_subtitle')}?id={self.id}"

    @property
    def url(self):
        return self.get_absolute_url()

    def convert_to_srt(self):
        input_path = self.subtitle_file.path
        with tempfile.TemporaryDirectory(dir=settings.TEMP_DIRECTORY) as tmpdirname:
            pysub = settings.PYSUBS_COMMAND

            cmd = [pysub, input_path, "--to", "vtt", "-o", tmpdirname]
            stdout = helpers.run_command(cmd)

            list_of_files = os.listdir(tmpdirname)
            if list_of_files:
                subtitles_file = os.path.join(tmpdirname, list_of_files[0])
                cmd = ["cp", subtitles_file, input_path]
                stdout = helpers.run_command(cmd)  # noqa
            else:
                raise Exception("Could not convert to srt")
        return True

    @property
    def subtitle_text(self):
        sub = pysubs2.load(self.subtitle_file.path, encoding="utf-8")
        text = ' '.join([line.text for line in sub])
        text = text.replace("\\N", " ")
        text = text.replace("-", " ")
        text = text.replace(".", " ")
        text = text.replace("  ", " ")

        return text


class TranscriptionRequest(models.Model):
    # Whisper transcription request
    media = models.ForeignKey("Media", on_delete=models.CASCADE, related_name="transcriptionrequests")
    add_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=MEDIA_ENCODING_STATUS, default="pending", db_index=True)
    translate_to_english = models.BooleanField(default=False)
    logs = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name = "Caption Request"
        verbose_name_plural = "Caption Requests"

    def __str__(self):
        return f"Transcription request for {self.media.title} - {self.status}"


@receiver(post_save, sender=Subtitle)
def subtitle_save(sender, instance, created, **kwargs):
    from .. import tasks

    tasks.update_search_vector.apply_async(
        args=[instance.media.friendly_token],
        countdown=10,
    )
