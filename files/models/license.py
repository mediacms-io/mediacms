from django.db import models


class License(models.Model):
    """A Base license model to be used in Media"""

    title = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.title
