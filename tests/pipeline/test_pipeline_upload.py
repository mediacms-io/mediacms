import hashlib
import os
import shutil
import subprocess
import tempfile
import uuid

import pytest
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings

from files.models import Encoding, Media
from files.tests import create_account, fixture_path
from files.tests.media_utils import IMAGE, IMAGE_JPG, SMALL_VIDEO
from uploader.fineuploader import (
    BaseFineUploader,
    ChunkedFineUploader,
    is_valid_uuid_format,
    strip_delimiters,
)
from uploader.utils import import_class

UPLOAD_URL = "/fu/upload/"
DONE_URL = f"/fu/upload/?{settings.CHUNKS_DONE_PARAM_NAME}"
PASSWORD = "pipeline-upload-pass"

MINIMAL_PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n"
    b"trailer<</Root 1 0 R>>\n"
    b"%%EOF\n"
)


def read_fixture(name):
    with open(fixture_path(name), "rb") as handle:
        return handle.read()


def md5(data):
    return hashlib.md5(data).hexdigest()


def upload(client, content, filename, qquuid=None, **extra):
    data = {
        "qqfile": SimpleUploadedFile(filename, content),
        "qquuid": qquuid or str(uuid.uuid4()),
        "qqfilename": filename,
        "qqtotalparts": 1,
    }
    data.update(extra)
    return client.post(UPLOAD_URL, data)


def media_from_response(response):
    token = response.json()["media_url"].split("m=")[-1]
    return Media.objects.get(friendly_token=token)


class UploadSingleRequestTest(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.audio_dir = tempfile.mkdtemp(prefix="pipeline-audio-")
        cls.addClassCleanup(shutil.rmtree, cls.audio_dir, ignore_errors=True)
        cls.audio_path = os.path.join(cls.audio_dir, "pipeline_clip.mp3")
        subprocess.run(
            [settings.FFMPEG_COMMAND, "-y", "-v", "error", "-i", fixture_path(SMALL_VIDEO), "-t", "3", "-vn", "-c:a", "libmp3lame", cls.audio_path],
            check=True,
        )

    @classmethod
    def setUpTestData(cls):
        cls.user = create_account(password=PASSWORD)

    def setUp(self):
        self.client.login(username=self.user.username, password=PASSWORD)

    def test_an_image_uploaded_in_one_request_becomes_a_media_of_the_uploader(self):
        response = upload(self.client, read_fixture(IMAGE), "pipeline_single.png")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["success"])
        media = media_from_response(response)
        self.assertEqual(media.user, self.user)
        self.assertEqual(media.title, "pipeline_single.png")
        self.assertEqual(media.media_type, "image")
        self.assertEqual(media.encoding_status, "success")
        with open(media.media_file.path, "rb") as handle:
            self.assertEqual(md5(handle.read()), md5(read_fixture(IMAGE)))

    def test_an_invalid_qquuid_is_replaced_and_the_upload_still_succeeds(self):
        for qquuid in ("../../etc/passwd", "not-a-uuid"):
            with self.subTest(qquuid=qquuid):
                response = upload(self.client, read_fixture(IMAGE), "pipeline_bad_uuid.png", qquuid=qquuid)
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.json()["success"])
                self.assertEqual(media_from_response(response).user, self.user)

    def test_the_temporary_upload_directory_is_removed_once_the_media_exists(self):
        qquuid = str(uuid.uuid4())
        upload(self.client, read_fixture(IMAGE), "pipeline_cleanup.png", qquuid=qquuid)

        self.assertFalse(os.path.exists(os.path.join(settings.MEDIA_ROOT, settings.UPLOAD_DIR, qquuid)))

    def test_an_uploaded_image_appears_on_the_listing_and_gets_a_media_page(self):
        response = upload(self.client, read_fixture(IMAGE_JPG), "pipeline_listed.jpg")
        media = media_from_response(response)

        self.assertTrue(media.listable)
        listing = Client().get("/api/v1/media")
        self.assertIn(media.friendly_token, [item["friendly_token"] for item in listing.data["results"]])

        page = Client().get(media.get_absolute_url())
        self.assertEqual(page.status_code, 200)
        self.assertEqual(page.context["media_object"], media)

        detail = Client().get(media.get_absolute_url(api=True)).json()
        self.assertEqual(detail["media_type"], "image")
        self.assertTrue(detail["thumbnail_url"])
        self.assertTrue(detail["poster_url"])
        self.assertTrue(media.thumbnail)
        self.assertTrue(os.path.exists(media.thumbnail.path))
        self.assertTrue(os.path.exists(media.poster.path))

    def test_a_pdf_upload_is_detected_as_pdf_and_uses_the_pdf_poster(self):
        response = upload(self.client, MINIMAL_PDF, "pipeline_doc.pdf")
        media = media_from_response(response)

        self.assertEqual(media.media_type, "pdf")
        self.assertEqual(media.encoding_status, "success")
        self.assertFalse(media.encodings.exists())
        self.assertTrue(media.thumbnail_url.endswith("poster_pdf.jpg"))
        self.assertTrue(media.poster_url.endswith("poster_pdf.jpg"))
        self.assertEqual(Client().get(media.get_absolute_url()).status_code, 200)

    def test_an_audio_upload_is_detected_as_audio_with_its_duration(self):
        with open(self.audio_path, "rb") as handle:
            response = upload(self.client, handle.read(), "pipeline_clip.mp3")
        media = media_from_response(response)

        self.assertEqual(media.media_type, "audio")
        self.assertEqual(media.encoding_status, "success")
        self.assertIn(media.duration, (2, 3))
        self.assertTrue(media.media_info)
        self.assertFalse(media.encodings.exists())
        self.assertTrue(media.thumbnail_url.endswith("poster_audio.jpg"))
        self.assertEqual(media.encodings_info, {})
        self.assertTrue(media.listable)

    def test_an_unrecognised_file_is_kept_out_of_listings(self):
        response = upload(self.client, b"this is not a media file at all\n" * 20, "pipeline_notes.mp4")
        media = media_from_response(response)

        self.assertEqual(media.media_type, "")
        self.assertEqual(media.encoding_status, "fail")
        self.assertFalse(media.listable)
        self.assertFalse(media.encodings.exists())
        self.assertNotIn(media.friendly_token, [item["friendly_token"] for item in Client().get("/api/v1/media").data["results"]])

    def test_path_components_in_the_file_name_cannot_escape_the_upload_directory(self):
        response = upload(self.client, read_fixture(IMAGE), "../../pipeline_escape.png")
        media = media_from_response(response)

        self.assertNotIn("..", media.media_file.name)
        self.assertTrue(os.path.realpath(media.media_file.path).startswith(os.path.realpath(settings.MEDIA_ROOT)))
        self.assertFalse(os.path.exists(os.path.join(settings.MEDIA_ROOT, "pipeline_escape.png")))


class UploadChunkedTest(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.user = create_account(password=PASSWORD)
        cls.content = read_fixture(IMAGE)
        third = len(cls.content) // 3
        cls.parts = [cls.content[:third], cls.content[third : 2 * third], cls.content[2 * third :]]

    def setUp(self):
        self.client.login(username=self.user.username, password=PASSWORD)
        self.qquuid = str(uuid.uuid4())

    def send_part(self, index, filename="pipeline_chunked.png"):
        return self.client.post(
            UPLOAD_URL,
            {
                "qqfile": SimpleUploadedFile("blob", self.parts[index]),
                "qquuid": self.qquuid,
                "qqfilename": filename,
                "qqpartindex": index,
                "qqtotalparts": len(self.parts),
                "qqchunksize": len(self.parts[0]),
                "qqtotalfilesize": len(self.content),
            },
        )

    def complete(self, filename="pipeline_chunked.png"):
        return self.client.post(DONE_URL, {"qquuid": self.qquuid, "qqfilename": filename, "qqtotalparts": len(self.parts), "qqtotalfilesize": len(self.content)})

    def test_chunks_are_stored_without_creating_media_until_completion(self):
        for index in range(len(self.parts)):
            response = self.send_part(index)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {"success": True})

        self.assertFalse(Media.objects.filter(user=self.user).exists())
        chunks_dir = os.path.join(settings.MEDIA_ROOT, settings.CHUNKS_DIR, self.qquuid)
        self.assertEqual(sorted(os.listdir(chunks_dir)), ["0", "1", "2"])

    def test_completion_combines_the_chunks_into_the_original_file(self):
        for index in range(len(self.parts)):
            self.send_part(index)

        response = self.complete()

        self.assertEqual(response.status_code, 200)
        media = media_from_response(response)
        self.assertEqual(media.media_type, "image")
        with open(media.media_file.path, "rb") as handle:
            self.assertEqual(md5(handle.read()), md5(self.content))
        self.assertFalse(os.path.exists(os.path.join(settings.MEDIA_ROOT, settings.CHUNKS_DIR, self.qquuid)))
        self.assertFalse(os.path.exists(os.path.join(settings.MEDIA_ROOT, settings.UPLOAD_DIR, self.qquuid)))

    def test_completion_without_uploaded_chunks_is_rejected(self):
        response = self.complete()

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()["success"])
        self.assertFalse(Media.objects.filter(user=self.user).exists())

    def test_completion_request_missing_total_parts_is_rejected(self):
        response = self.client.post(DONE_URL, {"qquuid": self.qquuid, "qqfilename": "pipeline_chunked.png"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("qqtotalparts", response.json()["error"])


class UploadPermissionsAndValidationTest(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.user = create_account(password=PASSWORD)

    def login(self):
        self.client.login(username=self.user.username, password=PASSWORD)

    def test_anonymous_users_cannot_upload(self):
        response = upload(self.client, read_fixture(IMAGE), "pipeline_anon.png")

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Media.objects.exists())

    def test_get_is_not_allowed(self):
        self.login()

        self.assertEqual(self.client.get(UPLOAD_URL).status_code, 405)

    def test_a_request_without_a_file_is_rejected_with_the_form_errors(self):
        self.login()

        response = self.client.post(UPLOAD_URL, {"qquuid": str(uuid.uuid4()), "qqfilename": "pipeline_nofile.png"})

        self.assertEqual(response.status_code, 400)
        body = response.json()
        self.assertFalse(body["success"])
        self.assertIn("qqfile", body["error"])

    @override_settings(CAN_ADD_MEDIA="advancedUser")
    def test_a_regular_user_cannot_upload_when_only_advanced_users_may(self):
        self.login()

        self.assertEqual(upload(self.client, read_fixture(IMAGE), "pipeline_adv.png").status_code, 403)

    @override_settings(CAN_ADD_MEDIA="advancedUser")
    def test_an_editor_can_upload_whatever_the_upload_policy(self):
        editor = create_account(password=PASSWORD, is_editor=True)
        self.client.login(username=editor.username, password=PASSWORD)

        self.assertEqual(upload(self.client, read_fixture(IMAGE), "pipeline_editor.png").status_code, 200)

    @override_settings(NUMBER_OF_MEDIA_USER_CAN_UPLOAD=1)
    def test_a_user_at_the_upload_limit_cannot_upload_more(self):
        self.login()
        self.assertEqual(upload(self.client, read_fixture(IMAGE), "pipeline_first.png").status_code, 200)

        self.assertEqual(upload(self.client, read_fixture(IMAGE), "pipeline_second.png").status_code, 403)
        self.assertEqual(Media.objects.filter(user=self.user).count(), 1)


class FineUploaderUnitTest(TestCase):
    def test_strip_delimiters_removes_shell_and_path_characters(self):
        self.assertEqual(strip_delimiters("my file (1);rm -rf *.png"), "myfile1rmrf.png")

    def test_uuid_format_accepts_only_version_4_uuids(self):
        self.assertTrue(is_valid_uuid_format(str(uuid.uuid4())))
        self.assertFalse(is_valid_uuid_format(str(uuid.uuid1())))
        self.assertFalse(is_valid_uuid_format("../../etc"))

    def test_the_uploader_keeps_the_original_name_but_sanitises_the_stored_one(self):
        qquuid = str(uuid.uuid4())
        uploader = BaseFineUploader({"qqfilename": "../dir/my clip (final).png", "qquuid": qquuid})

        self.assertEqual(uploader.original_filename, "../dir/my clip (final).png")
        self.assertEqual(uploader.filename, "myclipfinal.png")
        self.assertEqual(uploader.file_path, os.path.join(settings.UPLOAD_DIR, qquuid))
        self.assertFalse(uploader.finished)
        self.assertIsNone(uploader.url)

    def test_a_finished_upload_exposes_the_storage_url(self):
        uploader = BaseFineUploader({"qqfilename": "pipeline.png", "qquuid": str(uuid.uuid4())})
        uploader.real_path = "uploads/pipeline.png"

        self.assertTrue(uploader.finished)
        self.assertTrue(uploader.url.endswith("uploads/pipeline.png"))

    def test_non_integer_part_values_fall_back_to_a_single_part(self):
        uploader = ChunkedFineUploader({"qqfilename": "pipeline.png", "qquuid": str(uuid.uuid4()), "qqtotalparts": "3", "qqpartindex": "x"})

        self.assertEqual(uploader.total_parts, 1)
        self.assertEqual(uploader.part_index, 0)
        self.assertFalse(uploader.chunked)
        self.assertTrue(uploader.is_time_to_combine_chunks)

    def test_chunk_paths_are_namespaced_by_upload_uuid(self):
        qquuid = str(uuid.uuid4())
        uploader = ChunkedFineUploader({"qqfilename": "pipeline.png", "qquuid": qquuid, "qqtotalparts": 4, "qqpartindex": 2})

        self.assertTrue(uploader.chunked)
        self.assertFalse(uploader.is_time_to_combine_chunks)
        self.assertEqual(uploader.chunk_file, os.path.join(settings.CHUNKS_DIR, qquuid, "2"))
        self.assertEqual(uploader._abs_chunks_path, os.path.join(settings.MEDIA_ROOT, settings.CHUNKS_DIR, qquuid))

    def test_import_class_resolves_a_dotted_path(self):
        self.assertIs(import_class("uploader.fineuploader.ChunkedFineUploader"), ChunkedFineUploader)

    def test_import_class_rejects_incomplete_or_unknown_paths(self):
        with self.assertRaises(ImproperlyConfigured):
            import_class("ChunkedFineUploader")
        with self.assertRaises(ImportError):
            import_class("uploader.fineuploader.NoSuchUploader")


@pytest.mark.slow
class UploadedVideoTranscodeTest(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.user = create_account(password=PASSWORD)
        client = Client()
        client.login(username=cls.user.username, password=PASSWORD)
        with cls.captureOnCommitCallbacks(execute=True):
            response = upload(client, read_fixture(SMALL_VIDEO), "pipeline_small_video.mp4")
        cls.status_code = response.status_code
        cls.body = response.json()
        cls.media = media_from_response(response)

    def test_the_upload_responds_with_the_media_page_url(self):
        self.assertEqual(self.status_code, 200)
        self.assertEqual(self.body["media_url"], self.media.get_absolute_url())

    def test_video_metadata_is_probed(self):
        self.assertEqual(self.media.media_type, "video")
        self.assertEqual(self.media.duration, 27)
        self.assertEqual(self.media.video_height, 240)
        self.assertTrue(self.media.md5sum)
        self.assertTrue(self.media.size)

    def test_one_encoding_per_active_profile_that_fits_the_video_height(self):
        names = sorted(self.media.encodings.filter(chunk=False).values_list("profile__name", flat=True))

        self.assertEqual(names, ["h264-144", "h264-240", "preview"])

    def test_every_encoding_succeeded_with_a_real_file_and_size(self):
        for encoding in self.media.encodings.all():
            self.assertEqual(encoding.status, "success", encoding.profile.name)
            self.assertTrue(os.path.getsize(encoding.media_file.path) > 0)
            self.assertTrue(encoding.size)
            self.assertTrue(encoding.media_encoding_url.endswith(".mp4"))

    def test_media_is_listable_once_encoded(self):
        self.assertEqual(self.media.encoding_status, "success")
        self.assertTrue(self.media.listable)
        listing = Client().get("/api/v1/media")
        self.assertIn(self.media.friendly_token, [item["friendly_token"] for item in listing.data["results"]])

    def test_thumbnail_and_poster_are_produced(self):
        self.assertTrue(os.path.exists(self.media.thumbnail.path))
        self.assertTrue(os.path.exists(self.media.poster.path))
        self.assertTrue(self.media.thumbnail_url.endswith(".jpg"))

    def test_sprites_are_produced(self):
        self.assertTrue(self.media.sprites)
        self.assertTrue(os.path.getsize(self.media.sprites.path) > 0)
        self.assertTrue(self.media.sprites_url.endswith("sprites.jpg"))

    def test_hover_preview_points_at_the_preview_encoding(self):
        preview = self.media.encodings.get(profile__name="preview")

        self.assertEqual(self.media.preview_file_path, preview.media_file.path)
        self.assertTrue(self.media.preview_url.endswith(".mp4"))

    def test_hls_master_playlist_and_streams_are_created(self):
        self.assertTrue(self.media.hls_file.endswith("master.m3u8"))
        self.assertTrue(os.path.exists(self.media.hls_file))

        info = self.media.hls_info
        self.assertTrue(info["master_file"].endswith("master.m3u8"))
        self.assertIn("144_playlist", info)
        self.assertIn("240_playlist", info)
        self.assertIn("240_iframe", info)

    def test_encodings_info_lists_each_resolution_with_its_url(self):
        info = self.media.encodings_info

        self.assertEqual(info[144]["h264"]["status"], "success")
        self.assertEqual(info[240]["h264"]["status"], "success")
        self.assertEqual(info[360], {})
        self.assertTrue(info[240]["h264"]["url"].endswith(".mp4"))

    def test_api_detail_exposes_the_processed_assets(self):
        detail = Client().get(self.media.get_absolute_url(api=True)).json()

        self.assertEqual(detail["encoding_status"], "success")
        self.assertTrue(detail["hls_info"]["master_file"])
        self.assertTrue(detail["sprites_url"])
        self.assertTrue(detail["preview_url"])

    def test_the_media_page_renders_for_the_video(self):
        response = Client().get(self.media.get_absolute_url())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["media_object"].pk, self.media.pk)

    def test_transcoded_renditions_report_full_progress(self):
        for encoding in self.media.encodings.exclude(profile__name="preview"):
            self.assertEqual(encoding.progress, 100, encoding.profile.name)
            self.assertIn(settings.FFMPEG_COMMAND, encoding.commands)

    def test_encoding_rows_are_not_left_as_chunks(self):
        self.assertFalse(Encoding.objects.filter(media=self.media, chunk=True).exists())
