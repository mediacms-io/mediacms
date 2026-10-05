import uuid

from django.conf import settings
from django.test import TestCase
from rest_framework.test import APIClient

from files.models import Media
from files.tests import create_account, create_media
from users.models import User

PASSWORD = "roles_pass_31415"
NEW_PASSWORD = "Rq7!vNx2#kLp"
MANAGE_PAGES = ("/manage/users", "/manage/media", "/manage/comments")


class RolesTestBase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = create_account(password=PASSWORD, name="Content Owner")
        cls.plain = create_account(password=PASSWORD)
        cls.editor = create_account(password=PASSWORD, is_editor=True)
        cls.manager = create_account(password=PASSWORD, is_manager=True)
        cls.admin = create_account(password=PASSWORD, is_superuser=True)

    def setUp(self):
        self.api = APIClient()
        self.public_media = create_media(self.owner, title=f"public {uuid.uuid4().hex}", state="public")
        self.private_media = create_media(self.owner, title=f"private {uuid.uuid4().hex}", state="private")

    def as_user(self, user):
        self.api.force_authenticate(user)
        self.client.force_login(user)

    def media_url(self, media):
        return f"/api/v1/media/{media.friendly_token}"

    def review(self, media):
        return self.api.post(self.media_url(media), {"type": "review", "result": "true"}, format="multipart")


class PlainUserCannotTouchOthersTest(RolesTestBase):
    def setUp(self):
        super().setUp()
        self.as_user(self.plain)

    def test_cannot_delete_someone_elses_media(self):
        self.assertEqual(self.api.delete(self.media_url(self.public_media)).status_code, 401)
        self.assertTrue(Media.objects.filter(pk=self.public_media.pk).exists())

    def test_cannot_edit_someone_elses_media(self):
        response = self.api.put(self.media_url(self.public_media), {"title": "defaced"}, format="multipart")
        self.assertEqual(response.status_code, 401)
        self.public_media.refresh_from_db()
        self.assertNotEqual(self.public_media.title, "defaced")
        self.assertEqual(self.public_media.user, self.owner)

    def test_cannot_view_someone_elses_private_media(self):
        self.assertEqual(self.api.get(self.media_url(self.private_media)).status_code, 401)

    def test_cannot_review_media_even_their_own(self):
        own = create_media(self.plain, title=f"own {uuid.uuid4().hex}", state="public", is_reviewed=False)
        self.assertEqual(self.review(own).status_code, 400)
        own.refresh_from_db()
        self.assertFalse(own.is_reviewed)

    def test_cannot_edit_or_delete_another_user(self):
        self.assertEqual(self.api.post(f"/api/v1/users/{self.owner.username}", {"name": "x"}, format="multipart").status_code, 400)
        self.assertEqual(self.api.delete(f"/api/v1/users/{self.owner.username}").status_code, 400)
        self.assertRedirects(self.client.get(f"/user/{self.owner.username}/edit"), "/", fetch_redirect_response=False)
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.name, "Content Owner")

    def test_cannot_open_management_pages(self):
        for url in MANAGE_PAGES:
            self.assertRedirects(self.client.get(url), "/", fetch_redirect_response=False, msg_prefix=url)

    def test_can_manage_own_media(self):
        own = create_media(self.plain, title=f"own {uuid.uuid4().hex}", state="public")
        response = self.api.put(self.media_url(own), {"title": "renamed by owner"}, format="multipart")
        self.assertEqual(response.status_code, 201)
        own.refresh_from_db()
        self.assertEqual(own.title, "renamed by owner")
        self.assertEqual(self.api.delete(self.media_url(own)).status_code, 204)


class EditorPrivilegesTest(RolesTestBase):
    def setUp(self):
        super().setUp()
        self.as_user(self.editor)

    def test_can_view_someone_elses_private_media(self):
        self.assertEqual(self.api.get(self.media_url(self.private_media)).status_code, 200)

    def test_can_review_media(self):
        media = create_media(self.owner, title=f"pending {uuid.uuid4().hex}", state="public", is_reviewed=False)
        self.assertEqual(self.review(media).status_code, 201)
        media.refresh_from_db()
        self.assertTrue(media.is_reviewed)

    def test_can_delete_someone_elses_media(self):
        self.assertEqual(self.api.delete(self.media_url(self.public_media)).status_code, 204)
        self.assertFalse(Media.objects.filter(pk=self.public_media.pk).exists())

    def test_can_open_management_pages(self):
        for url in MANAGE_PAGES:
            self.assertEqual(self.client.get(url).status_code, 200, url)

    def test_cannot_manage_users(self):
        self.assertEqual(self.api.delete(f"/api/v1/users/{self.owner.username}").status_code, 400)
        self.assertEqual(self.api.put(f"/api/v1/users/{self.owner.username}", {"action": "approve_user"}, format="multipart").status_code, 400)
        self.assertRedirects(self.client.get(f"/user/{self.owner.username}/edit"), "/", fetch_redirect_response=False)
        self.assertEqual(self.api.post("/api/v1/users", {"username": "x_new_user", "password": NEW_PASSWORD, "email": "x@example.com", "name": "x"}, format="json").status_code, 403)
        self.assertTrue(User.objects.filter(pk=self.owner.pk).exists())

    def test_cannot_promote_themselves(self):
        self.client.post(f"/user/{self.editor.username}/edit", {"name": "Editor", "is_manager": "on"})
        self.editor.refresh_from_db()
        self.assertFalse(self.editor.is_manager)


class ManagerPrivilegesTest(RolesTestBase):
    def setUp(self):
        super().setUp()
        self.as_user(self.manager)

    def test_has_editor_privileges_on_media(self):
        self.assertEqual(self.api.get(self.media_url(self.private_media)).status_code, 200)
        self.assertEqual(self.api.delete(self.media_url(self.public_media)).status_code, 204)
        for url in MANAGE_PAGES:
            self.assertEqual(self.client.get(url).status_code, 200, url)

    def test_promotes_a_user_to_editor_who_then_gains_editor_powers(self):
        response = self.client.post(f"/user/{self.plain.username}/edit", {"name": "New Editor", "is_editor": "on"})
        self.assertEqual(response.status_code, 302)
        self.plain.refresh_from_db()
        self.assertTrue(self.plain.is_editor)

        self.client.force_login(self.plain)
        self.assertEqual(self.client.get("/manage/media").status_code, 200)

    def test_demotes_an_editor(self):
        self.client.post(f"/user/{self.editor.username}/edit", {"name": "Former Editor"})
        self.editor.refresh_from_db()
        self.assertFalse(self.editor.is_editor)

        self.client.force_login(self.editor)
        self.assertRedirects(self.client.get("/manage/media"), "/", fetch_redirect_response=False)

    def test_promotes_a_user_to_manager_who_can_then_delete_users(self):
        self.client.post(f"/user/{self.plain.username}/edit", {"name": "New Manager", "is_manager": "on"})
        self.plain.refresh_from_db()
        self.assertTrue(self.plain.is_manager)

        self.api.force_authenticate(self.plain)
        self.assertEqual(self.api.delete(f"/api/v1/users/{self.owner.username}").status_code, 204)

    def test_edits_and_deletes_other_users(self):
        self.assertEqual(self.api.post(f"/api/v1/users/{self.owner.username}", {"name": "Renamed by manager"}, format="multipart").status_code, 201)
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.name, "Renamed by manager")
        self.assertEqual(self.api.delete(f"/api/v1/users/{self.owner.username}").status_code, 204)
        self.assertFalse(User.objects.filter(pk=self.owner.pk).exists())

    def test_resets_a_plain_users_password_but_not_an_admins(self):
        self.assertEqual(self.api.put(f"/api/v1/users/{self.plain.username}", {"action": "change_password", "password": NEW_PASSWORD}, format="multipart").status_code, 200)
        self.assertEqual(self.api.put(f"/api/v1/users/{self.admin.username}", {"action": "change_password", "password": NEW_PASSWORD}, format="multipart").status_code, 403)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password(PASSWORD))

    def test_has_no_django_admin_access(self):
        response = self.client.get(f"/{settings.DJANGO_ADMIN_URL}")
        self.assertEqual(response.status_code, 302)
        self.assertIn("login", response["Location"])


class AdminPrivilegesTest(RolesTestBase):
    def setUp(self):
        super().setUp()
        self.as_user(self.admin)

    def test_has_manager_privileges(self):
        self.assertEqual(self.api.delete(self.media_url(self.public_media)).status_code, 204)
        self.assertEqual(self.api.delete(f"/api/v1/users/{self.plain.username}").status_code, 204)
        self.assertTrue(self.client.get(f"/user/{self.owner.username}").context["CAN_DELETE"])

    def test_resets_another_admins_password(self):
        other_admin = create_account(password=PASSWORD, is_superuser=True)
        self.assertEqual(self.api.put(f"/api/v1/users/{other_admin.username}", {"action": "change_password", "password": NEW_PASSWORD}, format="multipart").status_code, 200)
        other_admin.refresh_from_db()
        self.assertTrue(other_admin.check_password(NEW_PASSWORD))

    def test_opens_the_django_admin(self):
        self.assertEqual(self.client.get(f"/{settings.DJANGO_ADMIN_URL}").status_code, 200)

    def test_grants_manager_role_through_the_edit_page(self):
        self.client.post(f"/user/{self.plain.username}/edit", {"name": "Admin Made Manager", "is_manager": "on"})
        self.plain.refresh_from_db()
        self.assertTrue(self.plain.is_manager)
