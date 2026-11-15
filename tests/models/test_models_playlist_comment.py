from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.db import IntegrityError
from django.test import TestCase, override_settings

from actions.models import MediaAction
from files import helpers
from files.models import (
    Comment,
    License,
    Media,
    Page,
    Playlist,
    PlaylistMedia,
    Rating,
    RatingCategory,
    TinyMCEMedia,
    validate_rating,
)
from files.models.utils import (
    category_thumb_path,
    generate_uid,
    original_media_file_path,
    original_thumbnail_file_path,
)
from files.tests import create_account, create_media


def make_user(username, **kwargs):
    return create_account(username=username, email=f"{username}@example.com", **kwargs)


class PlaylistTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("playlist_user")
        cls.first = create_media(cls.user, title="playlist first")
        cls.second = create_media(cls.user, title="playlist second")
        cls.hidden = create_media(cls.user, title="playlist hidden", state="private")

    def make_playlist(self, **fields):
        fields.setdefault("title", "My playlist")
        return Playlist.objects.create(user=self.user, **fields)

    def test_save_strips_html_truncates_and_assigns_a_token(self):
        playlist = self.make_playlist(title="<b>" + "p" * 120 + "</b>", description="<i>desc</i>")
        self.assertEqual(playlist.title, "p" * 100)
        self.assertEqual(playlist.description, "desc")
        self.assertTrue(playlist.friendly_token)
        self.assertEqual(str(playlist), "p" * 100)

    def test_token_is_kept_on_later_saves(self):
        playlist = self.make_playlist()
        token = playlist.friendly_token
        playlist.title = "Renamed"
        playlist.save()
        self.assertEqual(Playlist.objects.get(pk=playlist.pk).friendly_token, token)

    def test_urls_use_the_friendly_token(self):
        playlist = self.make_playlist()
        self.assertEqual(playlist.url, f"/playlists/{playlist.friendly_token}")
        self.assertEqual(playlist.api_url, f"/api/v1/playlists/{playlist.friendly_token}")

    def test_media_count_includes_only_listable_media(self):
        playlist = self.make_playlist()
        for media in [self.first, self.second, self.hidden]:
            PlaylistMedia.objects.create(playlist=playlist, media=media)
        self.assertEqual(playlist.media_count, 2)

    def test_removing_media_lowers_the_count(self):
        playlist = self.make_playlist()
        PlaylistMedia.objects.create(playlist=playlist, media=self.first)
        PlaylistMedia.objects.create(playlist=playlist, media=self.second)

        PlaylistMedia.objects.filter(playlist=playlist, media=self.first).delete()

        self.assertEqual(playlist.media_count, 1)
        self.assertEqual(list(playlist.media.all()), [self.second])

    def test_set_ordering_reorders_media(self):
        playlist = self.make_playlist()
        PlaylistMedia.objects.create(playlist=playlist, media=self.first, ordering=1)
        PlaylistMedia.objects.create(playlist=playlist, media=self.second, ordering=2)

        self.assertTrue(playlist.set_ordering(self.first, 3))

        self.assertEqual([pm.media for pm in playlist.playlistmedia_set.all()], [self.second, self.first])

    def test_set_ordering_rejects_invalid_values_and_foreign_media(self):
        playlist = self.make_playlist()
        PlaylistMedia.objects.create(playlist=playlist, media=self.first)

        self.assertFalse(playlist.set_ordering(self.second, 2))
        self.assertFalse(playlist.set_ordering(self.first, 0))
        self.assertFalse(playlist.set_ordering(self.first, "2"))
        self.assertEqual(playlist.playlistmedia_set.get().ordering, 1)

    def test_thumbnail_comes_from_the_first_listable_media(self):
        playlist = self.make_playlist()
        self.assertIsNone(playlist.thumbnail_url)

        PlaylistMedia.objects.create(playlist=playlist, media=self.hidden, ordering=1)
        self.assertIsNone(playlist.thumbnail_url)

        PlaylistMedia.objects.create(playlist=playlist, media=self.second, ordering=2)
        self.assertEqual(playlist.thumbnail_url, helpers.url_from_path(self.second.thumbnail.path))

    def test_user_thumbnail_is_the_owners_logo(self):
        playlist = self.make_playlist()
        self.assertEqual(playlist.user_thumbnail_url(), helpers.url_from_path(self.user.logo.path))
        self.user.logo = None
        self.assertIsNone(playlist.user_thumbnail_url())

    def test_deleting_media_removes_it_from_playlists(self):
        playlist = self.make_playlist()
        media = create_media(self.user, title="playlist doomed")
        PlaylistMedia.objects.create(playlist=playlist, media=media)
        media.delete()
        self.assertFalse(playlist.playlistmedia_set.exists())


class CommentTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("comment_model_user")
        cls.media = create_media(cls.user, title="commented")

    def comment(self, text="hello", **fields):
        return Comment.objects.create(media=self.media, user=self.user, text=text, **fields)

    def test_html_is_stripped_from_the_text(self):
        self.assertEqual(self.comment("<b>nice</b> <script>x()</script>video").text, "nice x()video")

    @override_settings(MAX_CHARS_FOR_COMMENT=10)
    def test_text_is_truncated_to_the_configured_length(self):
        self.assertEqual(self.comment("abcdefghijklmnop").text, "abcdefghij")

    def test_replies_form_a_tree(self):
        root = self.comment("root")
        reply = self.comment("reply", parent=root)
        nested = self.comment("nested", parent=reply)
        root.refresh_from_db()

        self.assertEqual(nested.level, 2)
        self.assertEqual(list(root.get_descendants()), [reply, nested])
        self.assertEqual(list(nested.get_ancestors()), [root, reply])
        self.assertEqual(list(root.children.all()), [reply])

    def test_deleting_a_comment_deletes_its_replies(self):
        root = self.comment("root")
        self.comment("reply", parent=root)
        root.delete()
        self.assertFalse(Comment.objects.filter(media=self.media).exists())

    def test_urls_and_str(self):
        comment = self.comment()
        self.assertEqual(comment.get_absolute_url(), f"/view?m={self.media.friendly_token}")
        self.assertEqual(comment.media_url, comment.get_absolute_url())
        self.assertEqual(str(comment), "On commented by comment_model_user")


class RatingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("rating_model_user")
        cls.media = create_media(cls.user, title="rated media")
        cls.category = RatingCategory.objects.create(title="Overall")

    def test_scores_from_zero_to_five_are_valid(self):
        for score in range(0, 6):
            validate_rating(score)

    def test_scores_outside_the_range_are_rejected(self):
        for score in [-1, 6]:
            with self.assertRaises(ValidationError):
                validate_rating(score)
        rating = Rating(user=self.user, media=self.media, rating_category=self.category, score=9)
        with self.assertRaises(ValidationError):
            rating.full_clean()

    def test_a_user_rates_a_media_once_per_category(self):
        Rating.objects.create(user=self.user, media=self.media, rating_category=self.category, score=3)
        with self.assertRaises(IntegrityError):
            Rating.objects.create(user=self.user, media=self.media, rating_category=self.category, score=4)

    def test_str(self):
        rating = Rating.objects.create(user=self.user, media=self.media, rating_category=self.category, score=3)
        self.assertEqual(str(rating), "rating_model_user, rate for rated media for category Overall")
        self.assertEqual(str(self.category), "Overall")


class SmallModelTests(TestCase):
    def test_license_str(self):
        self.assertEqual(str(License.objects.create(title="CC-BY")), "CC-BY")

    def test_page_str_and_url(self):
        page = Page.objects.create(slug="terms-of-use", title="Terms")
        self.assertEqual(str(page), "Terms")
        self.assertEqual(page.get_absolute_url(), "/terms-of-use")

    def test_tinymce_media_str_and_url(self):
        item = TinyMCEMedia(file_type="image", original_filename="pic.png")
        item.file.save("pic.png", ContentFile(b"x"), save=False)
        item.save()
        self.assertEqual(str(item), "pic.png (image)")
        self.assertEqual(item.url, item.file.url)

    def test_generate_uid_is_random_16_chars(self):
        self.assertEqual(len(generate_uid()), 16)
        self.assertNotEqual(generate_uid(), generate_uid())

    def test_upload_paths_are_per_user(self):
        user = make_user("paths_user")
        media = Media(user=user)
        self.assertEqual(original_media_file_path(media, "dir/clip.mp4"), f"original/user/paths_user/{media.uid.hex}.clip.mp4")
        self.assertEqual(original_thumbnail_file_path(media, "thumb.jpg"), "original//thumbnails/user/paths_user/thumb.jpg")

    def test_category_thumbnail_path_uses_the_uid(self):
        category = type("CategoryStub", (), {"uid": "abc123"})()
        self.assertEqual(category_thumb_path(category, "x/pic.jpg"), "original/categories/abc123.pic.jpg")


class MediaActionModelTests(TestCase):
    def test_actions_are_stored_per_user_or_session(self):
        user = make_user("action_model_user")
        media = create_media(user, title="action model media")
        by_user = MediaAction.objects.create(user=user, media=media, action="like")
        by_session = MediaAction.objects.create(session_key="abc", media=media, action="report", extra_info="spam")

        self.assertEqual(str(by_user), "like")
        self.assertEqual(list(user.useractions.all()), [by_user])
        self.assertCountEqual(media.mediaactions.all(), [by_user, by_session])
        self.assertIsNotNone(by_session.action_date)

    def test_default_action_is_watch(self):
        user = make_user("action_default_user")
        media = create_media(user, title="action default media")
        self.assertEqual(MediaAction.objects.create(user=user, media=media).action, "watch")
