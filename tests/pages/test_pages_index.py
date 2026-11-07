import re

from django.test import TestCase, override_settings

from files.tests import create_account

PUBLIC_LINKS = {
    "home": "/",
    "search": "/search",
    "latestMedia": "/latest",
    "featuredMedia": "/featured",
    "recommendedMedia": "/recommended",
    "members": "/members",
    "tags": "/tags",
    "categories": "/categories",
    "likedMedia": "/liked",
    "history": "/history",
    "addMedia": "/upload",
}
ANONYMOUS_LINKS = {"signin": "/accounts/login/", "register": "/accounts/signup/"}
ACCOUNT_LINKS = {"signout": "/accounts/logout/", "changePassword": "/accounts/password/change/"}
STAFF_LINKS = ["admin", "migrations", "manageMedia", "manageUsers", "manageComments"]


def url_config(response):
    block = re.search(r"MediaCMS\.url = \{(.*?)\};", response.content.decode(), re.S).group(1)
    return dict(re.findall(r"(\w+):\s*['\"]([^'\"]*)['\"]", block))


def user_flags(response):
    block = re.search(r"MediaCMS\.user = \{(.*?)\n\};", response.content.decode(), re.S).group(1)
    return dict(re.findall(r"(\w+):\s*(true|false)", block))


class IndexPageLinksTest(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.user = create_account()
        cls.editor = create_account(is_editor=True)
        cls.manager = create_account(is_manager=True)
        cls.admin = create_account(is_superuser=True)

    def index(self, user=None):
        if user:
            self.client.force_login(user)
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "cms/index.html")
        return response

    def assert_links(self, links, expected):
        for name, url in expected.items():
            self.assertEqual(links.get(name), url, name)

    def test_anonymous_user_gets_public_links_and_sign_in(self):
        response = self.index()
        links = url_config(response)
        self.assert_links(links, PUBLIC_LINKS)
        self.assert_links(links, ANONYMOUS_LINKS)
        for name in list(ACCOUNT_LINKS) + STAFF_LINKS + ["editChannel"]:
            self.assertNotIn(name, links)
        flags = user_flags(response)
        self.assertEqual(flags["anonymous"], "true")
        self.assertEqual(flags["admin"], "false")
        self.assertContains(response, 'id="page-home"')

    def test_logged_in_user_gets_account_links_but_no_management(self):
        response = self.index(self.user)
        links = url_config(response)
        self.assert_links(links, PUBLIC_LINKS)
        self.assert_links(links, ACCOUNT_LINKS)
        self.assertEqual(links["editProfile"], f"/user/{self.user.username}/edit")
        for name in list(ANONYMOUS_LINKS) + STAFF_LINKS:
            self.assertNotIn(name, links)
        flags = user_flags(response)
        self.assertEqual(flags["anonymous"], "false")
        self.assertEqual((flags["manageMedia"], flags["manageUsers"], flags["manageComments"]), ("false", "false", "false"))
        self.assertContains(response, f'username: "{self.user.username}"')
        self.assertContains(response, f"media: '/user/{self.user.username}'")

    def test_editor_gets_media_and_comment_management_links(self):
        response = self.index(self.editor)
        links = url_config(response)
        self.assertEqual(links["manageMedia"], "/manage/media")
        self.assertEqual(links["manageComments"], "/manage/comments")
        for name in ["manageUsers", "admin", "migrations"]:
            self.assertNotIn(name, links)
        flags = user_flags(response)
        self.assertEqual((flags["manageMedia"], flags["manageUsers"], flags["manageComments"]), ("true", "false", "true"))

    def test_manager_also_gets_user_management(self):
        response = self.index(self.manager)
        links = url_config(response)
        self.assertEqual(links["manageMedia"], "/manage/media")
        self.assertEqual(links["manageUsers"], "/manage/users")
        self.assertEqual(links["manageComments"], "/manage/comments")
        self.assertNotIn("admin", links)
        self.assertEqual(user_flags(response)["manageUsers"], "true")

    def test_superuser_gets_every_management_link_and_django_admin(self):
        response = self.index(self.admin)
        links = url_config(response)
        self.assertEqual(links["admin"], "/admin/")
        self.assertEqual(links["migrations"], "/migrations")
        for name in ["manageMedia", "manageUsers", "manageComments"]:
            self.assertIn(name, links)
        self.assertEqual(user_flags(response)["admin"], "true")
        self.assertEqual(response.context["DJANGO_ADMIN_URL"], "admin/")

    def test_django_admin_url_is_only_exposed_to_superusers(self):
        for user in [None, self.user, self.editor, self.manager]:
            with self.subTest(user=user and user.username):
                self.client.logout()
                self.assertNotIn("DJANGO_ADMIN_URL", self.index(user).context)


class IndexPageContextTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = create_account()
        cls.editor = create_account(is_editor=True)
        cls.manager = create_account(is_manager=True)

    def test_role_flags_follow_the_user(self):
        cases = [(None, False, False, False), (self.user, False, False, False), (self.editor, False, True, False), (self.manager, False, True, True)]
        for user, admin, editor, manager in cases:
            with self.subTest(user=user and user.username):
                self.client.logout()
                if user:
                    self.client.force_login(user)
                context = self.client.get("/").context
                self.assertEqual((context["IS_MEDIACMS_ADMIN"], context["IS_MEDIACMS_EDITOR"], context["IS_MEDIACMS_MANAGER"]), (admin, editor, manager))

    @override_settings(LOGIN_ALLOWED=False, REGISTER_ALLOWED=False)
    def test_login_and_register_buttons_can_be_hidden(self):
        response = self.client.get("/")
        self.assertContains(response, "hideLogin: true")
        self.assertContains(response, "hideRegister: true")

    def test_login_and_register_buttons_show_by_default(self):
        response = self.client.get("/")
        self.assertContains(response, "hideLogin: false")
        self.assertContains(response, "hideRegister: false")

    @override_settings(PORTAL_NAME="Pages Test Portal")
    def test_portal_name_and_host_reach_the_page(self):
        response = self.client.get("/")
        self.assertEqual(response.context["FRONTEND_HOST"], "http://testserver")
        self.assertEqual(response.context["RSS_URL"], "/rss")
        self.assertContains(response, 'title: "Pages Test Portal"')

    @override_settings(USE_LTI=True)
    def test_lti_session_is_exposed_only_to_authenticated_users(self):
        session = self.client.session
        session["lti_session"] = {"context_id": "course-1"}
        session.save()
        self.assertNotIn("lti_session", self.client.get("/").context)

        self.client.force_login(self.user)
        session = self.client.session
        session["lti_session"] = {"context_id": "course-1"}
        session.save()
        self.assertEqual(self.client.get("/").context["lti_session"], {"context_id": "course-1"})
