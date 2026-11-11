from django.core.management import load_command_class
from django.core.management.base import CommandError
from django.test import SimpleTestCase

from files.management.commands.fake_media_locales import FAKE_MEDIA_LOCALES, RTL_LANGUAGE_CODES


class PopulateFakeMediaLocalesTest(SimpleTestCase):
    def setUp(self):
        self.command = load_command_class("files", "populate_fake_media")
        self.command.stdout = type("Stdout", (), {"write": lambda *args, **kwargs: None})()

    def test_init_content_locales_pairs_greek_with_requested_rtl(self):
        self.command._init_content_locales("ar")
        codes = [loc["code"] for loc in self.command.content_locales]
        self.assertEqual(codes, ["el", "ar"])
        self.assertEqual(self.command.rtl_language_code, "ar")
        self.assertTrue(self.command.content_locales[1]["rtl"])

    def test_init_content_locales_random_picks_one_supported_rtl(self):
        self.command._init_content_locales("random")
        codes = [loc["code"] for loc in self.command.content_locales]
        self.assertEqual(codes[0], "el")
        self.assertIn(codes[1], RTL_LANGUAGE_CODES)
        self.assertEqual(len(codes), 2)

    def test_init_content_locales_rejects_unknown_rtl(self):
        with self.assertRaises(CommandError):
            self.command._init_content_locales("fr")

    def test_generate_title_uses_greek_or_selected_rtl_script(self):
        self.command._init_content_locales("he")

        def has_greek(text):
            return any("\u0370" <= ch <= "\u03ff" for ch in text)

        def has_hebrew(text):
            return any("\u0590" <= ch <= "\u05ff" for ch in text)

        saw_greek = False
        saw_hebrew = False
        for _ in range(40):
            title = self.command.generate_title()
            if has_greek(title):
                saw_greek = True
            if has_hebrew(title):
                saw_hebrew = True
        self.assertTrue(saw_greek)
        self.assertTrue(saw_hebrew)

    def test_generate_name_and_comment_stay_within_selected_locales(self):
        self.command._init_content_locales("ur")
        allowed_first = set(FAKE_MEDIA_LOCALES["el"]["first_names"]) | set(FAKE_MEDIA_LOCALES["ur"]["first_names"])
        for _ in range(20):
            name = self.command.generate_name()
            first = name.split()[0]
            self.assertIn(first, allowed_first)
            comment = self.command.generate_comment_text()
            self.assertTrue(comment)
