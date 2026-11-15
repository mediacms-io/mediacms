import uuid

from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from files.models import Media
from files.tests import create_account, create_media, fixture_path
from users.models import Channel, User

PASSWORD = "api_pass_9876"
STRONG_PASSWORD = "Zq8!wvLm3#pT"


def make_user(prefix, **kwargs):
    token = uuid.uuid4().hex[:10]
    return create_account(username=f"{prefix}_{token}", email=f"{prefix}_{token}@example.com", password=PASSWORD, **kwargs)


def usernames(response):
    return {u["username"] for u in response.json()["results"]}


class UserListApiTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alice = make_user("alice", name="Alice Wonderland")
        cls.bob = make_user("bob", name="Bob Builder")
        cls.editor = make_user("editor", is_editor=True)
        cls.admin = make_user("admin", is_superuser=True)

    def setUp(self):
        self.client = APIClient()

    def test_anonymous_can_list_users_by_default(self):
        response = self.client.get("/api/v1/users")
        self.assertEqual(response.status_code, 200)
        self.assertTrue({self.alice.username, self.bob.username} <= usernames(response))

    def test_listing_exposes_profile_urls_but_not_emails(self):
        entry = next(u for u in self.client.get("/api/v1/users").json()["results"] if u["username"] == self.alice.username)
        self.assertTrue(entry["url"].endswith(f"/user/{self.alice.username}/"))
        self.assertTrue(entry["api_url"].endswith(f"/api/v1/users/{self.alice.username}"))
        self.assertNotIn("email", entry)

    @override_settings(ALLOW_ANONYMOUS_USER_LISTING=False)
    def test_anonymous_cannot_list_users_when_anonymous_listing_is_disabled(self):
        self.assertEqual(self.client.get("/api/v1/users").status_code, 403)

    @override_settings(ALLOW_ANONYMOUS_USER_LISTING=False)
    def test_logged_in_user_can_list_users_when_anonymous_listing_is_disabled(self):
        self.client.force_authenticate(self.alice)
        self.assertEqual(self.client.get("/api/v1/users").status_code, 200)

    @override_settings(CAN_SEE_MEMBERS_PAGE="editors")
    def test_members_restricted_to_editors_hides_listing_from_plain_users(self):
        self.client.force_authenticate(self.alice)
        self.assertEqual(self.client.get("/api/v1/users").status_code, 403)
        self.client.force_authenticate(self.editor)
        self.assertEqual(self.client.get("/api/v1/users").status_code, 200)

    @override_settings(CAN_SEE_MEMBERS_PAGE="admins")
    def test_members_restricted_to_admins_hides_listing_from_editors(self):
        self.client.force_authenticate(self.editor)
        self.assertEqual(self.client.get("/api/v1/users").status_code, 403)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get("/api/v1/users").status_code, 200)

    def test_search_matches_name_and_username(self):
        self.assertEqual(usernames(self.client.get("/api/v1/users", {"name": "wonderland"})), {self.alice.username})
        self.assertEqual(usernames(self.client.get("/api/v1/users", {"name": self.bob.username})), {self.bob.username})

    def test_search_ignores_email_by_default(self):
        self.assertEqual(usernames(self.client.get("/api/v1/users", {"name": self.alice.email})), set())

    @override_settings(USER_SEARCH_FIELD="name_username_email")
    def test_search_matches_email_when_enabled(self):
        self.assertEqual(usernames(self.client.get("/api/v1/users", {"name": self.alice.email})), {self.alice.username})

    def test_exclude_self_removes_the_requesting_user(self):
        self.client.force_authenticate(self.alice)
        found = usernames(self.client.get("/api/v1/users", {"exclude_self": "True"}))
        self.assertNotIn(self.alice.username, found)
        self.assertIn(self.bob.username, found)

    def test_approval_filter_is_ignored_when_approval_is_disabled(self):
        found = usernames(self.client.get("/api/v1/users", {"is_approved": "true"}))
        self.assertIn(self.alice.username, found)


class UserCreateApiTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.manager = make_user("manager", is_manager=True)
        cls.editor = make_user("editor", is_editor=True)

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.manager)
        token = uuid.uuid4().hex[:8]
        self.payload = {"username": f"newbie_{token}", "password": STRONG_PASSWORD, "email": f"newbie_{token}@example.com", "name": "New Person"}

    def test_manager_creates_a_user_that_can_log_in(self):
        response = self.client.post("/api/v1/users", self.payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["username"], self.payload["username"])
        user = User.objects.get(username=self.payload["username"])
        self.assertEqual(user.email, self.payload["email"])
        self.assertEqual(user.name, "New Person")
        self.assertTrue(user.check_password(STRONG_PASSWORD))
        self.assertTrue(Channel.objects.filter(user=user).exists())

    def test_editor_cannot_create_users(self):
        self.client.force_authenticate(self.editor)
        self.assertEqual(self.client.post("/api/v1/users", self.payload, format="json").status_code, 403)
        self.assertFalse(User.objects.filter(username=self.payload["username"]).exists())

    def test_anonymous_cannot_create_users(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post("/api/v1/users", self.payload, format="json").status_code, 403)

    def test_all_fields_are_required(self):
        for field in self.payload:
            payload = dict(self.payload, **{field: ""})
            response = self.client.post("/api/v1/users", payload, format="json")
            self.assertEqual(response.status_code, 400, field)

    def test_invalid_username_is_rejected(self):
        response = self.client.post("/api/v1/users", dict(self.payload, username="bad name!"), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email=self.payload["email"]).exists())

    def test_duplicate_username_is_rejected(self):
        response = self.client.post("/api/v1/users", dict(self.payload, username=self.editor.username), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "A user with that username already exists.")

    def test_duplicate_email_is_rejected(self):
        response = self.client.post("/api/v1/users", dict(self.payload, email=self.editor.email), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "A user with that email already exists.")


class UserDetailApiTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user("owner", name="Owner Name")
        cls.other = make_user("other")
        cls.manager = make_user("manager", is_manager=True)

    def setUp(self):
        self.client = APIClient()

    def url(self, user):
        return f"/api/v1/users/{user.username}"

    def test_anyone_can_read_user_details(self):
        response = self.client.get(self.url(self.owner))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["username"], self.owner.username)
        self.assertEqual(data["name"], "Owner Name")
        self.assertEqual(data["media_info"]["user_media"], f"/api/v1/media?author={self.owner.username}")
        self.assertTrue(data["edit_url"].endswith(f"/user/{self.owner.username}/edit"))
        self.assertIn("/channel/", data["default_channel_edit_url"])
        self.assertNotIn("email", data)

    def test_unknown_user_returns_400(self):
        response = self.client.get("/api/v1/users/does_not_exist_at_all")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "user does not exist")

    def test_anonymous_cannot_edit_a_profile(self):
        self.assertEqual(self.client.post(self.url(self.owner), {"name": "Hacked"}).status_code, 403)

    def test_user_edits_own_profile(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(self.url(self.owner), {"name": "<b>Renamed</b>", "description": "about <i>me</i>"}, format="multipart")
        self.assertEqual(response.status_code, 201)
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.name, "Renamed")
        self.assertEqual(self.owner.description, "about me")

    def test_user_uploads_a_logo(self):
        self.client.force_authenticate(self.owner)
        with open(fixture_path("test_image.png"), "rb") as fp:
            response = self.client.post(self.url(self.owner), {"logo": fp}, format="multipart")
        self.assertEqual(response.status_code, 201)
        self.owner.refresh_from_db()
        self.assertNotEqual(self.owner.logo.name, "userlogos/user.jpg")
        self.assertTrue(self.owner.logo.name.endswith(".jpg"))
        self.assertEqual((self.owner.logo.width, self.owner.logo.height), (200, 200))

    def test_user_cannot_edit_someone_elses_profile(self):
        self.client.force_authenticate(self.other)
        response = self.client.post(self.url(self.owner), {"name": "Hacked"}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "not enough permissions")
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.name, "Owner Name")

    def test_manager_can_edit_someone_elses_profile(self):
        self.client.force_authenticate(self.manager)
        response = self.client.post(self.url(self.owner), {"name": "Managed"}, format="multipart")
        self.assertEqual(response.status_code, 201)
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.name, "Managed")

    def test_username_cannot_be_changed_through_the_api(self):
        self.client.force_authenticate(self.owner)
        self.client.post(self.url(self.owner), {"username": "brand_new_name"}, format="multipart")
        self.assertFalse(User.objects.filter(username="brand_new_name").exists())


class UserPasswordAndApprovalApiTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("member")
        cls.other = make_user("other")
        cls.manager = make_user("manager", is_manager=True)
        cls.admin = make_user("admin", is_superuser=True)
        cls.admin2 = make_user("admintwo", is_superuser=True)

    def setUp(self):
        self.client = APIClient()

    def put(self, user, data):
        return self.client.put(f"/api/v1/users/{user.username}", data, format="multipart")

    def test_user_changes_own_password(self):
        self.client.force_authenticate(self.user)
        response = self.put(self.user, {"action": "change_password", "password": STRONG_PASSWORD})
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(STRONG_PASSWORD))

    def test_password_is_required(self):
        self.client.force_authenticate(self.user)
        response = self.put(self.user, {"action": "change_password"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Password is required")

    def test_weak_password_is_rejected_by_validators(self):
        self.client.force_authenticate(self.user)
        response = self.put(self.user, {"action": "change_password", "password": "123"})
        self.assertEqual(response.status_code, 400)
        self.assertIsInstance(response.json()["detail"], list)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(PASSWORD))

    def test_user_cannot_change_someone_elses_password(self):
        self.client.force_authenticate(self.other)
        response = self.put(self.user, {"action": "change_password", "password": STRONG_PASSWORD})
        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(PASSWORD))

    def test_manager_can_change_a_plain_users_password(self):
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.put(self.user, {"action": "change_password", "password": STRONG_PASSWORD}).status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(STRONG_PASSWORD))

    def test_manager_cannot_change_a_superusers_password(self):
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.put(self.admin, {"action": "change_password", "password": STRONG_PASSWORD}).status_code, 403)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password(PASSWORD))

    def test_superuser_can_change_another_superusers_password(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.put(self.admin2, {"action": "change_password", "password": STRONG_PASSWORD}).status_code, 200)
        self.admin2.refresh_from_db()
        self.assertTrue(self.admin2.check_password(STRONG_PASSWORD))

    def test_user_cannot_approve_themselves(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.put(self.user, {"action": "approve_user"}).status_code, 403)
        self.assertEqual(self.put(self.user, {"action": "disapprove_user"}).status_code, 403)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_approved)

    def test_manager_approves_and_disapproves_a_user(self):
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.put(self.user, {"action": "approve_user"}).status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_approved)
        self.assertEqual(self.put(self.user, {"action": "disapprove_user"}).status_code, 200)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_approved)

    def test_unknown_action_is_rejected(self):
        self.client.force_authenticate(self.user)
        response = self.put(self.user, {"action": "make_me_admin"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Invalid action")


class UserDeleteApiTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.victim = make_user("victim")
        self.other = make_user("other")
        self.editor = make_user("editor", is_editor=True)
        self.manager = make_user("manager", is_manager=True)

    def delete(self, user):
        return self.client.delete(f"/api/v1/users/{user.username}")

    def test_anonymous_cannot_delete_users(self):
        self.assertEqual(self.delete(self.victim).status_code, 403)
        self.assertTrue(User.objects.filter(pk=self.victim.pk).exists())

    def test_plain_user_cannot_delete_another_user(self):
        self.client.force_authenticate(self.other)
        self.assertEqual(self.delete(self.victim).status_code, 400)
        self.assertTrue(User.objects.filter(pk=self.victim.pk).exists())

    def test_editor_cannot_delete_another_user(self):
        self.client.force_authenticate(self.editor)
        self.assertEqual(self.delete(self.victim).status_code, 400)
        self.assertTrue(User.objects.filter(pk=self.victim.pk).exists())

    def test_user_can_delete_own_account(self):
        self.client.force_authenticate(self.victim)
        self.assertEqual(self.delete(self.victim).status_code, 204)
        self.assertFalse(User.objects.filter(pk=self.victim.pk).exists())

    def test_manager_deletes_a_user_and_their_media(self):
        media = create_media(self.victim, title=f"victim media {uuid.uuid4().hex}")
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.delete(self.victim).status_code, 204)
        self.assertFalse(User.objects.filter(pk=self.victim.pk).exists())
        self.assertFalse(Media.objects.filter(pk=media.pk).exists())
        self.assertFalse(Channel.objects.filter(user_id=self.victim.pk).exists())

    def test_manager_cannot_delete_a_superuser(self):
        admin = make_user("admin", is_superuser=True)
        self.client.force_authenticate(self.manager)
        response = self.delete(admin)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "You do not have permission to delete a superuser.")
        self.assertTrue(User.objects.filter(pk=admin.pk).exists())

    def test_superuser_can_delete_another_superuser(self):
        admin = make_user("admin", is_superuser=True)
        self.client.force_authenticate(make_user("root", is_superuser=True))
        self.assertEqual(self.delete(admin).status_code, 204)
        self.assertFalse(User.objects.filter(pk=admin.pk).exists())

    def test_superuser_can_delete_their_own_account(self):
        admin = make_user("admin", is_superuser=True)
        self.client.force_authenticate(admin)
        self.assertEqual(self.delete(admin).status_code, 204)


class ContactUserApiTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.open_user = make_user("open", name="Open User")
        cls.open_user.allow_contact = True
        cls.open_user.save()
        cls.closed_user = make_user("closed")
        cls.sender = make_user("sender", name="Sender Person")
        cls.editor = make_user("editor", is_editor=True)

    def setUp(self):
        self.client = APIClient()
        mail.outbox = []

    def contact(self, user, body="Hello there"):
        return self.client.post(f"/api/v1/users/{user.username}/contact", {"body": body}, format="json")

    def test_anonymous_cannot_contact_users(self):
        self.assertEqual(self.contact(self.open_user).status_code, 401)
        self.assertEqual(mail.outbox, [])

    def test_message_is_emailed_to_a_user_that_allows_contact(self):
        self.client.force_authenticate(self.sender)
        self.assertEqual(self.contact(self.open_user, "Nice video!").status_code, 204)
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, [self.open_user.email])
        self.assertEqual(message.reply_to, [self.sender.email])
        self.assertIn(self.sender.email, message.subject)
        self.assertIn("Nice video!", message.body)
        self.assertIn("Sender Person", message.body)

    def test_no_email_is_sent_to_a_user_that_disallows_contact(self):
        self.client.force_authenticate(self.sender)
        self.assertEqual(self.contact(self.closed_user).status_code, 204)
        self.assertEqual(mail.outbox, [])

    def test_editor_can_contact_a_user_that_disallows_contact(self):
        self.client.force_authenticate(self.editor)
        self.assertEqual(self.contact(self.closed_user).status_code, 204)
        self.assertEqual([m.to for m in mail.outbox], [[self.closed_user.email]])

    def test_contacting_an_unknown_user_sends_nothing(self):
        self.client.force_authenticate(self.sender)
        self.assertEqual(self.contact(User(username="nobody_here_at_all")).status_code, 204)
        self.assertEqual(mail.outbox, [])


class LoginApiTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("login")

    def login(self, data):
        return self.client.post("/api/v1/login", data)

    def test_login_by_email_returns_a_token(self):
        response = self.login({"email": self.user.email, "password": PASSWORD})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["username"], self.user.username)
        self.assertTrue(response.json()["token"])

    def test_repeated_logins_reuse_the_same_token(self):
        first = self.login({"username": self.user.username, "password": PASSWORD}).json()["token"]
        second = self.login({"username": self.user.username, "password": PASSWORD}).json()["token"]
        self.assertEqual(first, second)

    def test_username_or_email_is_required(self):
        self.assertEqual(self.login({"password": PASSWORD}).status_code, 400)

    def test_password_is_required(self):
        self.assertEqual(self.login({"username": self.user.username}).status_code, 400)

    def test_wrong_password_is_rejected(self):
        response = self.login({"username": self.user.username, "password": "wrong"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("User not found.", str(response.content))

    @override_settings(ACCOUNT_LOGIN_METHODS={"username"})
    def test_username_is_required_when_portal_logs_in_by_username(self):
        response = self.login({"email": self.user.email, "password": PASSWORD})
        self.assertEqual(response.status_code, 400)
        self.assertIn("username is required", str(response.content))

    @override_settings(ACCOUNT_LOGIN_METHODS={"email"})
    def test_email_is_required_when_portal_logs_in_by_email(self):
        response = self.login({"username": self.user.username, "password": PASSWORD})
        self.assertEqual(response.status_code, 400)
        self.assertIn("email is required", str(response.content))

    def test_inactive_user_cannot_log_in(self):
        self.user.is_active = False
        self.user.save()
        self.assertEqual(self.login({"username": self.user.username, "password": PASSWORD}).status_code, 400)
