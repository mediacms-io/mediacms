import json
from unittest import mock

from django.core.files import File
from django.test import Client, TestCase
from rest_framework.settings import api_settings

from files.models import Media
from files.tests import create_account
from migrationservice.models import MigrationRecord, MigrationService
from migrationservice.serializers import SECRET_MASK

API = "/api/v1/migrations/"

CONNECTION = {
    "service_url": "https://kaltura.example.edu",
    "partner_id": "342",
    "app_token_id": "atok",
    "app_token": "the-secret",
    "kms_root_category": "MediaSpace",
}


class ApiTestCase(TestCase):
    def setUp(self):
        self.password = "this_is_a_fake_password"
        self.admin = create_account(username="admin", password=self.password, is_superuser=True)
        self.editor = create_account(username="editor", password=self.password, is_editor=True)
        self.client = Client()

    def login(self, user):
        self.client.login(username=user.username, password=self.password)

    def make_service(self, **kwargs):
        defaults = {"name": "Kaltura production", "provider": "kaltura", "connection": dict(CONNECTION)}
        defaults.update(kwargs)
        return MigrationService.objects.create(**defaults)


class TestPermissions(ApiTestCase):
    def test_anonymous_is_rejected(self):
        self.assertIn(self.client.get(API).status_code, [401, 403])

    def test_an_editor_is_rejected(self):
        self.login(self.editor)
        self.assertEqual(self.client.get(API).status_code, 403)

    def test_a_superuser_is_allowed(self):
        self.login(self.admin)
        self.assertEqual(self.client.get(API).status_code, 200)


class TestCrud(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.login(self.admin)

    def test_create(self):
        payload = {"name": "Kaltura production", "provider": "kaltura", "connection": CONNECTION, "options": {"create_users": False}}
        response = self.client.post(API, data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 201)
        service = MigrationService.objects.get(pk=response.json()["id"])
        self.assertEqual(service.get_connection()["app_token"], "the-secret")
        self.assertEqual(service.status, "pending")

    def test_the_secret_is_masked_on_read(self):
        service = self.make_service()
        response = self.client.get(f"{API}{service.pk}/")
        self.assertEqual(response.json()["connection"]["app_token"], "••••••••")
        self.assertEqual(response.json()["connection"]["partner_id"], "342")

    def test_saving_the_mask_back_keeps_the_stored_secret(self):
        service = self.make_service()
        payload = {"name": "Renamed", "provider": "kaltura", "connection": dict(CONNECTION, app_token="••••••••")}
        response = self.client.put(f"{API}{service.pk}/", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 200)
        service.refresh_from_db()
        self.assertEqual(service.get_connection()["app_token"], "the-secret")
        self.assertEqual(service.name, "Renamed")

    def test_a_missing_required_connection_key_is_rejected(self):
        payload = {"name": "Broken", "provider": "kaltura", "connection": {"service_url": "https://x.example.edu"}}
        response = self.client.post(API, data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("partner_id", json.dumps(response.json()))

    def test_an_unknown_option_is_rejected(self):
        payload = {"name": "Broken", "provider": "kaltura", "connection": CONNECTION, "options": {"delete_everything": True}}
        response = self.client.post(API, data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 400)

    def test_restricting_to_users_without_any_user_is_rejected(self):
        for raw in ["", "   ", ",", " , "]:
            payload = {
                "name": "Test run",
                "provider": "kaltura",
                "connection": CONNECTION,
                "options": {"restrict_to_users": True, "source_user_ids": raw},
            }
            response = self.client.post(API, data=json.dumps(payload), content_type="application/json")
            self.assertEqual(response.status_code, 400, f"an empty list ({raw!r}) was accepted")

    def test_the_user_list_is_stored_cleaned(self):
        payload = {
            "name": "Test run",
            "provider": "kaltura",
            "connection": CONNECTION,
            "options": {"restrict_to_users": True, "source_user_ids": " jdoe@example.edu , , jdoe@example.edu ,5f2c1b9a,"},
        }
        response = self.client.post(API, data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 201, response.content)
        service = MigrationService.objects.get(name="Test run")
        self.assertEqual(service.options["source_user_ids"], "jdoe@example.edu,5f2c1b9a")

    def test_too_many_users_are_rejected(self):
        payload = {
            "name": "Test run",
            "provider": "kaltura",
            "connection": CONNECTION,
            "options": {"restrict_to_users": True, "source_user_ids": ",".join(f"user{index}" for index in range(51))},
        }
        response = self.client.post(API, data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 400)

    def test_a_user_list_is_kept_while_the_option_is_off(self):
        # turning the restriction off must not throw the list away, so it can be
        # switched back on without retyping
        payload = {
            "name": "Test run",
            "provider": "kaltura",
            "connection": CONNECTION,
            "options": {"restrict_to_users": False, "source_user_ids": "jdoe"},
        }
        response = self.client.post(API, data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(MigrationService.objects.get(name="Test run").options["source_user_ids"], "jdoe")

    def test_options_stay_editable_while_a_migration_runs(self):
        """Editing is allowed at any time. Options are read per item, so a change lands on
        whatever the run has not reached yet, which is the operator's call to make.
        """
        service = self.make_service(status="running", options={"create_users": True})
        payload = {
            "name": service.name,
            "provider": "kaltura",
            "connection": {**CONNECTION, "app_token": SECRET_MASK},
            "options": {"create_users": False},
        }
        response = self.client.put(f"{API}{service.pk}/", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 200, response.content)
        service.refresh_from_db()
        self.assertFalse(service.options["create_users"])

    def test_the_connection_cannot_be_changed_while_a_migration_runs(self):
        """The cursor mid sweep was built against these credentials, and means nothing
        against another portal.
        """
        service = self.make_service(status="running")
        payload = {
            "name": service.name,
            "provider": "kaltura",
            "connection": dict(CONNECTION, partner_id="999"),
        }
        response = self.client.put(f"{API}{service.pk}/", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Pause it", json.dumps(response.json()))
        service.refresh_from_db()
        self.assertEqual(service.get_connection()["partner_id"], CONNECTION["partner_id"])

    def test_resubmitting_the_same_connection_while_running_is_allowed(self):
        """The form always posts the connection back, with the secret masked. Saving an
        options change must not be mistaken for repointing the migration.
        """
        service = self.make_service(status="running")
        payload = {
            "name": "renamed mid run",
            "provider": "kaltura",
            "connection": {**CONNECTION, "app_token": SECRET_MASK},
        }
        response = self.client.put(f"{API}{service.pk}/", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 200, response.content)
        service.refresh_from_db()
        self.assertEqual(service.name, "renamed mid run")

    def test_the_connection_can_be_changed_once_paused(self):
        service = self.make_service(status="paused")
        payload = {
            "name": service.name,
            "provider": "kaltura",
            "connection": dict(CONNECTION, partner_id="999"),
        }
        response = self.client.put(f"{API}{service.pk}/", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 200, response.content)
        service.refresh_from_db()
        self.assertEqual(service.get_connection()["partner_id"], "999")

    def test_the_placeholder_mask_is_refused_as_a_new_secret(self):
        payload = {
            "name": "Pasted from somewhere",
            "provider": "kaltura",
            "connection": dict(CONNECTION, app_token="••••••••"),
        }
        response = self.client.post(API, data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("placeholder", json.dumps(response.json()))


class TestConnectionCheck(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.login(self.admin)

    def test_checks_an_unsaved_payload(self):
        payload = {"provider": "kaltura", "connection": CONNECTION}
        stats = {"ok": True, "error": "", "stats": {"entries": 11960, "users": 214, "categories": 87}}
        with mock.patch("migrationservice.providers.kaltura.KalturaProvider.check_connection", return_value=stats):
            response = self.client.post(f"{API}check_connection/", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["stats"]["entries"], 11960)

    def test_checks_a_saved_migration(self):
        service = self.make_service()
        stats = {"ok": True, "error": "", "stats": {"entries": 5}}
        with mock.patch("migrationservice.providers.kaltura.KalturaProvider.check_connection", return_value=stats):
            response = self.client.post(f"{API}{service.pk}/check_connection/", data="{}", content_type="application/json")
        self.assertEqual(response.json()["ok"], True)

    def _capture_options(self):
        """Record the options the provider was built with, rather than mocking them away.

        The bug this guards against was invisible to a test that mocks
        check_connection itself: the endpoint built the provider with no options at
        all, so a restricted check answered with numbers for the whole portal.
        """
        seen = {}

        def fake(provider_self):
            seen["options"] = dict(provider_self.options)
            return {"ok": True, "error": "", "stats": {"entries": 25}}

        return seen, fake

    def test_the_options_on_screen_reach_an_unsaved_check(self):
        seen, fake = self._capture_options()
        payload = {
            "provider": "kaltura",
            "connection": CONNECTION,
            "options": {"restrict_to_users": True, "source_user_ids": "jdoe"},
        }
        with mock.patch("migrationservice.providers.kaltura.KalturaProvider.check_connection", autospec=True, side_effect=fake):
            self.client.post(f"{API}check_connection/", data=json.dumps(payload), content_type="application/json")

        self.assertTrue(seen["options"]["restrict_to_users"])
        self.assertEqual(seen["options"]["source_user_ids"], "jdoe")

    def test_unsaved_options_win_over_the_stored_ones_on_a_saved_check(self):
        service = self.make_service(options={"restrict_to_users": False, "source_user_ids": "old"})
        seen, fake = self._capture_options()
        payload = {"options": {"restrict_to_users": True, "source_user_ids": "typed-but-not-saved"}}
        with mock.patch("migrationservice.providers.kaltura.KalturaProvider.check_connection", autospec=True, side_effect=fake):
            self.client.post(f"{API}{service.pk}/check_connection/", data=json.dumps(payload), content_type="application/json")

        self.assertTrue(seen["options"]["restrict_to_users"])
        self.assertEqual(seen["options"]["source_user_ids"], "typed-but-not-saved")

    def test_a_saved_check_without_options_uses_the_stored_ones(self):
        service = self.make_service(options={"restrict_to_users": True, "source_user_ids": "stored"})
        seen, fake = self._capture_options()
        with mock.patch("migrationservice.providers.kaltura.KalturaProvider.check_connection", autospec=True, side_effect=fake):
            self.client.post(f"{API}{service.pk}/check_connection/", data="{}", content_type="application/json")

        self.assertEqual(seen["options"]["source_user_ids"], "stored")

    def test_an_unimplemented_provider_reports_instead_of_raising(self):
        payload = {"provider": "panopto", "connection": {"service_url": "https://x", "client_id": "a", "client_secret": "b"}}
        response = self.client.post(f"{API}check_connection/", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["ok"])
        self.assertIn("not implemented", response.json()["error"].lower())


class TestControls(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.login(self.admin)

    def test_start_moves_to_running(self):
        service = self.make_service()
        with mock.patch("migrationservice.views.start_migration") as start:
            response = self.client.post(f"{API}{service.pk}/start/")
        self.assertEqual(response.status_code, 200)
        start.assert_called_once()

    def test_pause_from_running(self):
        service = self.make_service(status="running")
        response = self.client.post(f"{API}{service.pk}/pause/")
        self.assertEqual(response.status_code, 200)
        service.refresh_from_db()
        self.assertEqual(service.status, "paused")

    def test_pausing_something_not_running_is_a_conflict(self):
        service = self.make_service(status="pending")
        response = self.client.post(f"{API}{service.pk}/pause/")
        self.assertEqual(response.status_code, 409)

    def test_abort_from_paused(self):
        service = self.make_service(status="paused")
        response = self.client.post(f"{API}{service.pk}/abort/")
        self.assertEqual(response.status_code, 200)
        service.refresh_from_db()
        self.assertEqual(service.status, "aborted")


class TestRecordsAndProgress(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.login(self.admin)
        self.service = self.make_service(status="running", totals={"media_migrated": 7, "media_failed": 1})
        # deliberately high ids: these point at nothing, and must not collide with a
        # real object a test creates later, or a search would match them by accident
        MigrationRecord.objects.create(service=self.service, object_type="media", source_id="1_a", status="success", log="ok", target_id=900001)
        MigrationRecord.objects.create(service=self.service, object_type="media", source_id="1_b", status="failed", log="boom")
        MigrationRecord.objects.create(service=self.service, object_type="user", source_id="jdoe", status="success", target_id=900002)

    def test_records_are_listed(self):
        response = self.client.get(f"{API}{self.service.pk}/records/")
        self.assertEqual(response.json()["count"], 3)

    def test_records_filter_by_status(self):
        response = self.client.get(f"{API}{self.service.pk}/records/?status=failed")
        self.assertEqual(response.json()["count"], 1)
        self.assertEqual(response.json()["results"][0]["source_id"], "1_b")

    def test_records_filter_by_type(self):
        response = self.client.get(f"{API}{self.service.pk}/records/?object_type=user")
        self.assertEqual(response.json()["count"], 1)

    def test_records_beyond_the_first_page_are_reachable(self):
        """The mapping table is paginated. Every row must be reachable, including a
        retried one, whose created_at stays put and sinks it to the last page.
        """
        page_size = api_settings.PAGE_SIZE
        MigrationRecord.objects.bulk_create([MigrationRecord(service=self.service, object_type="media", source_id=f"filler_{index}", status="success") for index in range(page_size)])
        total = page_size + 3

        first = self.client.get(f"{API}{self.service.pk}/records/").json()
        self.assertEqual(first["count"], total)
        self.assertEqual(len(first["results"]), page_size)
        self.assertIsNotNone(first["next"])

        second = self.client.get(f"{API}{self.service.pk}/records/?page=2").json()
        self.assertEqual(len(second["results"]), total - page_size)

        seen = {row["source_id"] for row in first["results"]} | {row["source_id"] for row in second["results"]}
        # the oldest rows are the ones a re-run retries, and they sort last
        self.assertIn("1_b", seen)
        self.assertEqual(len(seen), total)

    def test_records_search_matches_the_source_id(self):
        response = self.client.get(f"{API}{self.service.pk}/records/?search=1_b")
        body = response.json()
        self.assertEqual(body["count"], 1)
        self.assertEqual(body["results"][0]["source_id"], "1_b")

    def test_records_search_matches_the_log(self):
        response = self.client.get(f"{API}{self.service.pk}/records/?search=boom")
        self.assertEqual(response.json()["count"], 1)

    def test_records_search_matches_the_mediacms_side(self):
        """The table shows a title or username for the MediaCMS side, so searching
        for one has to find its row even though the row itself only holds an id.
        """
        media = Media(user=self.admin, title="Thermodynamics week 3")
        with open("fixtures/test_image.png", "rb") as handle:
            media.media_file.save("lecture.png", File(handle), save=False)
        media.save()
        MigrationRecord.objects.create(service=self.service, object_type="media", source_id="1_c", status="success", target_id=media.pk)

        response = self.client.get(f"{API}{self.service.pk}/records/?search=thermodynamics")
        body = response.json()
        self.assertEqual(body["count"], 1)
        self.assertEqual(body["results"][0]["source_id"], "1_c")

        response = self.client.get(f"{API}{self.service.pk}/records/?search={media.friendly_token}")
        self.assertEqual(response.json()["count"], 1)

    def test_records_search_finds_nothing_for_an_unrelated_term(self):
        response = self.client.get(f"{API}{self.service.pk}/records/?search=zzzznotthere")
        self.assertEqual(response.json()["count"], 0)

    def test_records_search_does_not_leak_another_migration(self):
        other = self.make_service(name="other")
        MigrationRecord.objects.create(service=other, object_type="media", source_id="1_b", status="success")
        response = self.client.get(f"{API}{self.service.pk}/records/?search=1_b")
        self.assertEqual(response.json()["count"], 1)

    def test_progress_is_small_and_useful(self):
        response = self.client.get(f"{API}{self.service.pk}/progress/")
        body = response.json()
        self.assertEqual(body["status"], "running")
        # derived from the mapping table: one success row exists for media
        self.assertEqual(body["totals"]["media_migrated"], 1)
        self.assertIn("log", body)
        self.assertNotIn("connection", body)

    def test_the_progress_log_truncates_a_pathological_line(self):
        self.service.log = "x" * 5000
        self.service.save(update_fields=["log"])
        response = self.client.get(f"{API}{self.service.pk}/progress/")
        for line in response.json()["log"]:
            self.assertLessEqual(len(line), 500)


class TestPageViewPermissions(ApiTestCase):
    """The three page views are part of the superuser perimeter and had no coverage."""

    PAGES = ["/migrations", "/migrations/new", "/migrations/1"]

    def test_anonymous_is_redirected(self):
        for url in self.PAGES:
            self.assertEqual(self.client.get(url).status_code, 302, url)

    def test_an_editor_is_redirected(self):
        self.login(self.editor)
        for url in self.PAGES:
            response = self.client.get(url)
            self.assertEqual(response.status_code, 302, url)
            self.assertEqual(response["Location"], "/", url)
