from django.contrib.postgres.search import SearchQuery
from django.core.files.base import ContentFile
from django.templatetags.static import static
from django.test import TestCase, override_settings

from files import helpers
from files.models import Category, Language, Media, Subtitle, Tag
from files.models.category import DEFAULT_CATEGORY_THUMBNAIL
from files.tests import create_account, create_media, fixture_path
from files.tests.media_utils import IMAGE

VTT = b"WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nThe quick zebrafinch\n\n00:00:02.000 --> 00:00:04.000\nsings-loudly.\n"


def make_user(username, **kwargs):
    return create_account(username=username, email=f"{username}@example.com", **kwargs)


def search(term):
    return Media.objects.filter(search=SearchQuery(f"{term}:*", search_type="raw"))


class SearchVectorTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("searcher_uploader", name="Quetzal Person")

    def test_media_is_found_by_title_description_and_owner(self):
        media = create_media(self.user, title="Aardvark adventures", description="a story about pangolins")
        for term in ["aardvark", "pangolins", "searcher_uploader", "quetzal", media.friendly_token.lower()]:
            self.assertIn(media, search(term), term)

    def test_media_is_not_found_by_unrelated_words(self):
        create_media(self.user, title="Aardvark adventures")
        self.assertFalse(search("hippopotamus").exists())

    def test_stop_words_are_not_indexed(self):
        media = create_media(self.user, title="the ocelot")
        self.assertIn(media, search("ocelot"))
        self.assertNotIn(media, search("the"))

    def test_adding_a_category_makes_media_searchable_by_it(self):
        category = Category.objects.create(title="Volcanology", description="lava flows")
        media = create_media(self.user, title="eruption footage")
        self.assertNotIn(media, search("volcanology"))

        media.category.add(category)

        self.assertIn(media, search("volcanology"))
        self.assertIn(media, search("lava"))

    def test_removing_a_category_drops_it_from_the_index(self):
        category = Category.objects.create(title="Glaciology")
        media = create_media(self.user, title="ice footage", category=[category])
        self.assertIn(media, search("glaciology"))

        media.category.remove(category)

        self.assertNotIn(media, search("glaciology"))

    def test_tags_are_indexed_when_the_media_is_saved(self):
        media = create_media(self.user, title="birds", tags=[Tag.objects.create(title="kingfisher")])
        media.save()
        self.assertIn(media, search("kingfisher"))

    def test_subtitle_text_is_indexed(self):
        media = create_media(self.user, title="subtitled clip")
        language = Language.objects.create(code="en", title="English")
        subtitle = Subtitle(language=language, media=media, user=self.user)
        subtitle.subtitle_file.save("captions.vtt", ContentFile(VTT), save=False)
        subtitle.save()

        self.assertIn(media, search("zebrafinch"))
        self.assertIn(media, search("loudly"))

    def test_search_operators_in_text_do_not_break_indexing(self):
        media = create_media(self.user, title="what's (this) & that | other!")
        self.assertIn(media, search("whats"))


class CategoryAndUserCountTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("counts_user")

    def test_category_count_follows_added_media(self):
        category = Category.objects.create(title="Counted")
        create_media(self.user, title="count one", category=[category])
        create_media(self.user, title="count two", category=[category])
        category.refresh_from_db()
        self.assertEqual(category.media_count, 2)

    def test_category_count_includes_non_listable_media(self):
        category = Category.objects.create(title="All media counted")
        create_media(self.user, title="hidden counted", state="private", category=[category])
        category.refresh_from_db()
        self.assertEqual(category.media_count, 1)

    def test_tag_count_includes_only_public_reviewed_media(self):
        tag = Tag.objects.create(title="countedtag")
        for title, fields in [("tag public", {}), ("tag private", {"state": "private"}), ("tag unreviewed", {"is_reviewed": False})]:
            create_media(self.user, title=title, tags=[tag], **fields).save()
        tag.refresh_from_db()
        self.assertEqual(tag.media_count, 1)

    def test_user_count_includes_only_listable_media(self):
        create_media(self.user, title="user listable")
        create_media(self.user, title="user private", state="private")
        self.user.refresh_from_db()
        self.assertEqual(self.user.media_count, 1)


class CategoryModelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("category_user")

    def test_html_is_stripped_from_title_and_description(self):
        category = Category.objects.create(title="<b>Science</b>", description="<i>all</i> about it")
        self.assertEqual(category.title, "Science")
        self.assertEqual(category.description, "all about it")
        self.assertEqual(str(category), "Science")

    def test_absolute_url_searches_by_uid(self):
        category = Category.objects.create(title="Linked")
        self.assertEqual(category.get_absolute_url(), f"/search?c={category.uid}")
        self.assertEqual(len(category.uid), 16)

    def test_thumbnail_falls_back_to_the_portal_default(self):
        self.assertEqual(Category.objects.create(title="Empty").thumbnail_url, static(DEFAULT_CATEGORY_THUMBNAIL))

    def test_thumbnail_uses_the_most_viewed_public_media(self):
        category = Category.objects.create(title="With media")
        create_media(self.user, title="less viewed", category=[category])
        popular = create_media(self.user, title="most viewed", category=[category])
        Media.objects.filter(pk=popular.pk).update(views=100)
        category.refresh_from_db()
        self.assertEqual(category.thumbnail_url, popular.thumbnail_url)

    def test_thumbnail_ignores_unlisted_media(self):
        category = Category.objects.create(title="Only unlisted")
        create_media(self.user, title="unlisted only", state="unlisted", category=[category])
        category.refresh_from_db()
        self.assertEqual(category.media_count, 1)
        self.assertEqual(category.thumbnail_url, static(DEFAULT_CATEGORY_THUMBNAIL))

    def test_explicit_listings_thumbnail_wins_over_media(self):
        category = Category.objects.create(title="Explicit", listings_thumbnail="/media/custom.jpg")
        create_media(self.user, title="ignored", category=[category])
        category.refresh_from_db()
        self.assertEqual(category.thumbnail_url, "/media/custom.jpg")

    def test_uploaded_thumbnail_wins_over_everything(self):
        category = Category.objects.create(title="Uploaded", listings_thumbnail="/media/custom.jpg")
        with open(fixture_path(IMAGE), "rb") as fp:
            category.thumbnail.save("thumb.png", ContentFile(fp.read()))
        self.assertEqual(category.thumbnail_url, helpers.url_from_path(category.thumbnail.path))

    def test_turning_off_rbac_clears_the_listings_thumbnail(self):
        category = Category.objects.create(title="Was rbac", is_rbac_category=True, listings_thumbnail="/media/rbac.jpg")
        category.is_rbac_category = False
        category.save(update_fields=["is_rbac_category"])
        category.refresh_from_db()
        self.assertIsNone(category.listings_thumbnail)

    def test_keeping_rbac_keeps_the_listings_thumbnail(self):
        category = Category.objects.create(title="Still rbac", is_rbac_category=True, listings_thumbnail="/media/rbac.jpg")
        category.title = "Still rbac renamed"
        category.save()
        category.refresh_from_db()
        self.assertEqual(category.listings_thumbnail, "/media/rbac.jpg")


class TagModelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("tag_user")

    def test_title_keeps_only_letters_digits_and_single_spaces(self):
        tag = Tag.objects.create(title="  Hello,   World!  #2 ")
        self.assertEqual(tag.title, "Hello World 2")
        self.assertEqual(str(tag), "Hello World 2")

    def test_title_is_truncated_to_100_chars(self):
        self.assertEqual(Tag.objects.create(title="a" * 150).title, "a" * 100)

    def test_absolute_url_searches_by_title(self):
        self.assertEqual(Tag.objects.create(title="music").get_absolute_url(), "/search?t=music")

    def test_thumbnail_uses_listings_thumbnail_then_public_media(self):
        tag = Tag.objects.create(title="thumbtag")
        self.assertIsNone(tag.thumbnail_url)

        media = create_media(self.user, title="tag thumb", tags=[tag])
        self.assertEqual(tag.thumbnail_url, media.thumbnail_url)

        tag.listings_thumbnail = "/media/tag.jpg"
        self.assertEqual(tag.thumbnail_url, "/media/tag.jpg")

    @override_settings(PORTAL_WORKFLOW="private")
    def test_thumbnail_ignores_private_media(self):
        tag = Tag.objects.create(title="privatetag")
        create_media(self.user, title="private tag media", tags=[tag])
        self.assertIsNone(tag.thumbnail_url)
