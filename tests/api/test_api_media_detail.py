import uuid
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from files.models import (
    Category,
    EncodeProfile,
    Media,
    MediaPermission,
    Rating,
    RatingCategory,
)
from files.tests import create_account, create_media
from rbac.models import RBACGroup, RBACMembership


def detail_url(media):
    return f"/api/v1/media/{media.friendly_token}"


class MediaDetailGetTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = create_account()
        cls.other = create_account()
        cls.editor = create_account(is_editor=True)
        cls.manager = create_account(is_manager=True)
        cls.superuser = create_account(is_superuser=True)
        cls.public = create_media(cls.owner, title="detail public", description="public description", state="public")
        cls.unlisted = create_media(cls.owner, title="detail unlisted", state="unlisted")
        cls.private = create_media(cls.owner, title="detail private", state="private")
        cls.sibling = create_media(cls.owner, title="detail sibling", state="public")

    def get_as(self, user, media):
        client = APIClient()
        if user:
            client.force_authenticate(user)
        return client.get(detail_url(media))

    def test_public_media_is_readable_by_anonymous(self):
        response = self.get_as(None, self.public)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "detail public")
        self.assertEqual(response.data["description"], "public description")
        self.assertEqual(response.data["user"], self.owner.username)
        self.assertEqual(response.data["state"], "public")
        self.assertFalse(response.data["is_shared"])

    def test_unlisted_media_is_readable_by_anyone_with_the_link(self):
        for user in (None, self.other):
            response = self.get_as(user, self.unlisted)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["title"], "detail unlisted")

    def test_private_media_is_denied_to_other_users(self):
        response = self.get_as(self.other, self.private)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data["detail"], "media is private")

    def test_private_media_is_not_served_to_anonymous(self):
        response = self.get_as(None, self.private)
        self.assertIn(response.status_code, (400, 401))
        self.assertNotIn("title", response.data)

    def test_private_media_is_readable_by_owner_and_portal_staff(self):
        for user in (self.owner, self.editor, self.manager, self.superuser):
            response = self.get_as(user, self.private)
            self.assertEqual(response.status_code, 200, user.username)
            self.assertEqual(response.data["title"], "detail private")

    def test_private_media_is_readable_by_user_it_is_shared_with(self):
        MediaPermission.objects.create(owner_user=self.owner, user=self.other, media=self.private, permission="viewer")
        response = self.get_as(self.other, self.private)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_shared"])

    @override_settings(USE_RBAC=True)
    def test_private_media_is_readable_by_rbac_group_member(self):
        category = Category.objects.create(title="detail rbac course", is_rbac_category=True)
        group = RBACGroup.objects.create(name="detail rbac group")
        group.categories.add(category)
        RBACMembership.objects.create(user=self.other, rbac_group=group, role="member")
        self.private.category.add(category)

        response = self.get_as(self.other, self.private)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_shared"])
        self.assertEqual([c["title"] for c in response.data["categories_info"]], ["detail rbac course"])

    def test_rbac_category_is_hidden_from_categories_info_of_non_members(self):
        category = Category.objects.create(title="hidden rbac course", is_rbac_category=True)
        visible = Category.objects.create(title="visible category")
        self.public.category.add(category, visible)
        response = self.get_as(self.other, self.public)
        self.assertEqual([c["title"] for c in response.data["categories_info"]], ["visible category"])

    def test_unknown_friendly_token_returns_400(self):
        response = APIClient().get("/api/v1/media/doesnotexist")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "media file does not exist")

    def test_related_media_lists_other_listable_media_of_the_author(self):
        response = self.get_as(None, self.public)
        related_titles = [item["title"] for item in response.data["related_media"]]
        self.assertIn("detail sibling", related_titles)
        self.assertNotIn("detail public", related_titles)
        self.assertNotIn("detail private", related_titles)

    @override_settings(RELATED_MEDIA_STRATEGY="no_related")
    def test_related_media_can_be_disabled(self):
        self.assertEqual(self.get_as(None, self.public).data["related_media"], [])

    @override_settings(ALLOW_RATINGS=True)
    def test_ratings_info_carries_the_users_own_score(self):
        rating_category = RatingCategory.objects.create(title=f"detail quality {uuid.uuid4().hex[:6]}")
        self.public.rating_category.add(rating_category)
        Rating.objects.create(user=self.other, media=self.public, rating_category=rating_category, score=4)

        own = self.get_as(self.other, self.public).data["ratings_info"]
        self.assertEqual(own, [{"score": 4, "category_id": rating_category.id, "category_title": rating_category.title}])

        anonymous = self.get_as(None, self.public).data["ratings_info"]
        self.assertEqual(anonymous[0]["score"], -1)


class MediaDetailPutTest(TestCase):
    def setUp(self):
        self.owner = create_account()
        self.other = create_account()
        self.media = create_media(self.owner, title="original title", description="original description", state="private")

    def put_as(self, user, data):
        client = APIClient()
        if user:
            client.force_authenticate(user)
        return client.put(detail_url(self.media), data, format="multipart")

    def test_owner_can_update_title_and_description(self):
        response = self.put_as(self.owner, {"title": "new title", "description": "new description"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["title"], "new title")
        self.media.refresh_from_db()
        self.assertEqual(self.media.title, "new title")
        self.assertEqual(self.media.description, "new description")

    def test_html_is_stripped_from_title_and_description(self):
        self.put_as(self.owner, {"title": "<b>bold</b> title", "description": "<script>x</script>text"})
        self.media.refresh_from_db()
        self.assertEqual(self.media.title, "bold title")
        self.assertNotIn("<script>", self.media.description)

    def test_read_only_fields_cannot_be_changed_through_put(self):
        response = self.put_as(self.owner, {"title": "t", "state": "public", "featured": True, "is_reviewed": False, "views": 1000, "reported_times": 0})
        self.assertEqual(response.status_code, 201)
        self.media.refresh_from_db()
        self.assertEqual(self.media.state, "private")
        self.assertFalse(self.media.featured)
        self.assertTrue(self.media.is_reviewed)
        self.assertEqual(self.media.views, 1)

    def test_too_long_title_is_rejected(self):
        response = self.put_as(self.owner, {"title": "x" * 200})
        self.assertEqual(response.status_code, 400)
        self.assertIn("title", response.data)

    def test_other_user_cannot_update(self):
        self.media.state = "public"
        self.media.save()
        response = self.put_as(self.other, {"title": "hijacked"})
        self.assertEqual(response.status_code, 401)
        self.media.refresh_from_db()
        self.assertEqual(self.media.title, "original title")

    def test_anonymous_cannot_update(self):
        self.media.state = "public"
        self.media.save()
        self.assertIn(self.put_as(None, {"title": "hijacked"}).status_code, (401, 403))
        self.media.refresh_from_db()
        self.assertEqual(self.media.title, "original title")

    def test_editor_can_update_media_of_others(self):
        editor = create_account(is_editor=True)
        self.assertEqual(self.put_as(editor, {"title": "edited by editor"}).status_code, 201)
        self.media.refresh_from_db()
        self.assertEqual(self.media.title, "edited by editor")

    def test_an_editor_or_manager_editing_someone_elses_media_does_not_become_its_owner(self):
        for role in ({"is_editor": True}, {"is_manager": True}, {"is_superuser": True}):
            with self.subTest(**role):
                moderator = create_account(**role)
                response = self.put_as(moderator, {"title": "moderated title"})
                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.data["user"], self.owner.username)
                self.media.refresh_from_db()
                self.assertEqual(self.media.user, self.owner)
                self.assertEqual(self.media.title, "moderated title")

    def test_moderated_media_stays_in_the_owners_listing(self):
        self.put_as(create_account(is_editor=True), {"title": "moderated title"})
        self.assertEqual(list(Media.objects.filter(user=self.owner)), [self.media])


class MediaDetailSharedEditTest(TestCase):
    def setUp(self):
        self.owner = create_account()
        self.media = create_media(self.owner, title="shared original", state="private")

    def share(self, permission):
        user = create_account()
        MediaPermission.objects.create(owner_user=self.owner, user=user, media=self.media, permission=permission)
        return user

    def rbac_user(self, role):
        user = create_account()
        category = Category.objects.create(title=f"Course {uuid.uuid4().hex[:6]}", is_rbac_category=True)
        self.media.category.add(category)
        group = RBACGroup.objects.create(name=f"Group {uuid.uuid4().hex[:6]}")
        group.categories.add(category)
        RBACMembership.objects.create(user=user, rbac_group=group, role=role)
        return user

    def client_for(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def put_as(self, user, title):
        return self.client_for(user).put(detail_url(self.media), {"title": title}, format="multipart")

    def assert_edited_and_owner_kept(self, response, title):
        self.assertEqual(response.status_code, 201)
        self.media.refresh_from_db()
        self.assertEqual(self.media.title, title)
        self.assertEqual(self.media.user, self.owner)

    def test_a_user_shared_as_editor_can_edit(self):
        self.assert_edited_and_owner_kept(self.put_as(self.share("editor"), "edited by sharee"), "edited by sharee")

    def test_a_user_shared_as_owner_can_edit(self):
        self.assert_edited_and_owner_kept(self.put_as(self.share("owner"), "edited by co-owner"), "edited by co-owner")

    def test_patch_is_allowed_for_a_shared_editor_too(self):
        response = self.client_for(self.share("editor")).patch(detail_url(self.media), {"title": "patched"}, format="multipart")
        self.assertNotIn(response.status_code, (401, 403))

    def test_a_user_shared_as_viewer_cannot_edit(self):
        self.assertEqual(self.put_as(self.share("viewer"), "hijacked").status_code, 401)
        self.media.refresh_from_db()
        self.assertEqual(self.media.title, "shared original")

    @override_settings(USE_RBAC=True)
    def test_an_rbac_contributor_of_the_media_category_can_edit(self):
        self.assert_edited_and_owner_kept(self.put_as(self.rbac_user("contributor"), "edited by contributor"), "edited by contributor")

    @override_settings(USE_RBAC=True)
    def test_an_rbac_member_cannot_edit(self):
        self.assertEqual(self.put_as(self.rbac_user("member"), "hijacked").status_code, 401)
        self.media.refresh_from_db()
        self.assertEqual(self.media.title, "shared original")

    def test_edit_rights_do_not_include_deleting(self):
        for user in (self.share("editor"), self.share("owner")):
            self.assertEqual(self.client_for(user).delete(detail_url(self.media)).status_code, 401)
        self.assertTrue(Media.objects.filter(pk=self.media.pk).exists())

    def test_edit_rights_do_not_include_the_editor_only_actions(self):
        response = self.client_for(self.share("editor")).post(detail_url(self.media), {"type": "review", "result": "true"}, format="multipart")
        self.assertEqual(response.status_code, 401)


class MediaDetailDeleteTest(TestCase):
    def setUp(self):
        self.owner = create_account()
        self.media = create_media(self.owner, title="to delete", state="public")

    def delete_as(self, user):
        client = APIClient()
        if user:
            client.force_authenticate(user)
        return client.delete(detail_url(self.media))

    def test_owner_can_delete(self):
        self.assertEqual(self.delete_as(self.owner).status_code, 204)
        self.assertFalse(Media.objects.filter(pk=self.media.pk).exists())

    def test_staff_can_delete_media_of_others(self):
        for flags in ({"is_editor": True}, {"is_manager": True}, {"is_superuser": True}):
            media = create_media(self.owner, title="staff delete", state="private")
            client = APIClient()
            client.force_authenticate(create_account(**flags))
            self.assertEqual(client.delete(detail_url(media)).status_code, 204, flags)
            self.assertFalse(Media.objects.filter(pk=media.pk).exists())

    def test_other_user_cannot_delete(self):
        self.assertEqual(self.delete_as(create_account()).status_code, 401)
        self.assertTrue(Media.objects.filter(pk=self.media.pk).exists())

    def test_user_with_shared_viewer_permission_cannot_delete(self):
        viewer = create_account()
        MediaPermission.objects.create(owner_user=self.owner, user=viewer, media=self.media, permission="viewer")
        self.assertEqual(self.delete_as(viewer).status_code, 401)
        self.assertTrue(Media.objects.filter(pk=self.media.pk).exists())

    def test_anonymous_cannot_delete(self):
        self.assertIn(self.delete_as(None).status_code, (401, 403))
        self.assertTrue(Media.objects.filter(pk=self.media.pk).exists())

    def test_deleting_unknown_media_returns_400(self):
        client = APIClient()
        client.force_authenticate(self.owner)
        self.assertEqual(client.delete("/api/v1/media/doesnotexist").status_code, 400)


class MediaDetailManagerActionsTest(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        self.owner = create_account()
        self.editor = create_account(is_editor=True)
        self.media = create_media(self.owner, title="manager actions", state="public")
        self.client = APIClient()
        self.client.force_authenticate(self.editor)

    def post(self, data, fmt="multipart"):
        return self.client.post(detail_url(self.media), data, format=fmt)

    def test_owner_who_is_not_editor_cannot_run_actions(self):
        client = APIClient()
        client.force_authenticate(self.owner)
        response = client.post(detail_url(self.media), {"type": "review", "result": False})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "not allowed")
        self.media.refresh_from_db()
        self.assertTrue(self.media.is_reviewed)

    def test_other_user_gets_401_on_actions(self):
        client = APIClient()
        client.force_authenticate(create_account())
        self.assertEqual(client.post(detail_url(self.media), {"type": "review"}).status_code, 401)

    def test_review_without_result_marks_media_reviewed(self):
        Media.objects.filter(pk=self.media.pk).update(is_reviewed=False)
        response = self.post({"type": "review"})
        self.assertEqual(response.status_code, 201)
        self.media.refresh_from_db()
        self.assertTrue(self.media.is_reviewed)

    def test_unknown_action_is_rejected(self):
        response = self.post({"type": "explode"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "not valid action or no action specified")

    def test_encode_with_single_profile_id(self):
        profile = EncodeProfile.objects.filter(active=True).first()
        with patch.object(Media, "encode") as encode:
            response = self.post({"type": "encode", "encoding_profiles": str(profile.id)})
        self.assertEqual(response.status_code, 201)
        encode.assert_called_once_with(profiles=[profile])

    def test_encode_with_non_numeric_profile_is_rejected(self):
        with patch.object(Media, "encode") as encode:
            response = self.post({"type": "encode", "encoding_profiles": "abc"})
        self.assertEqual(response.status_code, 400)
        encode.assert_not_called()

    def test_encode_without_profiles_encodes_with_none_selected(self):
        with patch.object(Media, "encode") as encode:
            self.assertEqual(self.post({"type": "encode"}).status_code, 201)
        encode.assert_called_once_with(profiles=[])
