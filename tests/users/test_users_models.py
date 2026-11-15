import io
import os
import uuid

from allauth.account.models import EmailAddress, EmailConfirmationHMAC
from allauth.socialaccount.models import SocialAccount
from django.conf import settings
from django.contrib.admin.sites import site as admin_site
from django.core import mail
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory, TestCase, override_settings
from PIL import Image

from files.models import Category, Media, MediaPermission, Tag
from files.tests import create_account, create_media
from rbac.models import RBACGroup, RBACMembership
from users.adapter import MyAccountAdapter
from users.admin import UserAdmin
from users.forms import ChannelForm, SignupForm, UserForm
from users.models import Channel, Notification, User
from users.validators import (
    ASCIIUsernameValidator,
    LEssRestrictiveUsernameValidator,
    custom_username_validators,
)

PASSWORD = "models_pass_5555"


def make_user(prefix, **kwargs):
    token = uuid.uuid4().hex[:10]
    return create_account(username=f"{prefix}_{token}", email=f"{prefix}_{token}@example.com", password=PASSWORD, **kwargs)


def unique(prefix):
    return f"{prefix} {uuid.uuid4().hex[:10]}"


def large_png():
    buffer = io.BytesIO()
    Image.frombytes("RGB", (1000, 1000), os.urandom(3_000_000)).save(buffer, format="PNG")
    return SimpleUploadedFile("huge.png", buffer.getvalue(), content_type="image/png")


class UserModelTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("model", name="Model User")

    def test_str_shows_name_and_email(self):
        self.assertEqual(str(self.user), f"Model User - {self.user.email}")

    def test_urls(self):
        self.assertEqual(self.user.get_absolute_url(), f"/user/{self.user.username}/")
        self.assertEqual(self.user.get_absolute_url(api=True), f"/api/v1/users/{self.user.username}")
        self.assertEqual(self.user.edit_url(), f"/user/{self.user.username}/edit")
        channel = Channel.objects.get(user=self.user)
        self.assertEqual(self.user.default_channel_edit_url(), f"/channel/{channel.friendly_token}/edit")

    def test_a_default_channel_is_created_for_new_users(self):
        channels = Channel.objects.filter(user=self.user)
        self.assertEqual(channels.count(), 1)
        self.assertEqual(channels.first().title, "default")

    def test_channel_urls_are_none_without_a_channel(self):
        Channel.objects.filter(user=self.user).delete()
        self.assertIsNone(self.user.default_channel_edit_url())
        self.assertIsNone(self.user.banner_thumbnail_url())

    def test_thumbnail_urls_point_to_media_url(self):
        self.assertEqual(self.user.thumbnail_url(), f"{settings.MEDIA_URL}userlogos/user.jpg")
        self.assertEqual(self.user.banner_thumbnail_url(), f"{settings.MEDIA_URL}userlogos/banner.jpg")

    def test_thumbnail_url_is_none_without_logo(self):
        self.user.logo = ""
        self.assertIsNone(self.user.thumbnail_url())

    def test_save_strips_html_from_text_fields(self):
        self.user.name = "<script>alert(1)</script>Clean"
        self.user.description = "<p>Hello <b>world</b></p>"
        self.user.title = "<i>Dr</i>"
        self.user.save()
        self.user.refresh_from_db()
        self.assertEqual(self.user.name, "alert(1)Clean")
        self.assertEqual(self.user.description, "Hello world")
        self.assertEqual(self.user.title, "Dr")

    def test_email_is_verified_follows_allauth_email_address(self):
        self.assertFalse(self.user.email_is_verified)
        address = EmailAddress.objects.create(user=self.user, email=self.user.email, verified=False, primary=True)
        self.assertFalse(self.user.email_is_verified)
        address.verified = True
        address.save()
        self.assertTrue(self.user.email_is_verified)

    def test_media_info_points_to_the_user_media_listing(self):
        self.assertEqual(self.user.media_info, {"results": [], "user_media": f"/api/v1/media?author={self.user.username}"})

    def test_playlists_info_lists_the_users_playlists(self):
        playlist = self.user.playlists.create(title="My list", description="desc")
        info = self.user.playlists_info
        self.assertEqual(len(info), 1)
        self.assertEqual(info[0]["title"], "My list")
        self.assertEqual(info[0]["description"], "desc")
        self.assertEqual(info[0]["url"], playlist.get_absolute_url())
        self.assertEqual(info[0]["media_count"], 0)

    def test_notification_str_is_the_username(self):
        notification = Notification.objects.create(user=self.user, action="comment", notify=True)
        self.assertEqual(str(notification), self.user.username)


class UserMediaCountTest(TestCase):
    def test_update_user_media_counts_only_listable_media(self):
        user = make_user("counter")
        create_media(user, title=unique("public"), state="public")
        create_media(user, title=unique("private"), state="private")
        user.update_user_media()
        user.refresh_from_db()
        self.assertEqual(user.media_count, Media.objects.filter(user=user, listable=True).count())
        self.assertEqual(user.media_count, 1)


class SetRoleFromMappingTest(TestCase):
    def setUp(self):
        self.user = make_user("role")

    def test_each_role_grants_its_flag(self):
        expectations = {
            "advancedUser": "advancedUser",
            "editor": "is_editor",
            "manager": "is_manager",
        }
        for role, field in expectations.items():
            self.assertTrue(self.user.set_role_from_mapping(role))
            self.user.refresh_from_db()
            self.assertTrue(getattr(self.user, field), role)

    def test_admin_role_grants_superuser_and_staff(self):
        self.user.set_role_from_mapping("admin")
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_superuser)
        self.assertTrue(self.user.is_staff)

    def test_unknown_role_removes_every_privilege(self):
        self.user.is_superuser = self.user.is_staff = self.user.advancedUser = self.user.is_editor = self.user.is_manager = True
        self.user.save()
        self.assertTrue(self.user.set_role_from_mapping("user"))
        self.user.refresh_from_db()
        for field in ("is_superuser", "is_staff", "advancedUser", "is_editor", "is_manager"):
            self.assertFalse(getattr(self.user, field), field)


class UserRBACAccessTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user("owner")
        cls.member = make_user("member")
        cls.contributor = make_user("contributor")
        cls.manager = make_user("rbacmanager")
        cls.outsider = make_user("outsider")
        cls.category = Category.objects.create(title=unique("rbac cat"), is_rbac_category=True)
        cls.other_category = Category.objects.create(title=unique("other cat"))
        cls.group = RBACGroup.objects.create(name=unique("group"))
        cls.group.categories.add(cls.category)
        for user, role in ((cls.member, "member"), (cls.contributor, "contributor"), (cls.manager, "manager")):
            RBACMembership.objects.create(user=user, rbac_group=cls.group, role=role)
        cls.media = create_media(cls.owner, title=unique("rbac media"), state="private", category=[cls.category])

    def test_rbac_groups_and_categories(self):
        self.assertEqual(list(self.member.get_user_rbac_groups()), [self.group])
        self.assertEqual(list(self.outsider.get_user_rbac_groups()), [])
        self.assertEqual(list(self.member.get_rbac_categories_as_member()), [self.category])
        self.assertEqual(list(self.member.get_rbac_categories_as_contributor()), [])
        self.assertEqual(list(self.contributor.get_rbac_categories_as_contributor()), [self.category])
        self.assertEqual(list(self.manager.get_rbac_categories_as_contributor()), [self.category])

    def test_category_access_follows_role_hierarchy(self):
        table = {
            self.member: (True, False, False),
            self.contributor: (True, True, False),
            self.manager: (True, True, True),
            self.outsider: (False, False, False),
        }
        for user, (member, contributor, manager) in table.items():
            self.assertEqual(user.has_member_access_to_category(self.category), member, user.username)
            self.assertEqual(user.has_contributor_access_to_category(self.category), contributor, user.username)
            self.assertEqual(user.has_manager_access_to_category(self.category), manager, user.username)
            self.assertFalse(user.has_member_access_to_category(self.other_category))

    def test_owner_has_every_access_to_own_media(self):
        self.assertTrue(self.owner.has_member_access_to_media(self.media))
        self.assertTrue(self.owner.has_contributor_access_to_media(self.media))
        self.assertTrue(self.owner.has_owner_access_to_media(self.media))

    @override_settings(USE_RBAC=True)
    def test_media_access_through_rbac_follows_role_hierarchy(self):
        table = {
            self.member: (True, False, False),
            self.contributor: (True, True, False),
            self.manager: (True, True, True),
            self.outsider: (False, False, False),
        }
        for user, (member, contributor, owner) in table.items():
            self.assertEqual(user.has_member_access_to_media(self.media), member, user.username)
            self.assertEqual(user.has_contributor_access_to_media(self.media), contributor, user.username)
            self.assertEqual(user.has_owner_access_to_media(self.media), owner, user.username)

    @override_settings(USE_RBAC=False)
    def test_rbac_membership_grants_nothing_when_rbac_is_disabled(self):
        self.assertFalse(self.manager.has_member_access_to_media(self.media))
        self.assertFalse(self.manager.has_contributor_access_to_media(self.media))
        self.assertFalse(self.manager.has_owner_access_to_media(self.media))

    @override_settings(USE_RBAC=False)
    def test_media_access_through_explicit_sharing(self):
        table = {
            "viewer": (True, False, False),
            "editor": (True, True, False),
            "owner": (True, True, True),
        }
        for permission, (member, contributor, owner) in table.items():
            user = make_user(permission)
            MediaPermission.objects.create(user=user, owner_user=self.owner, media=self.media, permission=permission)
            self.assertEqual(user.has_member_access_to_media(self.media), member, permission)
            self.assertEqual(user.has_contributor_access_to_media(self.media), contributor, permission)
            self.assertEqual(user.has_owner_access_to_media(self.media), owner, permission)


class NewUserNotificationTest(TestCase):
    def setUp(self):
        mail.outbox = []

    @override_settings(ADMINS_NOTIFICATIONS={"NEW_USER": True}, ADMIN_EMAIL_LIST=["admins@example.com"])
    def test_admins_are_emailed_about_new_users(self):
        user = make_user("fresh")
        messages = [m for m in mail.outbox if m.to == ["admins@example.com"]]
        self.assertEqual(len(messages), 1)
        self.assertIn("New user just registered", messages[0].subject)
        self.assertIn(user.email, messages[0].body)
        self.assertIn(user.get_absolute_url(), messages[0].body)

    @override_settings(ADMINS_NOTIFICATIONS={"NEW_USER": True}, ADMIN_EMAIL_LIST=["admins@example.com"])
    def test_bulk_imports_can_skip_the_notification(self):
        user = User(username=f"bulk_{uuid.uuid4().hex[:8]}", email=f"bulk_{uuid.uuid4().hex[:8]}@example.com", name="Bulk")
        user._skip_admin_notification = True
        user.save()
        self.assertEqual(mail.outbox, [])
        self.assertTrue(Channel.objects.filter(user=user).exists())

    @override_settings(ADMINS_NOTIFICATIONS={"NEW_USER": False})
    def test_no_notification_when_disabled(self):
        make_user("quiet")
        self.assertEqual(mail.outbox, [])

    def test_updating_an_existing_user_sends_nothing_and_keeps_one_channel(self):
        user = make_user("existing")
        mail.outbox = []
        user.name = "Changed"
        user.save()
        self.assertEqual(mail.outbox, [])
        self.assertEqual(Channel.objects.filter(user=user).count(), 1)


class UserDeletionCleanupTest(TestCase):
    def test_deleting_a_user_removes_their_media_tags_and_categories(self):
        user = make_user("leaving")
        other = make_user("staying")
        media = create_media(user, title=unique("leaving media"))
        kept_media = create_media(other, title=unique("staying media"))
        tag = Tag.objects.create(title=unique("tag").replace(" ", "-"), user=user)
        category = Category.objects.create(title=unique("cat"), user=user)

        user.delete()

        self.assertFalse(Media.objects.filter(pk=media.pk).exists())
        self.assertFalse(Tag.objects.filter(pk=tag.pk).exists())
        self.assertFalse(Category.objects.filter(pk=category.pk).exists())
        self.assertTrue(Media.objects.filter(pk=kept_media.pk).exists())


class ChannelModelTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("channel")

    def test_save_strips_html_and_assigns_a_stable_friendly_token(self):
        channel = Channel.objects.create(user=self.user, title="<b>Extra</b>", description="<p>desc</p>")
        self.assertEqual(channel.title, "Extra")
        self.assertEqual(channel.description, "desc")
        token = channel.friendly_token
        self.assertTrue(token)
        channel.title = "Renamed"
        channel.save()
        self.assertEqual(channel.friendly_token, token)

    def test_friendly_tokens_are_unique(self):
        tokens = {Channel.objects.create(user=self.user, title=f"c{i}").friendly_token for i in range(5)}
        self.assertEqual(len(tokens), 5)

    def test_str_and_urls(self):
        channel = Channel.objects.get(user=self.user, title="default")
        self.assertEqual(str(channel), f"{self.user.username} -default")
        self.assertEqual(channel.get_absolute_url(), f"/channel/{channel.friendly_token}")
        self.assertEqual(channel.get_absolute_url(edit=True), f"/channel/{channel.friendly_token}/edit")
        self.assertEqual(channel.edit_url, f"/channel/{channel.friendly_token}/edit")


class UsernameValidatorTest(TestCase):
    def test_ascii_validator_accepts_allowed_characters(self):
        validator = ASCIIUsernameValidator()
        for username in ("john", "john.doe", "john_doe", "john-doe", "john@example.com", "J0hn"):
            validator(username)

    def test_ascii_validator_rejects_other_characters(self):
        validator = ASCIIUsernameValidator()
        for username in ("john doe", "jöhn", "john/doe", "john!", "名前", ""):
            with self.assertRaises(ValidationError, msg=username):
                validator(username)

    def test_portal_uses_the_ascii_validator(self):
        self.assertEqual(len(custom_username_validators), 1)
        self.assertIsInstance(custom_username_validators[0], ASCIIUsernameValidator)

    def test_less_restrictive_validator_accepts_unicode(self):
        validator = LEssRestrictiveUsernameValidator()
        for username in ("jöhn", "名前", "john doe", "o'neil"):
            validator(username)

    def test_less_restrictive_validator_rejects_filesystem_reserved_characters(self):
        validator = LEssRestrictiveUsernameValidator()
        for username in ("a/b", "a\\b", "a:b", "a*b", "a?b", 'a"b', "a<b", "a>b", "a|b", "a%b", "a#b", "a&b", "a`b", "a=b", "a~b", "a\x01b"):
            with self.assertRaises(ValidationError, msg=username):
                validator(username)


class AccountAdapterTest(TestCase):
    def setUp(self):
        self.adapter = MyAccountAdapter()

    def test_email_without_at_sign_is_rejected(self):
        with self.assertRaisesMessage(ValidationError, "Email is not valid"):
            self.adapter.clean_email("not-an-email")

    @override_settings(RESTRICTED_DOMAINS_FOR_USER_REGISTRATION=["blocked.com"], ALLOWED_DOMAINS_FOR_USER_REGISTRATION=[])
    def test_restricted_domain_is_rejected(self):
        with self.assertRaisesMessage(ValidationError, "Domain is restricted from registering"):
            self.adapter.clean_email("someone@blocked.com")
        self.assertEqual(self.adapter.clean_email("someone@fine.com"), "someone@fine.com")

    @override_settings(ALLOWED_DOMAINS_FOR_USER_REGISTRATION=["org.com"], RESTRICTED_DOMAINS_FOR_USER_REGISTRATION=[])
    def test_only_allowed_domains_may_register_when_a_list_is_set(self):
        self.assertEqual(self.adapter.clean_email("someone@org.com"), "someone@org.com")
        with self.assertRaisesMessage(ValidationError, "Domain is not in the permitted list"):
            self.adapter.clean_email("someone@elsewhere.com")

    def test_signup_is_open_according_to_settings(self):
        request = RequestFactory().get("/")
        with self.settings(USERS_CAN_SELF_REGISTER=True):
            self.assertTrue(self.adapter.is_open_for_signup(request))
        with self.settings(USERS_CAN_SELF_REGISTER=False):
            self.assertFalse(self.adapter.is_open_for_signup(request))

    @override_settings(SSL_FRONTEND_HOST="https://portal.example.com")
    def test_email_confirmation_link_uses_the_public_host(self):
        user = make_user("confirm")
        address = EmailAddress.objects.create(user=user, email=user.email, primary=True, verified=False)
        confirmation = EmailConfirmationHMAC(address)
        url = self.adapter.get_email_confirmation_url(RequestFactory().get("/"), confirmation)
        self.assertEqual(url, f"https://portal.example.com/accounts/confirm-email/{confirmation.key}/")

    def test_send_mail_renders_and_sends_the_template(self):
        user = make_user("reset")
        mail.outbox = []
        self.adapter.send_mail("account/email/password_reset_key", user.email, {"user": user, "password_reset_url": "https://x/reset", "request": None})
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [user.email])
        self.assertIn("https://x/reset", mail.outbox[0].body)


class UserFormTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("form")
        cls.manager = make_user("manager", is_manager=True)

    def test_plain_user_cannot_see_role_or_feature_fields(self):
        fields = set(UserForm(self.user, instance=self.user).fields)
        self.assertEqual(fields, {"name", "description", "logo", "notification_on_comments"})

    def test_manager_sees_role_fields(self):
        fields = set(UserForm(self.manager, instance=self.user).fields)
        self.assertEqual(fields, {"name", "description", "logo", "notification_on_comments", "advancedUser", "is_manager", "is_editor"})

    @override_settings(USERS_NEEDS_TO_BE_APPROVED=True)
    def test_manager_sees_approval_field_when_approval_is_required(self):
        self.assertIn("is_approved", UserForm(self.manager, instance=self.user).fields)
        self.assertNotIn("is_approved", UserForm(self.user, instance=self.user).fields)

    def test_name_is_read_only_for_social_accounts(self):
        SocialAccount.objects.create(user=self.user, provider="saml", uid=uuid.uuid4().hex)
        form = UserForm(self.user, instance=self.user)
        self.assertTrue(form.fields["name"].widget.attrs.get("readonly"))
        self.assertNotIn("readonly", UserForm(self.manager, instance=self.manager).fields["name"].widget.attrs)

    def test_logo_over_two_megabytes_is_rejected(self):
        form = UserForm(self.user, {"name": "Someone"}, {"logo": large_png()}, instance=self.user)
        self.assertFalse(form.is_valid())
        self.assertIn("Image file too large ( > 2mb )", form.errors["logo"])

    def test_existing_logo_is_kept_when_none_is_uploaded(self):
        form = UserForm(self.user, {"name": "Someone"}, instance=self.user)
        self.assertTrue(form.is_valid(), form.errors)

    def test_cleared_logo_is_rejected(self):
        form = UserForm(self.user, {"name": "Someone", "logo-clear": "on"}, instance=self.user)
        self.assertFalse(form.is_valid())
        self.assertIn("Please provide a logo", form.errors["logo"])

    def test_signup_form_stores_the_name(self):
        form = SignupForm({"name": "Signed Up"})
        self.assertTrue(form.is_valid())
        form.signup(None, self.user)
        self.user.refresh_from_db()
        self.assertEqual(self.user.name, "Signed Up")

    def test_channel_banner_over_two_megabytes_is_rejected(self):
        channel = Channel.objects.get(user=self.user)
        form = ChannelForm({}, {"banner_logo": large_png()}, instance=channel)
        self.assertFalse(form.is_valid())
        self.assertIn("Image file too large ( > 2mb )", form.errors["banner_logo"])

    def test_cleared_channel_banner_is_rejected(self):
        channel = Channel.objects.get(user=self.user)
        form = ChannelForm({"banner_logo-clear": "on"}, instance=channel)
        self.assertFalse(form.is_valid())
        self.assertIn("Please provide a banner", form.errors["banner_logo"])


class UserAdminTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = make_user("admin", is_superuser=True)
        cls.target = make_user("findme", name="Findable Person")

    def test_user_model_is_registered_with_the_custom_admin(self):
        self.assertIsInstance(admin_site._registry[User], UserAdmin)

    def test_superuser_can_search_users_in_admin(self):
        self.client.force_login(self.admin)
        response = self.client.get(f"/{settings.DJANGO_ADMIN_URL}users/user/", {"q": "Findable"})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.target.username)
        self.assertEqual(response.context["cl"].result_count, 1)

    def test_admin_change_form_hides_sensitive_fields(self):
        self.client.force_login(self.admin)
        response = self.client.get(f"/{settings.DJANGO_ADMIN_URL}users/user/{self.target.pk}/change/")
        self.assertEqual(response.status_code, 200)
        fields = response.context["adminform"].form.fields
        self.assertNotIn("password", fields)
        self.assertNotIn("is_approved", fields)
        self.assertIn("is_manager", fields)
