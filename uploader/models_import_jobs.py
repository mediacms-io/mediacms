from django.db import models
from django.conf import settings

class ImportJob(models.Model):
    STATUS_CHOICES = (
        ("queued", "Queued"),
        ("running", "Running"),
        ("success", "Success"),
        ("failed", "Failed"),
    )

    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )

    source_folder = models.TextField()
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="queued")
    output = models.TextField(blank=True, default="")
    error = models.TextField(blank=True, default="")

    output_file = models.CharField(max_length=1024, blank=True, default="")

    def __str__(self):
        return f"ImportJob#{self.id} {self.status} {self.source_folder}"

