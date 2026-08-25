from django.test import Client, TestCase

from files.tests import create_account


class TestMigrationPages(TestCase):
    def setUp(self):
        self.password = "this_is_a_fake_password"
        self.admin = create_account(username="admin", password=self.password, is_superuser=True)
        self.editor = create_account(username="editor", password=self.password, is_editor=True)
        self.client = Client()

    def test_admin_sees_the_list_page(self):
        self.client.login(username="admin", password=self.password)
        response = self.client.get("/migrations")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "page-migrations")

    def test_new_migration_asks_which_source_first(self):
        """/migrations/new picks a platform. It must not open a form for one."""
        self.client.login(username="admin", password=self.password)
        response = self.client.get("/migrations/new")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "page-migration-new")
        self.assertNotContains(response, "page-migration-edit")

    def test_each_source_has_its_own_page(self):
        self.client.login(username="admin", password=self.password)
        for source in ["kaltura", "panopto", "youtube"]:
            response = self.client.get(f"/migrations/new/{source}")
            self.assertEqual(response.status_code, 200, source)
            self.assertContains(response, "page-migration-edit")

    def test_an_unknown_source_goes_back_to_the_chooser(self):
        self.client.login(username="admin", password=self.password)
        response = self.client.get("/migrations/new/vimeo")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/migrations/new")

    def test_the_source_pages_are_admin_only(self):
        self.client.login(username="editor", password=self.password)
        self.assertEqual(self.client.get("/migrations/new").status_code, 302)
        self.assertEqual(self.client.get("/migrations/new/kaltura").status_code, 302)

    def test_admin_sees_the_edit_page_for_an_existing_migration(self):
        self.client.login(username="admin", password=self.password)
        response = self.client.get("/migrations/1/edit")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "page-migration-edit")

    def test_admin_sees_the_detail_page(self):
        self.client.login(username="admin", password=self.password)
        response = self.client.get("/migrations/1")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "page-migration-detail")

    def test_a_non_admin_is_redirected(self):
        self.client.login(username="editor", password=self.password)
        self.assertEqual(self.client.get("/migrations").status_code, 302)

    def test_anonymous_is_redirected_to_login(self):
        self.assertEqual(self.client.get("/migrations").status_code, 302)

    def test_the_migrations_url_is_exposed_to_admins_only(self):
        self.client.login(username="admin", password=self.password)
        self.assertContains(self.client.get("/"), "migrations:")
        self.client.logout()
        self.client.login(username="editor", password=self.password)
        self.assertNotContains(self.client.get("/"), "migrations:")
