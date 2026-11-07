from allauth.socialaccount.models import SocialApp
from django.core.exceptions import ValidationError
from django.test import Client, TestCase, override_settings

from files.methods import can_edit_category
from files.models import Category
from files.tests import create_account, create_media
from identity_providers.models import IdentityProviderCategoryMapping
from rbac.models import RBACGroup, RBACMembership, RBACRole, generate_uid

PASSWORD = "rbac-test-password"


def make_user(username, **kwargs):
    return create_account(username=username, email=f"{username}@example.com", password=PASSWORD, **kwargs)


def media_tokens(response):
    return {item["friendly_token"] for item in response.data["results"]}


class RBACModelTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = make_user("rbac_model_user")
        cls.idp = SocialApp.objects.create(provider="saml", provider_id="rbac-model-idp", name="Model IdP", client_id="rbac-model-idp")

    def test_generated_uids_are_ten_characters_and_distinct(self):
        uids = {generate_uid() for _ in range(20)}
        self.assertEqual(len(uids), 20)
        self.assertTrue(all(len(uid) == 10 for uid in uids))

    def test_group_str_mentions_identity_provider_only_when_set(self):
        plain = RBACGroup.objects.create(name="Plain group")
        linked = RBACGroup.objects.create(name="Linked group", identity_provider=self.idp)
        self.assertEqual(str(plain), "Plain group")
        self.assertEqual(str(linked), f"Linked group for {self.idp}")

    def test_new_group_gets_a_uid_by_default(self):
        group = RBACGroup.objects.create(name="Defaulted uid")
        self.assertEqual(len(group.uid), 10)

    def test_membership_str_shows_user_group_and_role(self):
        group = RBACGroup.objects.create(name="Str group")
        membership = RBACMembership.objects.create(user=self.user, rbac_group=group, role=RBACRole.CONTRIBUTOR)
        self.assertEqual(str(membership), "rbac_model_user - Str group (contributor)")

    def test_membership_defaults_to_member_role(self):
        group = RBACGroup.objects.create(name="Default role group")
        membership = RBACMembership.objects.create(user=self.user, rbac_group=group)
        self.assertEqual(membership.role, RBACRole.MEMBER)

    def test_membership_save_rejects_unknown_role(self):
        group = RBACGroup.objects.create(name="Bad role group")
        with self.assertRaises(ValidationError):
            RBACMembership.objects.create(user=self.user, rbac_group=group, role="owner")
        self.assertFalse(RBACMembership.objects.filter(rbac_group=group).exists())

    def test_membership_save_rejects_duplicate_user_group_role(self):
        group = RBACGroup.objects.create(name="Duplicate group")
        RBACMembership.objects.create(user=self.user, rbac_group=group, role=RBACRole.MEMBER)
        with self.assertRaises(ValidationError):
            RBACMembership.objects.create(user=self.user, rbac_group=group, role=RBACRole.MEMBER)

    def test_same_user_can_hold_two_roles_in_one_group(self):
        group = RBACGroup.objects.create(name="Two roles group")
        RBACMembership.objects.create(user=self.user, rbac_group=group, role=RBACRole.MEMBER)
        RBACMembership.objects.create(user=self.user, rbac_group=group, role=RBACRole.MANAGER)
        self.assertEqual(group.memberships.count(), 2)
        self.assertEqual(list(group.members.distinct()), [self.user])

    def test_group_names_are_unique_per_identity_provider(self):
        RBACGroup.objects.create(name="Same name", identity_provider=self.idp)
        with self.assertRaises(ValidationError):
            RBACGroup(name="Same name", identity_provider=self.idp).validate_unique()


@override_settings(USE_IDENTITY_PROVIDERS=True)
class RBACCategorySignalTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.idp = SocialApp.objects.create(provider="saml", provider_id="rbac-signal-idp", name="Signal IdP", client_id="rbac-signal-idp")
        cls.category = Category.objects.create(title="Signal category", is_rbac_category=True)

    def test_adding_category_to_idp_group_creates_category_mapping(self):
        group = RBACGroup.objects.create(name="Signal group", uid="signal-uid", identity_provider=self.idp)
        group.categories.add(self.category)
        mappings = IdentityProviderCategoryMapping.objects.filter(identity_provider=self.idp, name="signal-uid", map_to=self.category)
        self.assertEqual(mappings.count(), 1)

    def test_readding_category_does_not_duplicate_mapping(self):
        group = RBACGroup.objects.create(name="Signal group", uid="signal-uid", identity_provider=self.idp)
        group.categories.add(self.category)
        group.categories.remove(self.category)
        IdentityProviderCategoryMapping.objects.create(identity_provider=self.idp, name="signal-uid", map_to=self.category)
        group.categories.add(self.category)
        self.assertEqual(IdentityProviderCategoryMapping.objects.filter(identity_provider=self.idp, name="signal-uid").count(), 1)

    def test_removing_category_deletes_mapping(self):
        group = RBACGroup.objects.create(name="Signal group", uid="signal-uid", identity_provider=self.idp)
        group.categories.add(self.category)
        group.categories.remove(self.category)
        self.assertFalse(IdentityProviderCategoryMapping.objects.filter(identity_provider=self.idp, name="signal-uid").exists())

    def test_group_without_identity_provider_creates_no_mapping(self):
        group = RBACGroup.objects.create(name="Local group", uid="local-uid")
        group.categories.add(self.category)
        self.assertFalse(IdentityProviderCategoryMapping.objects.exists())
        self.assertIn(self.category, group.categories.all())

    @override_settings(USE_IDENTITY_PROVIDERS=False)
    def test_signal_is_inert_when_identity_providers_are_disabled(self):
        group = RBACGroup.objects.create(name="Signal group", uid="signal-uid", identity_provider=self.idp)
        group.categories.add(self.category)
        self.assertFalse(IdentityProviderCategoryMapping.objects.exists())


@override_settings(USE_RBAC=True)
class RBACMediaAccessTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user("rbac_owner")
        cls.member = make_user("rbac_member")
        cls.contributor = make_user("rbac_contributor")
        cls.manager = make_user("rbac_manager")
        cls.outsider = make_user("rbac_outsider")

        cls.category = Category.objects.create(title="Course one", is_rbac_category=True)
        cls.other_category = Category.objects.create(title="Course two", is_rbac_category=True)
        cls.public_category = Category.objects.create(title="Open category")

        cls.group = RBACGroup.objects.create(name="Course one group")
        cls.group.categories.add(cls.category)
        RBACMembership.objects.create(user=cls.member, rbac_group=cls.group, role=RBACRole.MEMBER)
        RBACMembership.objects.create(user=cls.contributor, rbac_group=cls.group, role=RBACRole.CONTRIBUTOR)
        RBACMembership.objects.create(user=cls.manager, rbac_group=cls.group, role=RBACRole.MANAGER)

        cls.media = create_media(cls.owner, title="rbac private lecture", state="private", category=[cls.category])
        cls.other_media = create_media(cls.owner, title="rbac other course lecture", state="private", category=[cls.other_category])

    def client_for(self, user):
        client = Client()
        client.login(username=user.username, password=PASSWORD)
        return client

    def detail(self, user, media=None):
        media = media or self.media
        client = self.client_for(user) if user else Client()
        return client.get(f"/api/v1/media/{media.friendly_token}")

    def test_every_group_role_can_view_private_media_in_group_category(self):
        for user in (self.member, self.contributor, self.manager):
            with self.subTest(user=user.username):
                response = self.detail(user)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["title"], "rbac private lecture")
                self.assertTrue(response.data["is_shared"])

    def test_non_member_and_anonymous_cannot_view_private_rbac_media(self):
        self.assertEqual(self.detail(self.outsider).status_code, 401)
        anonymous = self.detail(None)
        self.assertNotEqual(anonymous.status_code, 200)
        self.assertNotIn("title", anonymous.data)

    def test_membership_does_not_reach_categories_of_other_groups(self):
        self.assertEqual(self.detail(self.member, self.other_media).status_code, 401)

    def test_removing_membership_revokes_access(self):
        self.assertEqual(self.detail(self.member).status_code, 200)
        RBACMembership.objects.filter(user=self.member, rbac_group=self.group).delete()
        self.assertEqual(self.detail(self.member).status_code, 401)

    def test_detaching_category_from_group_revokes_access(self):
        self.group.categories.remove(self.category)
        self.assertEqual(self.detail(self.member).status_code, 401)

    @override_settings(USE_RBAC=False)
    def test_membership_grants_nothing_when_rbac_is_disabled(self):
        self.assertEqual(self.detail(self.member).status_code, 401)
        self.assertFalse(self.member.has_member_access_to_media(self.media))

    def test_media_listing_includes_private_rbac_media_only_for_group_members(self):
        member_tokens = media_tokens(self.client_for(self.member).get("/api/v1/media"))
        outsider_tokens = media_tokens(self.client_for(self.outsider).get("/api/v1/media"))
        self.assertIn(self.media.friendly_token, member_tokens)
        self.assertNotIn(self.other_media.friendly_token, member_tokens)
        self.assertNotIn(self.media.friendly_token, outsider_tokens)

    def test_author_listing_of_other_user_includes_rbac_media_for_member(self):
        response = self.client_for(self.member).get("/api/v1/media", {"author": self.owner.username})
        self.assertEqual(media_tokens(response), {self.media.friendly_token})

    def test_shared_with_me_lists_rbac_media(self):
        response = self.client_for(self.member).get("/api/v1/media", {"show": "shared_with_me"})
        self.assertEqual(media_tokens(response), {self.media.friendly_token})

    def test_shared_with_me_can_be_narrowed_by_group_name(self):
        response = self.client_for(self.member).get("/api/v1/media", {"show": "shared_with_me", "shared_group": self.group.name})
        self.assertEqual(media_tokens(response), {self.media.friendly_token})
        response = self.client_for(self.member).get("/api/v1/media", {"show": "shared_with_me", "shared_group": "no such group"})
        self.assertEqual(media_tokens(response), set())

    def test_shared_by_me_lists_own_media_placed_in_contributor_category(self):
        own = create_media(self.contributor, title="rbac contributor upload", state="private", category=[self.category])
        response = self.client_for(self.contributor).get("/api/v1/media", {"show": "shared_by_me"})
        self.assertEqual(media_tokens(response), {own.friendly_token})

    def test_contributor_and_manager_can_open_edit_page_but_member_cannot(self):
        url = f"/edit?m={self.media.friendly_token}"
        self.assertEqual(self.client_for(self.contributor).get(url).status_code, 200)
        self.assertEqual(self.client_for(self.manager).get(url).status_code, 200)
        response = self.client_for(self.member).get(url)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/")

    def test_access_levels_follow_role_hierarchy(self):
        expectations = {
            self.member: (True, False, False),
            self.contributor: (True, True, False),
            self.manager: (True, True, True),
            self.outsider: (False, False, False),
        }
        for user, (member, contributor, owner) in expectations.items():
            with self.subTest(user=user.username):
                self.assertEqual(user.has_member_access_to_media(self.media), member)
                self.assertEqual(user.has_contributor_access_to_media(self.media), contributor)
                self.assertEqual(user.has_owner_access_to_media(self.media), owner)
                self.assertEqual(user.has_member_access_to_category(self.category), member)
                self.assertEqual(user.has_contributor_access_to_category(self.category), contributor)
                self.assertEqual(user.has_manager_access_to_category(self.category), owner)

    def test_owner_always_has_full_access(self):
        self.assertTrue(self.owner.has_owner_access_to_media(self.media))
        self.assertTrue(self.owner.has_contributor_access_to_media(self.other_media))

    def test_rbac_category_querysets_depend_on_role(self):
        self.assertEqual(list(self.member.get_rbac_categories_as_member()), [self.category])
        self.assertEqual(list(self.member.get_rbac_categories_as_contributor()), [])
        self.assertEqual(list(self.contributor.get_rbac_categories_as_contributor()), [self.category])
        self.assertEqual(list(self.member.get_user_rbac_groups()), [self.group])

    def test_only_group_managers_can_edit_rbac_category(self):
        self.assertTrue(can_edit_category(self.manager, self.category))
        self.assertFalse(can_edit_category(self.contributor, self.category))
        self.assertFalse(can_edit_category(self.manager, self.public_category))

    def test_category_listing_hides_rbac_categories_from_non_members(self):
        member_titles = {c["title"] for c in self.client_for(self.member).get("/api/v1/categories").data}
        outsider_titles = {c["title"] for c in self.client_for(self.outsider).get("/api/v1/categories").data}
        self.assertIn("Course one", member_titles)
        self.assertNotIn("Course two", member_titles)
        self.assertIn("Open category", outsider_titles)
        self.assertNotIn("Course one", outsider_titles)

    def test_contributor_course_listing_returns_only_lms_courses_where_user_contributes(self):
        course = Category.objects.create(title="LMS course", is_rbac_category=True, is_lms_course=True)
        self.group.categories.add(course)
        contributor_titles = [c["title"] for c in self.client_for(self.contributor).get("/api/v1/categories/contributor").data]
        member_titles = [c["title"] for c in self.client_for(self.member).get("/api/v1/categories/contributor").data]
        self.assertEqual(contributor_titles, ["LMS course"])
        self.assertEqual(member_titles, [])
