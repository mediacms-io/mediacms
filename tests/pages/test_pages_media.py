from django.contrib.messages import get_messages
from django.test import TestCase, override_settings

from actions.models import MediaAction
from files.models import Category, Media, MediaPermission
from files.tests import create_account, create_media
from files.tests.media_utils import SMALL_VIDEO
from rbac.models import RBACGroup, RBACMembership


def message_texts(response):
    return [str(message) for message in get_messages(response.wsgi_request)]


class MediaPageAccessTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = create_account()
        cls.other = create_account()
        cls.editor = create_account(is_editor=True)
        cls.shared_editor = create_account()
        cls.shared_viewer = create_account()
        cls.media = create_media(cls.owner, title="media page public image", state="public")
        MediaPermission.objects.create(owner_user=cls.owner, user=cls.shared_editor, media=cls.media, permission="editor")
        MediaPermission.objects.create(owner_user=cls.owner, user=cls.shared_viewer, media=cls.media, permission="viewer")

    def view(self, user=None, token=None):
        if user:
            self.client.force_login(user)
        return self.client.get("/view", {"m": token or self.media.friendly_token})

    def assert_permissions(self, response, edit, delete):
        self.assertEqual(response.context["CAN_EDIT_MEDIA"], edit)
        self.assertEqual(response.context["CAN_DELETE_COMMENTS"], edit)
        self.assertEqual(response.context["CAN_DELETE_MEDIA"], delete)

    def test_anonymous_user_sees_the_media_page_without_edit_rights(self):
        response = self.view()
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "cms/media.html")
        self.assertEqual(response.context["media_object"], self.media)
        self.assertEqual(response.context["media"], self.media.friendly_token)
        self.assert_permissions(response, edit=False, delete=False)
        self.assertContains(response, f'mediaId: "{self.media.friendly_token}"')

    def test_owner_can_edit_and_delete(self):
        self.assert_permissions(self.view(self.owner), edit=True, delete=True)

    def test_other_user_can_neither_edit_nor_delete(self):
        self.assert_permissions(self.view(self.other), edit=False, delete=False)

    def test_mediacms_editor_can_edit_and_delete_any_media(self):
        self.assert_permissions(self.view(self.editor), edit=True, delete=True)

    def test_user_shared_as_editor_can_edit_but_not_delete(self):
        self.assert_permissions(self.view(self.shared_editor), edit=True, delete=False)

    def test_user_shared_as_viewer_gets_no_edit_rights(self):
        self.assert_permissions(self.view(self.shared_viewer), edit=False, delete=False)

    def test_unknown_token_renders_the_page_without_a_media(self):
        response = self.client.get("/view", {"m": "doesnotexist"})
        self.assertTemplateUsed(response, "cms/media.html")
        self.assertIsNone(response.context["media"])
        self.assertNotIn("media_object", response.context)

    def test_viewing_records_a_watch_action_for_the_logged_in_user(self):
        self.view(self.other)
        self.assertTrue(MediaAction.objects.filter(media=self.media, user=self.other, action="watch").exists())

    def test_allowed_media_type_flag_is_passed_to_the_template(self):
        self.assertTrue(self.view().context["is_media_allowed_type"])
        with override_settings(ALLOWED_MEDIA_UPLOAD_TYPES=["video"]):
            response = self.view()
        self.assertFalse(response.context["is_media_allowed_type"])
        self.assertContains(response, "This media type is not supported.")


class MediaPageEncodingMessageTest(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.owner = create_account()
        cls.other = create_account()
        cls.pending = create_media(cls.owner, filename=SMALL_VIDEO, title="pending video", encoding_status="pending")
        cls.running = create_media(cls.owner, filename=SMALL_VIDEO, title="running video", encoding_status="running")

    def test_owner_is_told_that_encoding_has_not_started(self):
        self.client.force_login(self.owner)
        response = self.client.get("/view", {"m": self.pending.friendly_token})
        self.assertIn("Media encoding hasn't started yet. Attempting to show the original video file", message_texts(response))

    def test_owner_is_told_that_encoding_is_running(self):
        self.client.force_login(self.owner)
        response = self.client.get("/view", {"m": self.running.friendly_token})
        self.assertIn("Media encoding is under processing. Attempting to show the original video file", message_texts(response))

    def test_other_users_get_no_encoding_message(self):
        self.client.force_login(self.other)
        response = self.client.get("/view", {"m": self.pending.friendly_token})
        self.assertEqual(message_texts(response), [])

    def test_video_page_carries_video_structured_data(self):
        response = self.client.get("/view", {"m": self.pending.friendly_token})
        self.assertContains(response, '<meta property="og:type" content="video.other">')
        self.assertContains(response, '"@type": "VideoObject"')


class EmbedPageTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.media = create_media(create_account(), title="embedded image")

    def test_embed_without_token_redirects_home(self):
        response = self.client.get("/embed")
        self.assertRedirects(response, "/", fetch_redirect_response=False)

    def test_embed_of_unknown_media_is_404(self):
        response = self.client.get("/embed", {"m": "doesnotexist"})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.content, b"This media no longer exists")

    def test_embed_renders_the_player_page_for_the_media(self):
        response = self.client.get("/embed", {"m": self.media.friendly_token})
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "cms/embed.html")
        self.assertEqual(response.context["media"], self.media.friendly_token)
        self.assertContains(response, 'id="page-embed"')

    def test_embed_page_is_not_wrapped_in_the_portal_sidebar_layout(self):
        response = self.client.get("/embed", {"m": self.media.friendly_token})
        self.assertTemplateNotUsed(response, "base.html")


class MediaListingPagesTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = create_account()
        create_media(cls.user, title="listing pages image")

    def test_listing_pages_render_for_anonymous_users(self):
        pages = {
            "/": "cms/index.html",
            "/featured": "cms/featured-media.html",
            "/latest": "cms/latest-media.html",
            "/recommended": "cms/recommended-media.html",
            "/popular": "cms/recommended-media.html",
            "/categories": "cms/categories.html",
            "/tags": "cms/tags.html",
            "/history": "cms/history.html",
            "/liked": "cms/liked_media.html",
            "/members": "cms/members.html",
            "/search": "cms/search.html",
        }
        for url, template in pages.items():
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)
                self.assertTemplateUsed(response, template)

    def test_listing_pages_render_for_logged_in_users(self):
        self.client.force_login(self.user)
        for url in ["/", "/featured", "/latest", "/recommended", "/history", "/liked", "/tags", "/categories"]:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 200)

    def test_search_page_points_its_rss_link_at_the_search_feed(self):
        response = self.client.get("/search?q=cats", REQUEST_URI="/search?q=cats")
        self.assertEqual(response.context["RSS_URL"], "/rss/search?q=cats")


class MembersPageTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = create_account()
        cls.editor = create_account(is_editor=True)
        cls.admin = create_account(is_superuser=True)

    def members(self, user=None):
        if user:
            self.client.force_login(user)
        return self.client.get("/members")

    @override_settings(CAN_SEE_MEMBERS_PAGE="all")
    def test_everyone_sees_members_when_open_to_all(self):
        self.assertEqual(self.members().status_code, 200)
        self.assertTrue(self.members(self.user).context["CAN_SEE_MEMBERS_PAGE"])

    @override_settings(CAN_SEE_MEMBERS_PAGE="all")
    def test_anonymous_user_is_not_offered_the_members_link(self):
        self.assertFalse(self.members().context["CAN_SEE_MEMBERS_PAGE"])

    @override_settings(CAN_SEE_MEMBERS_PAGE="editors")
    def test_only_editors_see_members_when_restricted_to_editors(self):
        self.assertRedirects(self.members(), "/", fetch_redirect_response=False)
        self.assertRedirects(self.members(self.user), "/", fetch_redirect_response=False)
        response = self.members(self.editor)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.context["CAN_SEE_MEMBERS_PAGE"])

    @override_settings(CAN_SEE_MEMBERS_PAGE="admins")
    def test_only_superusers_see_members_when_restricted_to_admins(self):
        self.assertRedirects(self.members(self.editor), "/", fetch_redirect_response=False)
        response = self.members(self.admin)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.context["CAN_SEE_MEMBERS_PAGE"])


class PlaylistPageTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = create_account()
        cls.playlist = cls.user.playlists.create(title="page playlist")

    def test_playlist_page_renders_for_existing_playlist(self):
        for prefix in ["/playlist/", "/playlists/"]:
            with self.subTest(prefix=prefix):
                response = self.client.get(f"{prefix}{self.playlist.friendly_token}")
                self.assertEqual(response.status_code, 200)
                self.assertTemplateUsed(response, "cms/playlist.html")
                self.assertEqual(response.context["playlist"], self.playlist)

    def test_unknown_playlist_renders_without_a_playlist(self):
        response = self.client.get("/playlist/doesnotexist")
        self.assertTemplateUsed(response, "cms/playlist.html")
        self.assertIsNone(response.context["playlist"])


class MediaModelVisibilityOnPagesTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = create_account()
        cls.private = create_media(cls.owner, title="private on page", state="private")
        cls.unlisted = create_media(cls.owner, title="unlisted on page", state="unlisted")

    def test_private_and_unlisted_media_are_not_listable(self):
        self.assertFalse(Media.objects.get(pk=self.private.pk).listable)
        self.assertFalse(Media.objects.get(pk=self.unlisted.pk).listable)

    def test_private_media_page_omits_social_preview_image(self):
        public = create_media(self.owner, title="public on page", state="public")
        self.assertContains(self.client.get("/view", {"m": public.friendly_token}), 'property="og:image"')
        self.assertNotContains(self.client.get("/view", {"m": self.private.friendly_token}), 'property="og:image"')

    def test_unlisted_media_page_is_reachable_by_link(self):
        response = self.client.get("/view", {"m": self.unlisted.friendly_token})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["media_object"], self.unlisted)


class PrivateMediaPageMetadataTest(TestCase):
    TITLE = "Confidential board meeting"
    DESCRIPTION = "Quarterly figures nobody outside should read"

    @classmethod
    def setUpTestData(cls):
        cls.owner = create_account()
        cls.stranger = create_account()
        cls.editor = create_account(is_editor=True)
        cls.shared_viewer = create_account()
        cls.private = create_media(cls.owner, title=cls.TITLE, description=cls.DESCRIPTION, state="private")
        MediaPermission.objects.create(owner_user=cls.owner, user=cls.shared_viewer, media=cls.private, permission="viewer")

    def view(self, user=None):
        if user:
            self.client.force_login(user)
        return self.client.get("/view", {"m": self.private.friendly_token})

    def assert_metadata_hidden(self, response):
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.context["media_object"])
        self.assertNotContains(response, self.TITLE)
        self.assertNotContains(response, self.DESCRIPTION)
        self.assertNotContains(response, 'property="og:title"')
        self.assertNotContains(response, 'name="description"')

    def assert_metadata_shown(self, response):
        self.assertEqual(response.context["media_object"], self.private)
        self.assertContains(response, f"<title>{self.TITLE} - ")
        self.assertContains(response, f'<meta property="og:title" content="{self.TITLE} - ')
        self.assertContains(response, self.DESCRIPTION)

    def test_anonymous_visitor_gets_no_title_or_description_of_a_private_media(self):
        self.assert_metadata_hidden(self.view())

    def test_logged_in_stranger_gets_no_title_or_description_of_a_private_media(self):
        self.assert_metadata_hidden(self.view(self.stranger))

    def test_the_page_still_boots_the_player_so_the_frontend_can_report_the_media_as_private(self):
        response = self.view()
        self.assertEqual(response.context["media"], self.private.friendly_token)
        self.assertContains(response, 'id="page-media"')

    def test_owner_sees_the_metadata_of_their_private_media(self):
        self.assert_metadata_shown(self.view(self.owner))

    def test_user_the_media_is_shared_with_sees_the_metadata(self):
        self.assert_metadata_shown(self.view(self.shared_viewer))

    def test_mediacms_editor_sees_the_metadata(self):
        self.assert_metadata_shown(self.view(self.editor))

    @override_settings(USE_RBAC=True)
    def test_rbac_member_of_the_media_category_sees_the_metadata(self):
        category = Category.objects.create(title="Private course", is_rbac_category=True)
        self.private.category.add(category)
        member = create_account()
        group = RBACGroup.objects.create(name="Private course group")
        group.categories.add(category)
        RBACMembership.objects.create(user=member, rbac_group=group, role="member")
        self.assert_metadata_shown(self.view(member))
