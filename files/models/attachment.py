from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver
from .media import Media

class Attachment(models.Model):
    """Attachment model for files linked to a video (Media)"""
    media = models.ForeignKey(Media, on_delete=models.CASCADE, related_name="attachments")
    name = models.CharField(max_length=255, help_text="Naam van het bestand")
    file = models.FileField(upload_to="attachments/%Y/%m/%d/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.file.name})"

    def get_file_size(self):
        """Return human-readable file size"""
        if not self.file:
            return "0 KB"
        
        size = self.file.size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"


@receiver(post_delete, sender=Attachment)
def attachment_file_delete(sender, instance, **kwargs):
    """
    Deletes file from filesystem
    when corresponding `Attachment` object is deleted.
    """
    if instance.file:
        import os
        from django.core.files.storage import default_storage
        
        # Delete the file from storage
        if default_storage.exists(instance.file.name):
            default_storage.delete(instance.file.name)
