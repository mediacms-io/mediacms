from django.test import SimpleTestCase

from migrationservice.providers.base import BaseProvider


class Unbuilt(BaseProvider):
    name = "unbuilt"
    label = "Unbuilt"


class TestBaseProviderDefaults(SimpleTestCase):
    def setUp(self):
        self.provider = Unbuilt(None, None)

    def test_missing_connection_and_options_become_empty(self):
        self.assertEqual((self.provider.connection, self.provider.options), ({}, {}))

    def test_a_source_without_categories_accepts_everything(self):
        self.assertTrue(self.provider.within_selection("Any>Path"))
        self.assertTrue(self.provider.worth_importing({"id": "1"}))

    def test_a_source_without_streams_groups_or_members_has_none(self):
        self.assertEqual(self.provider.child_entries("1_a"), [])
        self.assertEqual(self.provider.fetch_group_members("g"), [])
        self.assertEqual(self.provider.group_ids(), set())
        self.assertEqual(self.provider.fetch_category_members("c"), [])

    def test_the_pickers_name_the_source_that_cannot_answer(self):
        for call in (self.provider.list_categories, self.provider.list_roles):
            with self.assertRaisesMessage(NotImplementedError, "Unbuilt migration is not implemented yet"):
                call()

    def test_every_import_call_must_be_answered_by_the_source(self):
        for call in (
            lambda: self.provider.fetch_user("u"),
            lambda: self.provider.fetch_category("c"),
            lambda: self.provider.fetch_group("g"),
            lambda: self.provider.download("https://example.edu/f", "/tmp/never"),
        ):
            with self.assertRaises(NotImplementedError):
                call()

    def test_the_identity_is_namespaced_by_the_source_name(self):
        self.assertEqual(Unbuilt.source_system({"service_url": "x"}), "unbuilt:")
