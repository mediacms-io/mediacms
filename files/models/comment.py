import logging
import uuid

from django.conf import settings
from django.db import models
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.urls import reverse
from django.utils.html import strip_tags
from mptt.models import MPTTModel, TreeForeignKey

logger = logging.getLogger(__name__)


class Comment(MPTTModel):
    """Comments model"""

    add_date = models.DateTimeField(auto_now_add=True)

    media = models.ForeignKey("Media", on_delete=models.CASCADE, db_index=True, related_name="comments")

    parent = TreeForeignKey("self", on_delete=models.CASCADE, null=True, blank=True, related_name="children")

    text = models.TextField(help_text="text")

    uid = models.UUIDField(unique=True, default=uuid.uuid4)

    user = models.ForeignKey("users.User", on_delete=models.CASCADE, db_index=True)

    class MPTTMeta:
        order_insertion_by = ["add_date"]

    def __str__(self):
        return f"On {self.media.title} by {self.user.username}"

    def save(self, *args, **kwargs):
        strip_text_items = ["text"]
        for item in strip_text_items:
            setattr(self, item, strip_tags(getattr(self, item, None)))

        if self.text:
            self.text = self.text[: settings.MAX_CHARS_FOR_COMMENT]

        super(Comment, self).save(*args, **kwargs)

    def get_absolute_url(self):
        return f"{reverse('get_media')}?m={self.media.friendly_token}"

    @property
    def media_url(self):
        return self.get_absolute_url()


@receiver(post_save, sender=Comment)
def comment_save(sender, instance, created, **kwargs):
    """Log comment creation and updates"""
    if created:
        logger.info(
            "Comment created - comment_id=%s, user_id=%s, username=%s, media_friendly_token=%s, has_parent=%s",
            instance.id,
            instance.user.id if instance.user else None,
            instance.user.username if instance.user else None,
            instance.media.friendly_token if instance.media else None,
            bool(instance.parent),
        )
    else:
        logger.debug(
            "Comment updated - comment_id=%s, user_id=%s, media_friendly_token=%s",
            instance.id,
            instance.user.id if instance.user else None,
            instance.media.friendly_token if instance.media else None,
        )


@receiver(post_delete, sender=Comment)
def comment_delete(sender, instance, **kwargs):
    """Log comment deletion"""
    logger.info(
        "Comment deleted - comment_id=%s, user_id=%s, username=%s, media_friendly_token=%s",
        instance.id,
        instance.user.id if instance.user else None,
        instance.user.username if instance.user else None,
        instance.media.friendly_token if instance.media else None,
    )
