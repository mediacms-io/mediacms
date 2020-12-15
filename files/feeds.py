from django.contrib.syndication.views import Feed
from django.urls import reverse
from django.db.models import Q

from .models import Media


class RssMediaFeed(Feed):
    title = "Latest Media"
    link = "/media"
    description = "Latest Media RSS feed"

    def items(self):
        basic_query = Q(listable=True)
        media = Media.objects.filter(basic_query).order_by("-add_date")
        media = media.prefetch_related("user")
        return media[:40]

    def item_title(self, item):
        return item.title

    def item_description(self, item):
        return item.description

    def item_link(self, item):
        return reverse("get_media") + "?m={0}".format(item.friendly_token)
