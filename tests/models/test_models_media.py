import io
import json
import os
import wave
from datetime import timedelta
from unittest import mock

from django.conf import settings
from django.core.files import File
from django.core.files.base import ContentFile
from django.test import TestCase, override_settings
from django.utils import timezone

from files import helpers, tasks
from files.models import (
    Category,
    EmbedMediaCourse,
    EncodeProfile,
    Encoding,
    Media,
    MediaPermission,
    RatingCategory,
    Tag,
    TranscriptionRequest,
    VideoChapterData,
    VideoTrimRequest,
)
from files.tests import create_account, create_media, fixture_path
from files.tests.media_utils import IMAGE, IMAGE_JPG, SMALL_VIDEO

PDF_BYTES = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"


def make_user(username, **kwargs):
    return create_account(username=username, email=f"{username}@example.com", **kwargs)


def wav_bytes(seconds=2):
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(8000)
        wav.writeframes(b"\x00\x00" * 8000 * seconds)
    return buffer.getvalue()


def create_media_from_bytes(user, name, content, **fields):
    media = Media(user=user, **fields)
    media.media_file.save(name, ContentFile(content), save=False)
    media.save()
    media.refresh_from_db()
    return media


class MediaSaveTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("save_user")

    def test_blank_title_is_derived_from_the_file_name(self):
        media = create_media(self.user)
        self.assertTrue(media.title.endswith(IMAGE))
        self.assertIn(media.uid.hex, media.title)

    def test_html_is_stripped_from_title_and_description(self):
        media = create_media(self.user, title="<b>Bold</b> <a href='x'>title</a>", description="<p>Hello <script>alert(1)</script>world</p>")
        self.assertEqual(media.title, "Bold title")
        self.assertEqual(media.description, "Hello alert(1)world")

    def test_long_titles_are_truncated_to_100_chars(self):
        media = create_media(self.user, title="x" * 150)
        self.assertEqual(media.title, "x" * 100)

    def test_friendly_token_is_generated_once_and_kept(self):
        media = create_media(self.user, title="token media")
        token = media.friendly_token
        self.assertEqual(len(token), settings.FRIENDLY_TOKEN_LEN)

        media.title = "token media renamed"
        media.save()
        media.refresh_from_db()
        self.assertEqual(media.friendly_token, token)

    def test_explicit_friendly_token_is_respected(self):
        media = create_media(self.user, title="explicit token", friendly_token="mytoken42")
        self.assertEqual(media.friendly_token, "mytoken42")

    def test_friendly_tokens_are_unique_across_media(self):
        tokens = {create_media(self.user, title=f"unique {i}").friendly_token for i in range(3)}
        self.assertEqual(len(tokens), 3)

    def test_add_date_defaults_to_now_but_keeps_an_explicit_value(self):
        before = timezone.now()
        media = create_media(self.user, title="dated now")
        self.assertGreaterEqual(media.add_date, before)

        past = timezone.now() - timedelta(days=30)
        media = create_media(self.user, title="dated past", add_date=past)
        self.assertEqual(media.add_date, past)

    def test_thumbnail_time_is_rounded_to_one_decimal(self):
        media = create_media(self.user, title="thumb time")
        media.thumbnail_time = 3.14159
        media.save()
        media.refresh_from_db()
        self.assertEqual(media.thumbnail_time, 3.1)

    def test_str_is_the_title(self):
        self.assertEqual(str(create_media(self.user, title="printable")), "printable")


class MediaWorkflowStateTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("workflow_user")
        cls.advanced = make_user("workflow_advanced")
        cls.advanced.advancedUser = True
        cls.advanced.save()

    @override_settings(PORTAL_WORKFLOW="public")
    def test_public_workflow_publishes_new_media(self):
        media = create_media(self.user, title="public wf")
        self.assertEqual(media.state, "public")
        self.assertTrue(media.listable)

    @override_settings(PORTAL_WORKFLOW="unlisted")
    def test_unlisted_workflow_keeps_new_media_off_listings(self):
        media = create_media(self.user, title="unlisted wf")
        self.assertEqual(media.state, "unlisted")
        self.assertFalse(media.listable)

    @override_settings(PORTAL_WORKFLOW="private")
    def test_private_workflow_ignores_a_requested_public_state_on_creation(self):
        media = Media(user=self.user, title="private wf", state="public")
        with open(fixture_path(IMAGE), "rb") as fp:
            media.media_file.save(IMAGE, File(fp), save=False)
        media.save()
        media.refresh_from_db()
        self.assertEqual(media.state, "private")
        self.assertFalse(media.listable)

    @override_settings(PORTAL_WORKFLOW="private_verified")
    def test_private_verified_workflow_trusts_only_advanced_users(self):
        self.assertEqual(create_media(self.advanced, title="trusted").state, "unlisted")
        self.assertEqual(create_media(self.user, title="untrusted").state, "private")

    @override_settings(PORTAL_WORKFLOW="private")
    def test_state_can_change_after_creation(self):
        media = create_media(self.user, title="published later", state="public")
        self.assertEqual(media.state, "public")
        self.assertTrue(media.listable)


class MediaListableTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("listable_user")

    def test_public_reviewed_and_encoded_media_is_listable(self):
        self.assertTrue(create_media(self.user, title="listable").listable)

    def test_unreviewed_media_is_not_listable(self):
        self.assertFalse(create_media(self.user, title="unreviewed", is_reviewed=False).listable)

    def test_unlisted_or_private_media_is_not_listable(self):
        self.assertFalse(create_media(self.user, title="unlisted", state="unlisted").listable)
        self.assertFalse(create_media(self.user, title="private", state="private").listable)

    def test_media_still_encoding_is_not_listable(self):
        self.assertFalse(create_media(self.user, title="encoding", encoding_status="running").listable)

    def test_listable_follows_later_state_changes(self):
        media = create_media(self.user, title="toggled", state="private")
        media.state = "public"
        media.save()
        self.assertTrue(media.listable)


class MediaTypeDetectionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("type_user")

    def test_image_upload_gets_thumbnail_and_poster(self):
        media = create_media(self.user, filename=IMAGE_JPG, title="jpg")
        self.assertEqual(media.media_type, "image")
        self.assertEqual(media.encoding_status, "success")
        self.assertTrue(os.path.isfile(media.thumbnail.path))
        self.assertTrue(os.path.isfile(media.poster.path))
        self.assertEqual(media.thumbnail_url, helpers.url_from_path(media.thumbnail.path))

    def test_video_upload_gets_metadata_and_a_thumbnail(self):
        media = create_media(self.user, filename=SMALL_VIDEO, title="video")

        self.assertEqual(media.media_type, "video")
        self.assertEqual(media.encoding_status, "success")
        self.assertEqual(media.duration, 27)
        self.assertEqual(media.video_height, 240)
        self.assertEqual(len(media.md5sum), 32)
        self.assertTrue(media.size.endswith("MB"))
        self.assertEqual(json.loads(media.media_info)["video_height"], 240)
        self.assertTrue(media.thumbnail)
        self.assertTrue(media.poster)
        self.assertIsNotNone(media.thumbnail_time)
        self.assertTrue(0 <= media.thumbnail_time < media.duration)

    def test_pdf_upload_is_detected_and_uses_the_pdf_poster(self):
        media = create_media_from_bytes(self.user, "doc.pdf", PDF_BYTES, title="pdf")
        self.assertEqual(media.media_type, "pdf")
        self.assertEqual(media.encoding_status, "success")
        self.assertTrue(media.listable)
        self.assertEqual(media.thumbnail_url, helpers.url_from_path("userlogos/poster_pdf.jpg"))
        self.assertEqual(media.poster_url, helpers.url_from_path("userlogos/poster_pdf.jpg"))

    def test_audio_upload_is_detected_with_its_duration(self):
        media = create_media_from_bytes(self.user, "sound.wav", wav_bytes(seconds=2), title="audio")
        self.assertEqual(media.media_type, "audio")
        self.assertEqual(media.encoding_status, "success")
        self.assertEqual(media.duration, 2)
        self.assertEqual(media.thumbnail_url, helpers.url_from_path("userlogos/poster_audio.jpg"))
        self.assertEqual(media.poster_url, helpers.url_from_path("userlogos/poster_audio.jpg"))

    def test_unrecognised_upload_is_removed_and_hidden(self):
        media = create_media_from_bytes(self.user, "notes.txt", b"definitely not media", title="junk")
        self.assertEqual(media.media_type, "")
        self.assertEqual(media.encoding_status, "fail")
        self.assertEqual(media.state, "unlisted")
        self.assertFalse(media.listable)
        self.assertFalse(os.path.exists(media.media_file.path))

    @override_settings(ALLOWED_MEDIA_UPLOAD_TYPES=["video"])
    def test_disallowed_media_type_is_removed_and_hidden(self):
        media = create_media(self.user, title="images not allowed")
        self.assertEqual(media.media_type, "image")
        self.assertEqual(media.state, "unlisted")
        self.assertFalse(os.path.exists(media.media_file.path))
        self.assertFalse(media.thumbnail)

    @override_settings(PORTAL_WORKFLOW="private", ALLOWED_MEDIA_UPLOAD_TYPES=["video"])
    def test_disallowed_private_media_stays_private(self):
        self.assertEqual(create_media(self.user, title="private disallowed").state, "private")

    def test_video_upload_is_sent_for_encoding(self):
        with mock.patch.object(Media, "encode") as encode, mock.patch.object(Media, "produce_sprite_from_video") as sprite:
            media = create_media(self.user, filename=SMALL_VIDEO, title="to encode", transcode=True)
        encode.assert_called_once_with()
        sprite.assert_called_once_with()
        self.assertEqual(media.encoding_status, "pending")

    @override_settings(DO_NOT_TRANSCODE_VIDEO=True)
    def test_do_not_transcode_setting_marks_video_ready_without_encoding(self):
        with mock.patch.object(Media, "encode") as encode:
            media = create_media(self.user, filename=SMALL_VIDEO, title="not encoded", transcode=True)
        encode.assert_not_called()
        self.assertEqual(media.encoding_status, "success")

    def test_replacing_the_media_file_reinitialises_the_media(self):
        media = create_media(self.user, title="replace me")
        with mock.patch.object(tasks.media_init, "apply_async") as media_init:
            with open(fixture_path(IMAGE_JPG), "rb") as fp:
                media.media_file.save(IMAGE_JPG, File(fp), save=False)
            media.save()
        media_init.assert_called_once_with(args=[media.friendly_token], countdown=5)


class MediaTranscriptionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("whisper_user")

    def test_enabling_transcription_on_a_video_queues_one_request(self):
        media = create_media(self.user, filename=SMALL_VIDEO, title="whisper video")
        with mock.patch.object(tasks.whisper_transcribe, "apply_async") as transcribe:
            media.allow_whisper_transcribe = True
            media.save()
            media.save()

        transcribe.assert_called_once_with(args=[media.friendly_token, False], countdown=10)
        self.assertEqual(TranscriptionRequest.objects.filter(media=media, translate_to_english=False).count(), 1)

    def test_enabling_translation_queues_a_separate_request(self):
        media = create_media(self.user, filename=SMALL_VIDEO, title="translate video")
        with mock.patch.object(tasks.whisper_transcribe, "apply_async") as transcribe:
            media.allow_whisper_transcribe = True
            media.allow_whisper_transcribe_and_translate = True
            media.save()

        self.assertEqual(transcribe.call_count, 2)
        self.assertEqual(TranscriptionRequest.objects.filter(media=media).count(), 2)

    def test_existing_requests_are_not_duplicated(self):
        media = create_media(self.user, filename=SMALL_VIDEO, title="already requested")
        TranscriptionRequest.objects.create(media=media, translate_to_english=False)
        with mock.patch.object(tasks.whisper_transcribe, "apply_async") as transcribe:
            media.allow_whisper_transcribe = True
            media.save()
        transcribe.assert_not_called()

    def test_images_are_never_transcribed(self):
        media = create_media(self.user, title="whisper image")
        with mock.patch.object(tasks.whisper_transcribe, "apply_async") as transcribe:
            media.allow_whisper_transcribe = True
            media.save()
        transcribe.assert_not_called()
        self.assertFalse(TranscriptionRequest.objects.filter(media=media).exists())


class MediaEncodeTests(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("encode_user")

    def setUp(self):
        self.media = create_media(self.user, filename=SMALL_VIDEO, title="encode target")

    def test_profiles_above_the_video_height_are_skipped_except_minimum_ones(self):
        with mock.patch.object(tasks.encode_media, "apply_async") as encode_media:
            self.media.encode()

        resolutions = sorted((e.profile.resolution or 0) for e in self.media.encodings.all())
        self.assertEqual(resolutions, [0, 144, 240])
        priorities = {call.kwargs["args"][1]: call.kwargs["priority"] for call in encode_media.call_args_list}
        self.assertEqual(priorities[EncodeProfile.objects.get(name="h264-144", active=True).id], 9)
        self.assertEqual(priorities[EncodeProfile.objects.get(name="preview", active=True).id], 0)

    def test_specific_profiles_can_be_requested(self):
        profile = EncodeProfile.objects.get(name="h264-240", active=True)
        with mock.patch.object(tasks.encode_media, "apply_async") as encode_media:
            self.media.encode(profiles=[profile], force=False)

        self.assertEqual(list(self.media.encodings.values_list("profile", flat=True)), [profile.id])
        self.assertEqual(encode_media.call_args.kwargs["kwargs"], {"force": False})

    @override_settings(CHUNKIZE_VIDEO_DURATION=10)
    def test_long_videos_are_chunked_with_the_preview_encoded_separately(self):
        with mock.patch.object(tasks.encode_media, "apply_async") as encode_media, mock.patch.object(tasks.chunkize_media, "delay") as chunkize:
            self.media.encode()

        preview = EncodeProfile.objects.get(name="preview", active=True)
        self.assertEqual(list(self.media.encodings.values_list("profile", flat=True)), [preview.id])
        encode_media.assert_called_once()
        token, profile_ids = chunkize.call_args.args
        self.assertEqual(token, self.media.friendly_token)
        self.assertNotIn(preview.id, profile_ids)
        self.assertEqual(len(profile_ids), EncodeProfile.objects.filter(active=True).count() - 1)


class MediaEncodingStatusTests(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("status_user")
        cls.mp4 = EncodeProfile.objects.get(name="h264-240", active=True)
        cls.mp4_high = EncodeProfile.objects.get(name="h264-480", active=True)
        cls.preview = EncodeProfile.objects.get(name="preview", active=True)
        cls.webm = EncodeProfile.objects.filter(extension="webm").first()

    def setUp(self):
        self.media = create_media(self.user, filename=SMALL_VIDEO, title="status target")

    def add_encodings(self, *pairs, **fields):
        Encoding.objects.bulk_create([Encoding(media=self.media, profile=profile, status=status, **fields) for profile, status in pairs])

    def status(self):
        self.media.set_encoding_status()
        return self.media.encoding_status

    def test_no_encodings_means_pending(self):
        self.assertEqual(self.status(), "pending")

    def test_a_successful_mp4_or_webm_means_success(self):
        self.add_encodings((self.mp4, "fail"), (self.mp4_high, "success"))
        self.assertEqual(self.status(), "success")

    def test_a_successful_webm_alone_means_success(self):
        self.add_encodings((self.webm, "success"))
        self.assertEqual(self.status(), "success")

    def test_running_without_success_means_running(self):
        self.add_encodings((self.mp4, "fail"), (self.mp4_high, "running"))
        self.assertEqual(self.status(), "running")

    def test_only_failures_mean_fail(self):
        self.add_encodings((self.mp4, "fail"))
        self.assertEqual(self.status(), "fail")

    def test_preview_and_chunks_do_not_count(self):
        self.add_encodings((self.preview, "success"))
        self.add_encodings((self.mp4, "success"), chunk=True)
        self.assertEqual(self.status(), "pending")

    def test_post_encode_actions_records_the_preview_file(self):
        encoding = Encoding(media=self.media, profile=self.preview, status="success")
        with open(fixture_path(IMAGE), "rb") as fp:
            encoding.media_file.save("preview.gif", File(fp), save=False)
        Encoding.objects.bulk_create([encoding])

        self.media.post_encode_actions(encoding=encoding, action="add")
        self.media.refresh_from_db()
        self.assertEqual(self.media.preview_file_path, encoding.media_file.path)
        self.assertEqual(self.media.preview_url, helpers.url_from_path(encoding.media_file.path))

        self.media.post_encode_actions(encoding=encoding, action="delete")
        self.media.refresh_from_db()
        self.assertEqual(self.media.preview_file_path, "")
        self.assertEqual(self.media.preview_url, helpers.url_from_path(encoding.media_file.path))

    def test_successful_h264_encoding_triggers_hls_and_finishes_a_running_trim(self):
        self.add_encodings((self.mp4, "success"))
        encoding = self.media.encodings.get()
        trim = VideoTrimRequest.objects.create(media=self.media, status="running", video_action="replace", timestamps=[])

        with mock.patch.object(tasks.create_hls, "delay") as create_hls, mock.patch.object(tasks.post_trim_action, "delay") as post_trim:
            self.media.post_encode_actions(encoding=encoding, action="add")

        create_hls.assert_called_once_with(self.media.friendly_token)
        post_trim.assert_called_once_with(self.media.friendly_token)
        trim.refresh_from_db()
        self.assertEqual(trim.status, "success")
        self.assertEqual(Media.objects.get(pk=self.media.pk).encoding_status, "success")

    def test_failed_encoding_does_not_trigger_hls(self):
        self.add_encodings((self.mp4, "fail"))
        with mock.patch.object(tasks.create_hls, "delay") as create_hls:
            self.media.post_encode_actions(encoding=self.media.encodings.get(), action="add")
        create_hls.assert_not_called()
        self.assertEqual(Media.objects.get(pk=self.media.pk).encoding_status, "fail")


class MediaEncodingInfoTests(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("info_user")
        cls.mp4 = EncodeProfile.objects.get(name="h264-240", active=True)
        cls.mp4_high = EncodeProfile.objects.get(name="h264-480", active=True)
        cls.preview = EncodeProfile.objects.get(name="preview", active=True)

    def setUp(self):
        self.media = create_media(self.user, filename=SMALL_VIDEO, title="info target")

    def add_encoding(self, profile, status="success"):
        encoding = Encoding(media=self.media, profile=profile, status=status, progress=100, logs="log text", worker="w1", total_run_time=12, commands="ffmpeg")
        with open(self.media.media_file.path, "rb") as fp:
            encoding.media_file.save(f"{profile.name}.mp4", File(fp), save=False)
        Encoding.objects.bulk_create([encoding])
        return self.media.encodings.get(profile=profile)

    def test_non_video_media_has_no_encodings_info(self):
        self.assertEqual(create_media(self.user, title="info image").encodings_info, {})

    def test_media_still_encoding_exposes_the_original_file(self):
        Media.objects.filter(pk=self.media.pk).update(encoding_status="running")
        self.media.refresh_from_db()
        info = self.media.encodings_info
        self.assertEqual(info["0-original"]["h264"]["url"], helpers.url_from_path(self.media.media_file.path))

    @override_settings(DO_NOT_TRANSCODE_VIDEO=True)
    def test_do_not_transcode_exposes_the_original_file(self):
        self.assertEqual(self.media.encodings_info["0-original"]["h264"]["status"], "success")

    def test_encoded_media_lists_each_resolution_but_not_the_preview(self):
        encoding = self.add_encoding(self.mp4)
        self.add_encoding(self.preview)

        info = self.media.encodings_info

        self.assertNotIn("0-original", info)
        self.assertEqual(set(info.keys()), {2160, 1440, 1080, 720, 480, 360, 240, 144})
        self.assertEqual(info[240]["h264"]["encoding_id"], encoding.id)
        self.assertEqual(info[240]["h264"]["url"], helpers.url_from_path(encoding.media_file.path))
        self.assertEqual(info[480], {})

    def test_full_encoding_info_includes_diagnostics(self):
        encoding = self.add_encoding(self.mp4)
        info = self.media.get_encoding_info(encoding, full=True)
        self.assertEqual(info["logs"], "log text")
        self.assertEqual(info["worker"], "w1")
        self.assertEqual(info["total_run_time"], 12)
        self.assertEqual(info["commands"], "ffmpeg")
        self.assertNotIn("logs", self.media.get_encoding_info(encoding))

    def test_trim_url_prefers_the_highest_resolution_mp4_encoding(self):
        self.assertEqual(self.media.trim_video_url, helpers.url_from_path(self.media.media_file.path))
        self.assertIsNone(self.media.trim_video_path)

        self.add_encoding(self.mp4)
        high = self.add_encoding(self.mp4_high)

        self.assertEqual(self.media.trim_video_url, helpers.url_from_path(high.media_file.path))
        self.assertEqual(self.media.trim_video_path, high.media_file.path)

    def test_images_cannot_be_trimmed(self):
        image = create_media(self.user, title="trim image")
        self.assertIsNone(image.trim_video_url)
        self.assertIsNone(image.trim_video_path)


class MediaPropertiesTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("props_user", name="Props Person")
        cls.image = create_media(cls.user, title="props image")

    def test_author_properties_come_from_the_user(self):
        self.assertEqual(self.image.author_name, "Props Person")
        self.assertEqual(self.image.author_username, "props_user")
        self.assertEqual(self.image.author_profile(), self.user.get_absolute_url())
        self.assertEqual(self.image.author_thumbnail(), helpers.url_from_path(self.user.logo.path))

    def test_urls_use_the_friendly_token(self):
        token = self.image.friendly_token
        self.assertEqual(self.image.get_absolute_url(), f"/view?m={token}")
        self.assertEqual(self.image.get_absolute_url(api=True), f"/api/v1/media/{token}")
        self.assertEqual(self.image.edit_url, f"/edit?m={token}")
        self.assertEqual(self.image.add_subtitle_url, f"/add_subtitle?m={token}")

    @override_settings(SHOW_ORIGINAL_MEDIA=True)
    def test_original_media_url_is_shown_when_enabled(self):
        self.assertEqual(self.image.original_media_url, helpers.url_from_path(self.image.media_file.path))

    @override_settings(SHOW_ORIGINAL_MEDIA=False)
    def test_original_media_url_is_hidden_when_disabled(self):
        self.assertIsNone(self.image.original_media_url)

    def test_uploaded_poster_takes_priority_over_the_generated_one(self):
        media = create_media(self.user, title="custom poster")
        with open(fixture_path(IMAGE_JPG), "rb") as fp:
            media.uploaded_poster.save("custom.jpg", File(fp))
        media.refresh_from_db()

        self.assertTrue(media.uploaded_thumbnail)
        self.assertEqual(media.poster_url, helpers.url_from_path(media.uploaded_poster.path))
        self.assertEqual(media.thumbnail_url, helpers.url_from_path(media.uploaded_thumbnail.path))

    def test_media_without_thumbnails_has_no_urls(self):
        media = Media(user=self.user, media_type="video")
        self.assertIsNone(media.thumbnail_url)
        self.assertIsNone(media.poster_url)
        self.assertIsNone(media.sprites_url)
        self.assertEqual(media.hls_info, {})

    def test_sprites_url_points_to_the_sprites_file(self):
        media = create_media(self.user, title="sprites")
        with open(fixture_path(IMAGE_JPG), "rb") as fp:
            media.sprites.save("sprites.jpg", File(fp))
        self.assertEqual(media.sprites_url, helpers.url_from_path(media.sprites.path))

    def test_tags_info_lists_titles_and_urls(self):
        media = create_media(self.user, title="tagged", tags=[Tag.objects.create(title="props tag")])
        self.assertEqual(media.tags_info, [{"title": "props tag", "url": "/search?t=props tag"}])

    def test_slideshow_lists_the_media_first_then_the_users_other_images(self):
        other = create_media(self.user, title="slide two")
        create_media(self.user, title="slide hidden", state="private")
        create_media(self.user, filename=SMALL_VIDEO, title="slide video")

        items = self.image.slideshow_items

        self.assertEqual([item["title"] for item in items], ["props image", "slide two"])
        self.assertEqual(items[1]["url"], other.get_absolute_url())

    def test_slideshow_is_empty_for_non_images(self):
        video = Media(user=self.user, media_type="video")
        self.assertEqual(video.slideshow_items, [])

    @override_settings(ALLOW_RATINGS=False)
    def test_ratings_info_is_empty_when_ratings_are_disabled(self):
        self.image.rating_category.add(RatingCategory.objects.create(title="Disabled ratings"))
        self.assertEqual(self.image.ratings_info, [])

    @override_settings(ALLOW_RATINGS=True)
    def test_ratings_info_lists_enabled_categories_unscored(self):
        enabled = RatingCategory.objects.create(title="Enabled rating")
        disabled = RatingCategory.objects.create(title="Disabled rating", enabled=False)
        self.image.rating_category.add(enabled, disabled)
        self.assertEqual(self.image.ratings_info, [{"score": -1, "category_id": enabled.id, "category_title": "Enabled rating"}])

    def test_chapter_data_is_empty_until_chapters_exist(self):
        self.assertEqual(self.image.chapter_data, [])
        chapters = [{"startTime": 0, "endTime": 3, "chapterTitle": "Start"}]
        VideoChapterData.objects.create(media=self.image, data=chapters)
        self.assertEqual(self.image.chapter_data, chapters)

    def test_video_chapters_folder_is_per_user_and_media(self):
        self.assertEqual(
            self.image.video_chapters_folder,
            os.path.join(settings.MEDIA_ROOT, f"{settings.THUMBNAIL_UPLOAD_DIR}{self.user.username}/{self.image.friendly_token}_chapters"),
        )


class MediaSharingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user("share_owner")
        cls.friend = make_user("share_friend")

    def test_unsaved_media_is_not_shared(self):
        self.assertFalse(Media(user=self.owner).is_shared)

    def test_media_is_shared_through_permissions_or_rbac_categories(self):
        media = create_media(self.owner, title="share me")
        self.assertFalse(media.is_shared)

        permission = MediaPermission.objects.create(owner_user=self.owner, user=self.friend, media=media, permission="viewer")
        self.assertTrue(media.is_shared)
        self.assertEqual(str(permission), "share_friend - share me (viewer)")

        permission.delete()
        media.category.add(Category.objects.create(title="Share rbac", is_rbac_category=True))
        self.assertTrue(media.is_shared)

    def test_plain_categories_do_not_share_media(self):
        media = create_media(self.owner, title="plain category", category=[Category.objects.create(title="Share plain")])
        self.assertFalse(media.is_shared)

    def test_embed_course_str_names_media_and_course(self):
        media = create_media(self.owner, title="embedded")
        course = Category.objects.create(title="Course 101", is_lms_course=True)
        self.assertEqual(str(EmbedMediaCourse.objects.create(media=media, category=course)), "embedded in Course 101")


class MediaDeleteTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("delete_user")

    def test_deleting_media_removes_its_files(self):
        media = create_media(self.user, title="delete files")
        with open(fixture_path(IMAGE_JPG), "rb") as fp:
            media.uploaded_poster.save("poster.jpg", File(fp))
        with open(fixture_path(IMAGE_JPG), "rb") as fp:
            media.sprites.save("sprites.jpg", File(fp))
        media.refresh_from_db()
        paths = [media.media_file.path, media.thumbnail.path, media.poster.path, media.uploaded_poster.path, media.uploaded_thumbnail.path, media.sprites.path]
        self.assertTrue(all(os.path.isfile(path) for path in paths))

        media.delete()

        self.assertEqual([path for path in paths if os.path.exists(path)], [])

    def test_deleting_media_updates_category_tag_and_user_counts(self):
        category = Category.objects.create(title="Delete category")
        tag = Tag.objects.create(title="deletetag")
        keep = create_media(self.user, title="keep", category=[category], tags=[tag])
        gone = create_media(self.user, title="gone", category=[category], tags=[tag])
        keep.save()
        gone.save()
        tag.refresh_from_db()
        self.assertEqual(tag.media_count, 2)

        gone.delete()

        category.refresh_from_db()
        tag.refresh_from_db()
        self.user.refresh_from_db()
        self.assertEqual(category.media_count, 1)
        self.assertEqual(tag.media_count, 1)
        self.assertEqual(self.user.media_count, 1)
