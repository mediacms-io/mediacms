import re

from django.contrib import admin
from django.contrib.admin import RelatedOnlyFieldListFilter
from django.contrib.admin.filters import FieldListFilter
from django.core.exceptions import FieldDoesNotExist
from django.db import models
from django.test import RequestFactory, TestCase
from django.urls import reverse

from files.models import Comment, EncodeProfile, Media, MediaPermission
from files.templatetags.admin_filters import (
    classify_filter,
    clear_filters_query,
    filter_id,
    prepared_filter_choices,
    search_hint,
)
from files.tests import create_media
from tests.admin.test_admin_files import make_user
from users.models import User


class ChangelistFilterWidgetTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("filter_widget_admin", is_superuser=True)

    def _changelist(self, model, params=None):
        request = RequestFactory().get("/admin/", params or {})
        request.user = self.superuser
        request.session = {}
        model_admin = admin.site._registry[model]
        return model_admin.get_changelist_instance(request)

    def _widgets(self, model):
        changelist = self._changelist(model)
        return {filter_id(spec): classify_filter(spec) for spec in changelist.filter_specs}

    def test_media_filters_use_segmented_boolean_and_select_widgets(self):
        widgets = self._widgets(Media)
        self.assertEqual(widgets["is_reviewed"], "boolean")
        self.assertEqual(widgets["featured"], "boolean")
        self.assertEqual(widgets["listable"], "boolean")
        self.assertEqual(widgets["allow_download"], "boolean")
        self.assertEqual(widgets["enable_comments"], "boolean")
        self.assertEqual(widgets["state"], "segmented")
        self.assertEqual(widgets["media_type"], "segmented")
        self.assertEqual(widgets["encoding_status"], "segmented")
        self.assertEqual(widgets["encoding_queue"], "segmented")
        self.assertEqual(widgets["reported"], "segmented")

    def test_related_filters_stay_labeled_selects(self):
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        request.session = {}
        model_admin = admin.site._registry[Media]
        category = FieldListFilter.create(Media._meta.get_field("category"), request, {}, Media, model_admin, "category")
        tags = RelatedOnlyFieldListFilter(Media._meta.get_field("tags"), request, {}, Media, model_admin, "tags")
        user = RelatedOnlyFieldListFilter(Media._meta.get_field("user"), request, {}, Media, model_admin, "user")
        self.assertEqual(classify_filter(category), "select")
        self.assertEqual(classify_filter(tags), "select")
        self.assertEqual(classify_filter(user), "select")

    def test_boolean_choices_keep_exact_query_params(self):
        changelist = self._changelist(Media)
        spec = next(spec for spec in changelist.filter_specs if filter_id(spec) == "is_reviewed")
        choices = prepared_filter_choices(spec, changelist)
        params = [choice["params"] for choice in choices]
        self.assertIn({}, params)
        self.assertIn({"is_reviewed__exact": "1"}, params)
        self.assertIn({"is_reviewed__exact": "0"}, params)

    def test_encoding_queue_choices_keep_dashboard_params(self):
        changelist = self._changelist(Media)
        spec = next(spec for spec in changelist.filter_specs if filter_id(spec) == "encoding_queue")
        params = [choice["params"] for choice in prepared_filter_choices(spec, changelist)]
        self.assertIn({"encoding_queue": "yes"}, params)
        self.assertIn({"encoding_queue": "fail"}, params)

    def test_date_filters_stay_labeled_selects(self):
        changelist = self._changelist(Comment)
        widgets = {filter_id(spec): classify_filter(spec) for spec in changelist.filter_specs}
        self.assertEqual(widgets["add_date"], "date")
        spec = next(spec for spec in changelist.filter_specs if filter_id(spec) == "add_date")
        dated = [choice["params"] for choice in prepared_filter_choices(spec, changelist) if choice["params"]]
        self.assertTrue(dated)
        self.assertTrue(all({"add_date__gte", "add_date__lt"} <= set(choice) for choice in dated))

    def test_single_choice_filters_are_checkboxes_and_long_lists_stay_selects(self):
        user_widgets = self._widgets(User)
        self.assertEqual(user_widgets["is_active"], "boolean")
        self.assertEqual(user_widgets["joined"], "checkbox")
        self.assertEqual(user_widgets["activity"], "checkbox")
        self.assertEqual(user_widgets["role"], "checkbox")

        profile_widgets = self._widgets(EncodeProfile)
        self.assertEqual(profile_widgets["active"], "boolean")
        self.assertEqual(profile_widgets["extension"], "segmented")
        self.assertEqual(profile_widgets["codec"], "segmented")
        self.assertEqual(profile_widgets["resolution"], "select")

    def test_search_hint_names_the_fields_for_that_model(self):
        self.assertEqual(
            search_hint(Media, ["title", "user__username", "friendly_token"]),
            "Title, Username, or Friendly token",
        )
        self.assertEqual(
            search_hint(Comment, ["text", "user__username", "media__title"]),
            "Text, Username, or Media title",
        )
        self.assertEqual(
            search_hint(User, ["email", "username", "name"]),
            "Email address, Username, or Full name",
        )
        self.assertEqual(
            search_hint(MediaPermission, ["media__title", "user__username", "owner_user__username"]),
            "Media title, User username, or Owner user username",
        )

    def test_clear_filters_keeps_search_and_drops_filter_and_page_params(self):
        changelist = self._changelist(Media, {"q": "public", "is_reviewed__exact": "0", "p": "2"})
        query = clear_filters_query(changelist)
        self.assertIn("q=public", query)
        self.assertNotIn("is_reviewed", query)
        self.assertNotIn("p=2", query)


class ChangelistFilterBarTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("filter_bar_admin", is_superuser=True)
        create_media(cls.superuser, title="filter bar alpha")
        create_media(cls.superuser, title="filter bar beta")

    def setUp(self):
        self.client.force_login(self.superuser)

    def test_media_filter_bar_is_collapsed_and_preserves_column_params(self):
        url = reverse("admin:files_media_changelist")
        response = self.client.get(url, {"q": "alpha"})
        html = response.content.decode()
        self.assertContains(response, 'class="changelist-filter-card"')
        self.assertNotContains(response, 'class="changelist-filter-card" open')
        self.assertContains(response, "is_reviewed__exact")
        self.assertContains(response, "enable_comments__exact")
        self.assertContains(response, "encoding_queue")
        self.assertLess(html.find("changelist-search-submit"), html.find("changelist-result-count"))
        self.assertLess(html.find('class="media-column-chooser'), html.find('id="changelist-form"'))

        filtered = self.client.get(url, {"is_reviewed__exact": "0", "enable_comments__exact": "1"})
        display = list(filtered.context["cl"].list_display)
        self.assertIn("is_reviewed", display)
        self.assertIn("enable_comments", display)
        self.assertContains(filtered, "changelist-filter-chip")
        self.assertContains(filtered, "Clear filters")
        self.assertContains(filtered, "Shown because an active filter needs this column")
        self.assertNotContains(filtered, 'class="changelist-filter-card" open')
        self.assertRegex(filtered.content.decode(), r'href="\?" class="changelist-filter-clear"')

        cleared = self.client.get(url)
        cleared_display = list(cleared.context["cl"].list_display)
        self.assertNotIn("is_reviewed", cleared_display)
        self.assertNotIn("enable_comments", cleared_display)

    def test_clear_filters_keeps_the_search_query(self):
        url = reverse("admin:files_media_changelist")
        response = self.client.get(url, {"q": "public", "is_reviewed__exact": "1"})
        match = re.search(r'href="([^"]*)" class="changelist-filter-clear"', response.content.decode())
        self.assertIsNotNone(match)
        self.assertIn("q=public", match.group(1))
        self.assertNotIn("is_reviewed", match.group(1))

    def test_encoding_queue_filter_still_shows_the_encodings_column(self):
        response = self.client.get(reverse("admin:files_media_changelist"), {"encoding_queue": "yes"})
        self.assertIn("get_encodings_count", response.context["cl"].list_display)

    def test_search_placeholder_matches_the_model_fields(self):
        media = self.client.get(reverse("admin:files_media_changelist"))
        self.assertContains(media, 'placeholder="Title, Username, or Friendly token"')
        users = self.client.get(reverse("admin:users_user_changelist"))
        self.assertContains(users, 'placeholder="Email address, Username, or Full name"')
        comments = self.client.get(reverse("admin:files_comment_changelist"))
        self.assertContains(comments, 'placeholder="Text, Username, or Media title"')

    def test_search_only_changelist_has_no_filter_card(self):
        response = self.client.get(reverse("admin:files_tag_changelist"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="searchbar"')
        self.assertNotContains(response, "changelist-filter-card")

    def test_date_and_checkbox_filters_render_their_widgets(self):
        comments = self.client.get(reverse("admin:files_comment_changelist"))
        self.assertContains(comments, "changelist-filter-field--date")
        self.assertContains(comments, "Any date")

        users = self.client.get(reverse("admin:users_user_changelist"))
        self.assertContains(users, "changelist-filter-field--checkbox")
        self.assertContains(users, "Last 7 days")
        self.assertContains(users, "Activity in the last 30 days")
        self.assertNotContains(users, "Uploaded in the last 30 days")
        self.assertContains(users, "changelist-filter-field--boolean")

    def test_date_sorted_changelists_lead_with_that_date(self):
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        request.session = {}
        checked = []
        for model, model_admin in admin.site._registry.items():
            ordering = model_admin.ordering or model._meta.ordering
            if not ordering or not isinstance(ordering[0], str):
                continue
            field_name = ordering[0].removeprefix("-")
            try:
                field = model._meta.get_field(field_name)
            except FieldDoesNotExist:
                continue
            if not isinstance(field, models.DateField):
                continue
            display = list(model_admin.get_list_display(request))
            self.assertEqual(display[0], field_name, model._meta.label)
            checked.append(model._meta.label)
        self.assertIn("files.Media", checked)
        self.assertIn("users.User", checked)
        self.assertIn("files.Category", checked)
