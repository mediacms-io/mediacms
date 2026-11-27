from unittest import mock

from django.core.files.base import ContentFile
from django.test import TestCase

from files import helpers, tasks
from files.models import Language, Media, Subtitle, TranscriptionRequest
from files.models.utils import subtitles_file_path
from files.tests import create_account, create_media

VTT = b"WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nHello there.\n\n00:00:02.000 --> 00:00:04.000\nwell-known  line\n"
SRT = b"1\n00:00:00,000 --> 00:00:02,000\nFirst line\n\n2\n00:00:02,000 --> 00:00:04,000\nSecond line\n"


def make_user(username, **kwargs):
    return create_account(username=username, email=f"{username}@example.com", **kwargs)


class SubtitleTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("subtitle_user")
        cls.media = create_media(cls.user, title="subtitled")
        cls.english = Language.objects.create(code="en", title="English")
        cls.greek = Language.objects.create(code="el", title="Greek")

    def add_subtitle(self, content, name="captions.vtt", language=None):
        subtitle = Subtitle(language=language or self.english, media=self.media, user=self.user)
        subtitle.subtitle_file.save(name, ContentFile(content), save=False)
        subtitle.save()
        return subtitle

    def test_str_url_and_language_str(self):
        subtitle = self.add_subtitle(VTT)
        self.assertEqual(str(subtitle), "subtitled-English")
        self.assertEqual(subtitle.url, f"/edit_subtitle?id={subtitle.id}")
        self.assertEqual(str(self.english), "en-English")

    def test_files_are_stored_under_the_media_owner(self):
        subtitle = Subtitle(media=self.media)
        self.assertEqual(subtitles_file_path(subtitle, "c.vtt"), "original//subtitles/user/subtitle_user/c.vtt")

    def test_subtitle_text_joins_lines_without_punctuation(self):
        self.assertEqual(self.add_subtitle(VTT).subtitle_text, "Hello there well known line")

    def test_srt_text_is_read_too(self):
        self.assertEqual(self.add_subtitle(SRT, name="captions.srt").subtitle_text, "First line Second line")

    def test_saving_a_subtitle_schedules_a_search_update(self):
        with mock.patch.object(tasks.update_search_vector, "apply_async") as update:
            self.add_subtitle(VTT)
        update.assert_called_once_with(args=[self.media.friendly_token], countdown=10)

    def test_convert_to_srt_rewrites_the_file_as_webvtt(self):
        subtitle = self.add_subtitle(SRT, name="captions.srt")
        self.assertTrue(subtitle.convert_to_srt())
        with open(subtitle.subtitle_file.path) as fp:
            content = fp.read()
        self.assertTrue(content.startswith("WEBVTT"))
        self.assertIn("00:00:02.000 --> 00:00:04.000", content)

    def test_convert_to_srt_fails_loudly_when_nothing_is_produced(self):
        subtitle = self.add_subtitle(SRT, name="captions.srt")
        with mock.patch.object(helpers, "run_command", return_value={}):
            with self.assertRaises(Exception):
                subtitle.convert_to_srt()

    def test_media_subtitles_info_is_sorted_by_language(self):
        greek = self.add_subtitle(VTT, language=self.greek)
        english = self.add_subtitle(VTT)

        info = self.media.subtitles_info

        self.assertEqual([item["srclang"] for item in info], ["en", "el"])
        self.assertEqual(info[0], {"src": helpers.url_from_path(english.subtitle_file.path), "srclang": "en", "label": "English"})
        self.assertEqual(info[1]["src"], helpers.url_from_path(greek.subtitle_file.path))

    def test_transcription_request_str(self):
        request = TranscriptionRequest.objects.create(media=self.media)
        self.assertEqual(str(request), "Transcription request for subtitled - pending")


class WhisperSubtitleDeleteTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("whisper_user")
        cls.media = create_media(cls.user, title="transcribed")
        cls.transcription = Language.objects.create(code="whisper", title="Transcription")
        cls.translation = Language.objects.create(code="whisper-translation", title="English Translation")
        cls.english = Language.objects.create(code="en", title="English")

    def setUp(self):
        Media.objects.filter(pk=self.media.pk).update(allow_whisper_transcribe=True, allow_whisper_transcribe_and_translate=True)
        TranscriptionRequest.objects.create(media=self.media, translate_to_english=False, status="success")
        TranscriptionRequest.objects.create(media=self.media, translate_to_english=True, status="success")

    def delete_subtitle(self, language):
        subtitle = Subtitle(language=language, media=self.media, user=self.user)
        subtitle.subtitle_file.save("captions.vtt", ContentFile(VTT), save=False)
        subtitle.save()
        subtitle.delete()
        return Media.objects.get(pk=self.media.pk)

    def remaining_requests(self):
        return list(TranscriptionRequest.objects.filter(media=self.media).values_list("translate_to_english", flat=True))

    def test_deleting_the_transcription_lets_it_be_requested_again(self):
        media = self.delete_subtitle(self.transcription)
        self.assertEqual(self.remaining_requests(), [True])
        self.assertFalse(media.allow_whisper_transcribe)
        self.assertTrue(media.allow_whisper_transcribe_and_translate)

    def test_deleting_the_translation_lets_it_be_requested_again(self):
        media = self.delete_subtitle(self.translation)
        self.assertEqual(self.remaining_requests(), [False])
        self.assertTrue(media.allow_whisper_transcribe)
        self.assertFalse(media.allow_whisper_transcribe_and_translate)

    def test_deleting_an_uploaded_subtitle_keeps_the_requests(self):
        media = self.delete_subtitle(self.english)
        self.assertEqual(sorted(self.remaining_requests()), [False, True])
        self.assertTrue(media.allow_whisper_transcribe)
        self.assertTrue(media.allow_whisper_transcribe_and_translate)
