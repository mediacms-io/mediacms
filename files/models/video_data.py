from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .. import helpers


class VideoChapterData(models.Model):
    data = models.JSONField(null=False, blank=False, help_text="Chapter data")
    media = models.ForeignKey('Media', on_delete=models.CASCADE, related_name='chapters')

    class Meta:
        unique_together = ['media']

    def save(self, *args, **kwargs):
        from .. import tasks

        is_new = self.pk is None
        if is_new or (not is_new and self._check_data_changed()):
            super().save(*args, **kwargs)
            tasks.produce_video_chapters.delay(self.pk)
        else:
            super().save(*args, **kwargs)

    def _check_data_changed(self):
        if self.pk:
            old_instance = VideoChapterData.objects.get(pk=self.pk)
            return old_instance.data != self.data
        return False

    @property
    def chapter_data(self):
        # ensure response is consistent
        data = []
        for item in self.data:
            if item.get("start") and item.get("title"):
                thumbnail = item.get("thumbnail")
                if thumbnail:
                    thumbnail = helpers.url_from_path(thumbnail)
                else:
                    thumbnail = "static/images/chapter_default.jpg"
                data.append(
                    {
                        "start": item.get("start"),
                        "title": item.get("title"),
                        "thumbnail": thumbnail,
                    }
                )
        return data


class VideoTrimRequest(models.Model):
    """Model to handle video trimming requests"""

    VIDEO_TRIM_STATUS = (
        ("initial", "Initial"),
        ("running", "Running"),
        ("success", "Success"),
        ("fail", "Fail"),
    )

    VIDEO_ACTION_CHOICES = (
        ("replace", "Replace Original"),
        ("save_new", "Save as New"),
        ("create_segments", "Create Segments"),
    )

    TRIM_STYLE_CHOICES = (
        ("no_encoding", "No Encoding"),
        ("precise", "Precise"),
    )

    media = models.ForeignKey('Media', on_delete=models.CASCADE, related_name='trim_requests')
    status = models.CharField(max_length=20, choices=VIDEO_TRIM_STATUS, default="initial")
    add_date = models.DateTimeField(auto_now_add=True)
    video_action = models.CharField(max_length=20, choices=VIDEO_ACTION_CHOICES)
    media_trim_style = models.CharField(max_length=20, choices=TRIM_STYLE_CHOICES, default="no_encoding")
    timestamps = models.JSONField(null=False, blank=False, help_text="Timestamps for trimming")

    def __str__(self):
        return f"Trim request for {self.media.title} ({self.status})"


@receiver(post_delete, sender=VideoChapterData)
def videochapterdata_delete(sender, instance, **kwargs):
    helpers.rm_dir(instance.media.video_chapters_folder)
