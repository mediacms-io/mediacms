import logging

from django.db import models
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .utils import validate_rating

logger = logging.getLogger(__name__)


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
        return f"{self.title}"


class Rating(models.Model):
    """User Rating"""

    add_date = models.DateTimeField(auto_now_add=True)

    media = models.ForeignKey("Media", on_delete=models.CASCADE, related_name="ratings")

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
        return f"{self.user.username}, rate for {self.media.title} for category {self.rating_category.title}"


@receiver(post_save, sender=Rating)
def rating_save(sender, instance, created, **kwargs):
    """Log rating creation and updates"""
    if created:
        logger.info(
            "Rating created - rating_id=%s, user_id=%s, username=%s, media_friendly_token=%s, rating_category_id=%s, rating_category_title=%s, score=%s",
            instance.id,
            instance.user.id if instance.user else None,
            instance.user.username if instance.user else None,
            instance.media.friendly_token if instance.media else None,
            instance.rating_category.id if instance.rating_category else None,
            instance.rating_category.title if instance.rating_category else None,
            instance.score,
        )
    else:
        logger.debug(
            "Rating updated - rating_id=%s, user_id=%s, media_friendly_token=%s, score=%s",
            instance.id,
            instance.user.id if instance.user else None,
            instance.media.friendly_token if instance.media else None,
            instance.score,
        )


@receiver(post_delete, sender=Rating)
def rating_delete(sender, instance, **kwargs):
    """Log rating deletion"""
    logger.info(
        "Rating deleted - rating_id=%s, user_id=%s, username=%s, media_friendly_token=%s, rating_category_title=%s, score=%s",
        instance.id,
        instance.user.id if instance.user else None,
        instance.user.username if instance.user else None,
        instance.media.friendly_token if instance.media else None,
        instance.rating_category.title if instance.rating_category else None,
        instance.score,
    )


@receiver(post_save, sender=RatingCategory)
def ratingcategory_save(sender, instance, created, **kwargs):
    """Log rating category creation and updates"""
    if created:
        logger.info(
            "Rating category created - rating_category_id=%s, title=%s, enabled=%s",
            instance.id,
            instance.title,
            instance.enabled,
        )
    else:
        logger.debug(
            "Rating category updated - rating_category_id=%s, title=%s, enabled=%s",
            instance.id,
            instance.title,
            instance.enabled,
        )


@receiver(post_delete, sender=RatingCategory)
def ratingcategory_delete(sender, instance, **kwargs):
    """Log rating category deletion"""
    logger.info(
        "Rating category deleted - rating_category_id=%s, title=%s",
        instance.id,
        instance.title,
    )
