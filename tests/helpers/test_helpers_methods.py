import os
from datetime import timedelta
from types import SimpleNamespace
from unittest import mock

from allauth.account.models import EmailAddress
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.backends.db import SessionStore
from django.core import mail
from django.core.cache import cache
from django.core.files import File
from django.test import RequestFactory, TestCase, override_settings
from django.utils import timezone

from actions.models import MediaAction
from files import helpers, methods
from files.models import (
    Category,
    EncodeProfile,
    Encoding,
    Media,
    MediaPermission,
    Rating,
    RatingCategory,
    Tag,
    VideoChapterData,
    VideoTrimRequest,
)
from files.tests import create_account, create_media, fixture_path
from files.tests.media_utils import IMAGE_JPG, SMALL_VIDEO
from rbac.models import RBACGroup, RBACMembership


def make_user(username, **kwargs):
    return create_account(username=username, email=f"{username}@example.com", **kwargs)


class RoleCheckTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("roles_super", is_superuser=True)
        cls.manager = make_user("roles_manager", is_manager=True)
        cls.editor = make_user("roles_editor", is_editor=True)
        cls.regular = make_user("roles_regular")

    def test_superusers_managers_and_editors_are_editors(self):
        self.assertTrue(methods.is_mediacms_editor(self.superuser))
        self.assertTrue(methods.is_mediacms_editor(self.manager))
        self.assertTrue(methods.is_mediacms_editor(self.editor))
        self.assertFalse(methods.is_mediacms_editor(self.regular))

    def test_only_superusers_and_managers_are_managers(self):
        self.assertTrue(methods.is_mediacms_manager(self.superuser))
        self.assertTrue(methods.is_mediacms_manager(self.manager))
        self.assertFalse(methods.is_mediacms_manager(self.editor))
        self.assertFalse(methods.is_mediacms_manager(self.regular))

    def test_anonymous_or_missing_users_have_no_role(self):
        for user in [AnonymousUser(), None]:
            self.assertFalse(methods.is_mediacms_editor(user))
            self.assertFalse(methods.is_mediacms_manager(user))


class CanEditCategoryTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.manager = make_user("cat_manager", is_manager=True)
        cls.group_manager = make_user("cat_group_manager")
        cls.contributor = make_user("cat_contributor")
        cls.category = Category.objects.create(title="Plain category")
        cls.rbac_category = Category.objects.create(title="RBAC category", is_rbac_category=True)
        group = RBACGroup.objects.create(name="Editing group")
        group.categories.add(cls.rbac_category)
        RBACMembership.objects.create(user=cls.group_manager, rbac_group=group, role="manager")
        RBACMembership.objects.create(user=cls.contributor, rbac_group=group, role="contributor")

    def test_anonymous_and_missing_users_cannot_edit(self):
        self.assertFalse(methods.can_edit_category(AnonymousUser(), self.category))
        self.assertFalse(methods.can_edit_category(None, self.category))

    def test_portal_managers_can_edit_any_category(self):
        self.assertTrue(methods.can_edit_category(self.manager, self.category))
        self.assertTrue(methods.can_edit_category(self.manager, self.rbac_category))

    def test_regular_users_cannot_edit_plain_categories(self):
        self.assertFalse(methods.can_edit_category(self.group_manager, self.category))

    @override_settings(USE_RBAC=True)
    def test_group_managers_can_edit_their_rbac_category_but_contributors_cannot(self):
        self.assertTrue(methods.can_edit_category(self.group_manager, self.rbac_category))
        self.assertFalse(methods.can_edit_category(self.contributor, self.rbac_category))

    @override_settings(USE_RBAC=False)
    def test_group_managers_cannot_edit_rbac_categories_when_rbac_is_off(self):
        self.assertFalse(methods.can_edit_category(self.group_manager, self.rbac_category))


class NextStateTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.editor = make_user("state_editor", is_editor=True)
        cls.regular = make_user("state_regular")

    @override_settings(PORTAL_WORKFLOW="private")
    def test_editors_may_make_any_transition(self):
        self.assertEqual(methods.get_next_state(self.editor, "private", "public"), "public")

    @override_settings(PORTAL_WORKFLOW="unlisted")
    def test_invalid_next_state_falls_back_to_the_workflow_default(self):
        self.assertEqual(methods.get_next_state(self.regular, "private", "bogus"), "unlisted")

    @override_settings(PORTAL_WORKFLOW="private")
    def test_private_workflow_blocks_users_from_publishing(self):
        self.assertEqual(methods.get_next_state(self.regular, "private", "public"), "private")
        self.assertEqual(methods.get_next_state(self.regular, "private", "unlisted"), "unlisted")
        self.assertEqual(methods.get_next_state(self.regular, "unlisted", "private"), "private")

    @override_settings(PORTAL_WORKFLOW="unlisted")
    def test_unlisted_workflow_blocks_users_from_publishing(self):
        self.assertEqual(methods.get_next_state(self.regular, "unlisted", "public"), "unlisted")
        self.assertEqual(methods.get_next_state(self.regular, "unlisted", "private"), "private")

    @override_settings(PORTAL_WORKFLOW="public")
    def test_public_workflow_allows_users_any_state(self):
        self.assertEqual(methods.get_next_state(self.regular, "private", "public"), "public")


class UserOrSessionTests(TestCase):
    def build_request(self, user):
        request = RequestFactory().get("/", REMOTE_ADDR="192.168.1.10")
        request.user = user
        request.session = SessionStore()
        return request

    @override_settings(MASK_IPS_FOR_ACTIONS=True)
    def test_authenticated_user_is_identified_by_id_with_a_masked_ip(self):
        user = make_user("session_user")
        ret = methods.get_user_or_session(self.build_request(user))
        self.assertEqual(ret, {"user_id": user.id, "remote_ip_addr": helpers.mask_ip("192.168.1.10")})

    @override_settings(MASK_IPS_FOR_ACTIONS=False)
    def test_anonymous_user_gets_a_session_key_and_the_raw_ip(self):
        request = self.build_request(AnonymousUser())
        ret = methods.get_user_or_session(request)
        self.assertTrue(ret["user_session"])
        self.assertEqual(ret["user_session"], request.session.session_key)
        self.assertEqual(ret["remote_ip_addr"], "192.168.1.10")
        self.assertNotIn("user_id", ret)


class PreSaveActionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user("action_owner")
        cls.viewer = make_user("action_viewer")
        cls.media = create_media(cls.owner, title="action media")
        Media.objects.filter(pk=cls.media.pk).update(duration=30)
        cls.media.refresh_from_db()

    def record(self, seconds_ago, **fields):
        action = MediaAction.objects.create(media=self.media, **fields)
        MediaAction.objects.filter(pk=action.pk).update(action_date=timezone.now() - timedelta(seconds=seconds_ago))
        return action

    def check(self, action, user=None, session_key=None, remote_ip="1.1.1.1"):
        return methods.pre_save_action(media=self.media, user=user, session_key=session_key, action=action, remote_ip=remote_ip)

    def test_first_action_of_a_user_is_allowed(self):
        self.assertTrue(self.check("like", user=self.viewer))

    def test_user_cannot_like_dislike_or_report_twice(self):
        for action in ["like", "dislike", "report"]:
            self.record(5, user=self.viewer, action=action)
            self.assertFalse(self.check(action, user=self.viewer))

    def test_user_watch_counts_again_only_after_the_media_duration(self):
        self.record(10, user=self.viewer, action="watch")
        self.assertFalse(self.check("watch", user=self.viewer))

        MediaAction.objects.filter(user=self.viewer).update(action_date=timezone.now() - timedelta(seconds=60))
        self.assertTrue(self.check("watch", user=self.viewer))

    def test_first_anonymous_action_is_allowed(self):
        self.assertTrue(self.check("like", session_key="sess-a"))

    def test_anonymous_session_cannot_like_twice(self):
        self.record(5, session_key="sess-a", action="like")
        self.assertFalse(self.check("like", session_key="sess-a"))

    def test_new_anonymous_session_from_a_recent_ip_is_throttled(self):
        self.record(5, session_key="sess-a", action="like", remote_ip="2.2.2.2")
        self.assertFalse(self.check("like", session_key="sess-b", remote_ip="2.2.2.2"))

    @override_settings(TIME_TO_ACTION_ANONYMOUS=60)
    def test_new_anonymous_session_from_an_ip_is_allowed_after_the_threshold(self):
        self.record(120, session_key="sess-a", action="like", remote_ip="2.2.2.2")
        self.assertTrue(self.check("like", session_key="sess-b", remote_ip="2.2.2.2"))

    def test_anonymous_watch_from_the_same_ip_within_the_duration_is_ignored(self):
        self.record(5, session_key="sess-a", action="watch", remote_ip="3.3.3.3")
        self.assertFalse(self.check("watch", session_key="sess-b", remote_ip="3.3.3.3"))


class RecommendedAndRelatedMediaTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = make_user("related_author")
        cls.other = make_user("related_other")
        cls.category = Category.objects.create(title="Related category")
        cls.media = create_media(cls.author, title="related main", category=[cls.category])
        cls.author_media = create_media(cls.author, title="related by author")
        cls.category_media = create_media(cls.other, title="related in category", category=[cls.category])
        cls.generic_media = create_media(cls.other, title="related generic")
        cls.private_media = create_media(cls.author, title="related private", state="private")

    def test_recommended_media_lists_only_listable_media(self):
        result = methods.show_recommended_media(request=None)
        self.assertCountEqual(result, [self.media, self.author_media, self.category_media, self.generic_media])

    def test_recommended_media_honours_the_limit(self):
        self.assertEqual(len(methods.show_recommended_media(request=None, limit=2)), 2)

    def test_recommended_media_prefers_the_cached_popular_list(self):
        cache.set("popular_media_ids", [self.generic_media.friendly_token, self.private_media.friendly_token])
        self.assertEqual(methods.show_recommended_media(request=None), [self.generic_media])

    @override_settings(RELATED_MEDIA_STRATEGY="content")
    def test_content_strategy_mixes_author_category_and_generic_media_without_the_media_itself(self):
        result = methods.show_related_media(self.media)
        self.assertCountEqual(result, [self.author_media, self.category_media, self.generic_media])

    @override_settings(RELATED_MEDIA_STRATEGY="content")
    def test_content_strategy_honours_the_limit_and_keeps_author_media_first_in_line(self):
        result = methods.show_related_media(self.media, limit=2)
        self.assertIn(self.author_media, result)
        self.assertNotIn(self.private_media, result)
        self.assertLessEqual(len(result), 2)

    @override_settings(RELATED_MEDIA_STRATEGY="author")
    def test_author_strategy_lists_only_the_authors_other_listable_media(self):
        self.assertEqual(methods.show_related_media(self.media), [self.author_media])

    @override_settings(RELATED_MEDIA_STRATEGY="no_related")
    def test_no_related_strategy_lists_nothing(self):
        self.assertEqual(methods.show_related_media(self.media), [])

    @override_settings(RELATED_MEDIA_STRATEGY="calculated")
    def test_calculated_strategy_is_not_implemented_yet(self):
        self.assertEqual(methods.show_related_media(self.media), [])


class UserRatingsTests(TestCase):
    def test_existing_scores_are_filled_in(self):
        user = make_user("ratings_user")
        media = create_media(user, title="rated")
        rated = RatingCategory.objects.create(title="Sound quality")
        unrated = RatingCategory.objects.create(title="Picture quality")
        Rating.objects.create(user=user, media=media, rating_category=rated, score=4)

        ratings = [{"category_id": rated.id, "score": -1}, {"category_id": unrated.id, "score": -1}]
        result = methods.update_user_ratings(user, media, ratings)

        self.assertEqual(result, [{"category_id": rated.id, "score": 4}, {"category_id": unrated.id, "score": -1}])


class CommentMentionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user("mention_owner")
        cls.mentioned = make_user("mention_target")
        cls.silent = make_user("mention_silent")
        cls.silent.notification_on_comments = False
        cls.silent.save()
        cls.media = create_media(cls.owner, title="mention media")

    def setUp(self):
        mail.outbox = []

    def test_clean_comment_strips_mention_markup(self):
        self.assertEqual(methods.clean_comment("hi @(_mention_target_) look [_here_]"), "hi  look here")

    def test_mentioned_users_are_emailed_once_each(self):
        text = "@(_mention_target_) and again @(_mention_target_) see this"
        methods.check_comment_for_mention(self.media.friendly_token, text)

        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.mentioned.email])
        self.assertIn("You were mentioned", mail.outbox[0].subject)
        self.assertIn("and again  see this", mail.outbox[0].body)

    def test_users_who_opted_out_are_not_emailed(self):
        methods.check_comment_for_mention(self.media.friendly_token, "@(_mention_silent_) hello")
        self.assertEqual(mail.outbox, [])

    def test_comments_without_mentions_send_nothing(self):
        methods.check_comment_for_mention(self.media.friendly_token, "plain comment")
        self.assertEqual(mail.outbox, [])

    def test_mention_on_missing_media_does_nothing(self):
        self.assertFalse(methods.notify_user_on_mention("missingtoken", self.mentioned.username, "x"))
        self.assertEqual(mail.outbox, [])


class UploadPermissionTests(TestCase):
    def request_for(self, user):
        return SimpleNamespace(user=user)

    def test_anonymous_users_cannot_upload(self):
        self.assertFalse(methods.user_allowed_to_upload(self.request_for(AnonymousUser())))

    @override_settings(CAN_ADD_MEDIA="advancedUser", NUMBER_OF_MEDIA_USER_CAN_UPLOAD=0)
    def test_editors_bypass_every_restriction(self):
        self.assertTrue(methods.user_allowed_to_upload(self.request_for(make_user("upload_editor", is_editor=True))))

    @override_settings(CAN_ADD_MEDIA="all", NUMBER_OF_MEDIA_USER_CAN_UPLOAD=1)
    def test_users_are_blocked_once_they_reach_the_upload_limit(self):
        user = make_user("upload_limited")
        self.assertTrue(methods.user_allowed_to_upload(self.request_for(user)))
        create_media(user, title="limit reached")
        self.assertFalse(methods.user_allowed_to_upload(self.request_for(user)))

    @override_settings(CAN_ADD_MEDIA="email_verified")
    def test_email_verified_mode_requires_a_verified_address(self):
        user = make_user("upload_verify")
        self.assertFalse(methods.user_allowed_to_upload(self.request_for(user)))
        EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
        self.assertTrue(methods.user_allowed_to_upload(self.request_for(user)))

    @override_settings(CAN_ADD_MEDIA="advancedUser")
    def test_advanced_user_mode_requires_the_flag(self):
        user = make_user("upload_advanced")
        self.assertFalse(methods.user_allowed_to_upload(self.request_for(user)))
        user.advancedUser = True
        self.assertTrue(methods.user_allowed_to_upload(self.request_for(user)))

    @override_settings(CAN_ADD_MEDIA="nobody")
    def test_unknown_mode_denies_upload(self):
        self.assertFalse(methods.user_allowed_to_upload(self.request_for(make_user("upload_nobody"))))


class TranscribePermissionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.editor = make_user("transcribe_editor", is_editor=True)
        cls.regular = make_user("transcribe_regular")

    @override_settings(USE_WHISPER_TRANSCRIBE=False)
    def test_nobody_transcribes_when_whisper_is_off(self):
        self.assertFalse(methods.can_transcribe_video(self.editor))

    @override_settings(USE_WHISPER_TRANSCRIBE=True, USER_CAN_TRANSCRIBE_VIDEO=False)
    def test_only_editors_transcribe_when_users_are_not_allowed(self):
        self.assertTrue(methods.can_transcribe_video(self.editor))
        self.assertFalse(methods.can_transcribe_video(self.regular))

    @override_settings(USE_WHISPER_TRANSCRIBE=True, USER_CAN_TRANSCRIBE_VIDEO=True)
    def test_users_transcribe_when_allowed(self):
        self.assertTrue(methods.can_transcribe_video(self.regular))


class KillFfmpegProcessTests(TestCase):
    PS_OUTPUT = (
        "USER PID %CPU COMMAND\n"
        "www 101 9.0 ffmpeg -i /media/target.mp4 out.mp4\n"
        "www 102 0.1 grep ffmpeg /media/target.mp4\n"
        "www 103 9.0 ffmpeg -i /media/other.mp4 out.mp4\n"
        "www 104 0.5 python /media/target.mp4\n"
    )

    def test_unusable_input_is_rejected(self):
        self.assertFalse(methods.kill_ffmpeg_process(""))
        self.assertFalse(methods.kill_ffmpeg_process(None))
        self.assertFalse(methods.kill_ffmpeg_process(42))

    def test_only_ffmpeg_processes_for_the_file_are_killed(self):
        ps = SimpleNamespace(stdout=self.PS_OUTPUT.encode())
        with mock.patch.object(methods.subprocess, "run", side_effect=[ps, None]) as run:
            self.assertTrue(methods.kill_ffmpeg_process("/media/target.mp4"))

        self.assertEqual(run.call_count, 2)
        self.assertEqual(run.call_args_list[1], mock.call(["kill", "-9", "101"], check=False))

    def test_failure_to_list_processes_is_reported(self):
        with mock.patch.object(methods.subprocess, "run", side_effect=OSError):
            self.assertFalse(methods.kill_ffmpeg_process("/media/target.mp4"))


class CopyMediaTests(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("copy_user")
        cls.category = Category.objects.create(title="Copy category")
        cls.tag = Tag.objects.create(title="copytag")

    def test_copy_media_duplicates_an_image_with_its_categories_and_tags(self):
        original = create_media(self.user, title="original image", description="desc", category=[self.category], tags=[self.tag])

        copy = methods.copy_media(original)

        self.assertNotEqual(copy.pk, original.pk)
        self.assertNotEqual(copy.friendly_token, original.friendly_token)
        self.assertEqual(copy.title, "original image (Copy)")
        self.assertEqual(copy.description, "desc")
        self.assertEqual(copy.user, self.user)
        self.assertEqual(list(copy.category.all()), [self.category])
        self.assertEqual(list(copy.tags.all()), [self.tag])
        self.assertNotEqual(copy.media_file.path, original.media_file.path)

    def test_copy_media_of_a_missing_file_returns_nothing(self):
        original = create_media(self.user, title="vanished image")
        helpers.rm_file(original.media_file.path)
        self.assertIsNone(methods.copy_media(original))

    def test_copy_video_duplicates_metadata_encodings_and_thumbnails(self):
        original = create_media(self.user, filename=SMALL_VIDEO, title="original video", category=[self.category])
        profile = EncodeProfile.objects.filter(extension="mp4", codec="h264").first()
        with open(original.media_file.path, "rb") as fp:
            encoding = Encoding(media=original, profile=profile, status="success", progress=100)
            encoding.media_file.save("enc.mp4", File(fp), save=False)
        Encoding.objects.bulk_create([encoding])

        copy = methods.copy_video(original, title_suffix="(Copy)")
        copy.refresh_from_db()

        self.assertEqual(copy.title, "original video (Copy)")
        self.assertEqual(copy.media_type, "video")
        self.assertEqual(copy.duration, original.duration)
        self.assertEqual(copy.video_height, original.video_height)
        self.assertEqual(list(copy.category.all()), [self.category])
        self.assertTrue(copy.thumbnail)
        self.assertNotEqual(copy.thumbnail.path, original.thumbnail.path)
        self.assertEqual(copy.encodings.filter(status="success", profile=profile).count(), 1)

    def test_copy_video_uses_the_trimmed_suffix_by_default_and_can_skip_encodings(self):
        original = create_media(self.user, filename=SMALL_VIDEO, title="trim source")
        copy = methods.copy_video(original, copy_encodings=False)
        self.assertEqual(copy.title, "trim source (Trimmed)")
        self.assertFalse(copy.encodings.exists())

    def test_copy_video_carries_tags_posters_sprites_and_hls_files(self):
        original = create_media(self.user, filename=SMALL_VIDEO, title="rich video", tags=[self.tag])
        with open(fixture_path(IMAGE_JPG), "rb") as fp:
            original.uploaded_poster.save("poster.jpg", File(fp))
        with open(fixture_path(IMAGE_JPG), "rb") as fp:
            original.sprites.save("sprites.jpg", File(fp))
        hls_dir = os.path.join(settings.HLS_DIR, original.uid.hex)
        os.makedirs(hls_dir, exist_ok=True)
        with open(os.path.join(hls_dir, "master.m3u8"), "w") as fp:
            fp.write("#EXTM3U\n")
        Media.objects.filter(pk=original.pk).update(hls_file=os.path.join(hls_dir, "master.m3u8"))
        original.refresh_from_db()

        copy = methods.copy_video(original, copy_encodings=False)
        copy.refresh_from_db()

        self.assertEqual(list(copy.tags.all()), [self.tag])
        self.assertTrue(copy.uploaded_poster)
        self.assertTrue(copy.uploaded_thumbnail)
        self.assertTrue(copy.sprites)
        self.assertEqual(copy.hls_file, os.path.join(settings.HLS_DIR, copy.uid.hex, "master.m3u8"))
        self.assertTrue(os.path.isfile(copy.hls_file))


class TrimRequestTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.media = create_media(make_user("trim_user"), title="trim media")

    def test_default_action_replaces_the_original(self):
        segments = [{"startTime": "00:00:01.000", "endTime": "00:00:02.000"}]
        request = methods.create_video_trim_request(self.media, {"segments": segments})
        self.assertEqual(request.video_action, "replace")
        self.assertEqual(request.status, "initial")
        self.assertEqual(request.timestamps, segments)

    def test_individual_segments_take_precedence_over_copy(self):
        request = methods.create_video_trim_request(self.media, {"saveIndividualSegments": True, "saveAsCopy": True})
        self.assertEqual(request.video_action, "create_segments")

    def test_save_as_copy_creates_new_media(self):
        request = methods.create_video_trim_request(self.media, {"saveAsCopy": True})
        self.assertEqual(request.video_action, "save_new")
        self.assertTrue(VideoTrimRequest.objects.filter(pk=request.pk, media=self.media).exists())


class VideoChaptersAndOwnershipTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user("chapters_owner")
        cls.new_owner = make_user("chapters_new_owner")
        cls.viewer = make_user("chapters_viewer")

    def test_chapters_are_created_then_replaced(self):
        media = create_media(self.owner, title="chapters media")
        first = [{"startTime": 0, "endTime": 5, "chapterTitle": "Intro"}]
        second = [{"startTime": 0, "endTime": 9, "chapterTitle": "All"}, {"startTime": 1, "chapterTitle": "broken"}]

        self.assertEqual(methods.handle_video_chapters(media, first), {"chapters": first})
        self.assertEqual(methods.handle_video_chapters(media, second), {"chapters": [second[0]]})
        self.assertEqual(VideoChapterData.objects.filter(media=media).count(), 1)

    def test_change_owner_moves_media_and_drops_the_new_owners_own_permission(self):
        media = create_media(self.owner, title="owned media")
        MediaPermission.objects.create(owner_user=self.owner, user=self.viewer, media=media, permission="viewer")
        MediaPermission.objects.create(owner_user=self.owner, user=self.new_owner, media=media, permission="editor")

        result = methods.change_media_owner(media.id, self.new_owner)

        self.assertEqual(result.user, self.new_owner)
        media.refresh_from_db()
        self.assertEqual(media.user, self.new_owner)
        self.assertEqual(list(MediaPermission.objects.filter(media=media).values_list("user", "owner_user")), [(self.viewer.id, self.new_owner.id)])

    def test_change_owner_of_missing_media_returns_none(self):
        self.assertIsNone(methods.change_media_owner(0, self.new_owner))


class ListTasksTests(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def test_tasks_are_grouped_by_state_with_encoding_details(self):
        media = create_media(make_user("tasks_user"), title="encoding media")
        profile = EncodeProfile.objects.filter(active=True).first()
        Encoding.objects.bulk_create([Encoding(media=media, profile=profile, task_id="task-1", progress=42)])
        inspect = mock.Mock()
        inspect.active.return_value = {
            "worker1": [
                {"id": "task-1", "name": "encode_media", "args": f"('{media.friendly_token}', {profile.id}, 7)", "time_start": 1.0},
                {"id": "task-2", "name": "other_task", "args": "()", "time_start": 2.0},
            ]
        }
        inspect.reserved.return_value = {"worker2": [{"id": "task-3", "name": "encode_media", "args": "('missing', 1, 1)"}]}
        inspect.scheduled.return_value = {}

        with mock.patch.object(methods.celery_app.control, "inspect", return_value=inspect):
            ret = methods.list_tasks()

        self.assertEqual(ret["task_ids"], ["task-1", "task-2", "task-3"])
        self.assertEqual(ret["media_profile_pairs"], [(media.friendly_token, profile.id)])
        active = ret["active"]["tasks"]
        self.assertEqual(active[0]["worker"], "worker1")
        self.assertEqual(active[0]["info"], {"profile name": profile.name, "media title": "encoding media", "encoding progress": 42})
        self.assertNotIn("info", active[1])
        self.assertNotIn("info", ret["reserved"]["tasks"][0])
        self.assertEqual(ret["scheduled"]["tasks"], [])


class AllowedTypeTests(TestCase):
    @override_settings(ALLOWED_MEDIA_UPLOAD_TYPES=["video"])
    def test_only_listed_types_are_allowed(self):
        self.assertTrue(methods.is_media_allowed_type(Media(media_type="video")))
        self.assertFalse(methods.is_media_allowed_type(Media(media_type="image")))

    @override_settings(ALLOWED_MEDIA_UPLOAD_TYPES=["all"])
    def test_all_allows_anything(self):
        self.assertTrue(methods.is_media_allowed_type(Media(media_type="")))
