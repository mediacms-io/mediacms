from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from files.models import (
    Category,
    Comment,
    EmbedMediaCourse,
    Media,
    MediaPermission,
    Playlist,
    PlaylistMedia,
    Tag,
)
from files.tests import create_account, create_media
from rbac.models import RBACGroup, RBACMembership

BULK_URL = "/api/v1/media/user/bulk_actions"


class BulkActionsTestCase(TestCase):
    def setUp(self):
        self.owner = create_account(name="Bulk Owner")
        self.other = create_account(name="Bulk Other")
        self.first = create_media(self.owner, title="bulk first", state="private")
        self.second = create_media(self.owner, title="bulk second", state="private")
        self.foreign = create_media(self.other, title="bulk foreign", state="public")
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    @property
    def tokens(self):
        return [self.first.friendly_token, self.second.friendly_token]

    def bulk(self, action, media_ids=None, client=None, **extra):
        payload = {"action": action, "media_ids": self.tokens if media_ids is None else media_ids, **extra}
        return (client or self.client).post(BULK_URL, payload, format="json")

    def assert_rejected(self, response, detail_fragment):
        self.assertEqual(response.status_code, 400)
        self.assertIn(detail_fragment, response.data["detail"])


class BulkActionsValidationTest(BulkActionsTestCase):
    def test_anonymous_is_rejected(self):
        self.assertIn(APIClient().post(BULK_URL, {"action": "enable_comments", "media_ids": self.tokens}, format="json").status_code, (401, 403))

    def test_action_is_required(self):
        self.assert_rejected(self.client.post(BULK_URL, {"media_ids": self.tokens}, format="json"), "action is required")

    def test_media_ids_are_required(self):
        self.assert_rejected(self.bulk("enable_comments", media_ids=[]), "media_ids is required")

    def test_only_own_media_is_affected(self):
        self.assert_rejected(self.bulk("delete_media", media_ids=[self.foreign.friendly_token]), "No matching media found")
        self.assertTrue(Media.objects.filter(pk=self.foreign.pk).exists())

    def test_mixed_selection_ignores_media_of_others(self):
        self.assertEqual(self.bulk("delete_media", media_ids=[self.first.friendly_token, self.foreign.friendly_token]).status_code, 200)
        self.assertFalse(Media.objects.filter(pk=self.first.pk).exists())
        self.assertTrue(Media.objects.filter(pk=self.foreign.pk).exists())

    def test_editor_cannot_bulk_act_on_media_of_others(self):
        editor = APIClient()
        editor.force_authenticate(create_account(is_editor=True))
        self.assert_rejected(self.bulk("delete_media", client=editor), "No matching media found")

    def test_unknown_action_is_rejected(self):
        self.assert_rejected(self.bulk("launch_rockets"), "Unknown action")

    def test_form_encoded_body_is_not_accepted(self):
        response = self.client.post(BULK_URL, {"action": "enable_comments"}, format="multipart")
        self.assertEqual(response.status_code, 415)


class BulkSimpleActionsTest(BulkActionsTestCase):
    def test_disable_and_enable_comments(self):
        self.assertEqual(self.bulk("disable_comments").data["detail"], "Comments disabled for 2 media items")
        self.assertFalse(Media.objects.filter(pk__in=[self.first.pk, self.second.pk], enable_comments=True).exists())
        self.bulk("enable_comments")
        self.assertEqual(Media.objects.filter(pk__in=[self.first.pk, self.second.pk], enable_comments=True).count(), 2)

    def test_disable_and_enable_download(self):
        self.bulk("disable_download")
        self.assertFalse(Media.objects.filter(pk__in=[self.first.pk, self.second.pk], allow_download=True).exists())
        self.assertEqual(self.bulk("enable_download").data["detail"], "Download enabled for 2 media items")
        self.assertEqual(Media.objects.filter(pk__in=[self.first.pk, self.second.pk], allow_download=True).count(), 2)

    def test_delete_comments_only_on_selected_media(self):
        Comment.objects.create(user=self.other, media=self.first, text="one")
        Comment.objects.create(user=self.other, media=self.second, text="two")
        kept = Comment.objects.create(user=self.other, media=self.foreign, text="kept")
        self.assertEqual(self.bulk("delete_comments").data["detail"], "2 comments deleted")
        self.assertEqual(list(Comment.objects.values_list("pk", flat=True)), [kept.pk])

    def test_delete_media(self):
        self.assertEqual(self.bulk("delete_media").data["detail"], "2 media items deleted")
        self.assertFalse(Media.objects.filter(user=self.owner).exists())

    def test_copy_media_creates_copies_owned_by_the_same_user(self):
        self.assertEqual(self.bulk("copy_media", media_ids=[self.first.friendly_token]).status_code, 200)
        copy = Media.objects.get(title="bulk first (Copy)")
        self.assertEqual(copy.user, self.owner)
        self.assertNotEqual(copy.friendly_token, self.first.friendly_token)

    def test_change_owner(self):
        response = self.bulk("change_owner", owner=self.other.username)
        self.assertEqual(response.data["detail"], "Owner changed for 2 media items")
        self.assertEqual(Media.objects.filter(user=self.other, pk__in=[self.first.pk, self.second.pk]).count(), 2)

    def test_change_owner_validation(self):
        self.assert_rejected(self.bulk("change_owner"), "owner is required")
        self.assert_rejected(self.bulk("change_owner", owner="no-such-user"), "User not found")
        self.assertEqual(Media.objects.filter(user=self.owner).count(), 2)


class BulkSetStateTest(BulkActionsTestCase):
    def test_state_validation(self):
        self.assert_rejected(self.bulk("set_state"), "state is required")
        self.assert_rejected(self.bulk("set_state", state="secret"), "state must be one of")

    def test_set_public_makes_reviewed_media_listable(self):
        self.assertEqual(self.bulk("set_state", state="public").status_code, 200)
        for media in (self.first, self.second):
            media.refresh_from_db()
            self.assertEqual(media.state, "public")
            self.assertTrue(media.listable)

    def test_set_public_on_unreviewed_media_keeps_it_unlisted(self):
        Media.objects.filter(pk=self.first.pk).update(is_reviewed=False)
        self.bulk("set_state", state="public", media_ids=[self.first.friendly_token])
        self.first.refresh_from_db()
        self.assertEqual(self.first.state, "public")
        self.assertFalse(self.first.listable)

    def test_set_unlisted_removes_from_listings(self):
        self.bulk("set_state", state="public")
        self.bulk("set_state", state="unlisted")
        self.first.refresh_from_db()
        self.assertEqual(self.first.state, "unlisted")
        self.assertFalse(self.first.listable)

    @override_settings(PORTAL_WORKFLOW="private")
    def test_regular_user_cannot_publish_when_workflow_is_not_public(self):
        self.assert_rejected(self.bulk("set_state", state="public"), "not allowed to set media to public")
        self.first.refresh_from_db()
        self.assertEqual(self.first.state, "private")
        self.assertEqual(self.bulk("set_state", state="unlisted").status_code, 200)

    @override_settings(PORTAL_WORKFLOW="private")
    def test_editor_can_publish_own_media_when_workflow_is_not_public(self):
        editor = create_account(is_editor=True)
        media = create_media(editor, title="editor media", state="private")
        client = APIClient()
        client.force_authenticate(editor)
        self.assertEqual(self.bulk("set_state", media_ids=[media.friendly_token], client=client, state="public").status_code, 200)
        media.refresh_from_db()
        self.assertEqual(media.state, "public")

    def test_remove_sharing_drops_permissions_and_rbac_categories(self):
        rbac = Category.objects.create(title="bulk state rbac", is_rbac_category=True)
        plain = Category.objects.create(title="bulk state plain")
        self.first.category.add(rbac, plain)
        MediaPermission.objects.create(owner_user=self.owner, user=self.other, media=self.first, permission="viewer")
        self.bulk("set_state", state="private", remove_sharing=True)
        self.assertFalse(MediaPermission.objects.filter(media=self.first).exists())
        self.assertEqual(list(self.first.category.values_list("title", flat=True)), ["bulk state plain"])

    def test_sharing_is_kept_by_default(self):
        MediaPermission.objects.create(owner_user=self.owner, user=self.other, media=self.first, permission="viewer")
        self.bulk("set_state", state="private")
        self.assertTrue(MediaPermission.objects.filter(media=self.first).exists())


class BulkPlaylistActionsTest(BulkActionsTestCase):
    def setUp(self):
        super().setUp()
        self.playlist = Playlist.objects.create(user=self.owner, title="bulk playlist")
        self.foreign_playlist = Playlist.objects.create(user=self.other, title="foreign playlist")

    def test_playlist_ids_are_required(self):
        self.assert_rejected(self.bulk("add_to_playlist"), "playlist_ids is required")
        self.assert_rejected(self.bulk("remove_from_playlist"), "playlist_ids is required")

    def test_cannot_use_playlists_of_others(self):
        self.assert_rejected(self.bulk("add_to_playlist", playlist_ids=[self.foreign_playlist.id]), "No matching playlists found")
        self.assert_rejected(self.bulk("remove_from_playlist", playlist_ids=[self.foreign_playlist.id]), "No matching playlists found")
        self.assertFalse(PlaylistMedia.objects.filter(playlist=self.foreign_playlist).exists())

    def test_add_to_playlist_orders_items(self):
        self.assertEqual(self.bulk("add_to_playlist", playlist_ids=[self.playlist.id]).data["detail"], "Added 2 media items to 1 playlists")
        self.assertEqual(sorted(PlaylistMedia.objects.filter(playlist=self.playlist).values_list("ordering", flat=True)), [1, 2])

    def test_adding_media_already_in_the_playlist_does_not_duplicate_them(self):
        self.bulk("add_to_playlist", playlist_ids=[self.playlist.id])
        response = self.bulk("add_to_playlist", playlist_ids=[self.playlist.id])
        self.assertEqual(response.data["detail"], "Added 0 media items to 1 playlists")
        self.assertEqual(PlaylistMedia.objects.filter(playlist=self.playlist).count(), 2)
        self.assertEqual(sorted(PlaylistMedia.objects.filter(playlist=self.playlist).values_list("ordering", flat=True)), [1, 2])

    @override_settings(MAX_MEDIA_PER_PLAYLIST=1)
    def test_add_to_playlist_respects_max_media_per_playlist(self):
        self.assertEqual(self.bulk("add_to_playlist", playlist_ids=[self.playlist.id]).data["detail"], "Added 1 media items to 1 playlists")
        self.assertEqual(PlaylistMedia.objects.filter(playlist=self.playlist).count(), 1)

    def test_remove_from_playlist(self):
        self.bulk("add_to_playlist", playlist_ids=[self.playlist.id])
        response = self.bulk("remove_from_playlist", playlist_ids=[self.playlist.id], media_ids=[self.first.friendly_token])
        self.assertEqual(response.data["detail"], "Removed 1 media items from 1 playlists")
        self.assertEqual(list(PlaylistMedia.objects.filter(playlist=self.playlist).values_list("media", flat=True)), [self.second.pk])

    def test_playlist_membership_lists_playlists_containing_all_selected_media(self):
        partial = Playlist.objects.create(user=self.owner, title="partial playlist")
        self.bulk("add_to_playlist", playlist_ids=[self.playlist.id])
        self.bulk("add_to_playlist", playlist_ids=[partial.id], media_ids=[self.first.friendly_token])
        results = self.bulk("playlist_membership").data["results"]
        self.assertEqual([item["title"] for item in results], ["bulk playlist"])
        self.assertEqual(results[0]["friendly_token"], self.playlist.friendly_token)


class BulkOwnershipActionsTest(BulkActionsTestCase):
    def test_ownership_type_and_users_validation(self):
        for action in ("get_ownership", "set_ownership", "remove_ownership"):
            self.assert_rejected(self.bulk(action), "ownership_type is required")
            self.assert_rejected(self.bulk(action, ownership_type="admin"), "ownership_type must be one of")
        for action in ("set_ownership", "remove_ownership"):
            self.assert_rejected(self.bulk(action, ownership_type="viewer"), "users is required")
            self.assert_rejected(self.bulk(action, ownership_type="viewer", users=["nobody-here"]), "No valid users found")

    def test_set_ownership_creates_and_updates_permissions(self):
        self.bulk("set_ownership", ownership_type="viewer", users=[self.other.username])
        self.assertEqual(MediaPermission.objects.filter(user=self.other, permission="viewer", owner_user=self.owner).count(), 2)
        self.bulk("set_ownership", ownership_type="editor", users=[self.other.username])
        self.assertEqual(MediaPermission.objects.filter(user=self.other).count(), 2)
        self.assertEqual(MediaPermission.objects.filter(user=self.other, permission="editor").count(), 2)

    def test_get_ownership_lists_users_sharing_all_selected_media(self):
        partial = create_account(name="Partial User")
        self.bulk("set_ownership", ownership_type="viewer", users=[self.other.username])
        MediaPermission.objects.create(owner_user=self.owner, user=partial, media=self.first, permission="viewer")
        response = self.bulk("get_ownership", ownership_type="viewer")
        self.assertEqual(response.data["results"], [f"Bulk Other - {self.other.username}"])

    def test_remove_ownership_only_removes_matching_type(self):
        self.bulk("set_ownership", ownership_type="viewer", users=[self.other.username], media_ids=[self.first.friendly_token])
        self.bulk("set_ownership", ownership_type="editor", users=[self.other.username], media_ids=[self.second.friendly_token])
        self.assertEqual(self.bulk("remove_ownership", ownership_type="viewer", users=[self.other.username]).status_code, 200)
        self.assertEqual(list(MediaPermission.objects.filter(user=self.other).values_list("media", "permission")), [(self.second.pk, "editor")])


class BulkCategoryAndTagActionsTest(BulkActionsTestCase):
    def setUp(self):
        super().setUp()
        self.category = Category.objects.create(title="bulk category")
        self.rbac_category = Category.objects.create(title="bulk rbac category", is_rbac_category=True, lti_context_id="bulk-course")
        self.group = RBACGroup.objects.create(name="bulk group")
        self.group.categories.add(self.rbac_category)
        self.tag = Tag.objects.create(title="bulktag", user=self.owner)
        self.other_tag = Tag.objects.create(title="bulkothertag", user=self.owner)

    def make_contributor(self):
        RBACMembership.objects.create(user=self.owner, rbac_group=self.group, role="contributor")

    def test_add_to_category_requires_categories(self):
        self.assert_rejected(self.bulk("add_to_category"), "category_uids or lti_context_id is required")
        self.assert_rejected(self.bulk("add_to_category", category_uids=["missing"]), "No matching categories")

    def test_add_to_and_remove_from_plain_category(self):
        self.assertEqual(self.bulk("add_to_category", category_uids=[self.category.uid]).data["detail"], "Added 2 media items to 1 categories")
        self.assertEqual(self.bulk("add_to_category", category_uids=[self.category.uid]).data["detail"], "Added 0 media items to 1 categories")
        self.assertTrue(self.first.category.filter(pk=self.category.pk).exists())
        self.assertEqual(self.bulk("remove_from_category", category_uids=[self.category.uid]).data["detail"], "Removed 2 media items from 1 categories")
        self.assertFalse(self.first.category.exists())

    def test_rbac_category_requires_contributor_access(self):
        self.assert_rejected(self.bulk("add_to_category", category_uids=[self.rbac_category.uid]), "access denied")
        RBACMembership.objects.create(user=self.owner, rbac_group=self.group, role="member")
        self.assert_rejected(self.bulk("add_to_category", category_uids=[self.rbac_category.uid]), "access denied")
        self.assertFalse(self.first.category.exists())

    def test_contributor_can_add_to_rbac_category(self):
        self.make_contributor()
        self.assertEqual(self.bulk("add_to_category", category_uids=[self.rbac_category.uid]).status_code, 200)
        self.assertTrue(self.first.category.filter(pk=self.rbac_category.pk).exists())

    def test_add_to_category_by_lti_context_id(self):
        self.assert_rejected(self.bulk("add_to_category", lti_context_id="bulk-course"), "access denied")
        self.make_contributor()
        self.assertEqual(self.bulk("add_to_category", lti_context_id="bulk-course").status_code, 200)
        self.assertTrue(self.second.category.filter(pk=self.rbac_category.pk).exists())

    def test_remove_from_rbac_category_requires_contributor_access(self):
        self.first.category.add(self.rbac_category)
        self.assert_rejected(self.bulk("remove_from_category"), "category_uids is required")
        self.assert_rejected(self.bulk("remove_from_category", category_uids=[self.rbac_category.uid]), "access denied")
        self.assertTrue(self.first.category.filter(pk=self.rbac_category.pk).exists())

    def test_remove_from_rbac_category_cleans_embed_records_and_owner_permission(self):
        self.make_contributor()
        self.first.category.add(self.rbac_category)
        EmbedMediaCourse.objects.create(media=self.first, category=self.rbac_category)
        MediaPermission.objects.create(owner_user=self.owner, user=self.owner, media=self.first, permission="owner")
        self.bulk("remove_from_category", category_uids=[self.rbac_category.uid], media_ids=[self.first.friendly_token])
        self.assertFalse(self.first.category.exists())
        self.assertFalse(EmbedMediaCourse.objects.filter(media=self.first).exists())
        self.assertFalse(MediaPermission.objects.filter(media=self.first).exists())

    def test_owner_permission_is_kept_while_media_is_still_shared_with_others(self):
        self.make_contributor()
        self.first.category.add(self.rbac_category)
        MediaPermission.objects.create(owner_user=self.owner, user=self.owner, media=self.first, permission="owner")
        MediaPermission.objects.create(owner_user=self.owner, user=self.other, media=self.first, permission="viewer")
        self.bulk("remove_from_category", category_uids=[self.rbac_category.uid], media_ids=[self.first.friendly_token])
        self.assertEqual(MediaPermission.objects.filter(media=self.first).count(), 2)

    def test_category_membership_includes_shared_and_embedded_categories(self):
        partial = Category.objects.create(title="bulk partial category")
        self.first.category.add(self.category, partial)
        self.second.category.add(self.category)
        EmbedMediaCourse.objects.create(media=self.second, category=self.rbac_category)
        results = self.bulk("category_membership").data["results"]
        self.assertEqual({item["title"] for item in results}, {"bulk category", "bulk rbac category"})

    def test_tag_validation(self):
        for action in ("add_tags", "remove_tags"):
            self.assert_rejected(self.bulk(action), "tag_titles is required")
            self.assert_rejected(self.bulk(action, tag_titles=["nosuchtag"]), "No matching tags found")

    def test_add_and_remove_tags(self):
        self.assertEqual(self.bulk("add_tags", tag_titles=["bulktag", "bulkothertag"]).data["detail"], "Added 4 media items to 2 tags")
        self.assertEqual(set(self.first.tags.values_list("title", flat=True)), {"bulktag", "bulkothertag"})
        self.assertEqual(self.bulk("remove_tags", tag_titles=["bulktag"]).data["detail"], "Removed 2 media items from 1 tags")
        self.assertEqual(list(self.second.tags.values_list("title", flat=True)), ["bulkothertag"])

    def test_tag_membership_lists_tags_shared_by_all_selected_media(self):
        self.first.tags.add(self.tag, self.other_tag)
        self.second.tags.add(self.tag)
        results = self.bulk("tag_membership").data["results"]
        self.assertEqual([item["title"] for item in results], ["bulktag"])


class BulkCourseCleanupTest(BulkActionsTestCase):
    def setUp(self):
        super().setUp()
        self.course = Category.objects.create(title="cleanup course", is_rbac_category=True)
        self.group = RBACGroup.objects.create(name="cleanup group")
        self.group.categories.add(self.course)
        RBACMembership.objects.create(user=self.owner, rbac_group=self.group, role="contributor")
        self.student = create_account()
        RBACMembership.objects.create(user=self.student, rbac_group=self.group, role="member")
        self.outsider = create_account()
        self.first.category.add(self.course)
        self.second.category.add(self.course)
        for media in (self.first, self.second):
            MediaPermission.objects.create(owner_user=self.owner, user=self.student, media=media, permission="viewer")
            MediaPermission.objects.create(owner_user=self.owner, user=self.outsider, media=media, permission="viewer")
            Comment.objects.create(user=self.student, media=media, text="course comment")

    def cleanup(self, media_ids, client=None, **extra):
        return self.bulk("course_cleanup", media_ids=media_ids, client=client, category_uids=[self.course.uid], **extra)

    def test_category_uids_are_required(self):
        self.assert_rejected(self.bulk("course_cleanup", media_ids=[]), "category_uids is required")
        self.assert_rejected(self.bulk("course_cleanup", media_ids=[], category_uids=["missing"]), "No matching categories found")

    def test_requires_contributor_access_to_the_course(self):
        client = APIClient()
        client.force_authenticate(self.student)
        self.assertEqual(self.cleanup([], client=client).status_code, 403)
        self.assertTrue(self.first.category.filter(pk=self.course.pk).exists())

    def test_cleanup_of_whole_course_removes_media_and_optionally_permissions_and_comments(self):
        embedded = create_media(self.other, title="embedded elsewhere", state="private")
        EmbedMediaCourse.objects.create(media=embedded, category=self.course)
        MediaPermission.objects.create(owner_user=self.other, user=self.student, media=embedded, permission="viewer")
        Comment.objects.create(user=self.student, media=embedded, text="embedded comment")

        response = self.cleanup([], remove_permissions=True, remove_comments=True)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Media.objects.filter(category=self.course).exists())
        self.assertFalse(MediaPermission.objects.filter(user=self.student).exists())
        self.assertFalse(MediaPermission.objects.filter(media=embedded).exists())
        self.assertEqual(MediaPermission.objects.filter(user=self.outsider).count(), 2)
        self.assertFalse(Comment.objects.exists())

    def test_cleanup_without_flags_keeps_permissions_and_comments(self):
        self.cleanup([])
        self.assertFalse(Media.objects.filter(category=self.course).exists())
        self.assertEqual(MediaPermission.objects.filter(user=self.student).count(), 2)
        self.assertEqual(Comment.objects.count(), 2)

    def test_cleanup_of_selected_media_leaves_the_rest_of_the_course(self):
        self.cleanup([self.first.friendly_token], remove_permissions=True, remove_comments=True)
        self.assertFalse(self.first.category.exists())
        self.assertTrue(self.second.category.filter(pk=self.course.pk).exists())
        self.assertEqual(list(MediaPermission.objects.filter(user=self.student).values_list("media", flat=True)), [self.second.pk])
        self.assertEqual(list(Comment.objects.values_list("media", flat=True)), [self.second.pk])

    def test_cleanup_of_selected_media_applied_to_all(self):
        third = create_media(self.other, title="other course media", state="private", category=[self.course])
        MediaPermission.objects.create(owner_user=self.other, user=self.student, media=third, permission="viewer")
        Comment.objects.create(user=self.student, media=third, text="third comment")
        self.cleanup([self.first.friendly_token], remove_permissions=True, remove_comments=True, apply_to_all=True)
        self.assertFalse(Media.objects.filter(category=self.course).exists())
        self.assertFalse(MediaPermission.objects.filter(user=self.student).exists())
        self.assertFalse(Comment.objects.exists())
