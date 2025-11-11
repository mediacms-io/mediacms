from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .. import helpers


class VideoChapterData(models.Model):
    data = models.JSONField(null=False, blank=False, help_text="Chapter data")
    media = models.ForeignKey('Media', on_delete=models.CASCADE, related_name='chapters')

    class Meta:
        unique_together = ['media']

    @property
    def chapter_data(self):
        # ensure response is consistent
        data = []
        if self.data and isinstance(self.data, list):
            for item in self.data:
                if item.get("startTime") and item.get("endTime") and item.get("chapterTitle"):
                    chapter_item = {
                        'startTime': item.get("startTime"),
                        'endTime': item.get("endTime"),
                        'chapterTitle': item.get("chapterTitle"),
                    }
                    data.append(chapter_item)
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

    class Meta:
        verbose_name = "Trim Request"
        verbose_name_plural = "Trim Requests"

    def __str__(self):
        return f"Trim request for {self.media.title} ({self.status})"


@receiver(post_delete, sender=VideoChapterData)
def videochapterdata_delete(sender, instance, **kwargs):
    helpers.rm_dir(instance.media.video_chapters_folder)
