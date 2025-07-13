from django.db import models

from .utils import validate_rating


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
