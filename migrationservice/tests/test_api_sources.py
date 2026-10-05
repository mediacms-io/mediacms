import json
from types import SimpleNamespace
from unittest import mock

from django.test import Client, TestCase, override_settings
from rest_framework import serializers

from files.models import Category
from files.tests import create_account
from lti.models import LTIPlatform
from migrationservice.models import MigrationRecord, MigrationService
from migrationservice.providers.panopto import PanoptoProvider
from migrationservice.providers.youtube import YouTubeProvider
from migrationservice.serializers import (
    MigrationRecordSerializer,
    MigrationServiceSerializer,
    clean_role_map,
)

API = "/api/v1/migrations/"

PANOPTO = {"service_url": "https://yourorg.cloud.panopto.eu", "client_id": "c", "client_secret": "s", "username": "svc", "password": "pw"}

KALTURA = {"service_url": "https://kaltura.example.edu", "partner_id": "342", "app_token_id": "atok", "app_token": "the-secret"}

FOLDERS = [{"id": "r1", "name": "Courses", "path": "Courses", "entries": 3, "folders": 1, "kind": "panopto"}]


class AdminApiTestCase(TestCase):
    def setUp(self):
        self.password = "this_is_a_fake_password"
        self.admin = create_account(password=self.password, is_superuser=True)
        self.client = Client()
        self.client.login(username=self.admin.username, password=self.password)

    def post(self, path, payload=None):
        return self.client.post(f"{API}{path}", data=json.dumps(payload or {}), content_type="application/json")

    def panopto_service(self, **options):
        return MigrationService.objects.create(name="Panopto", provider="panopto", connection=dict(PANOPTO), options=options)


class TestUnsavedChecks(AdminApiTestCase):
    def test_an_unknown_source_is_answered_not_raised(self):
        for path, empty in (("check_connection/", "stats"), ("source_categories/", "categories"), ("source_roles/", "roles")):
            response = self.post(path, {"provider": "vimeo", "connection": {}})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {"ok": False, "error": "Unknown migration provider: vimeo", empty: {} if empty == "stats" else []})

    def test_a_check_that_crashes_names_the_exception(self):
        with mock.patch.object(YouTubeProvider, "check_connection", side_effect=KeyError("formats")):
            response = self.post("check_connection/", {"provider": "youtube", "connection": {"sources": "abcdefghijk"}})
        self.assertEqual(response.json(), {"ok": False, "error": "KeyError: 'formats'", "stats": {}})

    def test_a_check_a_source_cannot_answer_says_so(self):
        with mock.patch.object(YouTubeProvider, "check_connection", side_effect=NotImplementedError("not yet")):
            response = self.post("check_connection/", {"provider": "youtube", "connection": {"sources": "abcdefghijk"}})
        self.assertEqual(response.json(), {"ok": False, "error": "not yet", "stats": {}})

    def test_the_folder_picker_of_an_unsaved_migration(self):
        with mock.patch.object(PanoptoProvider, "list_categories", return_value=FOLDERS):
            response = self.post("source_categories/", {"provider": "panopto", "connection": PANOPTO})
        self.assertEqual(response.json(), {"ok": True, "error": "", "categories": FOLDERS})

    def test_a_picker_whose_source_fails(self):
        with mock.patch.object(PanoptoProvider, "list_categories", side_effect=RuntimeError("boom")):
            response = self.post("source_categories/", {"provider": "panopto", "connection": PANOPTO})
        self.assertEqual(response.json(), {"ok": False, "error": "RuntimeError: boom", "categories": []})

    def test_a_source_with_no_categories_says_so(self):
        response = self.post("source_categories/", {"provider": "youtube", "connection": {"sources": "abcdefghijk"}})
        self.assertFalse(response.json()["ok"])
        self.assertIn("not implemented", response.json()["error"])

    def test_a_source_with_no_roles_says_so(self):
        response = self.post("source_roles/", {"provider": "panopto", "connection": PANOPTO})
        self.assertEqual(response.json(), {"ok": False, "error": "Panopto migration is not implemented yet", "roles": []})

    def test_roles_from_an_unsaved_kaltura(self):
        roles = [{"id": "1", "name": "adminRole"}]
        with mock.patch("migrationservice.providers.kaltura.KalturaProvider.list_roles", return_value=roles):
            response = self.post("source_roles/", {"provider": "kaltura", "connection": KALTURA})
        self.assertEqual(response.json(), {"ok": True, "error": "", "roles": roles})

    def test_roles_whose_source_fails(self):
        with mock.patch("migrationservice.providers.kaltura.KalturaProvider.list_roles", side_effect=ValueError("bad ks")):
            response = self.post("source_roles/", {"provider": "kaltura", "connection": KALTURA})
        self.assertEqual(response.json(), {"ok": False, "error": "ValueError: bad ks", "roles": []})


class TestSavedPickers(AdminApiTestCase):
    def test_the_picker_of_a_saved_migration_uses_its_stored_credentials(self):
        service = self.panopto_service(source_category_ids="r1")
        seen = {}

        def listed(provider):
            seen["connection"] = provider.connection
            return FOLDERS

        with mock.patch.object(PanoptoProvider, "list_categories", autospec=True, side_effect=listed):
            response = self.post(f"{service.pk}/source_categories/")
        self.assertEqual(response.json()["categories"], FOLDERS)
        self.assertEqual(seen["connection"]["password"], "pw")

    def test_the_roles_of_a_saved_migration(self):
        service = self.panopto_service()
        self.assertFalse(self.post(f"{service.pk}/source_roles/").json()["ok"])


class TestLtiPlatforms(AdminApiTestCase):
    def make_platform(self, name):
        return LTIPlatform.objects.create(
            name=name,
            platform_id="https://lms.example.edu",
            client_id=f"client-{name}",
            auth_login_url="https://lms.example.edu/auth",
            auth_token_url="https://lms.example.edu/token",
            key_set_url="https://lms.example.edu/jwks",
        )

    @override_settings(USE_LTI=False)
    def test_without_lti_there_is_nothing_to_offer(self):
        self.make_platform("Moodle")
        self.assertEqual(self.client.get(f"{API}lti_platforms/").json(), [])

    @override_settings(USE_LTI=True)
    def test_the_platforms_by_name(self):
        moodle = self.make_platform("Moodle")
        canvas = self.make_platform("Canvas")
        self.assertEqual(self.client.get(f"{API}lti_platforms/").json(), [{"id": str(canvas.pk), "name": "Canvas"}, {"id": str(moodle.pk), "name": "Moodle"}])

    @override_settings(USE_LTI=True)
    def test_a_platform_that_exists_is_stored_on_the_options(self):
        platform = self.make_platform("Moodle")
        serializer = MigrationServiceSerializer(data={"name": "x", "provider": "kaltura", "connection": KALTURA, "options": {"source_category_ids": "1", "lti_platform_id": f" {platform.pk} "}})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["options"]["lti_platform_id"], str(platform.pk))


class TestTransitions(AdminApiTestCase):
    def test_resuming_a_paused_migration_runs_it(self):
        service = self.panopto_service(source_category_ids="r1")
        MigrationService.objects.filter(pk=service.pk).update(status="paused")
        with mock.patch("migrationservice.views.start_migration") as started:
            response = self.post(f"{service.pk}/resume/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(started.call_args.args[0].pk, service.pk)

    def test_a_rerun_of_a_running_migration_is_a_conflict(self):
        service = self.panopto_service(source_category_ids="r1")
        MigrationService.objects.filter(pk=service.pk).update(status="running")
        response = self.post(f"{service.pk}/rerun/")
        self.assertEqual(response.status_code, 409)
        self.assertTrue(response.json()["detail"])


class TestValidation(AdminApiTestCase):
    def validate(self, provider="kaltura", connection=None, options=None, instance=None):
        data = {"name": "Validation", "provider": provider, "connection": connection or KALTURA}
        if options is not None:
            data["options"] = options
        serializer = MigrationServiceSerializer(instance=instance, data=data)
        valid = serializer.is_valid()
        return valid, serializer

    def test_an_unknown_provider_is_refused(self):
        valid, serializer = self.validate(provider="vimeo")
        self.assertFalse(valid)
        self.assertIn("provider", serializer.errors)

    def test_a_retired_connection_key_is_dropped_not_refused(self):
        valid, serializer = self.validate(provider="youtube", connection={"sources": "abcdefghijk", "api_key": "old", "channel_id": "UC1"})
        self.assertTrue(valid, serializer.errors)
        self.assertEqual(serializer.validated_data["connection"], {"sources": "abcdefghijk"})

    def test_a_retired_option_is_dropped_not_refused(self):
        valid, serializer = self.validate(options={"source_category_ids": "1", "create_categories": True, "map_permissions": False})
        self.assertTrue(valid, serializer.errors)
        self.assertNotIn("create_categories", serializer.validated_data["options"])
        self.assertNotIn("map_permissions", serializer.validated_data["options"])

    def test_an_empty_category_selection_is_refused(self):
        valid, serializer = self.validate(options={"source_category_ids": " , "})
        self.assertFalse(valid)
        self.assertIn("Pick at least one category", str(serializer.errors))

    def test_the_role_map_is_cleaned_on_save(self):
        rows = [{"id": " 1 ", "name": "adminRole", "role": "admin"}, {"id": "", "name": "", "role": "editor"}, {"id": "2", "name": "viewer", "role": ""}]
        valid, serializer = self.validate(options={"source_category_ids": "1", "role_map": rows})
        self.assertTrue(valid, serializer.errors)
        self.assertEqual(serializer.validated_data["options"]["role_map"], [{"id": "1", "name": "adminRole", "role": "admin"}, {"id": "2", "name": "viewer", "role": ""}])

    def test_quiet_hours_need_both_ends(self):
        valid, serializer = self.validate(options={"source_category_ids": "1", "quiet_hours_enabled": True, "quiet_from": "22:00", "quiet_to": "25:00"})
        self.assertFalse(valid)
        self.assertIn("HH:MM", str(serializer.errors))

    def test_quiet_hours_need_ends_that_differ(self):
        valid, serializer = self.validate(options={"source_category_ids": "1", "quiet_hours_enabled": True, "quiet_from": "22:00", "quiet_to": "22:00"})
        self.assertFalse(valid)
        self.assertIn("differ", str(serializer.errors))

    def test_a_schedule_without_a_time_is_refused(self):
        valid, serializer = self.validate(options={"source_category_ids": "1", "schedule_enabled": True, "scheduled_at": "not a date"})
        self.assertFalse(valid)
        self.assertIn("needs a date and a time", str(serializer.errors))


class TestCleanRoleMap(TestCase):
    def test_a_role_map_that_is_not_a_list(self):
        with self.assertRaises(serializers.ValidationError):
            clean_role_map({"id": "1"})

    def test_a_row_that_is_not_an_object(self):
        with self.assertRaises(serializers.ValidationError):
            clean_role_map(["adminRole"])

    def test_an_unknown_target_role_is_refused(self):
        with self.assertRaisesMessage(serializers.ValidationError, "unknown MediaCMS role: superhero"):
            clean_role_map([{"id": "1", "role": "superhero"}])

    def test_a_row_naming_only_the_role_is_dropped(self):
        self.assertEqual(clean_role_map([{"role": "editor"}, {"name": " viewer ", "role": None}]), [{"id": "", "name": "viewer", "role": ""}])


class TestRecordLinks(TestCase):
    def setUp(self):
        self.service = MigrationService.objects.create(name="Panopto", provider="panopto", connection=dict(PANOPTO), options={})
        self.category = Category.objects.create(title="Biology", uid="link-test-biology")

    def row(self, **fields):
        defaults = {"service": self.service, "object_type": "category", "source_id": "f1", "status": "success", "target_id": self.category.pk}
        defaults.update(fields)
        return MigrationRecordSerializer(MigrationRecord.objects.create(**defaults)).data

    def test_a_category_row_links_to_the_category(self):
        data = self.row()
        self.assertEqual(data["target_label"], "Biology")
        self.assertEqual(data["target_url"], self.category.get_absolute_url())

    def test_a_row_whose_object_is_gone(self):
        data = self.row(target_id=None)
        self.assertIsNone(data["target_url"])
        self.assertIsNone(data["target_label"])

    def test_a_url_that_cannot_be_built_does_not_break_the_listing(self):
        with mock.patch.object(Category, "get_absolute_url", side_effect=RuntimeError("no route")):
            self.assertIsNone(self.row()["target_url"])

    def test_an_object_with_no_page_and_no_name(self):
        with mock.patch.object(MigrationRecord, "target", return_value=SimpleNamespace()):
            data = self.row(source_id="f2")
        self.assertIsNone(data["target_url"])
        self.assertEqual(data["target_label"], str(self.category.pk))
