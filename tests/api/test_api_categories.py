import uuid

from django.test import Client, TestCase, override_settings

from files.models import Category, Tag
from files.tests import create_account
from rbac.models import RBACGroup, RBACMembership

CATEGORIES_URL = '/api/v1/categories'
CONTRIBUTOR_CATEGORIES_URL = '/api/v1/categories/contributor'
TAGS_URL = '/api/v1/tags'


def make_user(**kwargs):
    name = uuid.uuid4().hex[:12]
    return create_account(username=f'u{name}', email=f'{name}@example.com', **kwargs)


def logged_in(user):
    client = Client()
    client.force_login(user)
    return client


def titles(response):
    return [c['title'] for c in response.data]


class CategoryVisibilityTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.plain = Category.objects.create(title='Plain category', description='open to all')
        cls.rbac = Category.objects.create(title='Rbac category', is_rbac_category=True)
        cls.other_rbac = Category.objects.create(title='Other rbac category', is_rbac_category=True)
        cls.course = Category.objects.create(title='Course category', is_lms_course=True)

        cls.member = make_user()
        cls.outsider = make_user()
        cls.editor = make_user(is_editor=True)
        cls.manager = make_user(is_manager=True)
        group = RBACGroup.objects.create(name='category group')
        group.categories.add(cls.rbac)
        RBACMembership.objects.create(user=cls.member, rbac_group=group, role='member')

    def test_anonymous_users_see_non_rbac_categories_sorted_by_title(self):
        response = Client().get(CATEGORIES_URL)
        self.assertEqual(response.status_code, 200)
        listed = titles(response)
        self.assertIn('Plain category', listed)
        self.assertIn('Course category', listed)
        self.assertNotIn('Rbac category', listed)
        self.assertNotIn('Other rbac category', listed)
        self.assertEqual(listed, sorted(listed))

    @override_settings(USE_RBAC=True)
    def test_rbac_members_also_see_their_rbac_categories(self):
        listed = titles(logged_in(self.member).get(CATEGORIES_URL))
        self.assertIn('Rbac category', listed)
        self.assertNotIn('Other rbac category', listed)

    @override_settings(USE_RBAC=True)
    def test_users_outside_rbac_groups_do_not_see_rbac_categories(self):
        listed = titles(logged_in(self.outsider).get(CATEGORIES_URL))
        self.assertNotIn('Rbac category', listed)

    def test_rbac_membership_does_not_reveal_categories_when_rbac_is_off(self):
        listed = titles(logged_in(self.member).get(CATEGORIES_URL))
        self.assertNotIn('Rbac category', listed)

    def test_editors_see_every_category(self):
        listed = titles(logged_in(self.editor).get(CATEGORIES_URL))
        for title in ('Plain category', 'Rbac category', 'Other rbac category', 'Course category'):
            self.assertIn(title, listed)

    @override_settings(SHOW_LMS_COURSES_IN_CATEGORIES=False)
    def test_lms_courses_can_be_hidden_from_listing(self):
        for client in (Client(), logged_in(self.editor)):
            listed = titles(client.get(CATEGORIES_URL))
            self.assertNotIn('Course category', listed)
            self.assertIn('Plain category', listed)

    def test_edit_url_is_offered_only_to_those_who_may_edit(self):
        plain_for_user = next(c for c in logged_in(self.outsider).get(CATEGORIES_URL).data if c['title'] == 'Plain category')
        plain_for_manager = next(c for c in logged_in(self.manager).get(CATEGORIES_URL).data if c['title'] == 'Plain category')
        self.assertEqual(plain_for_user['edit_url'], '')
        self.assertEqual(plain_for_manager['edit_url'], f'/edit_category/{self.plain.uid}')

    def test_detail_returns_a_visible_category(self):
        response = Client().get(f'{CATEGORIES_URL}/{self.plain.uid}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['title'], 'Plain category')
        self.assertEqual(response.data['description'], 'open to all')
        self.assertEqual(response.data['uid'], self.plain.uid)

    def test_detail_of_unknown_category_is_404(self):
        response = Client().get(f'{CATEGORIES_URL}/no-such-category')
        self.assertEqual(response.status_code, 404)

    def test_detail_of_rbac_category_is_404_for_non_members(self):
        self.assertEqual(Client().get(f'{CATEGORIES_URL}/{self.rbac.uid}').status_code, 404)
        self.assertEqual(logged_in(self.outsider).get(f'{CATEGORIES_URL}/{self.rbac.uid}').status_code, 404)

    @override_settings(USE_RBAC=True)
    def test_detail_of_rbac_category_is_returned_to_members(self):
        response = logged_in(self.member).get(f'{CATEGORIES_URL}/{self.rbac.uid}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['title'], 'Rbac category')

    @override_settings(SHOW_LMS_COURSES_IN_CATEGORIES=False)
    def test_detail_agrees_with_listing_on_hidden_lms_courses(self):
        self.assertEqual(Client().get(f'{CATEGORIES_URL}/{self.course.uid}').status_code, 404)


class ContributorCategoriesTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.course = Category.objects.create(title='Contributed course', is_lms_course=True, is_rbac_category=True)
        cls.second_course = Category.objects.create(title='Another course', is_lms_course=True, is_rbac_category=True)
        cls.non_course = Category.objects.create(title='Contributed group category', is_rbac_category=True)
        cls.member_course = Category.objects.create(title='Member only course', is_lms_course=True, is_rbac_category=True)

        cls.contributor = make_user()
        contributor_group = RBACGroup.objects.create(name='contributors')
        contributor_group.categories.add(cls.course, cls.non_course)
        RBACMembership.objects.create(user=cls.contributor, rbac_group=contributor_group, role='contributor')
        manager_group = RBACGroup.objects.create(name='course managers')
        manager_group.categories.add(cls.second_course)
        RBACMembership.objects.create(user=cls.contributor, rbac_group=manager_group, role='manager')
        member_group = RBACGroup.objects.create(name='members')
        member_group.categories.add(cls.member_course)
        RBACMembership.objects.create(user=cls.contributor, rbac_group=member_group, role='member')

    def test_anonymous_users_get_an_empty_list(self):
        response = Client().get(CONTRIBUTOR_CATEGORIES_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_lists_only_lms_courses_with_contributor_or_manager_role(self):
        response = logged_in(self.contributor).get(CONTRIBUTOR_CATEGORIES_URL)
        self.assertEqual(titles(response), ['Another course', 'Contributed course'])

    def test_users_without_memberships_get_an_empty_list(self):
        self.assertEqual(logged_in(make_user()).get(CONTRIBUTOR_CATEGORIES_URL).data, [])


class TagListTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        Tag.objects.create(title='rarely used', media_count=1)
        Tag.objects.create(title='very popular', media_count=9)
        Tag.objects.create(title='somewhat used', media_count=4)

    def test_tags_are_listed_by_popularity(self):
        response = Client().get(TAGS_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([t['title'] for t in response.data['results']], ['very popular', 'somewhat used', 'rarely used'])
        self.assertEqual(response.data['count'], 3)
        self.assertEqual(response.data['results'][0]['media_count'], 9)
