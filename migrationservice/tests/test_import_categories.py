from django.test import TestCase, override_settings

from files.models import Category
from files.tests import create_account
from migrationservice.models import MigrationRecord, MigrationService
from migrationservice.tasks import import_category
from migrationservice.tests.fakes import FakeProvider
from rbac.models import RBACGroup, RBACMembership
from users.models import User


def make_service(**options):
    defaults = {"create_users": True, "migrate_all_categories": True, "fallback_username": "admin"}
    defaults.update(options)
    return MigrationService.objects.create(
        name="Kaltura production",
        provider="kaltura",
        connection={"service_url": "https://kaltura.example.edu", "partner_id": "342", "app_token_id": "atok", "app_token": "x"},
        options=defaults,
    )


class TestImportCategory(TestCase):
    def setUp(self):
        create_account(username="admin")
        self.service = make_service()
        self.provider = FakeProvider()
        self.provider.users = {
            "jdoe": {"id": "jdoe", "email": "jdoe@example.edu", "fullName": "J Doe", "screenName": "", "roleName": ""},
            "asmith": {"id": "asmith", "email": "asmith@example.edu", "fullName": "A Smith", "screenName": "", "roleName": ""},
        }
        self.provider.categories = {
            "8812": {
                "id": "8812",
                "name": "Electronics",
                "fullName": "MediaSpace>site>galleries>Engineering>1. Term>Electronics",
                "parentName": "1. Term",
                "privacy": 1,
                "owner": "jdoe",
                "members": [],
            },
            "8813": {
                "id": "8813",
                "name": "Electronics",
                "fullName": "MediaSpace>site>channels>Physics>Electronics",
                "parentName": "Physics",
                "privacy": 3,
                "owner": "jdoe",
                "members": [{"userId": "asmith", "permissionLevel": 3}],
            },
        }
        self.service.connection["kms_root_category"] = "MediaSpace"

    def test_creates_a_flat_category_with_the_path_as_description(self):
        category = import_category(self.service, self.provider, "8812")
        self.assertEqual(category.title, "Electronics")
        self.assertEqual(category.description, "Engineering: 1. Term: Electronics")
        self.assertTrue(category.is_global)

    def test_writes_a_mapping_record(self):
        category = import_category(self.service, self.provider, "8812")
        row = MigrationRecord.objects.get(service=self.service, object_type="category", source_id="8812")
        self.assertEqual(row.target_id, category.id)
        self.assertEqual(row.status, "success")

    def test_a_title_collision_appends_the_parent(self):
        import_category(self.service, self.provider, "8812")
        second = import_category(self.service, self.provider, "8813")
        self.assertEqual(second.title, "Electronics (Physics)")
        self.assertEqual(Category.objects.filter(title__startswith="Electronics").count(), 2)

    def test_a_public_category_is_plain_even_with_rbac_on(self):
        with override_settings(USE_RBAC=True):
            category = import_category(self.service, self.provider, "8812")
        self.assertFalse(category.is_rbac_category)
        self.assertEqual(RBACGroup.objects.filter(categories=category).count(), 0)

    def test_a_members_only_category_becomes_rbac_with_a_group(self):
        with override_settings(USE_RBAC=True):
            category = import_category(self.service, self.provider, "8813")
        self.assertTrue(category.is_rbac_category)
        group = RBACGroup.objects.get(categories=category)
        self.assertEqual(group.uid, f"{self.service.source_system}:category:8813")
        roles = dict(RBACMembership.objects.filter(rbac_group=group).values_list("user__username", "role"))
        # asmith is a plain member, jdoe manages it by owning it
        self.assertEqual(roles, {"asmith": "member", "jdoe": "manager"})

    def test_a_members_only_category_stays_plain_when_rbac_is_off(self):
        with override_settings(USE_RBAC=False):
            category = import_category(self.service, self.provider, "8813")
        self.assertFalse(category.is_rbac_category)
        self.assertEqual(RBACGroup.objects.count(), 0)
        self.assertEqual(RBACMembership.objects.count(), 0)

    def test_members_are_imported_even_when_users_are_not(self):
        # a membership is worthless without the account it points at, so the
        # members of a restricted category are created whatever the user options say
        service = make_service(migrate_all_users=False, create_users=False)
        with override_settings(USE_RBAC=True):
            category = import_category(service, self.provider, "8813")
        self.assertTrue(User.objects.filter(username="asmith").exists())
        self.assertEqual(RBACMembership.objects.filter(rbac_group__categories=category).count(), 2)

    def test_a_second_import_reuses_the_group_and_adds_no_duplicates(self):
        with override_settings(USE_RBAC=True):
            first = import_category(self.service, self.provider, "8813")
            MigrationRecord.objects.filter(service=self.service, object_type="category").delete()
            second = import_category(self.service, self.provider, "8813")
        # the record was dropped, so the category is built again, but the group is
        # keyed on the source id and must be the one that already exists
        self.assertNotEqual(first.id, second.id)
        self.assertEqual(RBACGroup.objects.count(), 1)
        self.assertEqual(RBACMembership.objects.count(), 2)

    def test_a_moderator_becomes_a_contributor(self):
        self.provider.categories["8813"]["members"] = [{"userId": "asmith", "permissionLevel": 1}]
        with override_settings(USE_RBAC=True):
            category = import_category(self.service, self.provider, "8813")
        membership = RBACMembership.objects.get(rbac_group__categories=category, user__username="asmith")
        self.assertEqual(membership.role, "contributor")

    def test_a_pending_member_is_not_given_access(self):
        self.provider.categories["8813"]["members"] = [{"userId": "asmith", "permissionLevel": 3, "status": 2}]
        with override_settings(USE_RBAC=True):
            category = import_category(self.service, self.provider, "8813")
        usernames = set(RBACMembership.objects.filter(rbac_group__categories=category).values_list("user__username", flat=True))
        self.assertEqual(usernames, {"jdoe"})

    def test_importing_twice_reuses_the_same_category(self):
        first = import_category(self.service, self.provider, "8812")
        second = import_category(self.service, self.provider, "8812")
        self.assertEqual(first.id, second.id)
        self.assertEqual(Category.objects.filter(title="Electronics").count(), 1)
