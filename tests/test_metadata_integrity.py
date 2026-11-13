import json
import os
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from actions.models import MediaAction
from admin_customizations.admin import REPORT_AUDIT_ACTIONS, get_site_health_checks
from files.metadata_integrity import (
    MISSING_METADATA_FILTER_PARAM,
    qs_missing_media_metadata,
    refresh_and_check_media,
)
from files.models import EncodeProfile, Encoding, Language, Media, Subtitle
from files.tests import create_account, create_media
from files.tests.media_utils import SMALL_VIDEO


class MetadataIntegrityRefreshTests(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.user = create_account(username="meta_integrity_user")
        cls.profile = EncodeProfile.objects.filter(extension="mp4").exclude(name="preview").first()

    def test_fills_blank_md5_and_size_and_audits_refresh(self):
        media = create_media(self.user, filename=SMALL_VIDEO, title="fill blanks", encoding_status="success")
        Media.objects.filter(pk=media.pk).update(md5sum="", size="", media_info="")
        media.refresh_from_db()

        result = refresh_and_check_media(media, user=self.user)
        media.refresh_from_db()

        self.assertTrue(media.md5sum)
        self.assertTrue(media.size)
        self.assertTrue(media.media_info)
        self.assertTrue(any("md5sum" in note for note in result["filled"]))
        event = MediaAction.objects.get(media=media, action="metadata_refresh")
        self.assertEqual(event.user_id, self.user.pk)
        self.assertIn("md5sum", event.extra_info)

    def test_mismatch_keeps_stored_values_and_warns(self):
        media = create_media(self.user, filename=SMALL_VIDEO, title="mismatch", encoding_status="success")
        Media.objects.filter(pk=media.pk).update(md5sum="deadbeef" * 4, size="0.1MB")
        media.refresh_from_db()

        result = refresh_and_check_media(media, user=self.user)
        media.refresh_from_db()

        self.assertEqual(media.md5sum, "deadbeef" * 4)
        self.assertEqual(media.size, "0.1MB")
        self.assertTrue(any("md5sum mismatch" in w for w in result["warnings"]))
        self.assertTrue(MediaAction.objects.filter(media=media, action="metadata_refresh").exists())
        warn = MediaAction.objects.get(media=media, action="integrity_warning")
        self.assertIn("md5sum mismatch", warn.extra_info)

    def test_missing_original_warns(self):
        media = create_media(self.user, filename=SMALL_VIDEO, title="missing original", encoding_status="success")
        path = media.media_file.path
        os.remove(path)

        result = refresh_and_check_media(media, user=self.user)
        self.assertIn("original missing on disk", result["warnings"])
        self.assertTrue(MediaAction.objects.filter(media=media, action="integrity_warning").exists())

    def test_missing_encoding_file_warns(self):
        media = create_media(self.user, filename=SMALL_VIDEO, title="missing enc", encoding_status="success")
        encoding = Encoding.objects.create(media=media, profile=self.profile, status="success", chunk=False)
        Encoding.objects.filter(pk=encoding.pk).update(media_file="encodings/does-not-exist.mp4")

        result = refresh_and_check_media(media, user=self.user)
        self.assertTrue(any("file missing on disk" in w for w in result["warnings"]))

    def test_missing_hls_warns_for_success_video_with_encodings(self):
        media = create_media(self.user, filename=SMALL_VIDEO, title="missing hls", encoding_status="success")
        Encoding.objects.create(
            media=media,
            profile=self.profile,
            status="success",
            chunk=False,
            media_file=SimpleUploadedFile("enc.mp4", b"fake-mp4-bytes"),
        )
        Media.objects.filter(pk=media.pk).update(hls_file="")

        result = refresh_and_check_media(media, user=self.user)
        self.assertIn("missing HLS", result["warnings"])

    def test_missing_subtitle_file_warns(self):
        media = create_media(self.user, filename=SMALL_VIDEO, title="missing sub", encoding_status="success")
        language, _ = Language.objects.get_or_create(code="xx", defaults={"title": "TestLang"})
        subtitle = Subtitle.objects.create(
            media=media,
            user=self.user,
            language=language,
            subtitle_file=SimpleUploadedFile("cap.vtt", b"WEBVTT\n"),
        )
        path = subtitle.subtitle_file.path
        os.remove(path)

        result = refresh_and_check_media(media, user=self.user)
        self.assertTrue(any("subtitle:" in w and "missing on disk" in w for w in result["warnings"]))

    def test_always_records_metadata_refresh_audit(self):
        media = create_media(self.user, title="image ok", encoding_status="success")
        Media.objects.filter(pk=media.pk).update(md5sum="abc", size="1.0MB", media_info=json.dumps({"ok": True}))
        media.refresh_from_db()

        with patch("files.metadata_integrity._compute_md5", return_value="abc"), patch("files.metadata_integrity._compute_size_bytes", return_value=1000000), patch(
            "files.metadata_integrity._path_exists", return_value=True
        ):
            refresh_and_check_media(media, user=self.user)

        event = MediaAction.objects.get(media=media, action="metadata_refresh")
        self.assertEqual(event.extra_info, "no missing metadata")
        self.assertFalse(MediaAction.objects.filter(media=media, action="integrity_warning").exists())


class MetadataHealthCheckTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = create_account(username="meta_health_user")

    def test_qs_missing_media_metadata(self):
        media = create_media(self.user, title="blank meta")
        Media.objects.filter(pk=media.pk).update(md5sum="", size="")
        self.assertIn(media.pk, qs_missing_media_metadata().values_list("pk", flat=True))

        Media.objects.filter(pk=media.pk).update(md5sum="abc", size="1.0MB")
        self.assertNotIn(media.pk, qs_missing_media_metadata().values_list("pk", flat=True))

    def test_site_health_includes_metadata_checks(self):
        checks = {check["id"]: check for check in get_site_health_checks()}
        self.assertIn("missing_media_metadata", checks)
        self.assertIn("recent_integrity_warnings", checks)
        self.assertIn(MISSING_METADATA_FILTER_PARAM, checks["missing_media_metadata"]["link"])
        self.assertIn("integrity_warning", checks["recent_integrity_warnings"]["link"])

    def test_report_audit_actions_exclude_metadata_integrity(self):
        self.assertNotIn("metadata_refresh", REPORT_AUDIT_ACTIONS)
        self.assertNotIn("integrity_warning", REPORT_AUDIT_ACTIONS)

    def test_recent_integrity_warnings_status(self):
        media = create_media(self.user, title="warned")
        MediaAction.objects.create(user=self.user, media=media, action="integrity_warning", extra_info="original missing on disk")
        checks = {check["id"]: check for check in get_site_health_checks()}
        self.assertEqual(checks["recent_integrity_warnings"]["status"], "warn")
