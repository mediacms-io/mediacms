import xml.etree.ElementTree as ET
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from files.models import Category, Tag
from files.tests import create_account, create_media

MRSS = "{http://search.yahoo.com/mrss/}"


def parse_feed(response):
    return ET.fromstring(response.content).find("channel")


def item_titles(response):
    return [item.findtext("title") for item in parse_feed(response).findall("item")]


class LatestMediaFeedTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = create_account()
        now = timezone.now()
        cls.older = create_media(cls.user, title="feed older public", description="older one", add_date=now - timedelta(days=2))
        cls.newer = create_media(cls.user, title="feed newer public", description="newer one", add_date=now - timedelta(days=1))
        cls.private = create_media(cls.user, title="feed private", state="private")
        cls.unlisted = create_media(cls.user, title="feed unlisted", state="unlisted")
        cls.unreviewed = create_media(cls.user, title="feed unreviewed", is_reviewed=False)

    def test_feed_is_media_rss(self):
        response = self.client.get("/rss/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response["Content-Type"].startswith("application/rss+xml"))
        root = ET.fromstring(response.content)
        self.assertEqual(root.tag, "rss")
        self.assertIn(b'xmlns:media="http://search.yahoo.com/mrss/"', response.content)
        self.assertEqual(root.find("channel").findtext("title"), "Latest Media")

    def test_only_listable_media_appear_newest_first(self):
        self.assertEqual(item_titles(self.client.get("/rss/")), ["feed newer public", "feed older public"])

    def test_item_carries_link_author_and_media_elements(self):
        item = parse_feed(self.client.get("/rss/")).find("item")
        self.assertTrue(item.findtext("link").endswith(f"/view?m={self.newer.friendly_token}"))
        self.assertEqual(item.findtext("description"), "newer one")
        self.assertEqual(item.findtext(f"{MRSS}title"), "feed newer public")
        self.assertEqual(item.findtext(f"{MRSS}description"), "newer one")
        content = item.find(f"{MRSS}content")
        self.assertTrue(content.get("url").endswith(self.newer.get_absolute_url()))
        self.assertEqual(content.get("width"), "720")
        thumbnail = item.find(f"{MRSS}thumbnail")
        self.assertTrue(thumbnail.get("url").endswith(self.newer.poster_url))
        self.assertEqual(thumbnail.get("width"), "720")
        self.assertIn(self.user.username, item.findtext("author") or item.findtext("{http://purl.org/dc/elements/1.1/}creator"))

    def test_feed_is_capped_at_twenty_items(self):
        base = timezone.now() - timedelta(days=10)
        for index in range(21):
            create_media(self.user, title=f"feed bulk {index}", add_date=base + timedelta(minutes=index))
        titles = item_titles(self.client.get("/rss/"))
        self.assertEqual(len(titles), 20)
        self.assertNotIn("feed bulk 0", titles)


class SearchFeedTest(TestCase):
    fixtures = ["fixtures/categories.json"]

    @classmethod
    def setUpTestData(cls):
        cls.user = create_account()
        cls.art = Category.objects.get(title="Art")
        cls.music = Category.objects.get(title="Music")
        cls.tag = Tag.objects.create(title="feedtag")
        cls.painting = create_media(cls.user, title="watercolour painting", category=[cls.art], tags=[cls.tag])
        cls.song = create_media(cls.user, title="guitar song", category=[cls.music])
        cls.private_painting = create_media(cls.user, title="secret watercolour", category=[cls.art], tags=[cls.tag], state="private")

    def search(self, **params):
        response = self.client.get("/rss/search", params)
        self.assertEqual(response.status_code, 200)
        return set(item_titles(response))

    def test_category_filter_by_uid(self):
        self.assertEqual(self.search(c=self.art.uid), {"watercolour painting"})

    def test_category_filter_falls_back_to_the_title(self):
        self.assertEqual(self.search(c="Music"), {"guitar song"})

    def test_tag_filter(self):
        self.assertEqual(self.search(t="feedtag"), {"watercolour painting"})

    def test_text_query_matches_prefixes_and_skips_private_media(self):
        self.assertEqual(self.search(q="watercol"), {"watercolour painting"})
        self.assertEqual(self.search(q="guitar song"), {"guitar song"})

    def test_query_made_only_of_stop_words_returns_all_listable_media(self):
        self.assertEqual(self.search(q="the"), {"watercolour painting", "guitar song"})

    def test_unknown_filters_return_nothing(self):
        self.assertEqual(self.search(c="no-such-category"), set())
        self.assertEqual(self.search(t="no-such-tag"), set())
        self.assertEqual(self.search(q="zzzqqq"), set())

    def test_private_media_never_appear(self):
        for params in [{}, {"c": self.art.uid}, {"t": "feedtag"}, {"q": "secret"}]:
            with self.subTest(params=params):
                self.assertNotIn("secret watercolour", self.search(**params))

    def test_feed_links_back_to_the_search_feed(self):
        channel = parse_feed(self.client.get("/rss/search", {"q": "guitar"}))
        self.assertTrue(channel.findtext("link").endswith("/rss/search"))
