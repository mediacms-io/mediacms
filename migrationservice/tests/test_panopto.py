from unittest import mock

from django.test import TestCase, override_settings

from files.models import Category, MediaPermission, Playlist
from files.tests import create_account
from lti.models import LTIPlatform, LTIResourceLink
from migrationservice.models import MigrationRecord, MigrationService
from migrationservice.providers import get_provider, get_provider_class
from migrationservice.providers.panopto import (
    PanoptoAPIError,
    PanoptoProvider,
    folder_path,
    session_is_importable,
)
from migrationservice.tasks import (
    import_panopto_folder,
    import_panopto_playlist,
    import_panopto_session,
    import_panopto_user,
    restart_migration,
    start_migration,
)
from rbac.models import RBACMembership

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

    def test_a_phase_this_source_does_not_have_is_skipped(self):
        provider = PanoptoProvider(CONNECTION, {})
        self.assertEqual(provider.list_page("groups", {"page": 3}, 10), ([], {"page": 3}))
        self.assertEqual(provider.list_page("unknown", {}, 10), ([], {}))

    def test_the_users_phase_pages_until_the_total_is_reached(self):
        provider = PanoptoProvider(CONNECTION, {})
        pages = {0: (["u1", "u2"], 5), 1: (["u3", "u4"], 5), 2: (["u5"], 5)}
        with mock.patch.object(provider, "list_users", side_effect=lambda page, size: pages[page]) as listed:
            seen, cursor = [], {}
            for _ in range(5):
                ids, nxt = provider.list_page("users", cursor, 2)
                seen += ids
                if nxt == cursor:
                    break
                cursor = nxt

        self.assertEqual(seen, ["u1", "u2", "u3", "u4", "u5"])
        self.assertEqual([call.args[0] for call in listed.call_args_list], [0, 1, 2])


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

    def __init__(self, sessions=None, users=None, folders=None, pages=None, access=None, members=None, categories=None):
        super().__init__(CONNECTION, {"create_users": True, "fallback_username": "admin", "import_captions": True})
        self.sessions = sessions or {}
        self.users = users or {}
        self.folders = folders or {}
        self.pages = pages or []
        self.access = access or {}
        self.members = members or {}
        self.categories = categories or {}
        self.playlists = {}
        self.course_folders = set()
        self.downloads = []

    def folder_access(self, folder_id):
        return self.access.get(folder_id, access(public=True))

    def group_members(self, group_id):
        return self.members.get(group_id, [])

    def fetch_category(self, source_id):
        return self.categories[source_id]

    def fetch_playlist(self, source_id):
        return self.playlists[source_id]

    def is_lms_course_folder(self, folder_id):
        return folder_id in self.course_folders

    def list_page(self, phase, cursor, page_size):
        page = int((cursor or {}).get("page") or 0)
        if page >= len(self.pages):
            return [], {"page": page}
        return self.pages[page], {"page": page + 1}

    def fetch_media(self, source_id):
        return self.sessions[source_id]

    def fetch_user(self, source_id):
        return self.users[source_id]

    def download(self, url, dest_path):
        self.downloads.append(url)
        source_file = CAPTION if dest_path.endswith(".srt") else VIDEO
        with open(source_file, "rb") as source, open(dest_path, "wb") as target:
            target.write(source.read())
        return 1024


def access(public=False, organisation=False, lms=False, principals=None, lms_course_ids=None):
    return {"public": public, "organisation": organisation, "lms": lms, "lms_course_ids": lms_course_ids or [], "principals": principals or []}


def make_service(**options):
    defaults = {"create_users": True, "fallback_username": "admin", "import_captions": True, "source_category_ids": "root"}
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


@override_settings(DO_NOT_TRANSCODE_VIDEO=True)
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

    def test_a_recording_lands_in_its_own_folder_only(self):
        media = import_panopto_session(self.service, self.provider, "s1")
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


@override_settings(DO_NOT_TRANSCODE_VIDEO=True, USE_RBAC=True)
class TestPanoptoAccessMapping(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        create_account(username="admin")
        self.service = make_service()
        self.provider = StubPanopto(
            users={
                "u1": {"id": "u1", "username": "owner", "email": "owner@example.edu", "fullName": "Owner"},
                "u2": {"id": "u2", "username": "viewer", "email": "viewer@example.edu", "fullName": "Viewer"},
                "u3": {"id": "u3", "username": "creator", "email": "creator@example.edu", "fullName": "Creator"},
                "u4": {"id": "u4", "username": "publisher", "email": "publisher@example.edu", "fullName": "Publisher", "role": "admin"},
            },
            members={"g-viewers": ["u2"], "g-creators": ["u3"], "g-publishers": ["u4"]},
        )

    def import_from(self, folder_kind, folder_access, session_access=None, folder_id="f1"):
        self.provider.access[folder_id] = folder_access
        self.provider.sessions["s1"] = a_session(folder_id=folder_id, owner={"id": "u1", "username": "owner"}, folder_kind=folder_kind, access=session_access or access())
        self.provider.sessions["s1"]["folder"] = {"id": folder_id, "name": "Biology", "fullName": "Courses>Biology", "parentId": "root", "parentName": "Courses"}
        media = import_panopto_session(self.service, self.provider, "s1")
        media.refresh_from_db()
        return media

    def test_a_public_recording_is_public_in_a_plain_category(self):
        media = self.import_from("folder", access(public=True))
        category = media.category.get()
        self.assertEqual(media.state, "public")
        self.assertFalse(category.is_rbac_category)

    def test_a_recording_in_a_restricted_lms_folder_is_private_and_the_course_becomes_an_rbac_group(self):
        principals = [
            {"type": "Group", "id": "g-viewers", "role": "Viewer"},
            {"type": "Group", "id": "g-creators", "role": "Creator"},
            {"type": "Group", "id": "g-publishers", "role": "Publisher"},
        ]
        media = self.import_from("folder", access(lms=True, principals=principals))
        category = media.category.get()
        roles = dict(RBACMembership.objects.filter(rbac_group__categories=category).values_list("user__username", "role"))

        self.assertEqual(media.state, "private")
        self.assertTrue(category.is_rbac_category)
        self.assertTrue(category.is_lms_course)
        self.assertEqual(roles, {"viewer": "member", "creator": "contributor", "publisher": "manager", "owner": "contributor"})

    def test_your_organisation_keeps_the_recording_private_with_only_its_owner_in_the_group(self):
        media = self.import_from("folder", access(organisation=True))
        category = media.category.get()
        self.assertEqual(media.state, "private")
        self.assertTrue(category.is_rbac_category)
        self.assertEqual(list(RBACMembership.objects.filter(rbac_group__categories=category).values_list("user__username", flat=True)), ["owner"])

    @override_settings(USE_RBAC=False)
    def test_without_rbac_a_restricted_folder_is_a_plain_category(self):
        media = self.import_from("folder", access(principals=[{"type": "User", "id": "u2", "role": "Viewer"}]))
        self.assertFalse(media.category.get().is_rbac_category)
        self.service.refresh_from_db()
        self.assertIn("RBAC is off", self.service.log)

    def test_a_my_folder_recording_has_no_category_and_is_shared_with_the_folders_people(self):
        folder = access(principals=[{"type": "User", "id": "u3", "role": "Creator"}, {"type": "User", "id": "u1", "role": "Creator"}])
        session = access(principals=[{"type": "User", "id": "u2", "role": "Viewer"}, {"type": "Group", "id": "g-publishers", "role": "Publisher"}])
        media = self.import_from("personal", folder, session)

        shared = dict(MediaPermission.objects.filter(media=media).values_list("user__username", "permission"))
        self.assertEqual(media.state, "private")
        self.assertEqual(media.category.count(), 0)
        self.assertEqual(shared, {"creator": "editor", "viewer": "viewer", "publisher": "owner"})

    def test_a_group_whose_members_cannot_be_read_is_logged_and_the_rest_still_arrive(self):
        principals = [{"type": "Group", "id": "g-broken", "role": "Viewer"}, {"type": "User", "id": "u2", "role": "Viewer"}]
        with mock.patch.object(self.provider, "group_members", side_effect=PanoptoAPIError("GetUsersInGroup timed out")):
            media = self.import_from("folder", access(principals=principals))
        roles = dict(RBACMembership.objects.filter(rbac_group__categories=media.category.get()).values_list("user__username", "role"))
        self.assertEqual(roles, {"viewer": "member", "owner": "contributor"})
        self.service.refresh_from_db()
        self.assertIn("could not read the members of Panopto group g-broken", self.service.log)

    def test_a_folder_whose_group_could_not_be_read_fails_and_a_rerun_completes_it(self):
        self.provider.categories["f9"] = {"id": "f9", "name": "Department A", "fullName": "Department A", "parentName": "", "parentId": ""}
        self.provider.access["f9"] = access(principals=[{"type": "Group", "id": "g-publishers", "role": "Publisher"}, {"type": "User", "id": "u2", "role": "Viewer"}])

        with mock.patch.object(self.provider, "group_members", side_effect=PanoptoAPIError("timed out")):
            first = import_panopto_folder(self.service, self.provider, "f9")
        row = MigrationRecord.objects.get(service=self.service, object_type="category", source_id="f9")
        self.assertEqual(row.status, "failed")
        self.assertIn("g-publishers could not be read", row.log)

        again = import_panopto_folder(self.service, self.provider, "f9")
        roles = dict(RBACMembership.objects.filter(rbac_group__categories=again).values_list("user__username", "role"))
        self.assertEqual(again, first)
        self.assertEqual(roles, {"viewer": "member", "publisher": "manager"})
        self.assertEqual(MigrationRecord.objects.get(service=self.service, object_type="category", source_id="f9").status, "success")

    def test_viewer_with_link_grants_nothing(self):
        media = self.import_from("personal", access(), access(principals=[{"type": "User", "id": "u2", "role": "Viewer with Link"}]))
        self.assertFalse(MediaPermission.objects.filter(media=media).exists())

    def test_the_highest_role_wins_for_someone_named_twice(self):
        principals = [{"type": "User", "id": "u2", "role": "Viewer"}, {"type": "User", "id": "u2", "role": "Publisher"}]
        media = self.import_from("personal", access(principals=principals))
        self.assertEqual(MediaPermission.objects.get(media=media).permission, "owner")

    def test_a_panopto_administrator_becomes_a_superuser_and_a_videographer_an_editor(self):
        self.provider.users["u5"] = {"id": "u5", "username": "video", "email": "video@example.edu", "fullName": "Video", "role": "editor"}
        admin = import_panopto_user(self.service, self.provider, "u4")
        editor = import_panopto_user(self.service, self.provider, "u5")
        self.assertTrue(admin.is_superuser and admin.is_staff)
        self.assertTrue(editor.is_editor)
        self.assertFalse(editor.is_superuser)

    def test_a_folder_with_no_recordings_still_becomes_a_category(self):
        self.provider.categories["f9"] = {"id": "f9", "name": "Department A", "fullName": "Department A", "parentName": "", "parentId": ""}
        self.provider.access["f9"] = access(principals=[{"type": "Group", "id": "g-viewers", "role": "Viewer"}])
        category = import_panopto_folder(self.service, self.provider, "f9")
        self.assertTrue(category.is_rbac_category)
        self.assertEqual(list(RBACMembership.objects.filter(rbac_group__categories=category).values_list("user__username", "role")), [("viewer", "member")])


@override_settings(DO_NOT_TRANSCODE_VIDEO=True, USE_RBAC=True)
class TestPanoptoRecordingDetails(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        create_account(username="admin")
        self.provider = StubPanopto(
            sessions={"s1": a_session(tags=["biology", "week 1"], views=7)},
            users={"u1": {"id": "u1", "username": "jdoe", "email": "jdoe@example.edu", "fullName": "J Doe"}},
        )

    def test_tags_and_the_number_of_viewers_come_along(self):
        media = import_panopto_session(make_service(), self.provider, "s1")
        media.refresh_from_db()
        self.assertEqual(sorted(media.tags.values_list("title", flat=True)), ["biology", "week 1"])
        self.assertEqual(media.views, 7)

    def test_views_are_left_alone_when_not_wanted(self):
        media = import_panopto_session(make_service(preserve_views=False), self.provider, "s1")
        media.refresh_from_db()
        self.assertEqual(media.views, 1)

    def test_a_caption_keeps_its_language(self):
        self.provider.sessions["s1"]["captions"] = [{"language": "da", "url": "https://panopto.example.edu/GenerateSRT.ashx?language=Danish"}]
        media = import_panopto_session(make_service(), self.provider, "s1")
        subtitle = media.subtitles.get()
        self.assertEqual((subtitle.language.code, subtitle.language.title), ("da", "Danish"))

    def test_only_listed_owners_are_migrated_matched_by_email(self):
        listed = make_service(restrict_to_users=True, create_users=False, source_user_ids="JDoe@Example.edu")
        self.assertEqual(import_panopto_session(listed, self.provider, "s1").user.username, "jdoe")

    def test_an_owner_who_is_not_listed_is_skipped(self):
        listed = make_service(restrict_to_users=True, create_users=False, source_user_ids="someone@example.edu")
        self.assertIsNone(import_panopto_session(listed, self.provider, "s1"))
        record = MigrationRecord.objects.get(service=listed, object_type="media", source_id="s1")
        self.assertEqual(record.status, "skipped")

    def test_a_playlist_holds_the_recordings_this_migration_brought_over(self):
        service = make_service()
        media = import_panopto_session(service, self.provider, "s1")
        self.provider.playlists["pl1"] = {"id": "pl1", "name": "Featured", "description": "For the home page", "owner": {}, "entry_ids": ["s1", "not-migrated"]}
        playlist = import_panopto_playlist(service, self.provider, "pl1")
        self.assertEqual((playlist.title, playlist.description, playlist.user.username), ("Featured", "For the home page", "admin"))
        self.assertEqual(list(playlist.media.all()), [media])
        self.assertIn("1 not migrated: not-migrated", MigrationRecord.objects.get(service=service, object_type="playlist").log)
        self.assertEqual(import_panopto_playlist(service, self.provider, "pl1"), playlist)
        self.assertEqual(Playlist.objects.count(), 1)

    @override_settings(USE_LTI=True)
    def test_a_course_folder_is_wired_to_the_lti_platform_and_its_assignments_folder_is_not(self):
        platform = LTIPlatform.objects.create(
            name="Moodle",
            platform_id="https://moodle.example.edu",
            client_id="client",
            auth_login_url="https://moodle.example.edu/auth",
            auth_token_url="https://moodle.example.edu/token",
            key_set_url="https://moodle.example.edu/certs",
        )
        service = make_service(lti_platform_id=str(platform.pk))
        course_access = access(lms=True, lms_course_ids=["14"])
        self.provider.categories = {
            "course": {"id": "course", "name": "Biology", "fullName": "MoodleTrial-01>Biology", "parentName": "MoodleTrial-01", "parentId": "root"},
            "assignments": {"id": "assignments", "name": "Biology [assignments]", "fullName": "Biology>Biology [assignments]", "parentName": "Biology", "parentId": "course"},
        }
        self.provider.access = {"course": course_access, "assignments": course_access}
        self.provider.course_folders = {"course"}

        course = import_panopto_folder(service, self.provider, "course")
        assignments = import_panopto_folder(service, self.provider, "assignments")

        self.assertEqual((course.lti_platform, course.lti_context_id), (platform, "14"))
        self.assertIsNone(assignments.lti_platform)
        self.assertTrue(assignments.is_lms_course)
        link = LTIResourceLink.objects.get(platform=platform, context_id="14")
        self.assertEqual(link.category, course)
        self.assertEqual(list(course.rbac_groups.all()), [link.rbac_group])
