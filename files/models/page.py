import logging

from django.db import models
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.urls import reverse

logger = logging.getLogger(__name__)


class Page(models.Model):
    slug = models.SlugField(max_length=200, unique=True)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    add_date = models.DateTimeField(auto_now_add=True)
    edit_date = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    def get_absolute_url(self):
        return reverse("get_page", args=[str(self.slug)])


class TinyMCEMedia(models.Model):
    file = models.FileField(upload_to='tinymce_media/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    file_type = models.CharField(
        max_length=10,
        choices=(
            ('image', 'Image'),
            ('media', 'Media'),
        ),
    )
    original_filename = models.CharField(max_length=255)
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, null=True, blank=True)

    class Meta:
        verbose_name = 'TinyMCE Media'
        verbose_name_plural = 'TinyMCE Media'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.original_filename} ({self.file_type})"

    @property
    def url(self):
        return self.file.url


@receiver(post_save, sender=Page)
def page_save(sender, instance, created, **kwargs):
    """Log page creation and updates"""
    if created:
        logger.info(
            "Page created - page_id=%s, slug=%s, title=%s",
            instance.id,
            instance.slug,
            instance.title,
        )
    else:
        logger.debug(
            "Page updated - page_id=%s, slug=%s, title=%s",
            instance.id,
            instance.slug,
            instance.title,
        )


@receiver(post_delete, sender=Page)
def page_delete(sender, instance, **kwargs):
    """Log page deletion"""
    logger.info(
        "Page deleted - page_id=%s, slug=%s, title=%s",
        instance.id,
        instance.slug,
        instance.title,
    )


@receiver(post_save, sender=TinyMCEMedia)
def tinymcemedia_save(sender, instance, created, **kwargs):
    """Log TinyMCE media file upload"""
    if created:
        logger.info(
            "TinyMCE media uploaded - file_id=%s, original_filename=%s, file_type=%s, user_id=%s",
            instance.id,
            instance.original_filename,
            instance.file_type,
            instance.user.id if instance.user else None,
        )
    else:
        logger.debug(
            "TinyMCE media updated - file_id=%s, original_filename=%s, file_type=%s",
            instance.id,
            instance.original_filename,
            instance.file_type,
        )


@receiver(post_delete, sender=TinyMCEMedia)
def tinymcemedia_delete(sender, instance, **kwargs):
    """Log TinyMCE media file deletion"""
    logger.info(
        "TinyMCE media deleted - file_id=%s, original_filename=%s, file_type=%s, user_id=%s",
        instance.id,
        instance.original_filename,
        instance.file_type,
        instance.user.id if instance.user else None,
    )
