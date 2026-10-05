import os
import tempfile
import uuid
from datetime import timedelta
from types import SimpleNamespace
from unittest import mock

from django.conf import settings
from django.core.cache import cache
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from actions.models import MediaAction
from files import tasks
from files.helpers import mask_ip
from files.models import (
    Category,
    EncodeProfile,
    Encoding,
    Language,
    Media,
    Rating,
    RatingCategory,
    Subtitle,
    Tag,
    TranscriptionRequest,
)
from files.tests import create_account, create_media
from files.tests.media_utils import IMAGE, SMALL_VIDEO

FIXTURES = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

VTT = "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\npipeline words\n"


def age(queryset, **delta):
    queryset.update(action_date=timezone.now() - timedelta(**delta))


def fake_whisper(cmd, cwd=None):
    output_dir = cmd[cmd.index("--output_dir") + 1]
    base = os.path.splitext(os.path.basename(cmd[1]))[0]
    with open(os.path.join(output_dir, f"{base}.vtt"), "w") as handle:
        handle.write(VTT)
    return {"out": "", "error": ""}


class WhisperTranscribeTest(TestCase):
    fixtures = FIXTURES

    @classmethod
    def setUpTestData(cls):
        cls.video = create_media(create_account(), SMALL_VIDEO)

    def test_a_transcription_becomes_a_whisper_subtitle(self):
        request = TranscriptionRequest.objects.create(media=self.video)

        with mock.patch.object(tasks, "run_command", side_effect=fake_whisper) as run:
            self.assertTrue(tasks.whisper_transcribe(self.video.friendly_token))

        cmd = run.call_args.args[0]
        self.assertEqual(cmd[:2], ["whisper", self.video.media_file.path])
        self.assertNotIn("translate", cmd)
        subtitle = Subtitle.objects.get(media=self.video)
        self.assertEqual(subtitle.language.code, "whisper")
        self.assertEqual(subtitle.user, self.video.user)
        with open(subtitle.subtitle_file.path) as handle:
            self.assertEqual(handle.read(), VTT)
        request.refresh_from_db()
        self.assertEqual(request.status, "success")
        self.assertIn("Transcription took", request.logs)

    def test_a_translation_request_uses_the_translate_task_and_language(self):
        TranscriptionRequest.objects.create(media=self.video, translate_to_english=True)

        with mock.patch.object(tasks, "run_command", side_effect=fake_whisper) as run:
            self.assertTrue(tasks.whisper_transcribe(self.video.friendly_token, translate_to_english=True))

        self.assertEqual(run.call_args.args[0][-2:], ["--task", "translate"])
        self.assertEqual(Subtitle.objects.get(media=self.video).language.code, "whisper-translation")

    def test_an_existing_whisper_language_is_reused(self):
        existing = Language.objects.create(code="whisper", title="Transcription")
        TranscriptionRequest.objects.create(media=self.video)

        with mock.patch.object(tasks, "run_command", side_effect=fake_whisper):
            tasks.whisper_transcribe(self.video.friendly_token)

        self.assertEqual(Subtitle.objects.get(media=self.video).language, existing)
        self.assertEqual(Language.objects.filter(code="whisper").count(), 1)

    def test_whisper_producing_nothing_fails_the_request_with_its_error(self):
        request = TranscriptionRequest.objects.create(media=self.video)

        with mock.patch.object(tasks, "run_command", return_value={"error": "model not found"}):
            self.assertFalse(tasks.whisper_transcribe(self.video.friendly_token))

        request.refresh_from_db()
        self.assertEqual(request.status, "fail")
        self.assertIn("model not found", request.logs)
        self.assertFalse(Subtitle.objects.filter(media=self.video).exists())

    def test_without_a_pending_request_whisper_is_not_run(self):
        TranscriptionRequest.objects.create(media=self.video, status="success")

        with mock.patch.object(tasks, "run_command") as run:
            self.assertFalse(tasks.whisper_transcribe(self.video.friendly_token))
            self.assertFalse(tasks.whisper_transcribe("nosuchtoken"))

        run.assert_not_called()


class SaveUserActionTest(TestCase):
    fixtures = FIXTURES

    @classmethod
    def setUpTestData(cls):
        cls.owner = create_account()
        cls.viewer = create_account()

    def setUp(self):
        self.media = create_media(self.owner, IMAGE, state="public")
        self.baseline = (self.media.views, self.media.likes, self.media.dislikes)

    def act(self, action, user=None, session=None, ip="10.0.0.0", **kwargs):
        actor = {"remote_ip_addr": ip}
        if user:
            actor["user_id"] = user.id
        if session:
            actor["user_session"] = session
        return tasks.save_user_action(actor, friendly_token=self.media.friendly_token, action=action, **kwargs)

    def counters(self):
        self.media.refresh_from_db()
        current = (self.media.views, self.media.likes, self.media.dislikes)
        return tuple(now - before for now, before in zip(current, self.baseline))

    def test_a_user_like_and_dislike_are_each_counted_once(self):
        self.assertTrue(self.act("like", user=self.viewer))
        self.assertFalse(self.act("like", user=self.viewer))
        self.assertTrue(self.act("dislike", user=self.viewer))

        self.assertEqual(self.counters(), (0, 1, 1))
        self.assertEqual(MediaAction.objects.filter(media=self.media, user=self.viewer).count(), 2)

    def test_a_repeated_watch_within_the_video_length_is_not_a_new_view(self):
        video = create_media(self.owner, SMALL_VIDEO)
        views = video.views
        actor = {"user_id": self.viewer.id, "remote_ip_addr": "10.0.0.0"}

        self.assertTrue(tasks.save_user_action(actor, friendly_token=video.friendly_token))
        self.assertFalse(tasks.save_user_action(actor, friendly_token=video.friendly_token))

        video.refresh_from_db()
        self.assertEqual(video.views, views + 1)

    def test_a_watch_after_the_video_length_counts_again_and_replaces_the_old_row(self):
        video = create_media(self.owner, SMALL_VIDEO)
        views = video.views
        actor = {"user_id": self.viewer.id, "remote_ip_addr": "10.0.0.0"}
        tasks.save_user_action(actor, friendly_token=video.friendly_token)
        age(MediaAction.objects.filter(media=video), seconds=video.duration + 5)

        self.assertTrue(tasks.save_user_action(actor, friendly_token=video.friendly_token))

        video.refresh_from_db()
        self.assertEqual(video.views, views + 2)
        self.assertEqual(MediaAction.objects.filter(media=video, action="watch").count(), 1)

    def test_an_anonymous_session_like_is_counted_once(self):
        self.assertTrue(self.act("like", session="pipeline-session-a"))
        self.assertFalse(self.act("like", session="pipeline-session-a"))

        self.assertEqual(self.counters(), (0, 1, 0))
        self.assertEqual(MediaAction.objects.get(media=self.media).session_key, "pipeline-session-a")

    def test_a_new_session_from_the_same_ip_cannot_like_again_right_away(self):
        self.act("like", session="pipeline-session-a", ip="10.0.0.0")

        self.assertFalse(self.act("like", session="pipeline-session-b", ip="10.0.0.0"))
        self.assertTrue(self.act("like", session="pipeline-session-c", ip="10.9.9.0"))

        self.assertEqual(self.counters(), (0, 2, 0))

    def test_the_same_ip_may_act_again_after_the_anonymous_cooldown(self):
        self.act("like", session="pipeline-session-a", ip="10.0.0.0")
        age(MediaAction.objects.filter(media=self.media), seconds=settings.TIME_TO_ACTION_ANONYMOUS + 5)

        self.assertTrue(self.act("like", session="pipeline-session-b", ip="10.0.0.0"))

    def test_an_anonymous_media_page_visit_counts_a_view(self):
        response = Client(REMOTE_ADDR="10.1.2.3").get(self.media.get_absolute_url())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.counters()[0], 1)
        action = MediaAction.objects.get(media=self.media, action="watch")
        self.assertIsNone(action.user)
        self.assertTrue(action.session_key)
        self.assertEqual(action.remote_ip, mask_ip("10.1.2.3"))
        self.assertNotIn("10.1.2", action.remote_ip)

    def test_a_report_counts_once_per_user(self):
        self.assertTrue(self.act("report", user=self.viewer, extra_info="spam"))
        self.assertFalse(self.act("report", user=self.viewer, extra_info="spam"))

        self.media.refresh_from_db()
        self.assertEqual(self.media.reported_times, 1)
        self.assertEqual(self.media.state, "public")

    @override_settings(REPORTED_TIMES_THRESHOLD=2)
    def test_reaching_the_report_threshold_makes_the_media_private(self):
        self.act("report", user=self.viewer, extra_info="spam")
        self.act("report", user=create_account(), extra_info="spam")

        self.media.refresh_from_db()
        self.assertEqual(self.media.reported_times, 2)
        self.assertEqual(self.media.state, "private")

    def test_rating_twice_updates_the_users_single_rating(self):
        category = RatingCategory.objects.create(title=f"pipeline quality {uuid.uuid4().hex[:6]}")

        self.assertTrue(self.act("rate", user=self.viewer, extra_info={"score": 3, "category_id": category.id}))
        self.assertTrue(self.act("rate", user=self.viewer, extra_info={"score": 5, "category_id": category.id}))

        rating = Rating.objects.get(media=self.media, user=self.viewer)
        self.assertEqual(rating.score, 5)

    def test_a_rating_without_score_details_is_rejected(self):
        self.assertFalse(self.act("rate", user=self.viewer))

        self.assertFalse(MediaAction.objects.filter(action="rate").exists())

    def test_invalid_requests_record_nothing(self):
        self.assertFalse(self.act("share", user=self.viewer))
        self.assertFalse(self.act("like"))
        self.assertFalse(tasks.save_user_action({"user_id": 999999}, friendly_token=self.media.friendly_token, action="like"))
        self.assertFalse(tasks.save_user_action({"user_id": self.viewer.id}, friendly_token="nosuchtoken", action="like"))

        self.assertFalse(MediaAction.objects.exists())
        self.assertEqual(self.counters(), (0, 0, 0))


class PopularMediaTest(TestCase):
    fixtures = FIXTURES

    @classmethod
    def setUpTestData(cls):
        cls.user = create_account()
        cls.watched = create_media(cls.user, IMAGE, title="pipeline watched")
        cls.liked = create_media(cls.user, IMAGE, title="pipeline liked")
        cls.stale = create_media(cls.user, IMAGE, title="pipeline stale")
        cls.unlisted = create_media(cls.user, IMAGE, title="pipeline unlisted", state="unlisted")

    def test_recently_watched_and_liked_listable_media_are_cached_as_popular(self):
        MediaAction.objects.create(media=self.watched, action="watch", session_key="pipeline-a")
        MediaAction.objects.create(media=self.liked, action="like", session_key="pipeline-a")
        MediaAction.objects.create(media=self.stale, action="watch", session_key="pipeline-a")
        age(MediaAction.objects.filter(media=self.stale), days=8)
        MediaAction.objects.create(media=self.unlisted, action="watch", session_key="pipeline-a")

        self.assertTrue(tasks.get_list_of_popular_media())

        popular = cache.get("popular_media_ids")
        self.assertEqual(sorted(popular), sorted([self.watched.friendly_token, self.liked.friendly_token]))


class ListingsThumbnailsTest(TestCase):
    fixtures = FIXTURES

    @classmethod
    def setUpTestData(cls):
        cls.user = create_account()

    def test_categories_and_tags_get_the_most_viewed_public_media_thumbnail(self):
        category = Category.objects.create(title="pipeline tile category")
        tag = Tag.objects.create(title=f"pipelinetile{uuid.uuid4().hex[:6]}")
        quiet = create_media(self.user, IMAGE, category=[category], tags=[tag])
        busy = create_media(self.user, IMAGE, category=[category], tags=[tag])
        Media.objects.filter(pk=busy.pk).update(views=50)

        self.assertTrue(tasks.update_listings_thumbnails())

        category.refresh_from_db()
        tag.refresh_from_db()
        self.assertEqual(category.listings_thumbnail, busy.thumbnail_url)
        self.assertEqual(tag.listings_thumbnail, busy.thumbnail_url)
        self.assertNotEqual(quiet.thumbnail_url, busy.thumbnail_url)

    def test_a_media_is_used_for_at_most_one_category_tile(self):
        first = Category.objects.create(title="pipeline first")
        second = Category.objects.create(title="pipeline second")
        shared = create_media(self.user, IMAGE, category=[first, second])

        tasks.update_listings_thumbnails()

        tiles = [Category.objects.get(pk=pk).listings_thumbnail for pk in (first.pk, second.pk)]
        self.assertEqual(sorted(tiles, key=bool), [None, shared.thumbnail_url])

    def test_unlisted_media_never_becomes_a_public_category_tile(self):
        category = Category.objects.create(title="pipeline hidden", listings_thumbnail="/media/stale.jpg")
        tag = Tag.objects.create(title=f"pipelinehidden{uuid.uuid4().hex[:6]}", listings_thumbnail="/media/stale.jpg")
        create_media(self.user, IMAGE, state="unlisted", category=[category], tags=[tag])

        tasks.update_listings_thumbnails()

        category.refresh_from_db()
        tag.refresh_from_db()
        self.assertIsNone(category.listings_thumbnail)
        self.assertIsNone(tag.listings_thumbnail)

    def test_an_rbac_category_may_use_private_media(self):
        category = Category.objects.create(title="pipeline rbac", is_rbac_category=True)
        private = create_media(self.user, IMAGE, state="private", category=[category])

        tasks.update_listings_thumbnails()

        category.refresh_from_db()
        self.assertEqual(category.listings_thumbnail, private.thumbnail_url)


class PeriodicChecksTest(TestCase):
    fixtures = FIXTURES

    @classmethod
    def setUpTestData(cls):
        cls.video = create_media(create_account(), SMALL_VIDEO)
        cls.h144 = EncodeProfile.objects.get(name="h264-144")
        cls.h240 = EncodeProfile.objects.get(name="h264-240")

    def test_check_media_states_recomputes_stuck_encoding_status(self):
        Encoding.objects.bulk_create([Encoding(media=self.video, profile=self.h240, status="success")])
        Media.objects.filter(pk=self.video.pk).update(encoding_status="running")

        self.assertTrue(tasks.check_media_states())

        self.video.refresh_from_db()
        self.assertEqual(self.video.encoding_status, "success")

    def test_check_running_states_re_encodes_stale_running_encodings(self):
        stale = Encoding.objects.create(media=self.video, profile=self.h144, status="running")
        fresh = Encoding.objects.create(media=self.video, profile=self.h240, status="running")
        Encoding.objects.filter(pk=stale.pk).update(update_date=timezone.now() - timedelta(seconds=settings.RUNNING_STATE_STALE + 60))

        with mock.patch.object(Media, "encode") as encode:
            self.assertTrue(tasks.check_running_states())

        self.assertFalse(Encoding.objects.filter(pk=stale.pk).exists())
        self.assertTrue(Encoding.objects.filter(pk=fresh.pk).exists())
        encode.assert_called_once_with(profiles=[self.h144])

    def test_check_pending_states_requeues_only_pending_encodings_unknown_to_celery(self):
        queued = Encoding.objects.create(media=self.video, profile=self.h144, task_id="pipeline-task")
        reserved = Encoding.objects.create(media=self.video, profile=self.h240)
        orphan_profile = EncodeProfile.objects.get(name="h264-360")
        orphan = Encoding.objects.create(media=self.video, profile=orphan_profile)
        celery_view = {"task_ids": ["pipeline-task"], "media_profile_pairs": [(self.video.friendly_token, self.h240.id)]}

        with mock.patch.object(tasks, "list_tasks", return_value=celery_view), mock.patch.object(Media, "encode") as encode:
            self.assertTrue(tasks.check_pending_states())

        self.assertTrue(Encoding.objects.filter(pk__in=[queued.pk, reserved.pk]).count() == 2)
        self.assertFalse(Encoding.objects.filter(pk=orphan.pk).exists())
        encode.assert_called_once_with(profiles=[orphan_profile], force=False)

    def test_check_pending_states_without_pending_encodings_does_not_ask_celery(self):
        with mock.patch.object(tasks, "list_tasks") as list_tasks:
            self.assertTrue(tasks.check_pending_states())

        list_tasks.assert_not_called()

    def test_check_missing_profiles_queues_every_profile_a_video_lacks(self):
        Encoding.objects.create(media=self.video, profile=self.h240)

        with mock.patch.object(Media, "encode") as encode:
            self.assertTrue(tasks.check_missing_profiles())

        missing = encode.call_args.kwargs["profiles"]
        self.assertNotIn(self.h240, missing)
        self.assertEqual(len(missing), EncodeProfile.objects.count() - 1)
        self.assertFalse(encode.call_args.kwargs["force"])

    def test_a_revoked_encode_task_drops_its_encoding(self):
        encoding = Encoding.objects.create(media=self.video, profile=self.h144, task_id="pipeline-revoked", temp_file="/tmp/pipeline-never-exists.mp4")

        self.assertTrue(tasks.task_sent_handler(request=SimpleNamespace(task_id="pipeline-revoked")))

        self.assertFalse(Encoding.objects.filter(pk=encoding.pk).exists())
        self.assertTrue(tasks.task_sent_handler())

    def test_update_search_vector_task_indexes_the_media(self):
        Media.objects.filter(pk=self.video.pk).update(title="pipeline searchable zebra")

        self.assertTrue(tasks.update_search_vector(self.video.friendly_token))

        self.assertTrue(Media.objects.filter(pk=self.video.pk, search="zebra").exists())


class HousekeepingTasksTest(TestCase):
    def test_clear_sessions_runs_the_session_engine_cleanup(self):
        self.assertTrue(tasks.clear_sessions())

    @override_settings(SESSION_ENGINE="pipeline.no_such_engine")
    def test_clear_sessions_reports_a_broken_engine(self):
        self.assertFalse(tasks.clear_sessions())

    def test_remove_media_file_deletes_the_file(self):
        handle, path = tempfile.mkstemp(dir=settings.MEDIA_ROOT)
        os.close(handle)

        self.assertTrue(tasks.remove_media_file(media_file=path))

        self.assertFalse(os.path.exists(path))
