from unittest import mock

from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from files.forms import EditSubtitleForm, SubtitleForm, WhisperSubtitlesForm
from files.models import (
    Language,
    Media,
    MediaPermission,
    Subtitle,
    TranscriptionRequest,
)
from files.tests import create_account, create_media
from files.tests.media_utils import SMALL_VIDEO

SRT = b"1\n00:00:01,000 --> 00:00:02,500\nHello there\n\n2\n00:00:03,000 --> 00:00:04,000\nGeneral Kenobi\n"
VTT = b"WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nAlready vtt\n"


class SubtitleTestData(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.owner = create_account()
        cls.other = create_account()
        cls.editor = create_account(is_editor=True)
        cls.video = create_media(cls.owner, filename=SMALL_VIDEO, title="captioned video")
        cls.language = Language.objects.create(code="el", title="Greek")

    def add_caption(self, user, content, name="captions.srt", language=None):
        self.client.force_login(user)
        upload = SimpleUploadedFile(name, content, content_type="application/octet-stream")
        data = {"form-language": (language or self.language).pk, "form-subtitle_file": upload, "submit": "Submit"}
        return self.client.post(f"/add_subtitle?m={self.video.friendly_token}", data)

    def make_subtitle(self, content=VTT):
        subtitle = Subtitle(media=self.video, language=self.language, user=self.owner)
        subtitle.subtitle_file.save("existing.vtt", ContentFile(content), save=True)
        return subtitle


class SubtitleFormTest(SubtitleTestData):
    def test_language_and_file_are_required(self):
        form = SubtitleForm(self.video, {}, {})
        self.assertFalse(form.is_valid())
        self.assertEqual(set(form.errors), {"language", "subtitle_file"})

    def test_language_must_exist(self):
        upload = SimpleUploadedFile("captions.srt", SRT)
        form = SubtitleForm(self.video, {"language": 999999}, {"subtitle_file": upload})
        self.assertFalse(form.is_valid())
        self.assertIn("language", form.errors)

    def test_saved_caption_belongs_to_the_media_owner(self):
        form = SubtitleForm(self.video, {"language": self.language.pk}, {"subtitle_file": SimpleUploadedFile("captions.srt", SRT)})
        self.assertTrue(form.is_valid(), form.errors)
        subtitle = form.save()
        self.assertEqual((subtitle.media, subtitle.user, subtitle.language), (self.video, self.owner, self.language))

    def test_edit_form_is_prefilled_with_the_file_contents(self):
        subtitle = self.make_subtitle()
        self.assertEqual(EditSubtitleForm(subtitle).fields["subtitle"].initial, VTT.decode())


class AddSubtitlePageTest(SubtitleTestData):
    def test_srt_upload_is_converted_to_webvtt_and_listed_by_the_api(self):
        response = self.add_caption(self.owner, SRT)
        self.assertRedirects(response, self.video.get_absolute_url(), fetch_redirect_response=False)
        subtitle = Subtitle.objects.get(media=self.video)
        with open(subtitle.subtitle_file.path, "rb") as fp:
            converted = fp.read().decode()
        self.assertTrue(converted.startswith("WEBVTT"))
        self.assertIn("00:00:01.000 --> 00:00:02.500", converted)
        self.assertIn("General Kenobi", converted)
        info = self.client.get(f"/api/v1/media/{self.video.friendly_token}").json()["subtitles_info"]
        self.assertEqual([(item["srclang"], item["label"]) for item in info], [("el", "Greek")])

    def test_editor_can_add_captions_to_any_media(self):
        self.add_caption(self.editor, VTT, name="captions.vtt")
        self.assertEqual(Subtitle.objects.get(media=self.video).user, self.owner)

    def test_user_shared_as_editor_can_add_captions(self):
        collaborator = create_account()
        MediaPermission.objects.create(owner_user=self.owner, user=collaborator, media=self.video, permission="editor")
        self.add_caption(collaborator, SRT)
        self.assertTrue(Subtitle.objects.filter(media=self.video).exists())

    def test_other_user_cannot_add_captions(self):
        self.assertRedirects(self.add_caption(self.other, SRT), "/", fetch_redirect_response=False)
        self.assertFalse(Subtitle.objects.exists())

    def test_unparseable_file_is_rejected_and_not_kept(self):
        response = self.add_caption(self.owner, b"\x00\x01 this is not a caption file")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["form"].errors["subtitle_file"], ["Invalid subtitle format. Use SubRip (.srt) or WebVTT (.vtt) files."])
        self.assertFalse(Subtitle.objects.exists())

    def test_page_lists_existing_captions(self):
        subtitle = self.make_subtitle()
        self.client.force_login(self.owner)
        response = self.client.get(f"/add_subtitle?m={self.video.friendly_token}")
        self.assertEqual(list(response.context["subtitles"]), [subtitle])
        self.assertIsNone(response.context["whisper_form"])


class EditSubtitlePageTest(SubtitleTestData):
    def setUp(self):
        self.subtitle = self.make_subtitle()

    def open(self, user, method="get", query="", data=None):
        self.client.force_login(user)
        url = f"/edit_subtitle?id={self.subtitle.id}{query}"
        return getattr(self.client, method)(url, data or {})

    def test_owner_sees_the_caption_text(self):
        response = self.open(self.owner)
        self.assertTemplateUsed(response, "cms/edit_subtitle.html")
        self.assertEqual(response.context["subtitle"], self.subtitle)
        self.assertContains(response, "Already vtt")

    def test_saving_rewrites_the_caption_file(self):
        new_text = "WEBVTT\n\n00:00:05.000 --> 00:00:06.000\nRewritten line\n"
        response = self.open(self.owner, "post", data={"subtitle": new_text})
        self.assertRedirects(response, self.video.get_absolute_url(), fetch_redirect_response=False)
        with open(self.subtitle.subtitle_file.path) as fp:
            self.assertEqual(fp.read(), new_text)

    def test_confirmed_delete_removes_the_caption(self):
        response = self.open(self.owner, "post", query="&confirm=true")
        self.assertRedirects(response, self.video.get_absolute_url(), fetch_redirect_response=False)
        self.assertFalse(Subtitle.objects.filter(pk=self.subtitle.pk).exists())

    def test_download_returns_the_file_as_vtt_attachment(self):
        response = self.open(self.owner, query="&action=download")
        self.assertEqual(response["Content-Type"], "text/vtt")
        self.assertTrue(response["Content-Disposition"].startswith("attachment; filename="))
        self.assertTrue(response["Content-Disposition"].endswith(".vtt"))
        self.assertEqual(response.content, VTT)

    def test_other_user_can_neither_read_nor_change_it(self):
        self.assertRedirects(self.open(self.other), "/", fetch_redirect_response=False)
        self.assertRedirects(self.open(self.other, "post", query="&confirm=true"), "/", fetch_redirect_response=False)
        self.assertTrue(Subtitle.objects.filter(pk=self.subtitle.pk).exists())

    def test_missing_or_unknown_id_redirects_home(self):
        self.client.force_login(self.owner)
        self.assertRedirects(self.client.get("/edit_subtitle"), "/", fetch_redirect_response=False)
        self.assertRedirects(self.client.get("/edit_subtitle?id=999999"), "/", fetch_redirect_response=False)

    def test_anonymous_user_is_sent_to_login(self):
        response = self.client.get(f"/edit_subtitle?id={self.subtitle.id}")
        self.assertTrue(response["Location"].startswith("/accounts/login/"))


@override_settings(USE_WHISPER_TRANSCRIBE=True)
class WhisperTranscriptionFormTest(SubtitleTestData):
    def test_editor_is_offered_transcription(self):
        self.client.force_login(self.editor)
        response = self.client.get(f"/add_subtitle?m={self.video.friendly_token}")
        self.assertIsInstance(response.context["whisper_form"], WhisperSubtitlesForm)

    @override_settings(USER_CAN_TRANSCRIBE_VIDEO=False)
    def test_regular_owner_is_not_offered_transcription(self):
        self.client.force_login(self.owner)
        self.assertIsNone(self.client.get(f"/add_subtitle?m={self.video.friendly_token}").context["whisper_form"])

    @override_settings(USER_CAN_TRANSCRIBE_VIDEO=True)
    def test_owner_is_offered_transcription_when_users_may_transcribe(self):
        self.client.force_login(self.owner)
        self.assertIsNotNone(self.client.get(f"/add_subtitle?m={self.video.friendly_token}").context["whisper_form"])

    @mock.patch("files.tasks.whisper_transcribe.apply_async")
    def test_requesting_transcription_queues_one_job(self, apply_async):
        self.client.force_login(self.editor)
        response = self.client.post(f"/add_subtitle?m={self.video.friendly_token}", {"whisper_form-allow_whisper_transcribe": "on", "submit_whisper": "Submit"})
        self.assertRedirects(response, self.video.get_absolute_url(), fetch_redirect_response=False)
        self.assertTrue(Media.objects.get(pk=self.video.pk).allow_whisper_transcribe)
        self.assertEqual(TranscriptionRequest.objects.filter(media=self.video, translate_to_english=False).count(), 1)
        apply_async.assert_called_once_with(args=[self.video.friendly_token, False], countdown=10)

    def test_enabled_options_cannot_be_switched_off(self):
        Media.objects.filter(pk=self.video.pk).update(allow_whisper_transcribe=True, allow_whisper_transcribe_and_translate=True)
        video = Media.objects.get(pk=self.video.pk)
        form = WhisperSubtitlesForm(self.editor, {}, instance=video)
        self.assertTrue(form.fields["allow_whisper_transcribe"].widget.attrs["disabled"])
        self.assertTrue(form.is_valid())
        self.assertTrue(form.cleaned_data["allow_whisper_transcribe"])
        self.assertTrue(form.cleaned_data["allow_whisper_transcribe_and_translate"])
