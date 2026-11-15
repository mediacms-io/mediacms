import json
import re
import uuid

from django.test import RequestFactory, TestCase, override_settings

from files.forms import MediaPublishForm
from files.models import Category, Media, MediaPermission
from files.tests import create_account, create_media
from files.widgets import CategoryModalWidget
from rbac.models import RBACGroup, RBACMembership

EDITOR_ONLY_FIELDS = ["featured", "reported_times", "is_reviewed"]


def state_choices(form):
    return {value for value, _label in form.fields["state"].choices}


def widget_data(html):
    return json.loads(re.search(r'<script type="application/json" class="category-data">(.*?)</script>', html, re.S).group(1))


class PublishFormFieldsTest(TestCase):
    fixtures = ["fixtures/categories.json"]

    @classmethod
    def setUpTestData(cls):
        cls.owner = create_account()
        cls.editor = create_account(is_editor=True)
        cls.public = create_media(cls.owner, title="publish form public", state="public")
        cls.private = create_media(cls.owner, title="publish form private", state="private")

    def test_moderation_fields_are_read_only_for_regular_users(self):
        form = MediaPublishForm(self.owner, instance=self.public)
        for field in EDITOR_ONLY_FIELDS:
            with self.subTest(field=field):
                self.assertTrue(form.fields[field].disabled)
                self.assertEqual(form.fields[field].widget.attrs["class"], "read-only-field")

    def test_moderation_fields_are_editable_for_editors(self):
        form = MediaPublishForm(self.editor, instance=self.public)
        for field in EDITOR_ONLY_FIELDS:
            self.assertFalse(form.fields[field].disabled)

    @override_settings(PORTAL_WORKFLOW="public")
    def test_public_workflow_offers_every_state(self):
        self.assertEqual(state_choices(MediaPublishForm(self.owner, instance=self.private)), {"public", "private", "unlisted"})

    def test_restricted_workflows_hide_public_from_regular_users(self):
        for workflow in ["private", "unlisted", "private_verified"]:
            with self.subTest(workflow=workflow), override_settings(PORTAL_WORKFLOW=workflow):
                self.assertEqual(state_choices(MediaPublishForm(self.owner, instance=self.private)), {"private", "unlisted"})

    @override_settings(PORTAL_WORKFLOW="private")
    def test_media_already_public_keeps_its_state_as_a_choice(self):
        self.assertEqual(state_choices(MediaPublishForm(self.owner, instance=self.public)), {"public", "private", "unlisted"})

    @override_settings(PORTAL_WORKFLOW="private")
    def test_editors_may_always_choose_public(self):
        self.assertIn("public", state_choices(MediaPublishForm(self.editor, instance=self.private)))

    def test_shared_starts_checked_only_for_shared_media(self):
        self.assertFalse(MediaPublishForm(self.owner, instance=self.public).initial["shared"])
        MediaPermission.objects.create(owner_user=self.owner, user=self.editor, media=self.public, permission="viewer")
        self.assertTrue(MediaPublishForm(self.owner, instance=self.public).initial["shared"])

    def test_embed_mode_limits_categories_to_lms_courses(self):
        course = Category.objects.create(title="Course 101", is_lms_course=True)
        for request in [RequestFactory().get("/publish", {"mode": "lms_embed_mode"}), RequestFactory().get("/publish")]:
            request.session = {} if request.GET else {"lms_embed_mode": "true"}
            with self.subTest(source="query" if request.GET else "session"):
                form = MediaPublishForm(self.owner, instance=self.public, request=request)
                self.assertEqual(list(form.fields["category"].queryset), [course])
                self.assertEqual(form.fields["category"].label, "Course")
                self.assertTrue(form.fields["category"].widget.is_lms_mode)

    def test_without_embed_mode_every_category_is_offered(self):
        request = RequestFactory().get("/publish")
        request.session = {}
        form = MediaPublishForm(self.owner, instance=self.public, request=request)
        self.assertEqual(form.fields["category"].queryset.count(), Category.objects.count())


@override_settings(USE_RBAC=True)
class PublishFormRbacCategoriesTest(TestCase):
    fixtures = ["fixtures/categories.json"]

    @classmethod
    def setUpTestData(cls):
        cls.owner = create_account()
        cls.editor = create_account(is_editor=True)
        cls.contributed = Category.objects.create(title="RBAC contributed", is_rbac_category=True)
        cls.member_only = Category.objects.create(title="RBAC member only", is_rbac_category=True)
        cls.foreign = Category.objects.create(title="RBAC foreign", is_rbac_category=True)
        contributor_group = RBACGroup.objects.create(name=f"contrib {uuid.uuid4().hex[:6]}")
        contributor_group.categories.add(cls.contributed)
        RBACMembership.objects.create(user=cls.owner, rbac_group=contributor_group, role="contributor")
        member_group = RBACGroup.objects.create(name=f"member {uuid.uuid4().hex[:6]}")
        member_group.categories.add(cls.member_only)
        RBACMembership.objects.create(user=cls.owner, rbac_group=member_group, role="member")
        cls.media = create_media(cls.owner, title="rbac publish media")

    def test_regular_user_sees_public_categories_and_those_they_contribute_to(self):
        offered = set(MediaPublishForm(self.owner, instance=self.media).fields["category"].queryset)
        self.assertIn(self.contributed, offered)
        self.assertIn(Category.objects.get(title="Art"), offered)
        self.assertNotIn(self.member_only, offered)
        self.assertNotIn(self.foreign, offered)

    def test_categories_already_on_the_media_stay_selectable(self):
        self.media.category.add(self.foreign)
        self.assertIn(self.foreign, MediaPublishForm(self.owner, instance=self.media).fields["category"].queryset)

    def test_editor_sees_every_category(self):
        self.assertEqual(MediaPublishForm(self.editor, instance=self.media).fields["category"].queryset.count(), Category.objects.count())


class PublishMediaSubmitTest(TestCase):
    fixtures = ["fixtures/categories.json"]

    def setUp(self):
        self.owner = create_account()
        self.editor = create_account(is_editor=True)
        self.media = create_media(self.owner, title="publish submit", state="private")
        self.art = Category.objects.get(title="Art")

    def post(self, user, **data):
        self.client.force_login(user)
        payload = {"state": "private", "allow_download": "on"}
        payload.update(data)
        return self.client.post(f"/publish?m={self.media.friendly_token}", payload)

    def reload(self):
        return Media.objects.get(pk=self.media.pk)

    @override_settings(PORTAL_WORKFLOW="public")
    def test_owner_publishes_and_categorises_media(self):
        response = self.post(self.owner, state="public", category=[self.art.pk], allow_download="")
        self.assertRedirects(response, self.media.get_absolute_url(), fetch_redirect_response=False)
        media = self.reload()
        self.assertEqual(media.state, "public")
        self.assertTrue(media.listable)
        self.assertFalse(media.allow_download)
        self.assertEqual(list(media.category.all()), [self.art])
        api = self.client.get(f"/api/v1/media/{self.media.friendly_token}").json()
        self.assertEqual(api["state"], "public")
        self.assertEqual([category["title"] for category in api["categories_info"]], ["Art"])

    def test_restricted_workflows_refuse_public_from_regular_users(self):
        for workflow in ["private", "unlisted"]:
            with self.subTest(workflow=workflow), override_settings(PORTAL_WORKFLOW=workflow):
                response = self.post(self.owner, state="public")
                self.assertEqual(response.status_code, 200)
                self.assertIn("state", response.context["form"].errors)
                self.assertEqual(self.reload().state, "private")

    @override_settings(PORTAL_WORKFLOW="unlisted")
    def test_restricted_workflow_still_allows_unlisted(self):
        self.post(self.owner, state="unlisted")
        self.assertEqual(self.reload().state, "unlisted")

    @override_settings(PORTAL_WORKFLOW="private")
    def test_editor_may_publish_under_a_private_workflow(self):
        self.post(self.editor, state="public", reported_times="0", is_reviewed="on")
        self.assertEqual(self.reload().state, "public")

    def test_regular_user_cannot_feature_review_or_reset_reports(self):
        Media.objects.filter(pk=self.media.pk).update(reported_times=3, is_reviewed=False)
        self.post(self.owner, featured="on", is_reviewed="on", reported_times="0")
        media = self.reload()
        self.assertEqual((media.featured, media.is_reviewed, media.reported_times), (False, False, 3))

    def test_editor_moderates_media(self):
        Media.objects.filter(pk=self.media.pk).update(reported_times=3)
        self.post(self.editor, state="public", featured="on", reported_times="0")
        media = self.reload()
        self.assertEqual((media.featured, media.is_reviewed, media.reported_times), (True, False, 0))
        self.assertFalse(media.listable)

    def test_marking_shared_grants_the_publisher_an_owner_permission(self):
        self.post(self.owner, shared="on")
        permission = MediaPermission.objects.get(media=self.media)
        self.assertEqual((permission.user, permission.permission), (self.owner, "owner"))
        self.assertTrue(self.reload().is_shared)

    def test_unsharing_requires_confirmation(self):
        viewer = create_account()
        MediaPermission.objects.create(owner_user=self.owner, user=viewer, media=self.media, permission="viewer")
        response = self.post(self.owner)
        self.assertIn("confirm_state", response.context["form"].errors)
        self.assertTrue(MediaPermission.objects.filter(media=self.media, user=viewer).exists())

    def test_confirmed_unsharing_removes_every_permission(self):
        viewer = create_account()
        MediaPermission.objects.create(owner_user=self.owner, user=viewer, media=self.media, permission="viewer")
        MediaPermission.objects.create(owner_user=self.owner, user=self.editor, media=self.media, permission="editor")
        self.post(self.owner, confirm_state="on")
        media = self.reload()
        self.assertFalse(media.permissions.exists())
        self.assertFalse(media.is_shared)

    def test_other_user_cannot_publish(self):
        response = self.post(create_account(), state="public")
        self.assertRedirects(response, "/", fetch_redirect_response=False)
        self.assertEqual(self.reload().state, "private")


class CategoryModalWidgetTest(TestCase):
    fixtures = ["fixtures/categories.json"]

    def test_widget_embeds_categories_and_the_selection_as_json(self):
        course = Category.objects.create(title="Widget course", is_lms_course=True)
        widget = CategoryModalWidget()
        widget.choices = [("", "---"), (course.pk, course.title), (999999, "Vanished")]
        data = widget_data(widget.render("category", [course.pk]))
        self.assertEqual(data["selected"], [str(course.pk)])
        self.assertFalse(data["lms_mode"])
        self.assertEqual(data["all"], [{"id": str(course.pk), "title": "Widget course", "is_lms_course": True}, {"id": "999999", "title": "Vanished", "is_lms_course": False}])

    def test_lms_mode_relabels_the_widget(self):
        widget = CategoryModalWidget()
        widget.choices = []
        widget.is_lms_mode = True
        html = widget.render("category", None)
        self.assertIn('placeholder="Search courses..."', html)
        self.assertIn("<h3>Selected Courses</h3>", html)
        self.assertTrue(widget_data(html)["lms_mode"])

    def test_publish_page_renders_the_widget_with_current_categories(self):
        owner = create_account()
        art = Category.objects.get(title="Art")
        media = create_media(owner, title="widget page media", category=[art])
        self.client.force_login(owner)
        response = self.client.get(f"/publish?m={media.friendly_token}")
        data = widget_data(response.content.decode())
        self.assertEqual(data["selected"], [str(art.pk)])
        self.assertEqual(len(data["all"]), Category.objects.count())
