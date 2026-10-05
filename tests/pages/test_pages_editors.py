import json
import uuid
from unittest import mock

from django.contrib.messages import get_messages
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from files.models import (
    Category,
    Media,
    MediaPermission,
    VideoChapterData,
    VideoTrimRequest,
)
from files.tests import create_account, create_media, fixture_path
from files.tests.media_utils import IMAGE_JPG, SMALL_VIDEO


def message_texts(response):
    return [str(message) for message in get_messages(response.wsgi_request)]


class EditorPageAccessMixin:
    url = None
    template = None

    @classmethod
    def setUpTestData(cls):
        cls.owner = create_account()
        cls.other = create_account()
        cls.editor = create_account(is_editor=True)
        cls.manager = create_account(is_manager=True)
        cls.admin = create_account(is_superuser=True)
        cls.shared_editor = create_account()
        cls.media = cls.create_target_media()
        MediaPermission.objects.create(owner_user=cls.owner, user=cls.shared_editor, media=cls.media, permission="editor")

    @classmethod
    def create_target_media(cls):
        return create_media(cls.owner, title=f"editor page {uuid.uuid4().hex[:6]}")

    def open(self, user=None, token=None):
        if user:
            self.client.force_login(user)
        params = {"m": self.media.friendly_token if token is None else token}
        return self.client.get(self.url, params)

    def test_anonymous_user_is_sent_to_login(self):
        response = self.open()
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response["Location"].startswith("/accounts/login/?next="))

    def test_missing_or_unknown_token_redirects_home(self):
        for token in ["", "doesnotexist"]:
            with self.subTest(token=token):
                self.assertRedirects(self.open(self.owner, token=token), "/", fetch_redirect_response=False)

    def test_other_user_is_redirected_home(self):
        self.assertRedirects(self.open(self.other), "/", fetch_redirect_response=False)

    def test_owner_and_portal_staff_can_open_the_page(self):
        for user in [self.owner, self.editor, self.manager, self.admin]:
            with self.subTest(user=user.username):
                response = self.open(user)
                self.assertEqual(response.status_code, 200)
                self.assertTemplateUsed(response, self.template)
                self.assertEqual(response.context["media_object"], self.media)


class EditMediaPageAccessTest(EditorPageAccessMixin, TestCase):
    url = "/edit"
    template = "cms/edit_media.html"

    def test_user_shared_as_editor_can_open_the_page(self):
        self.assertEqual(self.open(self.shared_editor).status_code, 200)

    @override_settings(ALLOWED_MEDIA_UPLOAD_TYPES=["video"])
    def test_disallowed_media_type_redirects_to_the_media_page(self):
        self.assertRedirects(self.open(self.owner), self.media.get_absolute_url(), fetch_redirect_response=False)


class PublishMediaPageAccessTest(EditorPageAccessMixin, TestCase):
    url = "/publish"
    template = "cms/publish_media.html"

    def test_user_shared_as_editor_may_not_publish(self):
        response = self.open(self.shared_editor)
        self.assertRedirects(response, self.media.get_absolute_url(), fetch_redirect_response=False)
        self.assertTrue(any("Permission to publish is not grated by the owner" in text for text in message_texts(response)))

    def test_user_shared_as_owner_may_publish(self):
        co_owner = create_account()
        MediaPermission.objects.create(owner_user=self.owner, user=co_owner, media=self.media, permission="owner")
        self.assertEqual(self.open(co_owner).status_code, 200)


class AddSubtitlePageAccessTest(EditorPageAccessMixin, TestCase):
    url = "/add_subtitle"
    template = "cms/add_subtitle.html"


class EditChaptersPageTest(EditorPageAccessMixin, TestCase):
    url = "/edit_chapters"
    template = "cms/edit_chapters.html"

    def test_existing_chapters_are_embedded_with_html_escaped(self):
        VideoChapterData.objects.create(media=self.media, data=[{"startTime": 0, "endTime": 2, "chapterTitle": "</script><b>"}])
        response = self.open(self.owner)
        self.assertEqual(response.context["media_id"], self.media.friendly_token)
        self.assertIn("\\u003C/script\\u003E\\u003Cb\\u003E", str(response.context["chapters"]))
        self.assertNotContains(response, "</script><b>")


@override_settings(ALLOW_MEDIA_REPLACEMENT=True)
class ReplaceMediaPageAccessTest(EditorPageAccessMixin, TestCase):
    url = "/replace_media"
    template = "cms/replace_media.html"

    @override_settings(ALLOW_MEDIA_REPLACEMENT=False)
    def test_page_is_off_unless_replacement_is_allowed(self):
        self.assertRedirects(self.open(self.owner), "/", fetch_redirect_response=False)

    @override_settings(ALLOWED_MEDIA_UPLOAD_TYPES=["video"])
    def test_disallowed_media_type_redirects_to_the_media_page(self):
        self.assertRedirects(self.open(self.owner), self.media.get_absolute_url(), fetch_redirect_response=False)


@override_settings(ALLOW_MEDIA_REPLACEMENT=True)
class ReplaceMediaSubmitTest(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        self.owner = create_account()
        self.media = create_media(self.owner, title="to be replaced")
        self.client.force_login(self.owner)

    def post_file(self, upload):
        return self.client.post(f"/replace_media?m={self.media.friendly_token}", {"new_media_file": upload})

    @override_settings(PORTAL_WORKFLOW="private")
    def test_replacing_the_file_swaps_media_file_and_resets_state_to_the_default(self):
        Media.objects.filter(pk=self.media.pk).update(state="public")
        old_file = self.media.media_file.name
        with open(fixture_path(IMAGE_JPG), "rb") as fp:
            response = self.post_file(SimpleUploadedFile("replacement.jpg", fp.read(), content_type="image/jpeg"))
        self.assertRedirects(response, self.media.get_absolute_url(), fetch_redirect_response=False)
        self.assertIn("Media file was replaced successfully", message_texts(response))
        media = Media.objects.get(pk=self.media.pk)
        self.assertNotEqual(media.media_file.name, old_file)
        self.assertTrue(media.media_file.name.endswith(".replacement.jpg"))
        self.assertEqual(media.state, "private")
        self.assertFalse(media.listable)

    @override_settings(UPLOAD_MAX_SIZE=10)
    def test_oversized_replacement_is_rejected(self):
        old_file = self.media.media_file.name
        response = self.post_file(SimpleUploadedFile("big.jpg", b"x" * 100, content_type="image/jpeg"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("new_media_file", response.context["form"].errors)
        self.assertEqual(Media.objects.get(pk=self.media.pk).media_file.name, old_file)

    def test_submitting_without_a_file_keeps_the_original(self):
        old_file = self.media.media_file.name
        response = self.client.post(f"/replace_media?m={self.media.friendly_token}", {})
        self.assertIn("new_media_file", response.context["form"].errors)
        self.assertEqual(Media.objects.get(pk=self.media.pk).media_file.name, old_file)


class EditVideoPageTest(EditorPageAccessMixin, TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]
    url = "/edit_video"
    template = "cms/edit_video.html"

    @classmethod
    def create_target_media(cls):
        return create_media(cls.owner, filename=SMALL_VIDEO, title="trimmer video")

    def test_video_url_falls_back_to_the_original_file(self):
        response = self.open(self.owner)
        self.assertEqual(response.context["media_file_path"], self.media.trim_video_url)
        self.assertTrue(response.context["media_file_path"].endswith(".mp4"))

    def test_image_cannot_be_trimmed(self):
        image = create_media(self.owner, title="not trimmable")
        response = self.open(self.owner, token=image.friendly_token)
        self.assertRedirects(response, image.get_absolute_url(), fetch_redirect_response=False)
        self.assertIn("Media is not video or audio", message_texts(response))

    @override_settings(ALLOW_VIDEO_TRIMMER=False)
    def test_trimmer_can_be_disabled(self):
        response = self.open(self.owner)
        self.assertRedirects(response, self.media.get_absolute_url(), fetch_redirect_response=False)
        self.assertIn("Video Trimmer is not enabled", message_texts(response))

    def test_page_is_refused_while_a_trim_is_running(self):
        VideoTrimRequest.objects.create(media=self.media, status="running", video_action="replace", timestamps=[])
        response = self.open(self.owner)
        self.assertRedirects(response, self.media.get_absolute_url(), fetch_redirect_response=False)
        self.assertIn("Video trim request is already running", message_texts(response))

    def test_owner_is_warned_while_encoding_is_pending(self):
        Media.objects.filter(pk=self.media.pk).update(encoding_status="pending")
        response = self.open(self.owner)
        self.assertEqual(response.status_code, 200)
        self.assertIn("Media encoding hasn't finished yet. Attempting to show the original video file", message_texts(response))


class TrimVideoEndpointTest(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.owner = create_account()
        cls.other = create_account()
        cls.video = create_media(cls.owner, filename=SMALL_VIDEO, title="trim endpoint video")

    def trim(self, user, payload, method="post"):
        self.client.force_login(user)
        url = f"/api/v1/media/{self.video.friendly_token}/trim_video"
        if method == "get":
            return self.client.get(url)
        return self.client.post(url, payload, content_type="application/json")

    @mock.patch("files.views.pages.video_trim_task")
    def test_owner_creates_a_trim_request_and_queues_the_task(self, task):
        response = self.trim(self.owner, {"segments": [{"startTime": "00:00:01", "endTime": "00:00:03"}], "saveAsCopy": True})
        self.assertEqual(response.status_code, 200)
        request_id = response.json()["request_id"]
        trim_request = VideoTrimRequest.objects.get(id=request_id)
        self.assertEqual(trim_request.video_action, "save_new")
        self.assertEqual(trim_request.status, "initial")
        task.delay.assert_called_once_with(request_id)

    @mock.patch("files.views.pages.video_trim_task")
    def test_second_request_is_refused_while_one_is_in_progress(self, task):
        VideoTrimRequest.objects.create(media=self.video, status="initial", video_action="replace", timestamps=[])
        response = self.trim(self.owner, {"segments": []})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "A trim request is already in progress for this video")
        task.delay.assert_not_called()

    @mock.patch("files.views.pages.video_trim_task")
    def test_other_user_cannot_trim(self, task):
        self.assertRedirects(self.trim(self.other, {"segments": []}), "/", fetch_redirect_response=False)
        self.assertFalse(VideoTrimRequest.objects.filter(media=self.video).exists())

    @mock.patch("files.views.pages.video_trim_task")
    def test_malformed_body_is_a_400(self, task):
        self.client.force_login(self.owner)
        response = self.client.post(f"/api/v1/media/{self.video.friendly_token}/trim_video", "not json", content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Incorrect request data")

    def test_get_redirects_home(self):
        self.assertRedirects(self.trim(self.owner, None, method="get"), "/", fetch_redirect_response=False)

    @override_settings(ALLOW_VIDEO_TRIMMER=False)
    def test_disabled_trimmer_refuses_requests(self):
        response = self.trim(self.owner, {"segments": []})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Video trimming is not allowed")


class VideoChaptersEndpointTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = create_account()
        cls.other = create_account()
        cls.media = create_media(cls.owner, title="chapters endpoint media")

    def post(self, body, user=None):
        self.client.force_login(user or self.owner)
        data = body if isinstance(body, str) else json.dumps(body)
        return self.client.post(f"/api/v1/media/{self.media.friendly_token}/chapters", data, content_type="application/json")

    def test_valid_chapters_are_stored_and_returned(self):
        chapters = [
            {"startTime": "00:00:00.000", "endTime": "00:00:05.500", "chapterTitle": "Intro"},
            {"startTime": 5.5, "endTime": 10, "chapterTitle": "<b>Main</b> part"},
        ]
        response = self.post({"chapters": chapters})
        self.assertEqual(response.status_code, 200)
        expected = [
            {"startTime": "00:00:00.000", "endTime": "00:00:05.500", "chapterTitle": "Intro"},
            {"startTime": 5.5, "endTime": 10.0, "chapterTitle": "Main part"},
        ]
        self.assertEqual(response.json(), {"chapters": expected})
        self.assertEqual(Media.objects.get(pk=self.media.pk).chapter_data, expected)

    def test_posting_again_replaces_the_chapters(self):
        self.post({"chapters": [{"startTime": 0, "endTime": 1, "chapterTitle": "first"}]})
        self.post({"chapters": [{"startTime": 2, "endTime": 3, "chapterTitle": "second"}]})
        self.assertEqual(VideoChapterData.objects.filter(media=self.media).count(), 1)
        self.assertEqual([c["chapterTitle"] for c in Media.objects.get(pk=self.media.pk).chapter_data], ["second"])

    def test_invalid_chapters_are_dropped(self):
        chapters = [
            "not a dict",
            {"startTime": "bad", "endTime": 2, "chapterTitle": "unparseable start"},
            {"startTime": 3, "endTime": 2, "chapterTitle": "ends before it starts"},
            {"startTime": -1, "endTime": 2, "chapterTitle": "negative"},
            {"startTime": True, "endTime": 2, "chapterTitle": "boolean time"},
            {"startTime": 0, "endTime": 2, "chapterTitle": "   "},
            {"startTime": 0, "endTime": 2, "chapterTitle": "<i></i>"},
            {"startTime": 0, "endTime": 2, "chapterTitle": 7},
            {"startTime": "01:00:00", "endTime": "01:00:01.5", "chapterTitle": "kept"},
        ]
        response = self.post({"chapters": chapters})
        self.assertEqual([c["chapterTitle"] for c in response.json()["chapters"]], ["kept"])

    def test_request_shape_errors_are_400(self):
        cases = {
            "missing chapters": ({"other": []}, 'Request must contain "chapters" array'),
            "chapters not a list": ({"chapters": "x"}, '"chapters" must be an array'),
            "too many": ({"chapters": [{}] * 201}, "Too many chapters (max 200)"),
        }
        for name, (body, error) in cases.items():
            with self.subTest(name):
                response = self.post(body)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()["error"], error)

    def test_body_that_is_not_json_is_400(self):
        self.assertEqual(self.post("{not json").status_code, 400)

    def test_other_user_cannot_set_chapters(self):
        self.assertRedirects(self.post({"chapters": []}, user=self.other), "/", fetch_redirect_response=False)
        self.assertFalse(VideoChapterData.objects.filter(media=self.media).exists())

    def test_get_redirects_home(self):
        self.client.force_login(self.owner)
        self.assertRedirects(self.client.get(f"/api/v1/media/{self.media.friendly_token}/chapters"), "/", fetch_redirect_response=False)

    def test_unknown_media_redirects_home(self):
        self.client.force_login(self.owner)
        response = self.client.post("/api/v1/media/doesnotexist/chapters", "{}", content_type="application/json")
        self.assertRedirects(response, "/", fetch_redirect_response=False)


class EditCategoryPageTest(TestCase):
    fixtures = ["fixtures/categories.json"]

    @classmethod
    def setUpTestData(cls):
        cls.user = create_account()
        cls.editor = create_account(is_editor=True)
        cls.manager = create_account(is_manager=True)
        cls.category = Category.objects.get(title="Art")

    def test_unknown_category_redirects_home(self):
        self.client.force_login(self.manager)
        self.assertRedirects(self.client.get("/edit_category/doesnotexist"), "/", fetch_redirect_response=False)

    def test_users_and_editors_are_sent_back_to_the_category(self):
        for user in [None, self.user, self.editor]:
            with self.subTest(user=user and user.username):
                self.client.logout()
                if user:
                    self.client.force_login(user)
                response = self.client.get(f"/edit_category/{self.category.uid}")
                self.assertRedirects(response, self.category.get_absolute_url(), fetch_redirect_response=False)

    def test_manager_updates_title_and_description(self):
        self.client.force_login(self.manager)
        self.assertTemplateUsed(self.client.get(f"/edit_category/{self.category.uid}"), "cms/edit_category.html")
        response = self.client.post(f"/edit_category/{self.category.uid}", {"title": "  Fine Art  ", "description": "paintings"})
        self.assertRedirects(response, self.category.get_absolute_url(), fetch_redirect_response=False)
        category = Category.objects.get(pk=self.category.pk)
        self.assertEqual((category.title, category.description), ("Fine Art", "paintings"))

    def test_blank_title_is_rejected(self):
        self.client.force_login(self.manager)
        response = self.client.post(f"/edit_category/{self.category.uid}", {"title": "   ", "description": ""})
        self.assertEqual(response.status_code, 200)
        self.assertIn("title", response.context["form"].errors)
        self.assertEqual(Category.objects.get(pk=self.category.pk).title, "Art")


class UploadAndRecordPagesTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = create_account()
        cls.editor = create_account(is_editor=True)

    def test_upload_and_record_pages_require_login(self):
        for url in ["/upload", "/record_screen", "/scpublisher"]:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 302)
                self.assertTrue(response["Location"].startswith("/accounts/login/"))

    @override_settings(CAN_ADD_MEDIA="all")
    def test_logged_in_user_may_upload_when_open_to_all(self):
        self.client.force_login(self.user)
        for url, template in [("/upload", "cms/add-media.html"), ("/record_screen", "cms/record_screen.html")]:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertTemplateUsed(response, template)
                self.assertTrue(response.context["can_add"])

    @override_settings(CAN_ADD_MEDIA="advancedUser")
    def test_regular_user_is_told_why_upload_is_not_possible(self):
        self.client.force_login(self.user)
        response = self.client.get("/upload")
        self.assertFalse(response.context["can_add"])
        self.assertEqual(response.context["can_upload_exp"], "User cannot add media, or maximum number of media uploads has been reached.")

    @override_settings(CAN_ADD_MEDIA="advancedUser")
    def test_editor_may_always_upload(self):
        self.client.force_login(self.editor)
        self.assertTrue(self.client.get("/upload").context["can_add"])
