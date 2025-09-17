import uuid

from django.db import models
from django.urls import reverse
from django.utils.html import strip_tags

from .. import helpers


class Playlist(models.Model):
    """Playlists model"""

    add_date = models.DateTimeField(auto_now_add=True, db_index=True)

    description = models.TextField(blank=True, help_text="description")

    friendly_token = models.CharField(blank=True, max_length=12, db_index=True)

    media = models.ManyToManyField("Media", through="playlistmedia", blank=True)

    title = models.CharField(max_length=100, db_index=True)

    uid = models.UUIDField(unique=True, default=uuid.uuid4)

    user = models.ForeignKey("users.User", on_delete=models.CASCADE, db_index=True, related_name="playlists")

    def __str__(self):
        return self.title

    @property
    def media_count(self):
        return self.media.filter(listable=True).count()

    def get_absolute_url(self, api=False):
        if api:
            return reverse("api_get_playlist", kwargs={"friendly_token": self.friendly_token})
        else:
            return reverse("get_playlist", kwargs={"friendly_token": self.friendly_token})

    @property
    def url(self):
        return self.get_absolute_url()

    @property
    def api_url(self):
        return self.get_absolute_url(api=True)

    def user_thumbnail_url(self):
        if self.user.logo:
            return helpers.url_from_path(self.user.logo.path)
        return None

    def set_ordering(self, media, ordering):
        if media not in self.media.all():
            return False
        pm = PlaylistMedia.objects.filter(playlist=self, media=media).first()
        if pm and isinstance(ordering, int) and 0 < ordering:
            pm.ordering = ordering
            pm.save()
            return True
        return False

    def save(self, *args, **kwargs):
        strip_text_items = ["title", "description"]
        for item in strip_text_items:
            setattr(self, item, strip_tags(getattr(self, item, None)))
        self.title = self.title[:100]

        if not self.friendly_token:
            while True:
                friendly_token = helpers.produce_friendly_token()
                if not Playlist.objects.filter(friendly_token=friendly_token):
                    self.friendly_token = friendly_token
                    break
        super(Playlist, self).save(*args, **kwargs)

    @property
    def thumbnail_url(self):
        pm = self.playlistmedia_set.filter(media__listable=True).first()
        if pm and pm.media.thumbnail:
            return helpers.url_from_path(pm.media.thumbnail.path)
        return None


class PlaylistMedia(models.Model):
    """Helper model to store playlist specific media"""

    action_date = models.DateTimeField(auto_now=True)

    media = models.ForeignKey("Media", on_delete=models.CASCADE)

    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE)

    ordering = models.IntegerField(default=1)

    class Meta:
        ordering = ["ordering", "-action_date"]
