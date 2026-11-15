import uuid

from django.test import TestCase

from files.tests import create_account, fixture_path
from users.models import Channel

PASSWORD = "pages_pass_4321"


def make_user(prefix, **kwargs):
    token = uuid.uuid4().hex[:10]
    return create_account(username=f"{prefix}_{token}", email=f"{prefix}_{token}@example.com", password=PASSWORD, **kwargs)


class UserProfilePagesTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user("owner")
        cls.contactable = make_user("contactable")
        cls.contactable.allow_contact = True
        cls.contactable.save()
        cls.visitor = make_user("visitor")
        cls.editor = make_user("editor", is_editor=True)
        cls.manager = make_user("manager", is_manager=True)

    def profile_urls(self, user):
        return [
            (f"/user/{user.username}", "cms/user.html"),
            (f"/user/{user.username}/", "cms/user.html"),
            (f"/user/{user.username}/playlists", "cms/user_playlists.html"),
            (f"/user/{user.username}/about", "cms/user_about.html"),
        ]

    def test_profile_pages_render_for_anonymous_visitors_without_edit_rights(self):
        for url, template in self.profile_urls(self.owner):
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200, url)
            self.assertTemplateUsed(response, template)
            self.assertEqual(response.context["user"], self.owner)
            self.assertFalse(response.context["CAN_EDIT"], url)
            self.assertFalse(response.context["CAN_DELETE"], url)
            self.assertFalse(response.context["SHOW_CONTACT_FORM"], url)

    def test_unknown_user_profile_redirects_to_members(self):
        for suffix in ("", "/playlists", "/about"):
            response = self.client.get(f"/user/no_such_user_here{suffix}")
            self.assertRedirects(response, "/members", fetch_redirect_response=False)

    def test_owner_can_edit_but_not_delete_own_profile(self):
        self.client.force_login(self.owner)
        for url, _ in self.profile_urls(self.owner):
            response = self.client.get(url)
            self.assertTrue(response.context["CAN_EDIT"], url)
            self.assertFalse(response.context["CAN_DELETE"], url)

    def test_other_user_cannot_edit_a_profile(self):
        self.client.force_login(self.visitor)
        self.assertFalse(self.client.get(f"/user/{self.owner.username}").context["CAN_EDIT"])

    def test_manager_can_edit_and_delete_any_profile(self):
        self.client.force_login(self.manager)
        for url, _ in self.profile_urls(self.owner):
            response = self.client.get(url)
            self.assertTrue(response.context["CAN_EDIT"], url)
            self.assertTrue(response.context["CAN_DELETE"], url)

    def test_contact_form_shown_when_user_allows_contact(self):
        for url, _ in self.profile_urls(self.contactable):
            self.assertTrue(self.client.get(url).context["SHOW_CONTACT_FORM"], url)

    def test_editor_always_sees_contact_form_but_cannot_edit(self):
        self.client.force_login(self.editor)
        response = self.client.get(f"/user/{self.owner.username}/about")
        self.assertTrue(response.context["SHOW_CONTACT_FORM"])
        self.assertFalse(response.context["CAN_EDIT"])


class SharedMediaPagesTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user("owner")
        cls.other = make_user("other")

    def test_owner_sees_own_shared_pages(self):
        self.client.force_login(self.owner)
        for suffix, template in (("shared_with_me", "cms/user_shared_with_me.html"), ("shared_by_me", "cms/user_shared_by_me.html")):
            response = self.client.get(f"/user/{self.owner.username}/{suffix}")
            self.assertEqual(response.status_code, 200)
            self.assertTemplateUsed(response, template)
            self.assertTrue(response.context["CAN_EDIT"])

    def test_other_users_and_anonymous_are_sent_home(self):
        for login in (self.other, None):
            if login:
                self.client.force_login(login)
            for suffix in ("shared_with_me", "shared_by_me"):
                response = self.client.get(f"/user/{self.owner.username}/{suffix}")
                self.assertRedirects(response, "/", fetch_redirect_response=False)
            self.client.logout()

    def test_unknown_user_is_sent_home(self):
        self.client.force_login(self.owner)
        self.assertRedirects(self.client.get("/user/no_such_user_here/shared_by_me"), "/", fetch_redirect_response=False)


class EditUserPageTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user("owner")
        cls.other = make_user("other")
        cls.manager = make_user("manager", is_manager=True)

    def url(self, user):
        return f"/user/{user.username}/edit"

    def test_anonymous_is_sent_to_login(self):
        response = self.client.get(self.url(self.owner))
        self.assertEqual(response.status_code, 302)
        self.assertIn("/accounts/login", response["Location"])
        self.assertIn(f"next=/user/{self.owner.username}/edit", response["Location"])

    def test_owner_gets_the_edit_form(self):
        self.client.force_login(self.owner)
        response = self.client.get(self.url(self.owner))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "cms/user_edit.html")
        self.assertTrue(response.context["is_author"])
        self.assertNotIn("is_manager", response.context["form"].fields)

    def test_other_user_is_sent_home(self):
        self.client.force_login(self.other)
        self.assertRedirects(self.client.get(self.url(self.owner)), "/", fetch_redirect_response=False)

    def test_unknown_user_is_sent_home(self):
        self.client.force_login(self.manager)
        self.assertRedirects(self.client.get("/user/no_such_user_here/edit"), "/", fetch_redirect_response=False)

    def test_manager_gets_the_edit_form_of_another_user_with_role_fields(self):
        self.client.force_login(self.manager)
        response = self.client.get(self.url(self.owner))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.context["is_author"])
        self.assertEqual(response.context["user"], self.owner)
        for field in ("advancedUser", "is_manager", "is_editor"):
            self.assertIn(field, response.context["form"].fields)

    def test_invalid_submission_re_renders_the_form(self):
        self.client.force_login(self.owner)
        response = self.client.post(self.url(self.owner), {"description": "no name given"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("name", response.context["form"].errors)


class ChannelPagesTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user("owner")
        cls.other = make_user("other")
        cls.manager = make_user("manager", is_manager=True)
        cls.channel = Channel.objects.get(user=cls.owner)

    def test_a_channel_page_shows_its_owners_profile(self):
        response = self.client.get(self.channel.get_absolute_url())
        self.assertRedirects(response, self.owner.get_absolute_url(), fetch_redirect_response=False)
        self.assertEqual(self.client.get(response["Location"]).status_code, 200)

    def test_an_unknown_channel_is_a_404(self):
        self.assertEqual(self.client.get("/channel/doesnotexist").status_code, 404)

    def test_owner_gets_the_channel_edit_form(self):
        self.client.force_login(self.owner)
        response = self.client.get(self.channel.edit_url)
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "cms/channel_edit.html")

    def test_only_the_owner_may_edit_the_channel(self):
        for user in (self.other, self.manager):
            self.client.force_login(user)
            self.assertRedirects(self.client.get(self.channel.edit_url), "/", fetch_redirect_response=False)

    def test_anonymous_is_sent_to_login_for_channel_edit(self):
        response = self.client.get(self.channel.edit_url)
        self.assertEqual(response.status_code, 302)
        self.assertIn("/accounts/login", response["Location"])

    def test_owner_uploads_a_banner(self):
        self.client.force_login(self.owner)
        with open(fixture_path("test_image.png"), "rb") as fp:
            response = self.client.post(self.channel.edit_url, {"banner_logo": fp})
        self.assertRedirects(response, self.owner.get_absolute_url(), fetch_redirect_response=False)
        channel = Channel.objects.get(pk=self.channel.pk)
        self.assertNotEqual(channel.banner_logo.name, "userlogos/banner.jpg")
        self.assertEqual((channel.banner_logo.width, channel.banner_logo.height), (900, 200))
        self.assertTrue(self.owner.banner_thumbnail_url().endswith(".jpg"))
