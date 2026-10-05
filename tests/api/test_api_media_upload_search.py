from datetime import timedelta

from allauth.account.models import EmailAddress
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from files.models import Category, Media, MediaPermission, Tag
from files.tests import create_account, create_media, fixture_path
from rbac.models import RBACGroup, RBACMembership

MEDIA_LIST_URL = "/api/v1/media"
SEARCH_URL = "/api/v1/search"


def image_upload(name="upload.png"):
    with open(fixture_path("test_image.png"), "rb") as fp:
        return SimpleUploadedFile(name, fp.read(), content_type="image/png")


class MediaUploadTest(TestCase):
    def setUp(self):
        self.user = create_account()
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def upload(self, client=None, **data):
        data.setdefault("media_file", image_upload())
        return (client or self.client).post(MEDIA_LIST_URL, data, format="multipart")

    def test_an_upload_without_a_file_is_rejected_with_a_400(self):
        response = self.client.post(MEDIA_LIST_URL, {"title": "no file here"}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("media_file", response.data)
        self.assertFalse(Media.objects.filter(user=self.user).exists())

    def test_an_upload_with_an_empty_file_field_is_rejected_with_a_400(self):
        response = self.client.post(MEDIA_LIST_URL, {"title": "empty", "media_file": ""}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Media.objects.filter(user=self.user).exists())

    def test_authenticated_user_uploads_an_image(self):
        response = self.upload(title="api upload", description="uploaded through the api")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["title"], "api upload")
        media = Media.objects.get(friendly_token=response.data["friendly_token"])
        self.assertEqual(media.user, self.user)
        self.assertEqual(media.media_type, "image")
        self.assertEqual(media.state, "public")
        self.assertEqual(media.description, "uploaded through the api")

    def test_title_defaults_to_the_file_name(self):
        response = self.upload(media_file=image_upload("holiday.png"))
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Media.objects.get(friendly_token=response.data["friendly_token"]).title.startswith("holiday"))

    def test_client_cannot_choose_read_only_fields(self):
        response = self.upload(title="sneaky", state="private", featured=True, reported_times=5)
        media = Media.objects.get(friendly_token=response.data["friendly_token"])
        self.assertEqual(media.state, "public")
        self.assertFalse(media.featured)
        self.assertEqual(media.reported_times, 0)

    def test_anonymous_cannot_upload(self):
        self.assertIn(self.upload(client=APIClient()).status_code, (401, 403))
        self.assertFalse(Media.objects.exists())

    def test_too_long_title_is_rejected(self):
        response = self.upload(title="t" * 200)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Media.objects.exists())

    def test_disallowed_file_type_is_kept_out_of_public_listings(self):
        text_file = SimpleUploadedFile("notes.txt", b"just some plain text, not media", content_type="text/plain")
        response = self.upload(title="text upload", media_file=text_file)
        self.assertEqual(response.status_code, 201)
        media = Media.objects.get(friendly_token=response.data["friendly_token"])
        self.assertNotIn(media.media_type, ["video", "audio", "image", "pdf"])
        self.assertNotEqual(media.state, "public")
        self.assertFalse(media.listable)

    @override_settings(ALLOWED_MEDIA_UPLOAD_TYPES=["video"])
    def test_type_outside_allowed_upload_types_is_made_unlisted(self):
        response = self.upload(title="image not allowed")
        media = Media.objects.get(friendly_token=response.data["friendly_token"])
        self.assertEqual(media.state, "unlisted")
        self.assertFalse(media.listable)
        listing = APIClient().get(MEDIA_LIST_URL)
        self.assertNotIn(media.friendly_token, [item["friendly_token"] for item in listing.data["results"]])

    @override_settings(PORTAL_WORKFLOW="private")
    def test_private_workflow_makes_uploads_private(self):
        media = Media.objects.get(friendly_token=self.upload().data["friendly_token"])
        self.assertEqual(media.state, "private")

    @override_settings(PORTAL_WORKFLOW="unlisted")
    def test_unlisted_workflow_makes_uploads_unlisted(self):
        media = Media.objects.get(friendly_token=self.upload().data["friendly_token"])
        self.assertEqual(media.state, "unlisted")

    @override_settings(PORTAL_WORKFLOW="private_verified")
    def test_private_verified_workflow_depends_on_advanced_user(self):
        media = Media.objects.get(friendly_token=self.upload().data["friendly_token"])
        self.assertEqual(media.state, "private")

        advanced = create_account()
        advanced.advancedUser = True
        advanced.save()
        client = APIClient()
        client.force_authenticate(advanced)
        media = Media.objects.get(friendly_token=self.upload(client=client).data["friendly_token"])
        self.assertEqual(media.state, "unlisted")

    @override_settings(CAN_ADD_MEDIA="email_verified")
    def test_email_verified_policy(self):
        self.assertEqual(self.upload().status_code, 403)
        EmailAddress.objects.create(user=self.user, email=self.user.email, verified=True, primary=True)
        self.assertEqual(self.upload().status_code, 201)

    @override_settings(CAN_ADD_MEDIA="advancedUser")
    def test_advanced_user_policy(self):
        self.assertEqual(self.upload().status_code, 403)
        self.user.advancedUser = True
        self.user.save()
        self.assertEqual(self.upload().status_code, 201)

    @override_settings(CAN_ADD_MEDIA="nobody")
    def test_unknown_policy_denies_regular_users_but_not_editors(self):
        self.assertEqual(self.upload().status_code, 403)
        editor = APIClient()
        editor.force_authenticate(create_account(is_editor=True))
        self.assertEqual(self.upload(client=editor).status_code, 201)

    @override_settings(NUMBER_OF_MEDIA_USER_CAN_UPLOAD=1)
    def test_upload_count_limit(self):
        self.assertEqual(self.upload().status_code, 201)
        response = self.upload()
        self.assertEqual(response.status_code, 403)
        self.assertIn("max number of media uploads", str(response.data["detail"]))
        self.assertEqual(Media.objects.filter(user=self.user).count(), 1)

    @override_settings(NUMBER_OF_MEDIA_USER_CAN_UPLOAD=0)
    def test_upload_count_limit_does_not_apply_to_editors(self):
        editor = APIClient()
        editor.force_authenticate(create_account(is_manager=True))
        self.assertEqual(self.upload(client=editor).status_code, 201)

    def test_get_is_allowed_even_when_uploads_are_not(self):
        with self.settings(CAN_ADD_MEDIA="nobody"):
            self.assertEqual(self.client.get(MEDIA_LIST_URL).status_code, 200)


class MediaEncodingInfoTest(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def test_transcoded_video_exposes_encodings_and_hls_info(self):
        owner = create_account()
        video = create_media(owner, filename="small_video.mp4", transcode=True, title="encoded video")
        self.assertEqual(video.encoding_status, "success")

        response = APIClient().get(f"/api/v1/media/{video.friendly_token}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["media_type"], "video")
        self.assertEqual(response.data["encoding_status"], "success")
        encodings = response.data["encodings_info"]
        self.assertTrue(encodings)
        successful = [info for resolution in encodings.values() for info in resolution.values() if info.get("status") == "success"]
        self.assertTrue(successful)
        self.assertTrue(all(info["url"] for info in successful))
        self.assertTrue(response.data["hls_info"])


class MediaSearchEdgeCasesTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = create_account()
        cls.other = create_account()
        cls.editor = create_account(is_editor=True)
        now = timezone.now()
        cls.public = create_media(cls.owner, title="Zebra public", state="public", add_date=now - timedelta(days=1))
        cls.old = create_media(cls.owner, title="Zebra ancient", state="public", add_date=now - timedelta(days=400))
        cls.private = create_media(cls.owner, title="Zebra private", state="private")
        cls.foreign = create_media(cls.other, title="Zebra foreign", state="public", add_date=now - timedelta(days=3))
        cls.video = create_media(cls.other, filename="small_video.mp4", title="Zebra video", state="public", add_date=now - timedelta(days=2))
        for media in Media.objects.all():
            media.update_search_vector()

    def search(self, user=None, **params):
        client = APIClient()
        if user:
            client.force_authenticate(user)
        response = client.get(SEARCH_URL, params)
        self.assertEqual(response.status_code, 200)
        return response

    def found(self, user=None, **params):
        return [item["title"] for item in self.search(user, **params).data["results"]]

    def test_empty_search_returns_empty_object(self):
        self.assertEqual(self.search().data, {})
        self.assertEqual(self.search(media_type="video").data, {})

    def test_anonymous_never_finds_private_media(self):
        self.assertNotIn("Zebra private", self.found(q="zebra"))

    def test_owner_finds_own_private_media(self):
        self.assertIn("Zebra private", self.found(self.owner, q="zebra"))
        self.assertNotIn("Zebra private", self.found(self.other, q="zebra"))

    def test_user_finds_media_shared_with_them(self):
        MediaPermission.objects.create(owner_user=self.owner, user=self.other, media=self.private, permission="viewer")
        self.assertIn("Zebra private", self.found(self.other, q="zebra"))

    def test_editor_finds_everything(self):
        self.assertEqual(len(self.found(self.editor, q="zebra")), 5)

    @override_settings(USE_RBAC=True)
    def test_rbac_member_finds_course_media(self):
        course = Category.objects.create(title="search course", is_rbac_category=True)
        group = RBACGroup.objects.create(name="search group")
        group.categories.add(course)
        RBACMembership.objects.create(user=self.other, rbac_group=group, role="member")
        self.private.category.add(course)
        self.assertIn("Zebra private", self.found(self.other, q="zebra"))

    def test_multi_word_query_requires_all_words(self):
        self.assertEqual(self.found(q="zebra foreign"), ["Zebra foreign"])

    def test_prefix_matching(self):
        self.assertIn("Zebra ancient", self.found(q="ancie"))

    def test_query_of_only_stop_words_matches_without_filtering(self):
        self.assertEqual(len(self.found(q="the")), 4)

    def test_author_filter(self):
        self.assertEqual(set(self.found(q="zebra", author=self.other.username)), {"Zebra foreign", "Zebra video"})

    def test_media_type_filter_and_unknown_type_ignored(self):
        self.assertEqual(self.found(q="zebra", media_type="video"), ["Zebra video"])
        self.assertEqual(len(self.found(q="zebra", media_type="spreadsheet")), 4)

    def test_upload_date_filter(self):
        self.assertNotIn("Zebra ancient", self.found(q="zebra", upload_date="this_week"))
        self.assertIn("Zebra public", self.found(q="zebra", upload_date="this_week"))
        self.assertNotIn("Zebra ancient", self.found(q="zebra", upload_date="this_year"))
        self.assertEqual(len(self.found(q="zebra", upload_date="whenever")), 4)

    def test_sorting(self):
        self.assertEqual(self.found(q="zebra"), ["Zebra public", "Zebra video", "Zebra foreign", "Zebra ancient"])
        self.assertEqual(self.found(q="zebra", sort_by="title_asc"), ["Zebra ancient", "Zebra foreign", "Zebra public", "Zebra video"])
        self.assertEqual(self.found(q="zebra", sort_by="title", ordering="asc"), ["Zebra ancient", "Zebra foreign", "Zebra public", "Zebra video"])
        self.assertEqual(self.found(q="zebra", sort_by="secret_desc")[0], "Zebra public")

    def test_show_titles_returns_plain_title_list(self):
        response = self.search(q="zebra", show="titles")
        self.assertEqual(sorted(item["title"] for item in response.data), ["Zebra ancient", "Zebra foreign", "Zebra public", "Zebra video"])

    def test_unknown_tag_returns_no_results(self):
        self.assertEqual(self.found(t="nosuchsearchtag"), [])

    def test_tag_and_query_combine(self):
        tag = Tag.objects.create(title="stripes", user=self.owner)
        self.foreign.tags.add(tag)
        self.assertEqual(self.found(q="zebra", t="stripes"), ["Zebra foreign"])

    def test_search_results_use_search_serializer_fields(self):
        item = self.search(q="foreign").data["results"][0]
        self.assertEqual(item["friendly_token"], self.foreign.friendly_token)
        self.assertTrue(item["api_url"].endswith(f"/api/v1/media/{self.foreign.friendly_token}"))
        self.assertEqual(item["categories_info"], [])
        self.assertNotIn("state", item)
