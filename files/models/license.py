import logging

from django.db import models
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


class License(models.Model):
    """A Base license model to be used in Media"""

    title = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.title


@receiver(post_save, sender=License)
def license_save(sender, instance, created, **kwargs):
    """Log license creation and updates"""
    if created:
        logger.info(
            "License created - license_id=%s, title=%s",
            instance.id,
            instance.title,
        )
    else:
        logger.debug(
            "License updated - license_id=%s, title=%s",
            instance.id,
            instance.title,
        )


@receiver(post_delete, sender=License)
def license_delete(sender, instance, **kwargs):
    """Log license deletion"""
    logger.info(
        "License deleted - license_id=%s, title=%s",
        instance.id,
        instance.title,
    )
