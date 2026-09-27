from django.test import SimpleTestCase

from files.frontend_translations import en, es


class TestSpanishFrontendTranslations(SimpleTestCase):
    """The Spanish frontend strings cover every English key and none is left empty"""

    def assert_complete(self, reference, table):
        missing = sorted(set(reference) - set(table))
        self.assertEqual(missing, [], "keys missing from the Spanish table")
        empty = sorted(key for key, value in table.items() if not value.strip())
        self.assertEqual(empty, [], "empty Spanish translations")

    def test_translation_strings_complete(self):
        self.assert_complete(en.translation_strings, es.translation_strings)

    def test_replacement_strings_complete(self):
        self.assert_complete(en.replacement_strings, es.replacement_strings)
