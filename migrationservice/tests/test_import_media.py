from unittest import mock

from django.test import TestCase

from files.models import Category, Encoding, Media
from files.tests import create_account
from migrationservice.models import MigrationRecord, MigrationService
from migrationservice.tasks import import_media_entry, pick_original_flavor
from migrationservice.tests.fakes import FakeProvider

VIDEO = "fixtures/small_video.mp4"
IMAGE = "fixtures/test_image.png"


def make_service(**options):
    defaults = {
        "create_users": True,
        "migrate_all_categories": True,
        "map_permissions": True,
        "import_captions": False,
        "preserve_views": True,
        "preserve_publish_state": True,
        "skip_transcoding": True,
        "fallback_username": "admin",
    }
    defaults.update(options)
    return MigrationService.objects.create(
        name="Kaltura production",
        provider="kaltura",
        connection={"service_url": "https://kaltura.example.edu", "partner_id": "342", "app_token_id": "atok", "app_token": "x", "kms_root_category": "MediaSpace"},
        options=defaults,
    )


def make_provider():
    provider = FakeProvider()
    provider.users = {"jdoe": {"id": "jdoe", "email": "jdoe@example.edu", "fullName": "J Doe", "screenName": "", "roleName": ""}}
    provider.categories = {
        "8812": {
            "id": "8812",
            "name": "Electronics",
            "fullName": "MediaSpace>site>galleries>Engineering>Electronics",
            "parentName": "Engineering",
            "privacy": 1,
            "owner": "",
            "members": [],
        }
    }
    provider.media = {
        "1_a": {
            "entry": {
                "id": "1_a",
                "name": "Circuit analysis lecture 4",
                "description": "Fourth lecture",
                "userId": "jdoe",
                "createdAt": 1683800000,
                "plays": 1204,
                "tags": "electronics, lecture",
                "displayInSearch": 3,
            },
            "flavors": [
                {"id": "source", "height": 1080, "fileExt": "mp4", "isOriginal": True, "status": 2},
                {"id": "flav720", "height": 720, "fileExt": "mp4", "isOriginal": False, "status": 2},
                {"id": "flav360", "height": 360, "fileExt": "mp4", "isOriginal": False, "status": 2},
            ],
            "captions": [],
            "categories": [{"id": "8812", "privacy": 1}],
        }
    }
    provider.downloads = {"source": VIDEO, "flav720": VIDEO, "flav360": VIDEO}
    return provider


class TestImportImageEntry(TestCase):
    """Kaltura builds no flavor assets for an image, so the file has to come off
    the entry itself. Before this, every image in a portal failed the migration.
    """

    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        create_account(username="admin")
        self.service = make_service()
        self.provider = make_provider()
        self.provider.media["1_img"] = {
            "entry": {
                "id": "1_img",
                "name": "lecture-poster.png",
                "description": "",
                "userId": "jdoe",
                "mediaType": 2,
                "downloadUrl": "https://vod.example.edu/p/1/sp/100/raw/entry_id/1_img/version/1",
                "duration": 0,
                "tags": "",
                "displayInSearch": 3,
            },
            "flavors": [],
            "captions": [],
            "categories": [{"id": "8812", "privacy": 1}],
        }
        self.provider.downloads["1_img"] = IMAGE

    def test_an_image_entry_is_imported_from_the_entry_file(self):
        media = import_media_entry(self.service, self.provider, "1_img")
        media.refresh_from_db()

        self.assertEqual(media.media_type, "image")
        self.assertEqual(media.title, "lecture-poster.png")
        self.assertTrue(media.media_file.name.endswith(".png"), media.media_file.name)
        self.assertIn(("download_entry", "1_img"), self.provider.calls)

    def test_an_image_is_recorded_as_migrated(self):
        media = import_media_entry(self.service, self.provider, "1_img")
        row = MigrationRecord.objects.get(service=self.service, object_type="media", source_id="1_img")
        self.assertEqual(row.status, "success")
        self.assertEqual(row.target_id, media.id)

    def test_an_image_gets_its_categories_and_state(self):
        media = import_media_entry(self.service, self.provider, "1_img")
        media.refresh_from_db()
        self.assertEqual(media.state, "public")
        self.assertEqual(media.category.count(), 1)

    def test_an_image_attaches_no_encodings(self):
        media = import_media_entry(self.service, self.provider, "1_img")
        self.assertEqual(Encoding.objects.filter(media=media).count(), 0)

    def test_an_entry_with_no_flavor_and_no_image_file_still_fails(self):
        # a live stream, or an entry still transcoding: there is nothing to fetch
        self.provider.media["1_live"] = {
            "entry": {"id": "1_live", "name": "Town hall", "userId": "jdoe", "mediaType": 1, "tags": ""},
            "flavors": [],
            "captions": [],
            "categories": [],
        }
        with self.assertRaises(ValueError):
            import_media_entry(self.service, self.provider, "1_live")


class TestPickOriginalFlavor(TestCase):
    def test_prefers_the_source_flavor(self):
        flavors = [{"id": "a", "height": 720, "fileExt": "mp4"}, {"id": "src", "height": 1080, "fileExt": "mp4", "isOriginal": True}]
        self.assertEqual(pick_original_flavor(flavors)["id"], "src")

    def test_falls_back_to_the_tallest_flavor(self):
        flavors = [{"id": "a", "height": 360, "fileExt": "mp4"}, {"id": "b", "height": 720, "fileExt": "mp4"}]
        self.assertEqual(pick_original_flavor(flavors)["id"], "b")

    def test_no_flavors_gives_none(self):
        self.assertIsNone(pick_original_flavor([]))


class TestImportMediaEntry(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        create_account(username="admin")
        self.service = make_service()
        self.provider = make_provider()

    def test_creates_the_media_with_its_metadata(self):
        media = import_media_entry(self.service, self.provider, "1_a")
        self.assertEqual(media.title, "Circuit analysis lecture 4")
        self.assertEqual(media.description, "Fourth lecture")
        self.assertEqual(media.user.email, "jdoe@example.edu")
        self.assertEqual(media.views, 1204)
        self.assertEqual(media.add_date.year, 2023)

    def test_public_category_makes_the_media_public(self):
        media = import_media_entry(self.service, self.provider, "1_a")
        self.assertEqual(media.state, "public")

    def test_no_categories_makes_the_media_private(self):
        self.provider.media["1_a"]["categories"] = []
        media = import_media_entry(self.service, self.provider, "1_a")
        self.assertEqual(media.state, "private")

    def test_tags_are_imported(self):
        media = import_media_entry(self.service, self.provider, "1_a")
        self.assertEqual(sorted(tag.title for tag in media.tags.all()), ["electronics", "lecture"])

    def test_the_category_is_created_and_linked(self):
        media = import_media_entry(self.service, self.provider, "1_a")
        self.assertEqual([category.title for category in media.category.all()], ["Electronics"])
        self.assertEqual(Category.objects.filter(title="Electronics").count(), 1)

    def test_flavors_become_encodings_on_active_profiles(self):
        media = import_media_entry(self.service, self.provider, "1_a")
        encodings = Encoding.objects.filter(media=media)
        self.assertEqual(encodings.count(), 2)
        self.assertEqual(sorted(encoding.profile.resolution for encoding in encodings), [360, 720])
        self.assertTrue(all(encoding.status == "success" for encoding in encodings))
        self.assertTrue(all(encoding.profile.active for encoding in encodings))

    def test_no_transcoding_tasks_are_queued(self):
        with mock.patch("files.tasks.encode_media") as encode:
            import_media_entry(self.service, self.provider, "1_a")
        encode.apply_async.assert_not_called()

    def test_hls_is_triggered_exactly_once(self):
        with mock.patch("files.tasks.create_hls") as create_hls:
            import_media_entry(self.service, self.provider, "1_a")
        self.assertEqual(create_hls.delay.call_count, 1)

    def test_encoding_status_ends_up_successful(self):
        media = import_media_entry(self.service, self.provider, "1_a")
        media.refresh_from_db()
        self.assertEqual(media.encoding_status, "success")
        self.assertTrue(media.listable)

    def test_a_mapping_record_is_written(self):
        media = import_media_entry(self.service, self.provider, "1_a")
        row = MigrationRecord.objects.get(service=self.service, object_type="media", source_id="1_a")
        self.assertEqual(row.target_id, media.id)
        self.assertEqual(row.status, "success")

    def test_the_original_file_is_used_when_no_flavor_survives(self):
        self.provider.media["1_a"]["flavors"] = [{"id": "source", "height": 1080, "fileExt": "mp4", "isOriginal": True, "status": 2}]
        media = import_media_entry(self.service, self.provider, "1_a")
        media.refresh_from_db()
        self.assertEqual(Encoding.objects.filter(media=media).count(), 1)
        self.assertEqual(media.encoding_status, "success")

    def test_missing_source_flavor_uses_the_tallest_one(self):
        self.provider.media["1_a"]["flavors"] = [
            {"id": "flav720", "height": 720, "fileExt": "mp4", "isOriginal": False, "status": 2},
            {"id": "flav360", "height": 360, "fileExt": "mp4", "isOriginal": False, "status": 2},
        ]
        media = import_media_entry(self.service, self.provider, "1_a")
        self.assertEqual(Media.objects.filter(id=media.id).count(), 1)
        self.assertIn(("download_flavor", "flav720"), self.provider.calls)

    def test_preserve_views_off_leaves_the_default(self):
        service = make_service(preserve_views=False)
        media = import_media_entry(service, self.provider, "1_a")
        self.assertNotEqual(media.views, 1204)

    def test_skip_transcoding_off_runs_normal_encoding(self):
        service = make_service(skip_transcoding=False)
        with mock.patch("files.tasks.encode_media") as encode:
            import_media_entry(service, self.provider, "1_a")
        self.assertTrue(encode.apply_async.called)

    def test_importing_the_same_entry_twice_reuses_the_media(self):
        first = import_media_entry(self.service, self.provider, "1_a")
        second = import_media_entry(self.service, self.provider, "1_a")
        self.assertEqual(first.id, second.id)
        self.assertEqual(Media.objects.count(), 1)

    def test_a_retry_after_a_crash_discards_the_half_built_media(self):
        from unittest import mock

        with mock.patch("migrationservice.tasks.apply_entry_metadata", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                import_media_entry(self.service, self.provider, "1_a")

        # the interrupted attempt left a traceable row, not an invisible orphan
        row = MigrationRecord.objects.get(service=self.service, object_type="media", source_id="1_a")
        self.assertEqual(row.status, "failed")
        self.assertIsNotNone(row.target_id)
        self.assertEqual(Media.objects.count(), 1)

        media = import_media_entry(self.service, self.provider, "1_a")
        self.assertEqual(Media.objects.count(), 1, "the retry left a duplicate behind")
        row.refresh_from_db()
        self.assertEqual(row.status, "success")
        self.assertEqual(row.target_id, media.id)

    def test_the_migrated_state_survives_the_encoding_step(self):
        media = import_media_entry(self.service, self.provider, "1_a")
        media.refresh_from_db()
        self.assertEqual(media.state, "public")
        self.assertTrue(media.listable)
        self.assertEqual(media.encoding_status, "success")

    def test_a_failure_inside_migrate_item_keeps_the_media_pointer(self):
        from unittest import mock

        from migrationservice.tasks import migrate_item

        with mock.patch("migrationservice.tasks.apply_entry_metadata", side_effect=RuntimeError("boom")):
            with mock.patch("migrationservice.tasks.get_provider", return_value=self.provider):
                self.service.status = "running"
                self.service.save(update_fields=["status"])
                migrate_item(self.service.pk, "media", "1_a")

        row = MigrationRecord.objects.get(service=self.service, object_type="media", source_id="1_a")
        self.assertEqual(row.status, "failed")
        self.assertIsNotNone(row.target_id, "the media pointer was wiped, orphaning the half built media")

    def test_a_sprite_written_while_importing_is_not_clobbered(self):
        """media_init dispatches produce_sprite_from_video, which saves media.sprites
        from a worker while the import is still attaching flavors. The import must not
        write its own stale, empty copy of that column back over it.
        """
        from migrationservice.tasks import attach_flavor_encodings as real_attach

        def attach_then_race(service, provider, media, *args, **kwargs):
            result = real_attach(service, provider, media, *args, **kwargs)
            # what the sprite worker does once ffmpeg and convert have finished
            Media.objects.filter(pk=media.pk).update(sprites="thumbnails/sprite.jpg")
            return result

        with mock.patch("migrationservice.tasks.attach_flavor_encodings", attach_then_race):
            media = import_media_entry(self.service, self.provider, "1_a")

        media.refresh_from_db()
        self.assertEqual(media.sprites, "thumbnails/sprite.jpg", "the import overwrote the sprite sheet")

    def test_importing_media_does_not_email_anyone(self):
        from unittest import mock

        with mock.patch("files.methods.notify_users") as notify:
            import_media_entry(self.service, self.provider, "1_a")
        notify.assert_not_called()


class TestCategoryScoping(TestCase):
    """An entry belongs to housekeeping categories like "<root>>private" as well as
    to real galleries. Only the configured roots may become MediaCMS categories,
    but every category still counts towards the derived publish state.
    """

    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        create_account(username="admin")
        self.service = make_service()
        self.service.connection["kms_root_category"] = "MediaSpace"
        self.provider = make_provider()
        self.provider.connection = {"kms_root_category": "MediaSpace"}
        self.provider.categories["8899"] = {
            "id": "8899",
            "name": "private",
            "fullName": "MediaSpace>private",
            "parentName": "MediaSpace",
            "privacy": 3,
        }
        self.provider.media["1_a"]["categories"] = [
            {"id": "8812", "privacy": 1, "fullName": "MediaSpace>site>galleries>Engineering>Electronics"},
            {"id": "8899", "privacy": 3, "fullName": "MediaSpace>private"},
        ]

    def test_only_categories_under_a_configured_root_are_created(self):
        from files.models import Category

        media = import_media_entry(self.service, self.provider, "1_a")
        titles = sorted(category.title for category in media.category.all())
        self.assertEqual(titles, ["Electronics"])
        self.assertFalse(Category.objects.filter(title="private").exists())

    def test_out_of_scope_categories_still_count_towards_the_publish_state(self):
        # the gallery is public, so the entry is public despite also being in
        # a members-only housekeeping category
        media = import_media_entry(self.service, self.provider, "1_a")
        media.refresh_from_db()
        self.assertEqual(media.state, "public")

    def test_an_entry_only_in_housekeeping_categories_is_not_public(self):
        self.provider.media["1_a"]["categories"] = [
            {"id": "8899", "privacy": 3, "fullName": "MediaSpace>private"},
        ]
        media = import_media_entry(self.service, self.provider, "1_a")
        media.refresh_from_db()
        self.assertEqual(media.state, "unlisted")
        self.assertEqual(media.category.count(), 0)
