from django.core.management import load_command_class
from django.core.management.base import CommandError
from django.test import SimpleTestCase

from files.management.commands.fake_media_locales import (
    CJK_LANGUAGE_CODES,
    FAKE_MEDIA_LOCALES,
    RTL_LANGUAGE_CODES,
    SECONDARY_LANGUAGE_CODES,
)


class PopulateFakeMediaLocalesTest(SimpleTestCase):
    def setUp(self):
        self.command = load_command_class("files", "populate_fake_media")
        self.command.stdout = type("Stdout", (), {"write": lambda *args, **kwargs: None})()

    def test_init_content_locales_includes_english_secondary_rtl_and_cjk(self):
        self.command._init_content_locales(rtl_language="ar", secondary_language="de", cjk_language="ja")
        codes = [loc["code"] for loc in self.command.content_locales]
        self.assertEqual(codes, ["en", "de", "ar", "ja"])
        self.assertEqual(self.command.secondary_language_code, "de")
        self.assertEqual(self.command.rtl_language_code, "ar")
        self.assertEqual(self.command.cjk_language_code, "ja")
        self.assertIsNone(self.command.single_language_code)
        self.assertEqual(self.command.content_locale_weights, [40, 20, 20, 20])
        self.assertTrue(self.command.content_locales[2]["rtl"])
        self.assertFalse(self.command.content_locales[3]["rtl"])

    def test_init_content_locales_random_picks_secondary_rtl_and_cjk(self):
        self.command._init_content_locales(rtl_language="random", secondary_language="random", cjk_language="random")
        codes = [loc["code"] for loc in self.command.content_locales]
        self.assertEqual(codes[0], "en")
        self.assertIn(codes[1], SECONDARY_LANGUAGE_CODES)
        self.assertIn(codes[2], RTL_LANGUAGE_CODES)
        self.assertIn(codes[3], CJK_LANGUAGE_CODES)
        self.assertEqual(len(codes), 4)

    def test_cjk_locales_are_marked_ltr(self):
        for code in CJK_LANGUAGE_CODES:
            self.assertFalse(FAKE_MEDIA_LOCALES[code]["rtl"], msg=f"{code} should be LTR")

    def test_init_content_locales_rejects_unknown_rtl(self):
        with self.assertRaises(CommandError):
            self.command._init_content_locales(rtl_language="fr")

    def test_init_content_locales_rejects_unknown_secondary(self):
        with self.assertRaises(CommandError):
            self.command._init_content_locales(secondary_language="fr")

    def test_init_content_locales_rejects_unknown_cjk(self):
        with self.assertRaises(CommandError):
            self.command._init_content_locales(cjk_language="vi")

    def test_single_language_mode_uses_only_requested_locale(self):
        self.command._init_content_locales(single_language="ja")
        codes = [loc["code"] for loc in self.command.content_locales]
        self.assertEqual(codes, ["ja"])
        self.assertEqual(self.command.content_locale_weights, [100])
        self.assertEqual(self.command.single_language_code, "ja")
        self.assertEqual(self.command.cjk_language_code, "ja")
        self.assertEqual(self.command._locale()["code"], "ja")

    def test_single_language_mode_rejects_unknown_code(self):
        with self.assertRaises(CommandError):
            self.command._init_content_locales(single_language="fr")

    def test_generate_title_uses_english_secondary_rtl_or_cjk_script(self):
        self.command._init_content_locales(rtl_language="he", secondary_language="el", cjk_language="zh")

        def has_greek(text):
            return any("\u0370" <= ch <= "\u03ff" for ch in text)

        def has_hebrew(text):
            return any("\u0590" <= ch <= "\u05ff" for ch in text)

        def has_cjk(text):
            return any("\u4e00" <= ch <= "\u9fff" for ch in text)

        def looks_latin(text):
            return any("a" <= ch.lower() <= "z" for ch in text) and not has_greek(text) and not has_hebrew(text) and not has_cjk(text)

        saw_latin = False
        saw_greek = False
        saw_hebrew = False
        saw_cjk = False
        for _ in range(120):
            title = self.command.generate_title()
            if looks_latin(title):
                saw_latin = True
            if has_greek(title):
                saw_greek = True
            if has_hebrew(title):
                saw_hebrew = True
            if has_cjk(title):
                saw_cjk = True
        self.assertTrue(saw_latin)
        self.assertTrue(saw_greek)
        self.assertTrue(saw_hebrew)
        self.assertTrue(saw_cjk)

    def test_locale_selection_is_about_forty_percent_english(self):
        self.command._init_content_locales(rtl_language="ar", secondary_language="es", cjk_language="ko")
        samples = [self.command._locale()["code"] for _ in range(500)]
        english_share = samples.count("en") / len(samples)
        self.assertGreater(english_share, 0.30)
        self.assertLess(english_share, 0.50)

    def test_generate_name_and_comment_stay_within_selected_locales(self):
        self.command._init_content_locales(rtl_language="ur", secondary_language="es", cjk_language="zh")
        allowed_first = (
            set(FAKE_MEDIA_LOCALES["en"]["first_names"]) | set(FAKE_MEDIA_LOCALES["es"]["first_names"]) | set(FAKE_MEDIA_LOCALES["ur"]["first_names"]) | set(FAKE_MEDIA_LOCALES["zh"]["first_names"])
        )
        for _ in range(20):
            name = self.command.generate_name()
            first = name.split()[0]
            self.assertIn(first, allowed_first)
            comment = self.command.generate_comment_text()
            self.assertTrue(comment)

    def test_scaled_related_count_is_fifteen_to_twenty_percent(self):
        for media_count in (100, 150, 1000):
            for _ in range(20):
                related = self.command._scaled_related_count(media_count)
                self.assertGreaterEqual(related, int(round(media_count * 0.15)))
                self.assertLessEqual(related, int(round(media_count * 0.20)))

    def test_scaled_related_count_has_minimum_for_small_media_counts(self):
        self.assertGreaterEqual(self.command._scaled_related_count(5), 3)
        self.assertGreaterEqual(self.command._scaled_related_count(0), 3)

    def test_pick_localized_tag_title_uses_common_words_from_active_locales(self):
        self.command._init_content_locales(rtl_language="ar", secondary_language="de", cjk_language="zh")
        allowed = set()
        for locale in self.command.content_locales:
            for word in locale["tag_words"]:
                allowed.add(self.command._normalize_tag_title(word))

        picked = set()
        existing = set()
        for _ in range(30):
            title = self.command._pick_localized_tag_title(existing)
            self.assertIsNotNone(title)
            self.assertIn(title, allowed)
            self.assertNotIn(title, existing)
            existing.add(title)
            picked.add(title)
        self.assertEqual(len(picked), 30)

    def test_pick_localized_tag_title_returns_none_when_exhausted(self):
        self.command._init_content_locales(single_language="en")
        existing = {self.command._normalize_tag_title(word) for word in FAKE_MEDIA_LOCALES["en"]["tag_words"]}
        self.assertIsNone(self.command._pick_localized_tag_title(existing))
