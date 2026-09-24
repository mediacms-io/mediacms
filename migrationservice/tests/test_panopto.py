from unittest import mock

from django.test import TestCase

from files.models import Category
from files.tests import create_account
from migrationservice.models import MigrationRecord, MigrationService
from migrationservice.providers import get_provider, get_provider_class
from migrationservice.providers.panopto import (
    PanoptoProvider,
    folder_path,
    session_is_importable,
)
from migrationservice.tasks import (
    import_panopto_session,
    restart_migration,
    start_migration,
)

VIDEO = "fixtures/small_video.mp4"
CAPTION = "migrationservice/tests/fixtures/sample.srt"

CONNECTION = {
    "service_url": "https://yourorg.cloud.panopto.eu",
    "client_id": "client",
    "client_secret": "secret",
    "username": "service@example.edu",
    "password": "pw",
}


class TestPanoptoProvider(TestCase):
    def test_it_is_registered_and_implemented(self):
        self.assertIs(get_provider_class("panopto"), PanoptoProvider)
        self.assertTrue(PanoptoProvider.implemented)

    def test_the_credentials_it_asks_for(self):
        self.assertEqual(PanoptoProvider.required_connection_keys, ("service_url", "client_id", "client_secret", "username", "password"))
        self.assertEqual(PanoptoProvider.secret_keys, ("client_secret", "password"))

    def test_two_migrations_of_one_instance_share_an_identity(self):
        self.assertEqual(PanoptoProvider.source_system(CONNECTION), "panopto:yourorg.cloud.panopto.eu")
        self.assertEqual(PanoptoProvider.source_system(dict(CONNECTION, service_url="yourorg.cloud.panopto.eu/")), "panopto:yourorg.cloud.panopto.eu")
        self.assertNotEqual(PanoptoProvider.source_system(CONNECTION), PanoptoProvider.source_system(dict(CONNECTION, service_url="https://other.cloud.panopto.eu")))

    def test_the_chosen_folders_are_read_from_the_option_the_picker_writes(self):
        provider = PanoptoProvider(CONNECTION, {"source_category_ids": " abc , def ,,\nghi "})
        self.assertEqual(provider.selected_folder_ids(), ["abc", "def", "ghi"])

    def test_no_chosen_folders(self):
        self.assertEqual(PanoptoProvider(CONNECTION, {}).selected_folder_ids(), [])

    def test_it_reaches_the_provider_registry_through_a_migration(self):
        service = MigrationService.objects.create(name="Panopto", provider="panopto", connection=CONNECTION, options={})
        self.assertIsInstance(get_provider(service), PanoptoProvider)

    def test_only_the_media_phase_is_swept(self):
        provider = PanoptoProvider(CONNECTION, {})
        self.assertEqual(provider.list_page("users", {}, 10), ([], {}))
        self.assertEqual(provider.list_page("categories", {"page": 3}, 10), ([], {"page": 3}))


class TestPanoptoShapes(TestCase):
    """Folder and session records exactly as the live API returns them."""

    def test_a_folder_knows_its_own_path(self):
        folder = {
            "Id": "3",
            "Name": "Interactive Video",
            "ParentFolder": {"Id": "2", "Name": "Kaltura", "ParentFolder": {"Id": "1", "Name": "Guides"}},
        }
        self.assertEqual(folder_path(folder), "Guides>Kaltura>Interactive Video")

    def test_a_root_folder_is_its_own_path(self):
        self.assertEqual(folder_path({"Id": "1", "Name": "Users"}), "Users")

    def test_nothing_at_all(self):
        self.assertEqual(folder_path({}), "")
        self.assertEqual(folder_path(None), "")

    def test_a_finished_recording_is_importable(self):
        self.assertTrue(session_is_importable({"Id": "5036608c", "Status": 4, "IsWebcast": False}))

    def test_status_is_not_a_filter(self):
        for status in (0, 1, 2, 3, 4, 5):
            self.assertTrue(session_is_importable({"Id": "5036608c", "Status": status}), status)

    def test_a_running_webcast_is_not(self):
        self.assertFalse(session_is_importable({"Id": "5036608c", "Status": 1, "IsWebcast": True}))

    def test_something_that_is_not_a_session(self):
        self.assertFalse(session_is_importable({}))
        self.assertFalse(session_is_importable(None))
        self.assertFalse(session_is_importable({"Status": 4}))


class TestTheCanImportGuard(TestCase):
    """A source that cannot be swept is refused a start, rather than failing mid phase."""

    def make(self):
        return MigrationService.objects.create(name="zz panopto", provider="panopto", connection=CONNECTION, options={"source_category_ids": "abc"})

    def test_every_source_can_import_now(self):
        self.assertTrue(PanoptoProvider.can_import)
        for name in ("kaltura", "youtube"):
            self.assertTrue(get_provider_class(name).can_import, name)

    def test_a_source_that_cannot_import_is_refused_a_start(self):
        service = self.make()
        with mock.patch.object(PanoptoProvider, "can_import", False):
            with self.assertRaises(ValueError) as caught:
                start_migration(service)
        self.assertIn("not built yet", str(caught.exception))
        service.refresh_from_db()
        self.assertEqual(service.status, "pending")

    def test_and_refused_a_re_run(self):
        service = self.make()
        MigrationService.objects.filter(pk=service.pk).update(status="success")
        service.refresh_from_db()
        with mock.patch.object(PanoptoProvider, "can_import", False):
            with self.assertRaises(ValueError):
                restart_migration(service)


class StubPanopto(PanoptoProvider):
    """A Panopto that answers from dicts, shaped as the live API answers."""

    def __init__(self, sessions=None, users=None, folders=None, pages=None):
        super().__init__(CONNECTION, {"create_users": True, "fallback_username": "admin", "rollup_subfolders": True, "import_captions": True})
        self.sessions = sessions or {}
        self.users = users or {}
        self.folders = folders or {}
        self.pages = pages or []
        self.downloads = []

    def list_page(self, phase, cursor, page_size):
        page = int((cursor or {}).get("page") or 0)
        if page >= len(self.pages):
            return [], {"page": page}
        return self.pages[page], {"page": page + 1}

    def fetch_media(self, source_id):
        return self.sessions[source_id]

    def fetch_user(self, source_id):
        return self.users[source_id]

    def folder_ancestors(self, folder_id):
        return self.folders.get(folder_id, [])

    def download(self, url, dest_path):
        self.downloads.append(url)
        source_file = CAPTION if dest_path.endswith(".srt") else VIDEO
        with open(source_file, "rb") as source, open(dest_path, "wb") as target:
            target.write(source.read())
        return 1024


def make_service(**options):
    defaults = {"create_users": True, "fallback_username": "admin", "rollup_subfolders": True, "import_captions": True, "source_category_ids": "root"}
    defaults.update(options)
    return MigrationService.objects.create(name="Panopto", provider="panopto", connection=CONNECTION, options=defaults)


def a_session(source_id="s1", folder_id="f1", **extra):
    payload = {
        "id": source_id,
        "title": "Lecture 4",
        "description": "the fourth one",
        "duration": 61.5,
        "created_at": "2026-08-03T15:03:18.751Z",
        "owner": {"id": "u1", "username": "jdoe@example.edu"},
        "folder": {"id": folder_id, "name": "My Folder", "fullName": "Users>My Folder", "parentId": "root", "parentName": "Users"},
        "download_url": "https://panopto.example.edu/Panopto/Podcast/Download/s1.mp4",
        "captions": [],
    }
    payload.update(extra)
    return payload


class TestImportPanoptoSession(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        create_account(username="admin")
        self.service = make_service()
        self.provider = StubPanopto(
            sessions={"s1": a_session()},
            users={"u1": {"id": "u1", "username": "jdoe@example.edu", "email": "jdoe@example.edu", "fullName": "J Doe"}},
            folders={"f1": [("root", "Users")]},
        )

    def test_the_recording_arrives_with_its_file_and_owner(self):
        media = import_panopto_session(self.service, self.provider, "s1")
        media.refresh_from_db()

        self.assertEqual(media.title, "Lecture 4")
        self.assertEqual(media.description, "the fourth one")
        self.assertEqual(media.user.username, "jdoe@example.edu")
        self.assertEqual(media.user.email, "jdoe@example.edu")
        self.assertTrue(media.media_file.name)
        self.assertEqual(self.provider.downloads, ["https://panopto.example.edu/Panopto/Podcast/Download/s1.mp4"])

    def test_the_start_time_becomes_the_date(self):
        media = import_panopto_session(self.service, self.provider, "s1")
        media.refresh_from_db()
        self.assertEqual(media.add_date.year, 2026)
        self.assertEqual(media.add_date.month, 8)

    def test_the_folder_becomes_a_category_keyed_on_its_guid(self):
        media = import_panopto_session(self.service, self.provider, "s1")
        category = Category.objects.get(title="My Folder")
        self.assertEqual(category.uid, "f1")
        self.assertEqual(category.description, "Users: My Folder")
        self.assertIn(category, media.category.all())

    def test_the_parent_folder_holds_it_too(self):
        media = import_panopto_session(self.service, self.provider, "s1")
        self.assertEqual(sorted(media.category.values_list("title", flat=True)), ["My Folder", "Users"])

    def test_the_rollup_can_be_switched_off(self):
        service = make_service(rollup_subfolders=False)
        media = import_panopto_session(service, self.provider, "s1")
        self.assertEqual([category.title for category in media.category.all()], ["My Folder"])

    def test_importing_the_same_recording_twice_reuses_the_category(self):
        import_panopto_session(self.service, self.provider, "s1")
        self.provider.sessions["s2"] = a_session(source_id="s2")
        import_panopto_session(self.service, self.provider, "s2")
        self.assertEqual(Category.objects.filter(uid="f1").count(), 1)
        self.assertEqual(MigrationRecord.objects.filter(service=self.service, object_type="media").count(), 2)

    def test_two_personal_folders_called_my_folder_do_not_collide(self):
        import_panopto_session(self.service, self.provider, "s1")
        self.provider.sessions["s2"] = a_session(source_id="s2", folder_id="f2")
        self.provider.sessions["s2"]["folder"] = {"id": "f2", "name": "My Folder", "fullName": "Users>My Folder", "parentId": "root", "parentName": "asmith@example.edu"}
        self.provider.folders["f2"] = [("root", "Users")]
        import_panopto_session(self.service, self.provider, "s2")
        self.assertEqual(
            sorted(Category.objects.filter(uid__in=("f1", "f2")).values_list("title", flat=True)),
            ["My Folder", "My Folder (asmith@example.edu)"],
        )

    def test_with_user_creation_off_everything_goes_to_the_fallback(self):
        service = make_service(create_users=False)
        media = import_panopto_session(service, self.provider, "s1")
        self.assertEqual(media.user.username, "admin")
        self.assertEqual(MigrationRecord.objects.filter(service=service, object_type="user").count(), 0)

    def test_an_owner_panopto_cannot_resolve_falls_back(self):
        self.provider.sessions["s3"] = a_session(source_id="s3", owner={"id": "missing", "username": ""})
        media = import_panopto_session(self.service, self.provider, "s3")
        self.assertEqual(media.user.username, "admin")

    def test_a_caption_is_attached_when_panopto_offers_one(self):
        self.provider.sessions["s4"] = a_session(source_id="s4", captions=[{"language": "en", "url": "https://panopto.example.edu/caption.srt"}])
        media = import_panopto_session(self.service, self.provider, "s4")
        self.assertEqual(media.subtitles.count(), 1)

    def test_captions_off_leaves_them_alone(self):
        service = make_service(import_captions=False)
        self.provider.sessions["s5"] = a_session(source_id="s5", captions=[{"language": "en", "url": "https://panopto.example.edu/caption.srt"}])
        media = import_panopto_session(service, self.provider, "s5")
        self.assertEqual(media.subtitles.count(), 0)

    def test_a_mapping_record_points_at_the_media(self):
        media = import_panopto_session(self.service, self.provider, "s1")
        row = MigrationRecord.objects.get(service=self.service, object_type="media", source_id="s1")
        self.assertEqual(row.status, "success")
        self.assertEqual(row.target_id, media.id)
