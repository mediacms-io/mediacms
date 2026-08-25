from django.test import TestCase

from migrationservice.models import (
    MigrationRecord,
    MigrationService,
    decrypt_value,
    encrypt_value,
)


class TestEncryption(TestCase):
    def test_round_trip(self):
        encrypted = encrypt_value("super-secret")
        self.assertNotEqual(encrypted, "super-secret")
        self.assertTrue(encrypted.startswith("enc::"))
        self.assertEqual(decrypt_value(encrypted), "super-secret")

    def test_encrypting_twice_is_a_no_op(self):
        once = encrypt_value("super-secret")
        twice = encrypt_value(once)
        self.assertEqual(once, twice)

    def test_decrypting_plaintext_returns_it_unchanged(self):
        self.assertEqual(decrypt_value("not-encrypted"), "not-encrypted")

    def test_empty_value_is_left_alone(self):
        self.assertEqual(encrypt_value(""), "")
        self.assertEqual(decrypt_value(""), "")


class TestMigrationService(TestCase):
    def _service(self, **kwargs):
        defaults = {
            "name": "Kaltura production",
            "provider": "kaltura",
            "connection": {
                "service_url": "https://Kaltura.Example.edu/",
                "partner_id": "342",
                "app_token_id": "atok",
                "app_token": "the-secret",
            },
        }
        defaults.update(kwargs)
        return MigrationService.objects.create(**defaults)

    def test_defaults(self):
        service = self._service()
        self.assertEqual(service.status, "pending")
        self.assertEqual(service.cursor, {})
        self.assertEqual(service.totals, {})

    def test_secret_is_encrypted_at_rest(self):
        service = self._service()
        service.refresh_from_db()
        self.assertNotEqual(service.connection["app_token"], "the-secret")
        self.assertEqual(service.connection["service_url"], "https://Kaltura.Example.edu/")

    def test_get_connection_decrypts(self):
        service = self._service()
        service.refresh_from_db()
        self.assertEqual(service.get_connection()["app_token"], "the-secret")

    def test_source_system_is_derived_and_normalised(self):
        service = self._service()
        self.assertEqual(service.source_system, "kaltura:342@kaltura.example.edu")

    def test_two_services_on_the_same_kaltura_share_a_source_system(self):
        first = self._service()
        second = self._service(name="Kaltura second pass")
        self.assertEqual(first.source_system, second.source_system)

    def test_append_log_keeps_lines(self):
        service = self._service()
        service.append_log("started")
        service.append_log("finished")
        service.refresh_from_db()
        self.assertIn("started", service.log)
        self.assertIn("finished", service.log)


class TestMigrationRecord(TestCase):
    def setUp(self):
        self.service = MigrationService.objects.create(
            name="Kaltura production",
            provider="kaltura",
            connection={"service_url": "https://kaltura.example.edu", "partner_id": "342", "app_token_id": "atok", "app_token": "x"},
        )

    def test_already_migrated_ignores_records_whose_target_is_gone(self):
        MigrationRecord.objects.create(service=self.service, object_type="media", source_id="1_abc", status="success", target_id=5)
        found = MigrationRecord.already_migrated(self.service.source_system, "media", "1_abc")
        self.assertIsNone(found)

    def test_already_migrated_ignores_failed_records(self):
        MigrationRecord.objects.create(service=self.service, object_type="media", source_id="1_abc", status="failed", log="boom")
        found = MigrationRecord.already_migrated(self.service.source_system, "media", "1_abc")
        self.assertIsNone(found)

    def test_source_id_is_unique_per_service_and_type(self):
        MigrationRecord.objects.create(service=self.service, object_type="media", source_id="1_abc", status="success")
        with self.assertRaises(Exception):
            MigrationRecord.objects.create(service=self.service, object_type="media", source_id="1_abc", status="success")

    def test_already_migrated_returns_a_record_whose_target_still_exists(self):
        from files.tests import create_account

        user = create_account(username="migrated-jdoe")
        MigrationRecord.objects.create(
            service=self.service,
            object_type="user",
            source_id="jdoe",
            status="success",
            target_id=user.id,
        )
        found = MigrationRecord.already_migrated(self.service.source_system, "user", "jdoe")
        self.assertIsNotNone(found)
        self.assertEqual(found.source_id, "jdoe")
        self.assertEqual(found.target_id, user.id)

    def test_already_migrated_ignores_a_different_source_system(self):
        from files.tests import create_account

        user = create_account(username="other-jdoe")
        MigrationRecord.objects.create(
            service=self.service,
            object_type="user",
            source_id="jdoe",
            status="success",
            target_id=user.id,
        )
        found = MigrationRecord.already_migrated("kaltura:999@other.example.edu", "user", "jdoe")
        self.assertIsNone(found)

    def test_a_deleted_caption_target_is_detected(self):
        # captions had no FK, so target_exists() used to return True for them
        # unconditionally even after the subtitle was gone
        record = MigrationRecord.objects.create(service=self.service, object_type="caption", source_id="cap1", status="success", target_id=999999)
        self.assertFalse(record.target_exists())
