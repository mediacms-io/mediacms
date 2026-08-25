from django.test import TestCase

from files.tests import create_account
from migrationservice.models import MigrationRecord, MigrationService
from migrationservice.tasks import import_user, resolve_owner
from migrationservice.tests.fakes import FakeProvider
from users.models import User


def make_service(**options):
    return MigrationService.objects.create(
        name="Kaltura production",
        provider="kaltura",
        connection={"service_url": "https://kaltura.example.edu", "partner_id": "342", "app_token_id": "atok", "app_token": "x"},
        options=options,
    )


class TestImportUser(TestCase):
    def setUp(self):
        self.service = make_service(create_users=True)
        self.provider = FakeProvider()
        self.provider.users = {
            "jdoe": {"id": "jdoe", "email": "jdoe@example.edu", "fullName": "J Doe", "screenName": "jdoe", "roleName": "adminRole"},
            "cn=Ann Smith,ou=staff": {"id": "cn=Ann Smith,ou=staff", "email": "", "fullName": "Ann Smith", "screenName": "", "roleName": "viewerRole"},
        }

    def test_creates_a_user_and_a_record(self):
        user = import_user(self.service, self.provider, "jdoe")
        self.assertEqual(user.email, "jdoe@example.edu")
        self.assertEqual(user.name, "J Doe")
        record = MigrationRecord.objects.get(service=self.service, object_type="user", source_id="jdoe")
        self.assertEqual(record.status, "success")
        self.assertEqual(record.target_id, user.id)

    def test_applies_the_mapped_role(self):
        user = import_user(self.service, self.provider, "jdoe")
        user.refresh_from_db()
        self.assertTrue(user.advancedUser)
        self.assertFalse(user.is_superuser)
        self.assertFalse(user.is_staff)

    def test_a_plain_role_leaves_permissions_untouched(self):
        user = import_user(self.service, self.provider, "cn=Ann Smith,ou=staff")
        user.refresh_from_db()
        self.assertFalse(user.advancedUser)
        self.assertFalse(user.is_editor)
        self.assertFalse(user.is_manager)

    def test_invalid_characters_are_sanitised_out_of_the_username(self):
        user = import_user(self.service, self.provider, "cn=Ann Smith,ou=staff")
        self.assertEqual(user.username, "cn-Ann-Smith-ou-staff")

    def test_an_existing_user_is_linked_by_email_not_duplicated(self):
        existing = create_account(email="jdoe@example.edu")
        user = import_user(self.service, self.provider, "jdoe")
        self.assertEqual(user.id, existing.id)
        self.assertEqual(User.objects.filter(email="jdoe@example.edu").count(), 1)

    def test_a_username_collision_gets_a_suffix(self):
        create_account(username="jdoe", email="someone.else@example.edu")
        self.provider.users["jdoe"]["email"] = ""
        user = import_user(self.service, self.provider, "jdoe")
        self.assertEqual(user.username, "jdoe-2")

    def test_importing_twice_returns_the_same_user(self):
        first = import_user(self.service, self.provider, "jdoe")
        second = import_user(self.service, self.provider, "jdoe")
        self.assertEqual(first.id, second.id)
        self.assertEqual(User.objects.filter(email="jdoe@example.edu").count(), 1)

    def test_a_linked_pre_existing_account_does_not_get_a_kaltura_role(self):
        # roles apply only to accounts this migration created: elevating someone
        # who already had a local account is not the migration's business
        existing = create_account(email="jdoe@example.edu")
        self.provider.users["jdoe"]["roleName"] = "partnerAdminRole"

        user = import_user(self.service, self.provider, "jdoe")

        self.assertEqual(user.id, existing.id)
        user.refresh_from_db()
        self.assertFalse(user.is_manager)

    def test_linking_to_an_existing_user_never_strips_their_privileges(self):
        # set_role_from_mapping resets every permission flag when handed an
        # unmapped value, so an unmapped Kaltura role must not reach it
        existing = create_account(email="jdoe@example.edu")
        existing.advancedUser = True
        existing.is_editor = True
        existing.save()

        self.provider.users["jdoe"]["roleName"] = "someUnmappedRole"
        user = import_user(self.service, self.provider, "jdoe")

        self.assertEqual(user.id, existing.id)
        user.refresh_from_db()
        self.assertTrue(user.advancedUser)
        self.assertTrue(user.is_editor)

    def test_importing_a_user_does_not_email_the_admins(self):
        from unittest import mock

        with mock.patch("users.models.EmailMessage") as email:
            import_user(self.service, self.provider, "jdoe")
        email.assert_not_called()

    def test_an_import_never_grants_superuser_or_staff(self):
        for role in ["viewerRole", "adminRole", "unmoderatedAdminRole", "partnerAdminRole"]:
            self.provider.users["jdoe"]["roleName"] = role
            User.objects.filter(email="jdoe@example.edu").delete()
            MigrationRecord.objects.filter(service=self.service, object_type="user").delete()
            user = import_user(self.service, self.provider, "jdoe")
            user.refresh_from_db()
            self.assertFalse(user.is_superuser, f"{role} granted is_superuser")
            self.assertFalse(user.is_staff, f"{role} granted is_staff")

    def test_two_emailless_source_users_do_not_share_one_account(self):
        # "a!user" and "a#user" both sanitise to "a-user": the spec's own
        # "a.user" / "a=user" pair does not collide because "." is a
        # permitted username character and survives sanitisation unchanged.
        self.provider.users["a!user"] = {
            "id": "a!user",
            "email": "",
            "fullName": "A User",
            "screenName": "",
            "roleName": "",
        }
        self.provider.users["a#user"] = {
            "id": "a#user",
            "email": "",
            "fullName": "Different Person",
            "screenName": "",
            "roleName": "",
        }
        first = import_user(self.service, self.provider, "a!user")
        second = import_user(self.service, self.provider, "a#user")
        self.assertNotEqual(first.id, second.id)


class TestResolveOwner(TestCase):
    def setUp(self):
        self.provider = FakeProvider()
        self.provider.users = {"jdoe": {"id": "jdoe", "email": "jdoe@example.edu", "fullName": "J Doe", "screenName": "", "roleName": ""}}

    def test_create_users_on_returns_the_imported_user(self):
        service = make_service(create_users=True)
        owner = resolve_owner(service, self.provider, "jdoe")
        self.assertEqual(owner.email, "jdoe@example.edu")

    def test_create_users_off_returns_the_fallback(self):
        fallback = create_account(username="admin")
        service = make_service(create_users=False, fallback_username="admin")
        owner = resolve_owner(service, self.provider, "jdoe")
        self.assertEqual(owner.id, fallback.id)

    def test_unknown_source_user_falls_back(self):
        fallback = create_account(username="admin")
        service = make_service(create_users=True, fallback_username="admin")
        owner = resolve_owner(service, self.provider, "ghost")
        self.assertEqual(owner.id, fallback.id)

    def test_a_missing_fallback_user_raises(self):
        service = make_service(create_users=False, fallback_username="nobody")
        with self.assertRaises(ValueError):
            resolve_owner(service, self.provider, "jdoe")


class TestOnlyMediaOwnersAreCreated(TestCase):
    """Users are created only for the owner of an imported media.

    There is exactly one path to User(): import_media_entry -> resolve_owner ->
    import_user. Nothing enumerates the source directory, so an account that owns
    no media is never touched.
    """

    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        self.fallback = create_account(username="admin")
        self.service = make_service(create_users=True, fallback_username="admin")

        self.provider = FakeProvider()
        # a directory of five, only one of which owns anything
        for name in ["owner", "bystander1", "bystander2", "Guest", "__kms_logo_upload_user__"]:
            self.provider.users[name] = {
                "id": name,
                "email": f"{name}@example.edu",
                "fullName": name,
                "screenName": "",
                "roleName": "",
            }
        self.provider.media = {
            "1_a": {
                "entry": {"id": "1_a", "name": "Lecture", "userId": "owner", "tags": ""},
                "flavors": [{"id": "src", "height": 720, "fileExt": "mp4", "isOriginal": True, "status": 2}],
                "captions": [],
                "categories": [],
            }
        }
        self.provider.downloads = {"src": "fixtures/small_video.mp4"}

    def test_only_the_media_owner_is_created(self):
        from migrationservice.tasks import import_media_entry

        before = set(User.objects.values_list("username", flat=True))
        import_media_entry(self.service, self.provider, "1_a")
        created = set(User.objects.values_list("username", flat=True)) - before

        self.assertEqual(created, {"owner"}, "a user with no media was created")

    def test_the_directory_is_never_enumerated(self):
        from migrationservice.tasks import import_media_entry

        import_media_entry(self.service, self.provider, "1_a")
        fetched = [source_id for call, source_id in self.provider.calls if call == "fetch_user"]
        self.assertEqual(fetched, ["owner"], "more than the owner was looked up")

    def test_with_create_users_off_nobody_is_created_and_nobody_is_looked_up(self):
        from migrationservice.tasks import import_media_entry

        service = make_service(create_users=False, fallback_username="admin")
        before = User.objects.count()

        media = import_media_entry(service, self.provider, "1_a")

        self.assertEqual(User.objects.count(), before)
        self.assertEqual(media.user_id, self.fallback.id)
        self.assertEqual([c for c in self.provider.calls if c[0] == "fetch_user"], [])

    def test_a_user_record_is_only_written_for_the_owner(self):
        from migrationservice.tasks import import_media_entry

        import_media_entry(self.service, self.provider, "1_a")
        rows = MigrationRecord.objects.filter(service=self.service, object_type="user")
        self.assertEqual([row.source_id for row in rows], ["owner"])
