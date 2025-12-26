import logging

from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver

from files.models import Media
from users.models import User

logger = logging.getLogger(__name__)

USER_MEDIA_ACTIONS = (
    ("like", "Like"),
    ("dislike", "Dislike"),
    ("watch", "Watch"),
    ("report", "Report"),
    ("rate", "Rate"),
)


class MediaAction(models.Model):
    """Stores different user actions"""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        db_index=True,
        blank=True,
        null=True,
        related_name="useractions",
    )
    session_key = models.CharField(
        max_length=33,
        db_index=True,
        blank=True,
        null=True,
        help_text="for not logged in users",
    )

    action = models.CharField(max_length=20, choices=USER_MEDIA_ACTIONS, default="watch")
    # keeps extra info, eg on report action, why it is reported
    extra_info = models.TextField(blank=True, null=True)

    media = models.ForeignKey(Media, on_delete=models.CASCADE, related_name="mediaactions")
    action_date = models.DateTimeField(auto_now_add=True)
    remote_ip = models.CharField(max_length=40, blank=True, null=True)

    def save(self, *args, **kwargs):
        super(MediaAction, self).save(*args, **kwargs)

    def __str__(self):
        return self.action

    class Meta:
        indexes = [
            models.Index(fields=["user", "action", "-action_date"]),
            models.Index(fields=["session_key", "action"]),
        ]


@receiver(post_save, sender=MediaAction)
def mediaaction_save(sender, instance, created, **kwargs):
    """Log user action creation (like, dislike, watch, report, rate)"""
    if created:
        logger.info(
            "User action - action_id=%s, action=%s, user_id=%s, username=%s, media_friendly_token=%s, session_key=%s, remote_ip=%s",
            instance.id,
            instance.action,
            instance.user.id if instance.user else None,
            instance.user.username if instance.user else None,
            instance.media.friendly_token if instance.media else None,
            instance.session_key if instance.session_key else None,
            instance.remote_ip if instance.remote_ip else None,
        )
