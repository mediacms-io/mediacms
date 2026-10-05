import os
import shutil
from unittest import mock

from django.test import TestCase, override_settings

from files.models import Category, Encoding, Media
from files.tests import create_account
from migrationservice.models import MigrationRecord, MigrationService
from migrationservice.providers.panopto import PanoptoProvider
from migrationservice.providers.youtube import YouTubeProvider
from migrationservice.tasks import (
    get_or_import_panopto_folder,
    import_group,
    import_panopto_user,
    import_youtube_video,
    resolve_panopto_owner,
    unique_panopto_title,
)
from migrationservice.tests.fakes import FakeProvider
from rbac.models import RBACGroup, RBACMembership
from users.models import User

VIDEO = "fixtures/small_video.mp4"

VTT = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nhello\n"


class StubYouTube(YouTubeProvider):
    def __init__(self, videos, heights=(720, 480), **options):
        defaults = {"fallback_username": "admin", "import_captions": True, "skip_transcoding": True}
        defaults.update(options)
        super().__init__({"sources": ",".join(videos)}, defaults)
        self.videos = videos
        self.heights = heights
        self.wanted = []
        self.cleaned = 0
        self.downloaded = []

    def fetch_media(self, source_id):
        return self.videos[source_id]

    def download_renditions(self, source_id, dest_dir, wanted_heights):
        self.wanted.append(list(wanted_heights))
        produced = []
        for height in self.heights:
            path = os.path.join(dest_dir, f"{source_id}-{height}.mp4")
            shutil.copyfile(VIDEO, path)
            produced.append((path, height))
        return produced

    def download(self, url, dest_path):
        self.downloaded.append(url)
        if "broken" in url:
            raise RuntimeError("HTTP Error 404")
        with open(dest_path, "w") as out:
            out.write(VTT)
        return len(VTT)

    def cleanup(self):
        self.cleaned += 1


def a_video(source_id="abcdefghijk", **extra):
    payload = {
        "id": source_id,
        "title": "Lecture one",
        "description": "the first",
        "tags": ["biology", "cell.bio", "!!!"],
        "views": 321,
        "duration": 27,
        "captions": [],
    }
    payload.update(extra)
    return payload


def make_youtube_service(**options):
    defaults = {"fallback_username": "admin", "import_captions": True, "skip_transcoding": True}
    defaults.update(options)
    return MigrationService.objects.create(name="YouTube", provider="youtube", connection={"sources": "abcdefghijk"}, options=defaults)


class TestImportYouTubeVideo(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        self.admin = create_account(username="admin")
        finalise = mock.patch("migrationservice.tasks.finalise_encodings")
        preview = mock.patch("migrationservice.tasks.ensure_preview")
        self.finalise = finalise.start()
        self.preview = preview.start()
        self.addCleanup(finalise.stop)
        self.addCleanup(preview.stop)

    def test_the_video_arrives_with_its_metadata_and_owner(self):
        service = make_youtube_service()
        provider = StubYouTube({"abcdefghijk": a_video()})
        media = import_youtube_video(service, provider, "abcdefghijk")
        media.refresh_from_db()

        self.assertEqual(media.title, "Lecture one")
        self.assertEqual(media.description, "the first")
        self.assertEqual(media.user, self.admin)
        self.assertEqual(sorted(media.tags.values_list("title", flat=True)), ["biology", "cellbio"])
        record = MigrationRecord.objects.get(service=service, object_type="media", source_id="abcdefghijk")
        self.assertEqual((record.status, record.target_id), ("success", media.id))
        self.assertEqual(provider.cleaned, 1)

    def test_every_profile_size_is_asked_for_and_each_rendition_filed_untouched(self):
        service = make_youtube_service()
        provider = StubYouTube({"abcdefghijk": a_video()}, heights=(720, 500, 480))
        media = import_youtube_video(service, provider, "abcdefghijk")

        self.assertEqual(provider.wanted, [[1080, 720, 480, 360, 240, 144]])
        self.assertEqual(sorted(Encoding.objects.filter(media=media).values_list("profile__name", flat=True)), ["h264-480", "h264-720"])
        self.assertEqual(media.encoding_status, "success")
        self.finalise.assert_called_once()
        self.preview.assert_called_once_with(media)
        self.assertIn("filed 720p as h264-720, 500p as h264-480, nothing transcoded", MigrationService.objects.get(pk=service.pk).log)

    def test_a_rendition_smaller_than_every_profile_is_left_to_encode(self):
        service = make_youtube_service()
        provider = StubYouTube({"abcdefghijk": a_video()}, heights=(100,))
        with mock.patch.object(Media, "encode") as encode:
            media = import_youtube_video(service, provider, "abcdefghijk")

        encode.assert_called_once_with(chunkize=False)
        self.assertFalse(Encoding.objects.filter(media=media).exists())
        self.finalise.assert_not_called()
        self.assertIn("no profile at or below 100p, leaving it to encode", MigrationService.objects.get(pk=service.pk).log)

    @override_settings(DO_NOT_TRANSCODE_VIDEO=True)
    def test_with_transcoding_on_only_the_best_file_is_fetched(self):
        service = make_youtube_service(skip_transcoding=False)
        provider = StubYouTube({"abcdefghijk": a_video()})
        media = import_youtube_video(service, provider, "abcdefghijk")

        self.assertEqual(provider.wanted, [[]])
        self.assertFalse(Encoding.objects.filter(media=media).exists())
        self.preview.assert_not_called()

    def test_views_are_carried_when_asked(self):
        service = make_youtube_service(preserve_views=True)
        media = import_youtube_video(service, StubYouTube({"abcdefghijk": a_video()}), "abcdefghijk")
        media.refresh_from_db()
        self.assertEqual(media.views, 321)

    def test_the_english_caption_is_attached_as_webvtt(self):
        service = make_youtube_service()
        provider = StubYouTube({"abcdefghijk": a_video(captions=[{"language": "en", "url": "https://yt.example/en.vtt"}])})
        media = import_youtube_video(service, provider, "abcdefghijk")

        subtitle = media.subtitles.get()
        self.assertEqual(subtitle.language.code, "en")
        self.assertTrue(subtitle.subtitle_file.name.endswith(".vtt"))
        self.assertEqual(provider.downloaded, ["https://yt.example/en.vtt"])
        self.assertTrue(MigrationRecord.objects.filter(service=service, object_type="caption", status="success").exists())

    def test_a_caption_that_fails_does_not_cost_the_video(self):
        service = make_youtube_service()
        provider = StubYouTube({"abcdefghijk": a_video(captions=[{"url": "https://yt.example/broken.vtt"}])})
        media = import_youtube_video(service, provider, "abcdefghijk")

        self.assertEqual(media.subtitles.count(), 0)
        self.assertIn("en caption failed: HTTP Error 404", MigrationService.objects.get(pk=service.pk).log)
        self.assertEqual(MigrationRecord.objects.get(service=service, source_id="abcdefghijk").status, "success")

    def test_a_video_already_imported_is_not_fetched_again(self):
        service = make_youtube_service()
        provider = StubYouTube({"abcdefghijk": a_video()})
        first = import_youtube_video(service, provider, "abcdefghijk")
        again = import_youtube_video(service, provider, "abcdefghijk")

        self.assertEqual(again, first)
        self.assertEqual(len(provider.wanted), 1)
        self.assertEqual(Media.objects.count(), 1)

    def test_a_half_built_video_from_a_crash_is_discarded(self):
        service = make_youtube_service()
        provider = StubYouTube({"abcdefghijk": a_video()})
        first = import_youtube_video(service, provider, "abcdefghijk")
        MigrationRecord.objects.filter(service=service, source_id="abcdefghijk").update(status="failed")

        again = import_youtube_video(service, provider, "abcdefghijk")
        self.assertNotEqual(again.pk, first.pk)
        self.assertFalse(Media.objects.filter(pk=first.pk).exists())
        self.assertIn("discarding an incomplete media", MigrationService.objects.get(pk=service.pk).log)

    def test_the_cookie_file_is_cleaned_up_even_when_the_download_fails(self):
        service = make_youtube_service()
        provider = StubYouTube({"abcdefghijk": a_video()})
        with mock.patch.object(provider, "download_renditions", side_effect=RuntimeError("no h264 stream")):
            with self.assertRaises(RuntimeError):
                import_youtube_video(service, provider, "abcdefghijk")
        self.assertEqual(provider.cleaned, 1)
        self.assertFalse(Media.objects.exists())


PANOPTO_CONNECTION = {"service_url": "https://yourorg.cloud.panopto.eu", "client_id": "c", "client_secret": "s", "username": "svc", "password": "pw"}


class PanoptoUsers(PanoptoProvider):
    def __init__(self, users):
        super().__init__(PANOPTO_CONNECTION, {})
        self.users = users

    def fetch_user(self, source_id):
        return self.users[source_id]


def make_panopto_service(name="Panopto", **options):
    defaults = {"create_users": True, "fallback_username": "admin", "source_category_ids": "root"}
    defaults.update(options)
    return MigrationService.objects.create(name=name, provider="panopto", connection=PANOPTO_CONNECTION, options=defaults)


class TestImportPanoptoUser(TestCase):
    def setUp(self):
        self.service = make_panopto_service()
        self.provider = PanoptoUsers(
            {
                "u1": {"id": "u1", "username": "jdoe@example.edu", "email": "JDoe@Example.edu ", "fullName": "J Doe"},
                "u2": {"id": "u2", "username": "asmith", "email": "", "fullName": ""},
                "u3": {"id": "u3", "username": "", "email": "", "fullName": "No Name"},
            }
        )

    def test_a_new_account_is_created_without_a_usable_password(self):
        user = import_panopto_user(self.service, self.provider, "u1")
        self.assertEqual((user.username, user.email, user.name), ("jdoe@example.edu", "JDoe@Example.edu", "J Doe"))
        self.assertFalse(user.has_usable_password())
        self.assertEqual(MigrationRecord.objects.get(service=self.service, object_type="user", source_id="u1").log, "created jdoe@example.edu")

    def test_an_account_with_the_same_email_is_linked(self):
        existing = create_account(username="janedoe", email="jdoe@example.edu")
        self.assertEqual(import_panopto_user(self.service, self.provider, "u1"), existing)
        self.assertIn("linked to existing user", MigrationRecord.objects.get(service=self.service, source_id="u1").log)

    def test_an_account_with_the_same_name_and_no_email_is_linked(self):
        existing = User.objects.create(username="asmith", email="")
        self.assertEqual(import_panopto_user(self.service, self.provider, "u2"), existing)

    def test_an_account_with_the_same_name_and_its_own_email_is_someone_else(self):
        create_account(username="asmith", email="a.smith@elsewhere.edu")
        user = import_panopto_user(self.service, self.provider, "u2")
        self.assertEqual(user.username, "asmith-2")

    def test_a_name_already_claimed_by_another_source_user_is_not_reused(self):
        existing = User.objects.create(username="asmith", email="")
        MigrationRecord.objects.create(service=self.service, object_type="user", source_id="someone-else", status="success", target_id=existing.pk)
        user = import_panopto_user(self.service, self.provider, "u2")
        self.assertNotEqual(user, existing)
        self.assertEqual(user.username, "asmith-2")

    def test_a_user_with_no_username_is_named_after_its_id(self):
        user = import_panopto_user(self.service, self.provider, "u3")
        self.assertEqual((user.username, user.name), ("u3", "No Name"))

    def test_an_owner_that_cannot_be_fetched_falls_back(self):
        admin = create_account(username="admin")
        self.assertEqual(resolve_panopto_owner(self.service, self.provider, {"id": "missing"}), admin)
        self.assertEqual(resolve_panopto_owner(self.service, self.provider, {}), admin)

    def test_with_user_creation_off_nobody_is_fetched(self):
        admin = create_account(username="admin")
        service = make_panopto_service(name="no users", create_users=False)
        with mock.patch.object(self.provider, "fetch_user") as fetched:
            self.assertEqual(resolve_panopto_owner(service, self.provider, {"id": "u1"}), admin)
        fetched.assert_not_called()


class TestPanoptoFolders(TestCase):
    def setUp(self):
        self.service = make_panopto_service()
        self.provider = PanoptoUsers({})

    def test_a_title_free_of_collisions_is_kept(self):
        self.assertEqual(unique_panopto_title("Biology", "Courses", {"Physics"}), "Biology")

    def test_collisions_fall_back_to_a_counter(self):
        taken = {"My Folder", "My Folder (jdoe)", "My Folder (2)"}
        self.assertEqual(unique_panopto_title("My Folder", "jdoe", taken), "My Folder (3)")
        self.assertEqual(unique_panopto_title("My Folder", "", {"My Folder"}), "My Folder (2)")

    def test_a_folder_with_no_id_is_no_category(self):
        self.assertIsNone(get_or_import_panopto_folder(self.service, self.provider, {}))

    def test_a_category_already_holding_the_folder_guid_is_reused(self):
        existing = Category.objects.create(title="Hand made", uid="0f8e2c94-panopto-guid")
        category = get_or_import_panopto_folder(self.service, self.provider, {"id": "0f8e2c94-panopto-guid", "name": "Biology"})
        self.assertEqual(category, existing)
        self.assertIn("reused existing category Hand made", MigrationRecord.objects.get(service=self.service, object_type="category").log)

    def test_a_category_deleted_since_is_created_again(self):
        first = get_or_import_panopto_folder(self.service, self.provider, {"id": "f-gone", "name": "Biology"})
        first.delete()
        again = get_or_import_panopto_folder(self.service, self.provider, {"id": "f-gone", "name": "Biology"})
        self.assertNotEqual(again.pk, first.pk)
        self.assertEqual(again.uid, "f-gone")


class GroupProvider(FakeProvider):
    def __init__(self, groups):
        super().__init__()
        self.groups = groups

    def fetch_group(self, source_id):
        return self.groups[source_id]


def make_kaltura_service():
    return MigrationService.objects.create(
        name="Kaltura production",
        provider="kaltura",
        connection={"service_url": "https://kaltura.example.edu", "partner_id": "342", "app_token_id": "atok", "app_token": "x"},
        options={"create_users": True},
    )


class TestImportGroup(TestCase):
    def setUp(self):
        self.service = make_kaltura_service()
        self.provider = GroupProvider(
            {
                "staff": {
                    "id": "staff",
                    "name": "Staff",
                    "description": "everybody employed",
                    "members": [{"userId": "jdoe", "role": "member"}, {"userId": "ghost", "role": "member"}, {"userId": "jdoe", "role": "manager"}],
                }
            }
        )
        self.provider.users = {"jdoe": {"id": "jdoe", "email": "jdoe@example.edu", "fullName": "J Doe", "screenName": "", "roleName": ""}}

    @override_settings(USE_RBAC=False)
    def test_without_rbac_a_group_is_skipped(self):
        self.assertIsNone(import_group(self.service, self.provider, "staff"))
        self.assertEqual(MigrationRecord.objects.get(service=self.service, object_type="group").status, "skipped")
        self.assertFalse(RBACGroup.objects.exists())

    @override_settings(USE_RBAC=True)
    def test_a_group_becomes_an_rbac_group_with_its_members(self):
        group = import_group(self.service, self.provider, "staff")

        self.assertEqual((group.name, group.description), ("Staff", "everybody employed"))
        self.assertEqual(list(RBACMembership.objects.filter(rbac_group=group).values_list("user__email", "role")), [("jdoe@example.edu", "member")])
        self.assertIn("could not import member ghost", MigrationService.objects.get(pk=self.service.pk).log)
        self.assertEqual(MigrationRecord.objects.get(service=self.service, object_type="group").log, "created group Staff with 1 member(s)")

    @override_settings(USE_RBAC=True)
    def test_a_rerun_lands_on_the_same_group(self):
        first = import_group(self.service, self.provider, "staff")
        again = import_group(self.service, self.provider, "staff")
        self.assertEqual(first, again)
        self.assertEqual(RBACMembership.objects.filter(rbac_group=first).count(), 1)

    @override_settings(USE_RBAC=True)
    def test_a_name_taken_by_another_group_is_suffixed(self):
        RBACGroup.objects.create(uid="local-staff", name="Staff")
        self.assertEqual(import_group(self.service, self.provider, "staff").name, "Staff (2)")
