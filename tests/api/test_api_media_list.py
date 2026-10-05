from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.pagination import PageNumberPagination

from files.models import Category, Media, MediaPermission, Tag
from files.tests import create_account, create_media
from rbac.models import RBACGroup, RBACMembership

MEDIA_LIST_URL = "/api/v1/media"


def titles(response):
    return [item["title"] for item in response.data["results"]]


class MediaListVisibilityTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = create_account()
        cls.other = create_account()
        cls.editor = create_account(is_editor=True)
        cls.public = create_media(cls.owner, title="vis public", state="public")
        cls.unlisted = create_media(cls.owner, title="vis unlisted", state="unlisted")
        cls.private = create_media(cls.owner, title="vis private", state="private")
        cls.unreviewed = create_media(cls.owner, title="vis unreviewed", state="public", is_reviewed=False)

    def test_anonymous_sees_only_listable_media(self):
        response = self.client.get(MEDIA_LIST_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(titles(response)), {"vis public"})
        self.assertEqual(response.data["count"], 1)

    def test_authenticated_user_without_shares_sees_only_listable_media(self):
        self.client.force_login(self.other)
        self.assertEqual(set(titles(self.client.get(MEDIA_LIST_URL))), {"vis public"})

    def test_media_shared_with_user_is_listed_for_that_user_only(self):
        MediaPermission.objects.create(owner_user=self.owner, user=self.other, media=self.private, permission="viewer")
        self.client.force_login(self.other)
        self.assertEqual(set(titles(self.client.get(MEDIA_LIST_URL))), {"vis public", "vis private"})

        self.client.force_login(create_account())
        self.assertEqual(set(titles(self.client.get(MEDIA_LIST_URL))), {"vis public"})

    def test_editor_sees_every_media(self):
        self.client.force_login(self.editor)
        self.assertEqual(set(titles(self.client.get(MEDIA_LIST_URL))), {"vis public", "vis unlisted", "vis private", "vis unreviewed"})

    def test_author_listing_by_owner_includes_non_listable_media(self):
        self.client.force_login(self.owner)
        response = self.client.get(MEDIA_LIST_URL, {"author": self.owner.username})
        self.assertEqual(len(titles(response)), 4)
        self.assertEqual(response.data["shared_users"], [])
        self.assertEqual(response.data["shared_groups"], [])

    def test_author_listing_by_editor_includes_non_listable_media_without_sharing_info(self):
        self.client.force_login(self.editor)
        response = self.client.get(MEDIA_LIST_URL, {"author": self.owner.username})
        self.assertEqual(len(titles(response)), 4)
        self.assertNotIn("shared_users", response.data)

    def test_author_listing_by_stranger_shows_only_listable_media(self):
        self.client.force_login(self.other)
        self.assertEqual(titles(self.client.get(MEDIA_LIST_URL, {"author": self.owner.username})), ["vis public"])

    def test_author_listing_by_stranger_includes_media_shared_with_them_by_that_author(self):
        MediaPermission.objects.create(owner_user=self.owner, user=self.other, media=self.unlisted, permission="viewer")
        self.client.force_login(self.other)
        self.assertEqual(set(titles(self.client.get(MEDIA_LIST_URL, {"author": self.owner.username}))), {"vis public", "vis unlisted"})

    def test_author_listing_for_anonymous_shows_only_listable_media(self):
        self.assertEqual(titles(self.client.get(MEDIA_LIST_URL, {"author": self.owner.username})), ["vis public"])

    def test_unknown_author_returns_404(self):
        self.assertEqual(self.client.get(MEDIA_LIST_URL, {"author": "nobody-by-this-name"}).status_code, 404)

    def test_featured_listing_shows_only_listable_featured_media(self):
        create_media(self.owner, title="vis featured", state="public", featured=True)
        create_media(self.owner, title="vis featured private", state="private", featured=True)
        self.assertEqual(titles(self.client.get(MEDIA_LIST_URL, {"show": "featured"})), ["vis featured"])

    def test_recommended_listing_has_no_count_and_only_listable_media(self):
        response = self.client.get(MEDIA_LIST_URL, {"show": "recommended"})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("count", response.data)
        self.assertEqual(titles(response), ["vis public"])

    def test_latest_listing_behaves_like_the_default_listing(self):
        self.assertEqual(titles(self.client.get(MEDIA_LIST_URL, {"show": "latest"})), ["vis public"])


@override_settings(USE_RBAC=True)
class MediaListRbacTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = create_account()
        cls.member = create_account()
        cls.category = Category.objects.create(title="rbac course list", is_rbac_category=True)
        cls.group = RBACGroup.objects.create(name="rbac list group")
        cls.group.categories.add(cls.category)
        RBACMembership.objects.create(user=cls.member, rbac_group=cls.group, role="member")
        cls.course_media = create_media(cls.owner, title="rbac course media", state="private", category=[cls.category])
        create_media(cls.owner, title="rbac public", state="public")

    def test_group_member_sees_media_of_rbac_category(self):
        self.client.force_login(self.member)
        self.assertEqual(set(titles(self.client.get(MEDIA_LIST_URL))), {"rbac course media", "rbac public"})

    def test_group_member_sees_rbac_media_in_author_listing(self):
        self.client.force_login(self.member)
        self.assertEqual(set(titles(self.client.get(MEDIA_LIST_URL, {"author": self.owner.username}))), {"rbac course media", "rbac public"})

    def test_non_member_does_not_see_rbac_media(self):
        self.client.force_login(create_account())
        self.assertEqual(titles(self.client.get(MEDIA_LIST_URL)), ["rbac public"])

    def test_shared_with_me_includes_rbac_category_media_and_group_names(self):
        self.client.force_login(self.member)
        response = self.client.get(MEDIA_LIST_URL, {"show": "shared_with_me"})
        self.assertEqual(titles(response), ["rbac course media"])
        self.assertEqual(response.data["shared_groups"], [{"name": "rbac list group"}])

    def test_shared_by_me_includes_own_media_in_contributor_categories(self):
        RBACMembership.objects.create(user=self.owner, rbac_group=self.group, role="contributor")
        self.client.force_login(self.owner)
        self.assertEqual(titles(self.client.get(MEDIA_LIST_URL, {"show": "shared_by_me"})), ["rbac course media"])

    def test_shared_group_filter_narrows_shared_with_me(self):
        self.client.force_login(self.member)
        self.assertEqual(titles(self.client.get(MEDIA_LIST_URL, {"show": "shared_with_me", "shared_group": "rbac list group"})), ["rbac course media"])
        self.assertEqual(titles(self.client.get(MEDIA_LIST_URL, {"show": "shared_with_me", "shared_group": "another group"})), [])


class MediaListSharingTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = create_account(name="Sharing Owner")
        cls.viewer = create_account(name="Sharing Viewer")
        cls.second_viewer = create_account(name="Second Viewer")
        cls.shared = create_media(cls.owner, title="shared item", state="private")
        cls.lti_shared = create_media(cls.owner, title="lti shared item", state="private")
        cls.not_shared = create_media(cls.owner, title="not shared item", state="private")
        MediaPermission.objects.create(owner_user=cls.owner, user=cls.viewer, media=cls.shared, permission="viewer")
        MediaPermission.objects.create(owner_user=cls.owner, user=cls.viewer, media=cls.lti_shared, permission="viewer", source=MediaPermission.SOURCE_LTI_EMBED)
        MediaPermission.objects.create(owner_user=cls.owner, user=cls.second_viewer, media=cls.shared, permission="editor")

    def test_shared_with_me_is_empty_for_anonymous(self):
        response = self.client.get(MEDIA_LIST_URL, {"show": "shared_with_me"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(titles(response), [])

    def test_shared_by_me_is_empty_for_anonymous(self):
        self.assertEqual(titles(self.client.get(MEDIA_LIST_URL, {"show": "shared_by_me"})), [])

    def test_shared_with_me_lists_media_shared_with_the_user(self):
        self.client.force_login(self.viewer)
        response = self.client.get(MEDIA_LIST_URL, {"show": "shared_with_me"})
        self.assertEqual(set(titles(response)), {"shared item", "lti shared item"})
        self.assertEqual(response.data["shared_groups"], [])

    def test_shared_with_me_can_exclude_lti_embeds(self):
        self.client.force_login(self.viewer)
        self.assertEqual(titles(self.client.get(MEDIA_LIST_URL, {"show": "shared_with_me", "exclude_lti_embed": "1"})), ["shared item"])

    def test_shared_with_me_never_lists_own_media(self):
        MediaPermission.objects.create(owner_user=self.owner, user=self.owner, media=self.not_shared, permission="owner")
        self.client.force_login(self.owner)
        self.assertEqual(titles(self.client.get(MEDIA_LIST_URL, {"show": "shared_with_me"})), [])

    def test_shared_by_me_lists_media_with_shared_users_excluding_self(self):
        self.client.force_login(self.owner)
        response = self.client.get(MEDIA_LIST_URL, {"show": "shared_by_me"})
        self.assertEqual(set(titles(response)), {"shared item", "lti shared item"})
        shared_usernames = {user["username"] for user in response.data["shared_users"]}
        self.assertEqual(shared_usernames, {self.viewer.username, self.second_viewer.username})
        self.assertIn({"username": self.viewer.username, "name": "Sharing Viewer"}, response.data["shared_users"])

    def test_shared_user_filter_narrows_shared_by_me(self):
        self.client.force_login(self.owner)
        self.assertEqual(titles(self.client.get(MEDIA_LIST_URL, {"show": "shared_by_me", "shared_user": self.second_viewer.username})), ["shared item"])

    def test_shared_user_filter_is_ignored_without_sharing_info(self):
        self.assertEqual(self.client.get(MEDIA_LIST_URL, {"shared_user": self.viewer.username}).status_code, 200)

    def test_publish_state_shared_returns_only_media_with_permissions(self):
        self.client.force_login(self.owner)
        response = self.client.get(MEDIA_LIST_URL, {"author": self.owner.username, "publish_state": "shared"})
        self.assertEqual(set(titles(response)), {"shared item", "lti shared item"})


class MediaListFilteringTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = create_account()
        cls.editor = create_account(is_editor=True)
        now = timezone.now()
        cls.tag = Tag.objects.create(title="filtertag", user=cls.user)
        cls.image = create_media(cls.user, title="Banana image", state="public", add_date=now - timedelta(days=2), tags=[cls.tag])
        cls.video = create_media(cls.user, filename="small_video.mp4", title="Cherry video", state="public", add_date=now - timedelta(days=400))
        cls.old_image = create_media(cls.user, title="Apple image", state="public", add_date=now - timedelta(days=30))
        Media.objects.filter(pk=cls.image.pk).update(views=5, likes=1, duration=100)
        Media.objects.filter(pk=cls.old_image.pk).update(views=50, likes=7, duration=1500)
        Media.objects.filter(pk=cls.video.pk).update(views=1, likes=3, duration=4000)

    def get_titles(self, **params):
        response = self.client.get(MEDIA_LIST_URL, params)
        self.assertEqual(response.status_code, 200)
        return titles(response)

    def test_default_ordering_is_newest_first(self):
        self.assertEqual(self.get_titles(), ["Banana image", "Apple image", "Cherry video"])

    def test_ordering_asc_reverses_default_sort(self):
        self.client.force_login(self.editor)
        self.assertEqual(self.get_titles(ordering="asc"), ["Cherry video", "Apple image", "Banana image"])

    def test_legacy_sort_by_with_ordering(self):
        self.client.force_login(self.editor)
        self.assertEqual(self.get_titles(sort_by="title", ordering="asc"), ["Apple image", "Banana image", "Cherry video"])
        self.assertEqual(self.get_titles(sort_by="views"), ["Apple image", "Banana image", "Cherry video"])

    def test_combined_sort_by_options(self):
        self.client.force_login(self.editor)
        self.assertEqual(self.get_titles(sort_by="title_desc"), ["Cherry video", "Banana image", "Apple image"])
        self.assertEqual(self.get_titles(sort_by="likes_asc"), ["Banana image", "Cherry video", "Apple image"])
        self.assertEqual(self.get_titles(sort_by="add_date_asc"), ["Cherry video", "Apple image", "Banana image"])

    def test_sort_applies_to_own_author_listing(self):
        self.client.force_login(self.user)
        self.assertEqual(self.get_titles(author=self.user.username, sort_by="views_asc"), ["Cherry video", "Banana image", "Apple image"])

    def test_unknown_sort_falls_back_to_add_date(self):
        self.client.force_login(self.editor)
        self.assertEqual(self.get_titles(sort_by="password_desc"), ["Banana image", "Apple image", "Cherry video"])
        self.assertEqual(self.get_titles(sort_by="bogus"), ["Banana image", "Apple image", "Cherry video"])

    def test_media_type_filter(self):
        self.assertEqual(self.get_titles(media_type="video"), ["Cherry video"])
        self.assertEqual(self.get_titles(media_type="image"), ["Banana image", "Apple image"])
        self.assertEqual(self.get_titles(media_type="pdf"), [])

    def test_unknown_media_type_is_ignored(self):
        self.assertEqual(len(self.get_titles(media_type="spreadsheet")), 3)

    def test_tag_filter(self):
        self.assertEqual(self.get_titles(t="filtertag"), ["Banana image"])
        self.assertEqual(self.get_titles(t="missingtag"), [])

    def test_response_lists_tags_of_returned_media(self):
        response = self.client.get(MEDIA_LIST_URL)
        self.assertEqual(response.data["tags"], "filtertag")

    def test_upload_date_this_week(self):
        self.assertEqual(self.get_titles(upload_date="this_week"), ["Banana image"])

    def test_upload_date_this_year_excludes_older_media(self):
        self.assertNotIn("Cherry video", self.get_titles(upload_date="this_year"))

    def test_unknown_upload_date_is_ignored(self):
        self.assertEqual(len(self.get_titles(upload_date="last_century")), 3)

    def test_duration_buckets(self):
        self.assertEqual(self.get_titles(duration="0-20"), ["Banana image"])
        self.assertEqual(self.get_titles(duration="20-40"), ["Apple image"])
        self.assertEqual(self.get_titles(duration="40-60"), [])
        self.assertEqual(self.get_titles(duration="60-120"), ["Cherry video"])
        self.assertEqual(len(self.get_titles(duration="bogus")), 3)

    def test_publish_state_filter(self):
        self.assertEqual(len(self.get_titles(publish_state="public")), 3)
        self.assertEqual(self.get_titles(publish_state="private"), [])
        self.assertEqual(len(self.get_titles(publish_state="bogus")), 3)

    def test_query_filters_by_search_vector(self):
        for media in Media.objects.filter(user=self.user):
            media.update_search_vector()
        self.assertEqual(self.get_titles(q="banana"), ["Banana image"])
        self.assertEqual(self.get_titles(q="image"), ["Banana image", "Apple image"])

    def test_query_of_only_stop_words_does_not_filter(self):
        self.assertEqual(len(self.get_titles(q="the")), 3)

    def test_pagination_page_size_and_next_link(self):
        with patch.object(PageNumberPagination, "page_size", 2):
            response = self.client.get(MEDIA_LIST_URL)
        self.assertEqual(response.data["count"], 3)
        self.assertEqual(len(response.data["results"]), 2)
        self.assertIn("page=2", response.data["next"])

    def test_page_out_of_range_returns_404(self):
        self.assertEqual(self.client.get(MEDIA_LIST_URL, {"page": 99}).status_code, 404)

    def test_listing_item_has_absolute_urls(self):
        item = self.client.get(MEDIA_LIST_URL, {"t": "filtertag"}).data["results"][0]
        self.assertEqual(item["friendly_token"], self.image.friendly_token)
        self.assertTrue(item["url"].startswith("http://testserver/"))
        self.assertTrue(item["api_url"].endswith(f"/api/v1/media/{self.image.friendly_token}"))
        self.assertEqual(item["user"], self.user.username)
