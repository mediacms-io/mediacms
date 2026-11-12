from datetime import timedelta

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone

from admin_customizations.admin import get_site_health_checks
from files.integrity import (
    INTEGRITY_CHECKS,
    INTEGRITY_FILTER_PARAM,
    get_integrity_check,
    inject_integrity_faults,
    qs_listable_mismatch,
    qs_nonvideo_has_encodings,
    qs_nonvideo_not_success,
    qs_stale_encoding_running,
    qs_transcription_success_no_subtitle,
    qs_video_queued_no_rows,
    qs_video_success_no_encoding,
)
from files.models import (
    EncodeProfile,
    Encoding,
    Language,
    Subtitle,
    TranscriptionRequest,
)
from files.models.utils import PREVIEW_PROFILE_NAME
from files.tests import create_account, create_media
from files.tests.media_utils import SMALL_VIDEO


class IntegrityQueryTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = create_account(username="integrity_user")
        cls.profile = EncodeProfile.objects.filter(extension="mp4").exclude(name=PREVIEW_PROFILE_NAME).first()
        if cls.profile is None:
            cls.profile = EncodeProfile.objects.create(
                name="integrity-h264-240",
                extension="mp4",
                resolution=240,
                codec="h264",
                active=True,
            )

    def test_video_success_no_encoding_detects_missing_playable_rows(self):
        video = create_media(self.user, filename=SMALL_VIDEO, title="ok video success", encoding_status="success")
        self.assertIn(video.pk, qs_video_success_no_encoding().values_list("pk", flat=True))

        Encoding.objects.create(media=video, profile=self.profile, status="success", chunk=False)
        self.assertNotIn(video.pk, qs_video_success_no_encoding().values_list("pk", flat=True))

    @override_settings(DO_NOT_TRANSCODE_VIDEO=True)
    def test_video_success_no_encoding_skipped_when_transcode_disabled(self):
        create_media(self.user, filename=SMALL_VIDEO, title="no transcode video", encoding_status="success")
        self.assertEqual(qs_video_success_no_encoding().count(), 0)

    def test_listable_mismatch_detects_bypass_update(self):
        media = create_media(
            self.user,
            title="listable mismatch",
            state="public",
            encoding_status="success",
            is_reviewed=True,
        )
        self.assertTrue(media.listable)
        type(media).objects.filter(pk=media.pk).update(listable=False)
        self.assertIn(media.pk, qs_listable_mismatch().values_list("pk", flat=True))

    def test_nonvideo_not_success(self):
        image = create_media(self.user, title="pending image", encoding_status="pending")
        self.assertIn(image.pk, qs_nonvideo_not_success().values_list("pk", flat=True))

    def test_video_queued_no_rows(self):
        video = create_media(self.user, filename=SMALL_VIDEO, title="queued empty", encoding_status="pending")
        Encoding.objects.filter(media=video).delete()
        type(video).objects.filter(pk=video.pk).update(encoding_status="pending")
        self.assertIn(video.pk, qs_video_queued_no_rows().values_list("pk", flat=True))

        Encoding.objects.create(media=video, profile=self.profile, status="pending", chunk=False)
        self.assertNotIn(video.pk, qs_video_queued_no_rows().values_list("pk", flat=True))

    def test_nonvideo_has_encodings(self):
        image = create_media(self.user, title="image with encoding")
        Encoding.objects.create(media=image, profile=self.profile, status="pending")
        self.assertIn(image.pk, qs_nonvideo_has_encodings().values_list("pk", flat=True))

    def test_transcription_success_no_subtitle(self):
        video = create_media(self.user, filename=SMALL_VIDEO, title="caption orphan", encoding_status="success")
        TranscriptionRequest.objects.create(media=video, status="success")
        self.assertIn(video.pk, qs_transcription_success_no_subtitle().values_list("pk", flat=True))

        lang, _ = Language.objects.get_or_create(code="en", defaults={"title": "English"})
        Subtitle.objects.create(
            media=video,
            language=lang,
            user=self.user,
            subtitle_file=SimpleUploadedFile("caption.vtt", b"WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHi\n"),
        )
        self.assertNotIn(video.pk, qs_transcription_success_no_subtitle().values_list("pk", flat=True))

    def test_stale_encoding_running(self):
        video = create_media(self.user, filename=SMALL_VIDEO, title="stale running", encoding_status="running")
        encoding = Encoding.objects.create(media=video, profile=self.profile, status="running", chunk=False)
        Encoding.objects.filter(pk=encoding.pk).update(update_date=timezone.now() - timedelta(seconds=settings.RUNNING_STATE_STALE + 120))
        self.assertIn(video.pk, qs_stale_encoding_running().values_list("pk", flat=True))


class IntegrityHealthAndInjectTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = create_account(username="integrity_health_user")

    def test_health_checks_include_integrity_ids(self):
        checks = {check["id"]: check for check in get_site_health_checks()}
        for integrity in INTEGRITY_CHECKS:
            self.assertIn(f"integrity_{integrity.id}", checks)
            self.assertIn(INTEGRITY_FILTER_PARAM, checks[f"integrity_{integrity.id}"]["link"])

    def test_inject_integrity_faults_creates_detectable_rows(self):
        media_pool = [create_media(self.user, filename=SMALL_VIDEO, title=f"video {i}", encoding_status="success", state="public", is_reviewed=True) for i in range(6)]
        media_pool.extend([create_media(self.user, title=f"image {i}", encoding_status="success") for i in range(3)])
        media_pool.append(create_media(self.user, title="audio one", filename="sample_audio.mp3", encoding_status="success"))

        injected = inject_integrity_faults(media_pool, per_check=1)
        self.assertTrue(injected)
        for check_id, victims in injected.items():
            self.assertEqual(len(victims), 1)
            check = get_integrity_check(check_id)
            self.assertIsNotNone(check)
            self.assertGreaterEqual(check.count(), 1)
            self.assertTrue(victims[0].title.startswith(f"[integrity:{check_id}]"))

    def test_inject_respects_per_check_cap(self):
        media_pool = [create_media(self.user, filename=SMALL_VIDEO, title=f"cap video {i}", encoding_status="success", state="public", is_reviewed=True) for i in range(6)]
        media_pool.extend([create_media(self.user, title=f"cap image {i}") for i in range(4)])
        injected = inject_integrity_faults(media_pool, per_check=5)
        for victims in injected.values():
            self.assertLessEqual(len(victims), 2)
