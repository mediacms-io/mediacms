from django.test import TestCase

from migrationservice.models import MigrationService
from migrationservice.providers import get_provider, get_provider_class
from migrationservice.providers.base import BaseProvider


class TestProviderRegistry(TestCase):
    def test_known_providers_resolve(self):
        for name in ["kaltura", "panopto", "youtube"]:
            self.assertTrue(issubclass(get_provider_class(name), BaseProvider))

    def test_unknown_provider_raises(self):
        with self.assertRaises(ValueError):
            get_provider_class("vimeo")

    def test_stub_providers_are_marked_unimplemented(self):
        for name in ["panopto", "youtube"]:
            self.assertFalse(get_provider_class(name).implemented)

    def test_stub_check_connection_raises_not_implemented(self):
        provider = get_provider_class("panopto")({}, {})
        with self.assertRaises(NotImplementedError):
            provider.check_connection()

    def test_stub_source_system_is_namespaced(self):
        self.assertEqual(get_provider_class("panopto").source_system({}), "panopto:")


class TestUserRestrictionReachesTheProvider(TestCase):
    """The option is stored on the service and read by the provider it builds."""

    def make_service(self, **options):
        return MigrationService.objects.create(
            name="Test run",
            provider="kaltura",
            connection={"service_url": "https://kaltura.example.edu", "partner_id": "342", "app_token_id": "atok", "app_token": "x"},
            options=options,
        )

    def test_a_saved_restriction_is_read_back(self):
        provider = get_provider(self.make_service(restrict_to_users=True, source_user_ids="jdoe,asmith"))
        self.assertEqual(provider.restricted_user_ids(), ["jdoe", "asmith"])

    def test_no_restriction_by_default(self):
        provider = get_provider(self.make_service())
        self.assertEqual(provider.restricted_user_ids(), [])

    def test_a_stored_list_is_inert_while_the_option_is_off(self):
        provider = get_provider(self.make_service(restrict_to_users=False, source_user_ids="jdoe"))
        self.assertEqual(provider.restricted_user_ids(), [])
