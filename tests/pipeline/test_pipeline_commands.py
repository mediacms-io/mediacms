import os
import shutil
import sys
import tempfile
import types
from io import StringIO
from unittest import mock

from django.core.files.base import ContentFile
from django.core.management import call_command
from django.test import TestCase, override_settings

from files.frontend_translations.en import replacement_strings, translation_strings
from files.management.commands import upgrade_previews
from files.models import EncodeProfile, Encoding
from files.tests import create_account, create_media
from files.tests.media_utils import SMALL_VIDEO


def run(*args):
    out, err = StringIO(), StringIO()
    call_command(*args, stdout=out, stderr=err)
    return out.getvalue(), err.getvalue()


class UpgradePreviewsTest(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.user = create_account()
        cls.gif_profile = EncodeProfile.objects.get(name="preview", extension="gif")
        cls.mp4_profile = EncodeProfile.objects.get(name="preview", extension="mp4")

    def setUp(self):
        self.video = create_media(self.user, SMALL_VIDEO)
        self.gif = self.add_preview(self.video, self.gif_profile, "old.gif")

    def add_preview(self, media, profile, name):
        encoding = Encoding(media=media, profile=profile, status="success", progress=100)
        encoding.media_file.save(name, ContentFile(b"GIF89a pipeline"), save=False)
        encoding.save()
        return encoding

    def test_without_an_mp4_preview_profile_nothing_is_done(self):
        self.mp4_profile.delete()

        out, err = run("upgrade_previews")

        self.assertIn("No mp4 preview profile", err)
        self.assertTrue(Encoding.objects.filter(pk=self.gif.pk).exists())

    def test_a_library_without_gifs_has_nothing_to_upgrade(self):
        self.gif.delete()

        out, _ = run("upgrade_previews")

        self.assertIn("0 media still have a gif preview", out)

    def test_dry_run_lists_the_media_and_changes_nothing(self):
        out, _ = run("upgrade_previews", "--dry-run")

        self.assertIn("1 media still have a gif preview", out)
        self.assertIn(f"would re-encode {self.video.friendly_token}", out)
        self.assertTrue(Encoding.objects.filter(pk=self.gif.pk).exists())
        self.assertFalse(self.video.encodings.filter(profile=self.mp4_profile).exists())

    def test_upgrade_encodes_an_mp4_preview_and_drops_the_gif(self):
        gif_path = self.gif.media_file.path

        out, _ = run("upgrade_previews")

        self.assertIn("1 upgraded, 0 left as gif", out)
        self.assertFalse(Encoding.objects.filter(pk=self.gif.pk).exists())
        self.assertFalse(os.path.exists(gif_path))
        mp4 = self.video.encodings.get(profile=self.mp4_profile)
        self.assertEqual(mp4.status, "success")
        self.video.refresh_from_db()
        self.assertEqual(self.video.preview_file_path, mp4.media_file.path)

    def test_a_failed_encode_keeps_the_gif(self):
        with mock.patch.object(upgrade_previews.encode_media, "apply") as apply:
            out, err = run("upgrade_previews")

        apply.assert_called_once()
        self.assertIn(f"failed {self.video.friendly_token}", err)
        self.assertIn("0 upgraded, 1 left as gif", out)
        self.assertTrue(Encoding.objects.filter(pk=self.gif.pk).exists())

    def test_an_existing_mp4_preview_is_reused_without_encoding(self):
        mp4 = self.add_preview(self.video, self.mp4_profile, "new.mp4")

        with mock.patch.object(upgrade_previews.encode_media, "apply") as apply:
            out, _ = run("upgrade_previews")

        apply.assert_not_called()
        self.assertIn("1 upgraded", out)
        self.assertFalse(Encoding.objects.filter(pk=self.gif.pk).exists())
        self.video.refresh_from_db()
        self.assertEqual(self.video.preview_file_path, mp4.media_file.path)

    def test_async_queues_the_encode_and_keeps_the_gif_for_a_later_run(self):
        with mock.patch.object(upgrade_previews.encode_media, "delay") as delay:
            out, _ = run("upgrade_previews", "--async")

        row = self.video.encodings.get(profile=self.mp4_profile)
        self.assertEqual(row.status, "pending")
        delay.assert_called_once_with(self.video.friendly_token, self.mp4_profile.id, row.id, force=True)
        self.assertIn("queued 1", out)
        self.assertTrue(Encoding.objects.filter(pk=self.gif.pk).exists())

    def test_token_and_limit_narrow_the_run(self):
        other = create_media(self.user, SMALL_VIDEO)
        self.add_preview(other, self.gif_profile, "other.gif")

        with mock.patch.object(upgrade_previews.encode_media, "delay") as delay:
            run("upgrade_previews", "--async", "--token", other.friendly_token)
        self.assertEqual(delay.call_args.args[0], other.friendly_token)

        with mock.patch.object(upgrade_previews.encode_media, "delay") as delay:
            out, _ = run("upgrade_previews", "--async", "--limit", "1")
        self.assertEqual(delay.call_count, 1)
        self.assertIn("2 media still have a gif preview", out)


class ProcessTranslationsTest(TestCase):
    module_name = "files.frontend_translations.zz_pipeline"

    def setUp(self):
        self.base_dir = tempfile.mkdtemp(prefix="pipeline-translations-")
        self.addCleanup(shutil.rmtree, self.base_dir, ignore_errors=True)
        translations_dir = os.path.join(self.base_dir, "files", "frontend_translations")
        os.makedirs(translations_dir)
        for name in ("__init__.py", "en.py", "zz_pipeline.py", "README.txt"):
            open(os.path.join(translations_dir, name), "w").close()
        self.output = os.path.join(translations_dir, "zz_pipeline.py")

        self.english_key = next(iter(translation_strings))
        self.module = types.ModuleType(self.module_name)
        self.module.translation_strings = {"zz pipeline only": "translated", self.english_key: "already translated"}
        self.module.replacement_strings = {}

    def test_missing_keys_are_added_with_the_english_text_and_sorted(self):
        with override_settings(BASE_DIR=self.base_dir), mock.patch.dict(sys.modules, {self.module_name: self.module}):
            out, _ = run("process_translations")

        self.assertIn("Processed zz_pipeline.py", out)
        self.assertIn("Successfully processed translation files", out)
        namespace = {}
        with open(self.output) as handle:
            source = handle.read()
        exec(source, namespace)

        result = namespace["translation_strings"]
        self.assertEqual(set(result), set(translation_strings) | {"zz pipeline only"})
        self.assertEqual(result[self.english_key], "already translated")
        self.assertEqual(list(result), sorted(result))
        self.assertEqual(set(namespace["replacement_strings"]), set(replacement_strings))
