from django.conf import settings
from django.test import TestCase, override_settings

from files.tests import create_account, fixture_path


class EditProfileFormTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = create_account(name="Before Edit")
        cls.other = create_account()
        cls.manager = create_account(is_manager=True)

    def url(self, user):
        return f"/user/{user.username}/edit"

    def test_owner_saves_name_description_and_notification_choice(self):
        self.client.force_login(self.user)
        response = self.client.post(self.url(self.user), {"name": "After <b>Edit</b>", "description": "New bio"})
        self.assertRedirects(response, self.user.get_absolute_url(), fetch_redirect_response=False)
        self.user.refresh_from_db()
        self.assertEqual(self.user.name, "After Edit")
        self.assertEqual(self.user.description, "New bio")
        self.assertFalse(self.user.notification_on_comments)

    def test_saved_values_show_up_in_the_api(self):
        self.client.force_login(self.user)
        self.client.post(self.url(self.user), {"name": "Api Visible", "description": "Seen via api", "notification_on_comments": "on"})
        data = self.client.get(f"/api/v1/users/{self.user.username}").json()
        self.assertEqual(data["name"], "Api Visible")
        self.assertEqual(data["description"], "Seen via api")
        self.user.refresh_from_db()
        self.assertTrue(self.user.notification_on_comments)

    def test_owner_uploads_a_new_logo(self):
        self.client.force_login(self.user)
        with open(fixture_path("test_image.png"), "rb") as fp:
            response = self.client.post(self.url(self.user), {"name": "With Logo", "logo": fp})
        self.assertEqual(response.status_code, 302)
        self.user.refresh_from_db()
        self.assertNotEqual(self.user.logo.name, "userlogos/user.jpg")
        self.assertEqual((self.user.logo.width, self.user.logo.height), (200, 200))
        self.assertEqual(self.user.thumbnail_url(), f"{settings.MEDIA_URL}{self.user.logo.name}")

    def test_plain_user_cannot_grant_themselves_roles(self):
        self.client.force_login(self.user)
        self.client.post(self.url(self.user), {"name": "Sneaky", "is_editor": "on", "is_manager": "on", "advancedUser": "on", "is_featured": "on", "is_approved": "on"})
        self.user.refresh_from_db()
        self.assertEqual(self.user.name, "Sneaky")
        self.assertFalse(self.user.is_editor)
        self.assertFalse(self.user.is_manager)
        self.assertFalse(self.user.advancedUser)
        self.assertFalse(self.user.is_featured)
        self.assertFalse(self.user.is_approved)

    def test_other_user_cannot_change_the_profile(self):
        self.client.force_login(self.other)
        response = self.client.post(self.url(self.user), {"name": "Defaced"})
        self.assertRedirects(response, "/", fetch_redirect_response=False)
        self.user.refresh_from_db()
        self.assertEqual(self.user.name, "Before Edit")

    def test_manager_edits_another_users_profile_and_roles(self):
        self.client.force_login(self.manager)
        response = self.client.post(self.url(self.user), {"name": "Promoted", "is_editor": "on", "advancedUser": "on"})
        self.assertRedirects(response, self.user.get_absolute_url(), fetch_redirect_response=False)
        self.user.refresh_from_db()
        self.assertEqual(self.user.name, "Promoted")
        self.assertTrue(self.user.is_editor)
        self.assertTrue(self.user.advancedUser)
        self.assertFalse(self.user.is_manager)

    @override_settings(USERS_NEEDS_TO_BE_APPROVED=True)
    def test_manager_approves_a_user_from_the_edit_page(self):
        self.client.force_login(self.manager)
        self.client.post(self.url(self.user), {"name": "Approved", "is_approved": "true"})
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_approved)
