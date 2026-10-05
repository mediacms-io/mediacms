import json

from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from actions.models import MediaAction
from files.models import Category, EmbedMediaCourse, Media, MediaPermission
from files.tests import create_account, create_media


def actions_url(media):
    return f"/api/v1/media/{media.friendly_token}/actions"


class MediaActionsPostTest(TestCase):
    def setUp(self):
        self.owner = create_account()
        self.user = create_account()
        self.media = create_media(self.owner, title="actions media", state="public")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def act(self, action, client=None, **extra):
        payload = {"type": action, **extra}
        return (client or self.client).post(actions_url(self.media), payload, format="json")

    def test_like_is_recorded_once_per_user(self):
        likes_before = self.media.likes
        self.assertEqual(self.act("like").status_code, 201)
        self.assertEqual(self.act("like").status_code, 201)
        self.media.refresh_from_db()
        self.assertEqual(self.media.likes, likes_before + 1)
        self.assertEqual(MediaAction.objects.filter(media=self.media, user=self.user, action="like").count(), 1)

    def test_dislike_increments_dislikes(self):
        dislikes_before = self.media.dislikes
        self.act("dislike")
        self.media.refresh_from_db()
        self.assertEqual(self.media.dislikes, dislikes_before + 1)
        self.assertTrue(MediaAction.objects.filter(media=self.media, user=self.user, action="dislike").exists())

    def test_watch_increments_views_and_keeps_one_watch_record(self):
        views_before = self.media.views
        self.act("watch")
        self.act("watch")
        self.media.refresh_from_db()
        self.assertGreater(self.media.views, views_before)
        self.assertEqual(MediaAction.objects.filter(media=self.media, user=self.user, action="watch").count(), 1)

    def test_report_increments_reported_times_stores_reason_and_notifies(self):
        mail.outbox = []
        response = self.act("report", extra_info="offensive content")
        self.assertEqual(response.status_code, 201)
        self.media.refresh_from_db()
        self.assertEqual(self.media.reported_times, 1)
        self.assertEqual(self.media.state, "public")
        self.assertEqual(MediaAction.objects.get(media=self.media, action="report").extra_info, "offensive content")
        self.assertTrue(any("offensive content" in message.body for message in mail.outbox))

    def test_same_user_cannot_report_twice(self):
        self.act("report", extra_info="first")
        self.act("report", extra_info="second")
        self.media.refresh_from_db()
        self.assertEqual(self.media.reported_times, 1)

    @override_settings(REPORTED_TIMES_THRESHOLD=2)
    def test_media_becomes_private_once_reports_reach_threshold(self):
        self.act("report", extra_info="one")
        self.media.refresh_from_db()
        self.assertEqual(self.media.state, "public")

        second = APIClient()
        second.force_authenticate(create_account())
        self.act("report", client=second, extra_info="two")
        self.media.refresh_from_db()
        self.assertEqual(self.media.reported_times, 2)
        self.assertEqual(self.media.state, "private")

    @override_settings(REPORTED_TIMES_THRESHOLD=1)
    def test_media_made_private_by_reports_leaves_the_public_listings(self):
        self.assertTrue(Media.objects.get(pk=self.media.pk).listable)
        self.act("report", extra_info="spam")
        self.media.refresh_from_db()
        self.assertEqual(self.media.state, "private")
        self.assertFalse(self.media.listable)
        listing = APIClient().get("/api/v1/media")
        self.assertNotIn(self.media.friendly_token, [item["friendly_token"] for item in listing.data["results"]])

    def test_unknown_action_is_accepted_but_not_recorded(self):
        self.assertEqual(self.act("explode").status_code, 201)
        self.assertFalse(MediaAction.objects.filter(media=self.media).exists())

    def test_missing_action_is_rejected(self):
        response = self.client.post(actions_url(self.media), {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "no action specified")

    def test_unknown_media_is_rejected(self):
        response = self.client.post("/api/v1/media/doesnotexist/actions", {"type": "like"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_actions_on_private_media_are_rejected_for_non_owner(self):
        Media.objects.filter(pk=self.media.pk).update(state="private")
        response = self.act("like")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "media is private")
        self.assertFalse(MediaAction.objects.filter(media=self.media).exists())

    def test_owner_can_act_on_own_private_media(self):
        Media.objects.filter(pk=self.media.pk).update(state="private")
        owner_client = APIClient()
        owner_client.force_authenticate(self.owner)
        self.assertEqual(self.act("like", client=owner_client).status_code, 201)
        self.assertTrue(MediaAction.objects.filter(media=self.media, user=self.owner, action="like").exists())


class MediaActionsAnonymousTest(TestCase):
    def setUp(self):
        self.owner = create_account()
        self.media = create_media(self.owner, title="anonymous actions media", state="public")

    def act(self, action):
        return self.client.post(actions_url(self.media), json.dumps({"type": action}), content_type="application/json")

    def test_anonymous_like_is_recorded_against_the_session(self):
        likes_before = self.media.likes
        self.assertEqual(self.act("like").status_code, 201)
        action = MediaAction.objects.get(media=self.media, action="like")
        self.assertIsNone(action.user)
        self.assertTrue(action.session_key)
        self.media.refresh_from_db()
        self.assertEqual(self.media.likes, likes_before + 1)

    def test_anonymous_like_from_same_session_is_not_counted_twice(self):
        likes_before = self.media.likes
        self.act("like")
        self.act("like")
        self.media.refresh_from_db()
        self.assertEqual(self.media.likes, likes_before + 1)

    def test_anonymous_action_not_in_allowed_list_is_rejected(self):
        response = self.act("rate")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "action allowed on logged in users only")

    @override_settings(ALLOW_ANONYMOUS_ACTIONS=["watch"])
    def test_anonymous_actions_follow_the_allowed_list(self):
        self.assertEqual(self.act("like").status_code, 400)
        self.assertEqual(self.act("report").status_code, 400)
        self.assertEqual(self.act("watch").status_code, 201)
        self.assertEqual(list(MediaAction.objects.filter(media=self.media).values_list("action", flat=True)), ["watch"])

    def test_anonymous_cannot_act_on_private_media(self):
        Media.objects.filter(pk=self.media.pk).update(state="private")
        self.assertEqual(self.act("like").status_code, 400)


class MediaActionsReportsTest(TestCase):
    def setUp(self):
        self.owner = create_account()
        self.reporter = create_account()
        self.media = create_media(self.owner, title="reported media", state="public")
        MediaAction.objects.create(user=self.reporter, media=self.media, action="report", extra_info="spam")
        Media.objects.filter(pk=self.media.pk).update(reported_times=1)

    def client_for(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def test_owner_sees_report_reasons(self):
        response = self.client_for(self.owner).get(actions_url(self.media))
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["reason"] for item in response.data["reported"]], ["spam"])
        self.assertIsNotNone(response.data["reported"][0]["reported_date"])

    def test_editor_sees_report_reasons(self):
        response = self.client_for(create_account(is_editor=True)).get(actions_url(self.media))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["reported"]), 1)

    def test_other_users_cannot_see_report_reasons(self):
        response = self.client_for(self.reporter).get(actions_url(self.media))
        self.assertEqual(response.status_code, 400)
        self.assertNotIn("reported", response.data)
        self.assertEqual(APIClient().get(actions_url(self.media)).status_code, 400)

    def test_superuser_can_reset_reports(self):
        response = self.client_for(create_account(is_superuser=True)).delete(actions_url(self.media), {"type": "report"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.media.refresh_from_db()
        self.assertEqual(self.media.reported_times, 0)
        self.assertFalse(MediaAction.objects.filter(media=self.media, action="report").exists())

    def test_reset_requires_an_action_type(self):
        response = self.client_for(create_account(is_superuser=True)).delete(actions_url(self.media), {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "no action specified")

    def test_non_superusers_cannot_reset_reports(self):
        for user in (self.owner, create_account(is_editor=True), create_account(is_manager=True)):
            response = self.client_for(user).delete(actions_url(self.media), {"type": "report"}, format="json")
            self.assertEqual(response.status_code, 400)
        self.media.refresh_from_db()
        self.assertEqual(self.media.reported_times, 1)
        self.assertTrue(MediaAction.objects.filter(media=self.media, action="report").exists())

    def test_reset_on_unknown_media_is_rejected(self):
        response = self.client_for(create_account(is_superuser=True)).delete("/api/v1/media/doesnotexist/actions", {"type": "report"}, format="json")
        self.assertEqual(response.status_code, 400)


class VideoChaptersTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = create_account()
        cls.other = create_account()
        cls.media = create_media(cls.owner, title="chapters media", state="public")

    def post(self, user, payload, raw=None):
        if user:
            self.client.force_login(user)
        body = raw if raw is not None else json.dumps(payload)
        return self.client.post(f"/api/v1/media/{self.media.friendly_token}/chapters", body, content_type="application/json")

    def test_owner_saves_valid_chapters_and_invalid_ones_are_dropped(self):
        chapters = [
            {"startTime": "00:00:00", "endTime": "00:00:10.5", "chapterTitle": "Intro"},
            {"startTime": 10.5, "endTime": 20, "chapterTitle": "<b>Main</b>"},
            {"startTime": "00:00:30", "endTime": "00:00:20", "chapterTitle": "backwards"},
            {"startTime": "bad", "endTime": "00:00:40", "chapterTitle": "unparseable"},
            {"startTime": "00:00:40", "endTime": "00:00:50", "chapterTitle": "   "},
            {"startTime": True, "endTime": 60, "chapterTitle": "boolean"},
            "not a dict",
        ]
        response = self.post(self.owner, {"chapters": chapters})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["chapters"],
            [
                {"startTime": "00:00:00", "endTime": "00:00:10.5", "chapterTitle": "Intro"},
                {"startTime": 10.5, "endTime": 20.0, "chapterTitle": "Main"},
            ],
        )
        self.media.refresh_from_db()
        self.assertEqual(len(self.media.chapter_data), 2)

    def test_saving_again_replaces_existing_chapters(self):
        self.post(self.owner, {"chapters": [{"startTime": 0, "endTime": 5, "chapterTitle": "first"}]})
        response = self.post(self.owner, {"chapters": [{"startTime": 5, "endTime": 9, "chapterTitle": "second"}]})
        self.assertEqual([c["chapterTitle"] for c in response.json()["chapters"]], ["second"])
        self.assertEqual(self.media.chapters.count(), 1)

    def test_request_without_chapters_key_is_rejected(self):
        response = self.post(self.owner, {"other": []})
        self.assertEqual(response.status_code, 400)
        self.assertIn("chapters", response.json()["error"])

    def test_chapters_must_be_a_list(self):
        self.assertEqual(self.post(self.owner, {"chapters": {"a": 1}}).status_code, 400)

    def test_too_many_chapters_are_rejected(self):
        chapters = [{"startTime": i, "endTime": i + 1, "chapterTitle": f"c{i}"} for i in range(201)]
        response = self.post(self.owner, {"chapters": chapters})
        self.assertEqual(response.status_code, 400)
        self.assertIn("max 200", response.json()["error"])

    def test_malformed_json_is_rejected(self):
        self.assertEqual(self.post(self.owner, None, raw="{not json").status_code, 400)

    def test_other_user_is_redirected_and_nothing_is_saved(self):
        response = self.post(self.other, {"chapters": [{"startTime": 0, "endTime": 5, "chapterTitle": "x"}]})
        self.assertRedirects(response, "/", fetch_redirect_response=False)
        self.assertFalse(self.media.chapters.exists())

    def test_user_shared_as_editor_can_save_chapters(self):
        MediaPermission.objects.create(owner_user=self.owner, user=self.other, media=self.media, permission="editor")
        response = self.post(self.other, {"chapters": [{"startTime": 0, "endTime": 5, "chapterTitle": "shared"}]})
        self.assertEqual(response.status_code, 200)

    def test_anonymous_is_sent_to_login(self):
        response = self.post(None, {"chapters": []})
        self.assertEqual(response.status_code, 302)
        self.assertIn("login", response["Location"])

    def test_get_and_unknown_media_redirect_home(self):
        self.client.force_login(self.owner)
        self.assertRedirects(self.client.get(f"/api/v1/media/{self.media.friendly_token}/chapters"), "/", fetch_redirect_response=False)
        response = self.client.post("/api/v1/media/doesnotexist/chapters", "{}", content_type="application/json")
        self.assertRedirects(response, "/", fetch_redirect_response=False)


class MediaShareTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = create_account()
        cls.media = create_media(cls.owner, title="share media", state="private")
        cls.course = Category.objects.create(title="share course", is_rbac_category=True, lti_context_id="course-42")

    def share_url(self, media=None):
        return f"/api/v1/media/{(media or self.media).friendly_token}/share"

    def test_anonymous_gets_401(self):
        self.assertEqual(self.client.post(self.share_url()).status_code, 401)

    def test_get_is_not_allowed(self):
        self.client.force_login(self.owner)
        self.assertEqual(self.client.get(self.share_url()).status_code, 405)

    def test_non_owner_gets_403(self):
        self.client.force_login(create_account())
        self.assertEqual(self.client.post(self.share_url()).status_code, 403)
        self.assertFalse(MediaPermission.objects.filter(media=self.media).exists())

    def test_unknown_media_returns_404(self):
        self.client.force_login(self.owner)
        self.assertEqual(self.client.post("/api/v1/media/doesnotexist/share").status_code, 404)

    def test_owner_share_creates_owner_permission_idempotently(self):
        self.client.force_login(self.owner)
        self.assertEqual(self.client.post(self.share_url()).status_code, 200)
        self.assertEqual(self.client.post(self.share_url()).status_code, 200)
        permission = MediaPermission.objects.get(media=self.media)
        self.assertEqual(permission.user, self.owner)
        self.assertEqual(permission.permission, "owner")
        self.assertFalse(EmbedMediaCourse.objects.filter(media=self.media).exists())

    def test_share_into_known_course_records_the_embed(self):
        self.client.force_login(self.owner)
        self.client.post(self.share_url(), {"courseid": "course-42"})
        self.assertTrue(EmbedMediaCourse.objects.filter(media=self.media, category=self.course).exists())

    def test_share_into_unknown_course_records_no_embed(self):
        self.client.force_login(self.owner)
        self.assertEqual(self.client.post(self.share_url(), {"courseid": "unknown"}).status_code, 200)
        self.assertFalse(EmbedMediaCourse.objects.filter(media=self.media).exists())


class MediaActionsGetTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = create_account()
        cls.other = create_account()
        cls.private = create_media(cls.owner, title="private reported", state="private")

    def get_as(self, user, token):
        client = APIClient()
        client.force_authenticate(user)
        return client.get(f"/api/v1/media/{token}/actions")

    def test_an_unknown_token_is_a_400_not_a_crash(self):
        response = self.get_as(self.owner, "doesnotexist")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "media file does not exist")

    def test_someone_elses_private_media_is_a_400_not_a_crash(self):
        response = self.get_as(self.other, self.private.friendly_token)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "media is private")

    def test_the_owner_reads_the_reports_of_their_media(self):
        MediaAction.objects.create(media=self.private, user=self.other, action="report", extra_info="spam")
        response = self.get_as(self.owner, self.private.friendly_token)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["reason"] for item in response.data["reported"]], ["spam"])
