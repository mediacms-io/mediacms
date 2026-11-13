import importlib
import os
from unittest.mock import patch

from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialApp
from django.conf import settings
from django.contrib import admin
from django.contrib.admin import AdminSite
from django.contrib.admin.sites import all_sites
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory, TestCase, override_settings
from django.urls import reverse

import users.admin
from actions.models import MediaAction
from files.admin import MEDIA_REPORT_TAB_ACTIONS, CategoryAdminForm, MediaAdminForm, PageAdminForm, format_thumbnail_clock, parse_thumbnail_clock
from files.admin_helpers import ADMIN_CLIPPED_TEXT_LENGTH, clipped_admin_text
from files.methods import (
    can_delete_original_media_file,
    delete_original_media_file,
    media_has_original_file,
)
from files.models import (
    Category,
    Comment,
    EncodeProfile,
    Encoding,
    Language,
    License,
    Media,
    MediaPermission,
    Page,
    Playlist,
    PlaylistMedia,
    Subtitle,
    Tag,
    TinyMCEMedia,
    TranscriptionRequest,
    VideoTrimRequest,
)
from files.tests import create_account, create_media
from files.tests.media_utils import SMALL_VIDEO
from rbac.models import RBACGroup
from users.models import Channel, User

PASSWORD = "admin-files-password"


def make_user(username, **kwargs):
    return create_account(username=username, email=f"{username}@example.com", password=PASSWORD, **kwargs)


def category_form_data(category, **overrides):
    data = {
        "uid": category.uid,
        "title": category.title,
        "description": "",
        "is_global": "",
        "media_count": 0,
        "is_rbac_category": "",
        "is_lms_course": "",
        "lti_context_id": "",
        "rbac_groups": [],
        # CategoryMediaInline management form (empty by default)
        "Media_category-TOTAL_FORMS": "0",
        "Media_category-INITIAL_FORMS": "0",
        "Media_category-MIN_NUM_FORMS": "0",
        "Media_category-MAX_NUM_FORMS": "1000",
    }
    data.update(overrides)
    return data


class AdminRequestMixin:
    def admin_request(self):
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        return request


class MediaAdminTest(AdminRequestMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("files_admin_root", is_superuser=True)
        cls.category = Category.objects.create(title="Admin filter category")
        cls.public = create_media(cls.superuser, title="admin public media", state="public")
        cls.private = create_media(cls.superuser, title="admin private media", state="private", category=[cls.category])

    def setUp(self):
        self.client.force_login(self.superuser)

    def changelist_titles(self, **params):
        response = self.client.get(reverse("admin:files_media_changelist"), params)
        self.assertEqual(response.status_code, 200)
        return {media.title for media in response.context["cl"].result_list}

    def test_state_and_category_filters_narrow_changelist(self):
        self.assertEqual(self.changelist_titles(state="private"), {"admin private media"})
        self.assertEqual(self.changelist_titles(category__id__exact=self.category.pk), {"admin private media"})
        self.assertEqual(self.changelist_titles(q="public"), {"admin public media"})

    def test_changelist_eye_link_sort_hint_and_collapsed_column_chooser(self):
        response = self.client.get(reverse("admin:files_media_changelist"))
        html = response.content.decode()
        self.assertContains(response, reverse("get_media") + f"?m={self.public.friendly_token}")
        self.assertContains(response, "open-on-site")
        self.assertContains(response, "changelist-sort-hint")
        self.assertIn('<details class="media-column-chooser admin-column-chooser card card-outline card-secondary mb-3">', html)
        self.assertNotIn('<details class="media-column-chooser admin-column-chooser card card-outline card-secondary mb-3" open>', html)

        self.client.get(reverse("admin:files_media_changelist"), {"set_media_columns": "1", "media_col": ["link_user"]})
        opened = self.client.get(reverse("admin:files_media_changelist"))
        self.assertContains(opened, '<details class="media-column-chooser admin-column-chooser card card-outline card-secondary mb-3" open>')

    def test_comments_count_column_links_to_filtered_comments(self):
        model_admin = admin.site._registry[Media]
        html = str(model_admin.get_comments_count(self.public))
        self.assertIn("0 comments", html)
        self.assertIn(f"media__id__exact={self.public.pk}", html)
        self.assertIn(reverse("admin:files_comment_changelist"), html)

    def test_generate_missing_encodings_action_encodes_selected_media_without_forcing(self):
        with patch.object(Media, "encode") as encode:
            response = self.client.post(reverse("admin:files_media_changelist"), {"action": "generate_missing_encodings", "_selected_action": [self.public.pk, self.private.pk]})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(encode.call_count, 2)
        for call in encode.call_args_list:
            self.assertEqual(call.kwargs, {"force": False})

    def test_action_requires_change_permission(self):
        model_admin = admin.site._registry[Media]
        viewer = make_user("files_admin_viewer")
        request = RequestFactory().get("/admin/")
        request.user = viewer
        self.assertNotIn("generate_missing_encodings", model_admin.get_actions(request))
        self.assertIn("generate_missing_encodings", model_admin.get_actions(self.admin_request()))

    def test_reported_and_media_type_filters(self):
        self.public.reported_times = 3
        self.public.save(update_fields=["reported_times"])
        self.assertEqual(self.changelist_titles(reported="yes"), {"admin public media"})
        self.assertEqual(self.changelist_titles(reported="clean"), {"admin private media"})
        self.assertIn("admin public media", self.changelist_titles(media_type__exact=self.public.media_type))

    @override_settings(REPORTED_TIMES_THRESHOLD=2)
    def test_reported_threshold_filter(self):
        self.public.reported_times = 5
        self.public.save(update_fields=["reported_times"])
        self.private.reported_times = 1
        self.private.save(update_fields=["reported_times"])
        self.assertEqual(self.changelist_titles(reported="threshold"), {"admin public media"})

    def test_search_by_username_and_friendly_token(self):
        self.assertEqual(self.changelist_titles(q=self.superuser.username), {"admin public media", "admin private media"})
        self.assertEqual(self.changelist_titles(q=self.public.friendly_token), {"admin public media"})

    def test_mark_as_reviewed_action(self):
        self.public.is_reviewed = False
        self.public.save()
        response = self.client.post(
            reverse("admin:files_media_changelist"),
            {"action": "mark_as_reviewed", "_selected_action": [self.public.pk]},
        )
        self.assertEqual(response.status_code, 302)
        self.public.refresh_from_db()
        self.assertTrue(self.public.is_reviewed)
        reviewed = MediaAction.objects.filter(media=self.public, action="media_reviewed")
        self.assertEqual(reviewed.count(), 1)
        self.assertEqual(reviewed.get().user_id, self.superuser.pk)

    def test_clear_reports_action_resets_counter_and_deletes_actions(self):
        MediaAction.objects.create(user=self.superuser, media=self.public, action="report", extra_info="spam")
        self.public.reported_times = 4
        self.public.save(update_fields=["reported_times"])
        response = self.client.post(
            reverse("admin:files_media_changelist"),
            {"action": "clear_reports", "_selected_action": [self.public.pk]},
        )
        self.assertEqual(response.status_code, 302)
        self.public.refresh_from_db()
        self.assertEqual(self.public.reported_times, 0)
        self.assertFalse(MediaAction.objects.filter(media=self.public, action="report").exists())
        cleared = MediaAction.objects.get(media=self.public, action="report_cleared")
        self.assertEqual(cleared.user_id, self.superuser.pk)
        self.assertIn("cleared 1 report", cleared.extra_info)
        self.assertIn("spam", cleared.extra_info)

    def test_set_state_and_toggle_download_actions(self):
        response = self.client.post(
            reverse("admin:files_media_changelist"),
            {"action": "set_state_private", "_selected_action": [self.public.pk]},
        )
        self.assertEqual(response.status_code, 302)
        self.public.refresh_from_db()
        self.assertEqual(self.public.state, "private")

        response = self.client.post(
            reverse("admin:files_media_changelist"),
            {"action": "disable_download", "_selected_action": [self.public.pk]},
        )
        self.assertEqual(response.status_code, 302)
        self.public.refresh_from_db()
        self.assertFalse(self.public.allow_download)

    def test_list_editable_fields_are_configured(self):
        model_admin = admin.site._registry[Media]
        for field in ("is_reviewed", "featured", "allow_download", "enable_comments"):
            self.assertIn(field, model_admin.list_editable)
            self.assertIn(field, model_admin.list_display)

    def test_changelist_status_columns_render_icons_with_translated_titles(self):
        self.public.encoding_status = "success"
        self.public.state = "public"
        self.public.is_reviewed = True
        self.public.reported_times = 3
        self.public.save(update_fields=["encoding_status", "state", "is_reviewed", "reported_times", "listable"])
        self.public.refresh_from_db()
        response = self.client.get(
            reverse("admin:files_media_changelist"),
            {"set_media_columns": "1", "media_col": ["display_reported_times"]},
        )
        self.assertEqual(response.status_code, 302)
        response = self.client.get(reverse("admin:files_media_changelist"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "changelist-status-icon")
        # create_media fixtures are images; public+reviewed+success should be listable.
        self.assertContains(response, "fas fa-image")
        self.assertContains(response, 'title="Image"')
        self.assertContains(response, "fas fa-globe")
        self.assertContains(response, 'title="Public"')
        self.assertContains(response, "fas fa-check-circle")
        self.assertContains(response, 'title="Success"')
        self.assertContains(response, "fas fa-eye")
        self.assertContains(response, "fas fa-flag")
        self.assertContains(response, "Reported times: 3")

    def test_changelist_title_is_clipped_and_encoding_count_is_numeric(self):
        # Media.title max_length is 100; keep under that but past the clip limit.
        long_title = ("wrap-title-" * 9)[:100]
        self.assertGreater(len(long_title), ADMIN_CLIPPED_TEXT_LENGTH)
        create_media(self.superuser, title=long_title, encoding_status="fail")
        url = reverse("admin:files_media_changelist")
        self.client.get(
            url,
            {"set_media_columns": "1", "media_col": ["get_encodings_count"]},
        )
        response = self.client.get(url, {"encoding_status__exact": "fail"})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "changelist-clipped-text__preview")
        self.assertContains(response, "changelist-clipped-text__full")
        self.assertContains(response, long_title)
        self.assertContains(response, 'title="0 encodings"')
        self.assertNotContains(response, ">0 encodings<")
        html = response.content.decode()
        self.assertRegex(html, r'field-get_encodings_count[^>]*>[\s\S]*?>0<')

    def _media_admin_request(self, params=None, session=None):
        request = RequestFactory().get("/admin/files/media/", params or {})
        request.user = self.superuser
        request.session = session if session is not None else {}
        return request

    def test_optional_columns_hidden_by_default_and_listable_shown(self):
        model_admin = admin.site._registry[Media]
        display = model_admin.get_list_display(self._media_admin_request())
        for column in (
            "link_user",
            "display_duration",
            "is_reviewed",
            "featured",
            "get_comments_count",
            "get_encodings_count",
            "display_reported_times",
            "allow_download",
            "enable_comments",
        ):
            self.assertNotIn(column, display)
        self.assertIn("display_listable", display)
        self.assertIn("display_title", display)
        self.assertIn("add_date", display)
        editable = model_admin.get_list_editable(self._media_admin_request())
        self.assertEqual(editable, ())

    def test_user_column_can_be_enabled_via_chooser(self):
        url = reverse("admin:files_media_changelist")
        response = self.client.get(url)
        self.assertContains(response, 'value="link_user"')
        self.assertNotContains(response, 'class="field-link_user"')

        response = self.client.get(url, {"set_media_columns": "1", "media_col": ["link_user"]})
        self.assertEqual(response.status_code, 302)
        response = self.client.get(url)
        display = list(response.context["cl"].list_display)
        self.assertIn("link_user", display)
        self.assertContains(response, 'class="field-link_user"')

    def test_queryset_skips_count_annotations_when_optional_columns_hidden(self):
        model_admin = admin.site._registry[Media]
        hidden_request = self._media_admin_request()
        hidden_qs = model_admin.get_queryset(hidden_request)
        self.assertNotIn("_comments_count", hidden_qs.query.annotations)
        self.assertNotIn("_encodings_count", hidden_qs.query.annotations)

        encoding_request = self._media_admin_request({"encoding_status__exact": "pending"})
        encoding_qs = model_admin.get_queryset(encoding_request)
        self.assertIn("_encodings_count", encoding_qs.query.annotations)
        self.assertNotIn("_comments_count", encoding_qs.query.annotations)

        session = {"mediacms_media_admin_optional_columns": ["get_comments_count", "get_encodings_count"]}
        visible_request = self._media_admin_request(session=session)
        visible_qs = model_admin.get_queryset(visible_request)
        self.assertIn("_comments_count", visible_qs.query.annotations)
        self.assertIn("_encodings_count", visible_qs.query.annotations)

    def test_related_filters_force_optional_columns(self):
        model_admin = admin.site._registry[Media]
        reviewed = model_admin.get_list_display(self._media_admin_request({"is_reviewed__exact": "0"}))
        self.assertIn("is_reviewed", reviewed)
        featured = model_admin.get_list_display(self._media_admin_request({"featured__exact": "1"}))
        self.assertIn("featured", featured)
        reported = model_admin.get_list_display(self._media_admin_request({"reported": "yes"}))
        self.assertIn("display_reported_times", reported)
        encodings = model_admin.get_list_display(self._media_admin_request({"encoding_status__exact": "pending"}))
        self.assertIn("get_encodings_count", encodings)
        queue = model_admin.get_list_display(self._media_admin_request({"encoding_queue": "pending"}))
        self.assertIn("get_encodings_count", queue)
        downloads = model_admin.get_list_display(self._media_admin_request({"allow_download__exact": "0"}))
        self.assertIn("allow_download", downloads)
        comments = model_admin.get_list_display(self._media_admin_request({"enable_comments__exact": "1"}))
        self.assertIn("enable_comments", comments)

    @override_settings(SECURE_SSL_REDIRECT=False)
    def test_column_chooser_persists_selection_in_session(self):
        url = reverse("admin:files_media_changelist")
        response = self.client.get(url, {"set_media_columns": "1", "media_col": ["display_duration", "allow_download"], "state": "public"})
        self.assertEqual(response.status_code, 302)
        self.assertIn("state=public", response["Location"])
        self.assertNotIn("set_media_columns", response["Location"])
        self.assertNotIn("media_col", response["Location"])

        response = self.client.get(url, {"state": "public"})
        self.assertEqual(response.status_code, 200)
        display = list(response.context["cl"].list_display)
        self.assertIn("display_duration", display)
        self.assertIn("allow_download", display)
        self.assertNotIn("display_reported_times", display)
        self.assertContains(response, "fa-stopwatch")
        self.assertContains(response, "column-display_duration")
        html = response.content.decode()
        legend = html.split('class="changelist-icon-legend"', 1)[1].split("</details>", 1)[0]
        self.assertIn("Duration", legend)
        self.assertIn("display_listable", display)
        self.assertContains(response, "Apply columns")
        self.assertContains(response, "Reset columns")
        self.assertContains(response, 'name="media_col"')
        self.assertContains(response, 'name="reset_media_columns"')
        # Column chooser must render outside the changelist POST form.
        html = response.content.decode()
        chooser_pos = html.find("media-column-chooser")
        form_pos = html.find('id="changelist-form"')
        self.assertNotEqual(chooser_pos, -1)
        self.assertNotEqual(form_pos, -1)
        self.assertLess(chooser_pos, form_pos)

    @override_settings(SECURE_SSL_REDIRECT=False)
    def test_column_chooser_reset_clears_session_selection(self):
        url = reverse("admin:files_media_changelist")
        self.client.get(url, {"set_media_columns": "1", "media_col": ["display_duration", "allow_download"]})
        response = self.client.get(url)
        display = list(response.context["cl"].list_display)
        self.assertIn("display_duration", display)
        self.assertIn("allow_download", display)

        response = self.client.get(
            url,
            {
                "set_media_columns": "1",
                "reset_media_columns": "1",
                "media_col": ["display_duration", "allow_download"],
                "state": "public",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("state=public", response["Location"])
        self.assertNotIn("reset_media_columns", response["Location"])
        self.assertNotIn("set_media_columns", response["Location"])
        self.assertNotIn("media_col", response["Location"])

        response = self.client.get(url, {"state": "public"})
        display = list(response.context["cl"].list_display)
        self.assertNotIn("display_duration", display)
        self.assertNotIn("allow_download", display)
        self.assertNotIn("display_reported_times", display)

    def test_encode_profile_list_editable_active(self):
        model_admin = admin.site._registry[EncodeProfile]
        self.assertIn("active", model_admin.list_editable)
        self.assertIn("active", model_admin.list_display)
        self.assertEqual(model_admin.ordering, ("-active", "resolution", "name"))

    def test_list_editable_save_lives_in_bulk_actions(self):
        self.client.force_login(self.superuser)
        response = self.client.get(reverse("admin:files_encodeprofile_changelist"))
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn("changelist-list-editable-save", html)
        self.assertIn('name="_save"', html)
        # Bulk actions (with Save) appear above and below the table; not in pagination.
        self.assertEqual(html.count('class="actions'), 2)
        self.assertEqual(html.count("changelist-list-editable-save"), 2)
        self.assertIn("change-list-actions-bottom", html)
        self.assertNotIn('name="_save"', html.split('class="dataTables_info"', 1)[-1].split("</div>", 1)[0])

    def test_reports_tab_shows_report_and_moderation_actions(self):
        model_admin = admin.site._registry[Media]
        fieldsets = model_admin.get_fieldsets(self.admin_request(), obj=self.public)
        reports_fieldsets = [options for name, options in fieldsets if name == "Reports"]
        self.assertEqual(len(reports_fieldsets), 1)
        self.assertEqual(reports_fieldsets[0]["fields"], ("reported_times", "report_actions_table"))
        self.assertIn("tab", reports_fieldsets[0]["classes"])
        content_fields = dict(fieldsets)["Content"]["fields"]
        self.assertNotIn("reported_times", content_fields)
        self.assertNotIn("report_actions_table", content_fields)

        MediaAction.objects.create(user=self.superuser, media=self.public, action="report", extra_info="spam")
        MediaAction.objects.create(user=self.superuser, media=self.public, action="report_cleared", extra_info="cleared 1")
        MediaAction.objects.create(user=self.superuser, media=self.public, action="media_reviewed")
        MediaAction.objects.create(user=self.superuser, media=self.public, action="like")

        html = str(model_admin.report_actions_table(self.public))
        self.assertNotIn("spam", html)
        self.assertIn('aria-label="Report"', html)
        self.assertIn("fa-flag", html)
        self.assertIn('aria-label="Report cleared"', html)
        self.assertIn(">Report cleared<", html)
        self.assertIn('aria-label="Media reviewed"', html)
        self.assertIn(">Media reviewed<", html)
        self.assertIn("/admin/actions/mediaaction/", html)
        self.assertNotIn(">Like<", html)
        self.assertNotIn("Extra info", html)
        self.assertNotIn(">IP<", html)
        self.assertLess(html.find(">When<"), html.find(">Action<"))
        self.assertLess(html.find(">Action<"), html.find(">Inspect<"))
        self.assertIn("report-actions-table__inspect", html)
        self.assertIn("fa-search", html)
        self.assertTrue(
            {
                "report",
                "report_cleared",
                "report_confirmed",
                "media_reviewed",
                "original_deleted",
                "metadata_refresh",
                "integrity_warning",
            }.issubset(set(MEDIA_REPORT_TAB_ACTIONS))
        )
        self.assertNotIn("related_reports", dict(fieldsets)["Related"]["fields"])
        self.assertIn("reported_times", model_admin.readonly_fields)

    def test_media_change_fieldsets_are_grouped_by_purpose(self):
        model_admin = admin.site._registry[Media]
        fieldsets = dict(model_admin.get_fieldsets(self.admin_request(), obj=self.public))
        self.assertEqual(
            list(fieldsets.keys()),
            ["Content", "Publishing", "Sharing", "Details", "Reports", "Related"],
        )
        self.assertEqual(fieldsets["Content"]["fields"][0], "title")
        self.assertNotIn("link_user", fieldsets["Content"]["fields"])
        self.assertNotIn("link_channel", fieldsets["Content"]["fields"])
        self.assertIn("media_file", fieldsets["Content"]["fields"])
        self.assertEqual(
            fieldsets["Content"]["fields"][-4:],
            ("display_current_poster", "uploaded_poster", "display_current_thumbnail", "uploaded_thumbnail"),
        )
        self.assertNotIn("thumbnail_time", fieldsets["Content"]["fields"])
        self.assertIn("media-content", fieldsets["Content"]["classes"])
        self.assertIn("title", fieldsets["Content"]["fields"])
        self.assertNotIn("rating_category", fieldsets["Content"]["fields"])
        self.assertNotIn("hls_file", fieldsets["Content"]["fields"])
        self.assertNotIn("sprites", fieldsets["Content"]["fields"])
        self.assertEqual(fieldsets["Publishing"]["fields"][0], "display_listable")
        self.assertIn("display_listable", model_admin.readonly_fields)
        listable = str(model_admin.display_listable(self.public))
        self.assertIn("fa-eye-slash", listable)
        self.assertIn(">No<", listable)
        self.public.listable = True
        listed = str(model_admin.display_listable(self.public))
        self.assertIn("fa-eye\"", listed)
        self.assertIn(">Yes<", listed)
        self.assertIn("state", fieldsets["Publishing"]["fields"])
        self.assertEqual(
            fieldsets["Sharing"]["fields"],
            ("allow_download", "enable_comments", "password"),
        )
        self.assertNotIn("allow_whisper_transcribe", fieldsets["Content"]["fields"])
        self.assertEqual(
            fieldsets["Details"]["fields"][:3],
            ("display_views", "display_likes", "display_dislikes"),
        )
        self.assertEqual(
            fieldsets["Details"]["fields"][3:],
            ("display_uid", "display_friendly_token", "display_md5sum", "display_media_info", "display_search"),
        )
        token = str(model_admin.display_friendly_token(self.public))
        self.assertIn(f'data-copy-value="{self.public.friendly_token}"', token)
        self.assertIn('title="Copy"', token)
        self.assertIn("fa-copy", token)
        self.assertIn(f'data-copy-value="{self.public.uid}"', str(model_admin.display_uid(self.public)))
        md5 = str(model_admin.display_md5sum(self.public))
        if self.public.md5sum:
            self.assertIn(f'data-copy-value="{self.public.md5sum}"', md5)
        else:
            self.assertEqual(md5, "—")
        self.assertNotIn("related_captions", fieldsets["Details"]["fields"])
        self.assertIn("related_captions", fieldsets["Related"]["fields"])
        self.assertIn("related_permissions", fieldsets["Related"]["fields"])
        self.assertIn("related-links-tab", fieldsets["Related"]["classes"])
        self.assertNotIn("allow_download", model_admin.readonly_fields)
        for machine_field in ("display_encoding_status", "duration", "md5sum", "search", "display_views"):
            self.assertIn(machine_field, model_admin.readonly_fields)
        self.assertIn("display_media_type", model_admin.readonly_fields)
        content_field_names = fieldsets["Content"]["fields"]
        self.assertNotIn("display_media_type", content_field_names)
        self.assertNotIn("display_encoding_status", content_field_names)
        self.assertNotIn("media_type", content_field_names)
        self.assertNotIn("encoding_status", content_field_names)
        self.assertFalse(getattr(model_admin, "inlines", ()))

    def test_media_file_fields_follow_type_and_glance_is_type_specific(self):
        model_admin = admin.site._registry[Media]
        video = create_media(self.superuser, filename=SMALL_VIDEO, title="fieldset video")
        video.video_height = 720
        video.duration = 65
        video.size = "1.2MB"
        pdf = create_media(self.superuser, filename="sample_document.pdf", title="fieldset pdf")
        audio = create_media(self.superuser, filename="sample_audio.mp3", title="fieldset audio")

        video_sets = dict(model_admin.get_fieldsets(self.admin_request(), obj=video))
        self.assertNotIn("Media file", video_sets)
        self.assertIn("thumbnail_time", video_sets["Content"]["fields"])
        self.assertIn("media_file", video_sets["Content"]["fields"])
        self.assertNotIn("hls_file", video_sets["Content"]["fields"])
        self.assertNotIn("sprites", video_sets["Content"]["fields"])
        labels = [card["label"] for card in model_admin._glance_cards(video)]
        self.assertEqual(
            labels,
            [
                "Media type",
                "State",
                "Is reviewed",
                "Featured",
                "User featured",
                "Listable",
                "User",
                "Channel",
                "Allow download",
                "Enable comments",
                "Duration",
                "Resolution",
                "Size",
                "Encoding status",
            ],
        )
        user_card = str(next(card["value"] for card in model_admin._glance_cards(video) if card["label"] == "User"))
        self.assertIn("fa-search", user_card)
        self.assertIn('title="Inspect"', user_card)
        self.assertNotIn(">Edit<", user_card)
        self.assertEqual(model_admin._format_duration(65), "1:05")
        self.assertEqual(model_admin._format_duration_brief(15), "15s")
        self.assertEqual(model_admin._format_duration_brief(15 * 60), "15m")
        self.assertEqual(model_admin._format_duration_brief(4 * 3600), "4h")
        self.assertEqual(model_admin._format_duration_brief(2 * 86400), "2d")
        self.assertEqual(model_admin._format_duration_clock(15), "0:15")
        self.assertEqual(model_admin._format_duration_clock(15 * 60), "15:00")
        self.assertEqual(model_admin._format_duration_clock(4 * 3600), "4:00:00")
        self.assertEqual(model_admin._format_duration_clock(2 * 86400), "2:00:00:00")
        self.assertEqual(model_admin._format_duration_clock(0), "0:00")
        video_duration = str(model_admin.display_duration(video))
        self.assertIn(">1m<", video_duration)
        self.assertIn('title="1:05"', video_duration)
        self.assertEqual(str(model_admin.display_duration(pdf)), "<span></span>")

        pdf_sets = dict(model_admin.get_fieldsets(self.admin_request(), obj=pdf))
        self.assertIn("media_file", pdf_sets["Content"]["fields"])
        self.assertNotIn("thumbnail_time", pdf_sets["Content"]["fields"])
        pdf_labels = [card["label"] for card in model_admin._glance_cards(pdf)]
        self.assertEqual(pdf_labels[:10], labels[:10])
        self.assertNotIn("Duration", pdf_labels)
        self.assertNotIn("Encoding status", pdf_labels)

        audio_sets = dict(model_admin.get_fieldsets(self.admin_request(), obj=audio))
        self.assertIn("media_file", audio_sets["Content"]["fields"])
        self.assertNotIn("hls_file", audio_sets["Content"]["fields"])
        audio_labels = [card["label"] for card in model_admin._glance_cards(audio)]
        self.assertEqual(audio_labels[:10], labels[:10])
        self.assertIn("Duration", audio_labels)
        self.assertNotIn("Resolution", audio_labels)

        views = str(model_admin.display_views(video))
        self.assertIn(f"media__id__exact={video.pk}", views)
        self.assertIn("action__exact=watch", views)
        self.assertIn("fa-search", views)
        self.assertIn('title="Inspect"', views)
        self.assertNotIn(">Inspect<", views)
        self.assertIn("action__exact=like", str(model_admin.display_likes(video)))
        self.assertIn("action__exact=dislike", str(model_admin.display_dislikes(video)))
        add_date = model_admin.formfield_for_dbfield(Media._meta.get_field("add_date"), self.admin_request())
        self.assertEqual(add_date.widget.input_type, "datetime-local")

    @override_settings(SECURE_SSL_REDIRECT=False)
    def test_thumbnail_time_is_a_clock_within_the_video(self):
        self.assertEqual(format_thumbnail_clock(3.14), "00:00:03.1")
        self.assertEqual(format_thumbnail_clock(3661.1), "01:01:01.1")
        self.assertEqual(parse_thumbnail_clock("00:01:05.0"), 65.0)
        self.assertEqual(parse_thumbnail_clock("65"), 65.0)

        video = create_media(self.superuser, filename=SMALL_VIDEO, title="thumbnail clock")
        video.duration = 65
        video.thumbnail_time = 3.14
        video.save()
        video.refresh_from_db()
        self.assertEqual(video.thumbnail_time, 3.1)

        model_admin = admin.site._registry[Media]
        form_class = model_admin.get_form(self.admin_request(), obj=video)
        self.assertTrue(issubclass(form_class, MediaAdminForm))
        bound = form_class(instance=video)
        rendered = str(bound["thumbnail_time"])
        self.assertIn("thumbnail-time", rendered)
        self.assertIn("00:00:03.1", rendered)
        self.assertIn('data-duration="65"', rendered)
        self.assertNotIn('type="number"', rendered)

        self.assertNotIn("thumbnail_time", form_class({"thumbnail_time": ""}, instance=video).errors)
        self.assertNotIn("thumbnail_time", form_class({"thumbnail_time": "00:01:05.0"}, instance=video).errors)
        too_early = form_class({"thumbnail_time": "00:00:00.0"}, instance=video)
        too_late = form_class({"thumbnail_time": "00:01:05.1"}, instance=video)
        self.assertIn("greater than 0", too_early.errors["thumbnail_time"][0])
        self.assertIn("00:01:05.0", too_late.errors["thumbnail_time"][0])

        response = self.client.get(reverse("admin:files_media_change", args=[video.pk]))
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn("thumbnail-time__step", html)
        self.assertIn("00:00:03.1", html)

    @override_settings(SECURE_SSL_REDIRECT=False)
    def test_content_images_relation_links_and_playlists(self):
        model_admin = admin.site._registry[Media]
        poster_field = model_admin.formfield_for_dbfield(Media._meta.get_field("uploaded_poster"), self.admin_request())
        thumb_field = model_admin.formfield_for_dbfield(Media._meta.get_field("uploaded_thumbnail"), self.admin_request())
        self.assertEqual(poster_field.widget.template_name, "admin/widgets/image_dropzone.html")
        self.assertEqual(thumb_field.widget.template_name, "admin/widgets/image_dropzone.html")
        media_file_field = model_admin.formfield_for_dbfield(Media._meta.get_field("media_file"), self.admin_request())
        self.assertEqual(media_file_field.widget.template_name, "admin/widgets/file_dropzone.html")

        playlist = Playlist.objects.create(title="Listed playlist", user=self.superuser)
        playlist.media.add(self.public)
        listing = str(model_admin.related_playlists(self.public))
        self.assertIn("View 1 playlist(s)", listing)
        self.assertIn(f"media__id__exact={self.public.pk}", listing)
        self.assertNotIn("related-object-list", listing)
        self.assertNotIn("Listed playlist", listing)

        response = self.client.get(reverse("admin:files_media_change", args=[self.public.pk]))
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn("image-dropzone", html)
        self.assertIn("media-image-cards", html)
        self.assertIn("media-file-card", html)
        self.assertIn("file-dropzone", html)
        self.assertIn('name="media_file"', html)
        self.assertNotIn("Currently:", html)
        self.assertNotIn('id="media-file-tab"', html)
        self.assertEqual(html.count('name="allow_download"'), 1)
        self.assertEqual(html.count('name="enable_comments"'), 1)
        self.assertIn("Allow download", html)
        self.assertIn("Enable comments", html)
        self.assertIn("media-glance", html)
        self.assertIn('type="datetime-local"', html)
        self.assertIn("action__exact=watch", html)
        self.assertIn("action__exact=like", html)
        self.assertIn("action__exact=dislike", html)
        self.assertIn("Click or drop to replace", html)
        self.assertIn("license-inspect", html)
        self.assertIn("/admin/files/license/__fk__/change/", html)
        self.assertNotIn("change_id_license", html)
        if self.public.license_id:
            self.assertIn(reverse("admin:files_license_change", args=[self.public.license_id]), html)
        self.assertIn("View 1 playlist(s)", html)
        self.assertNotIn("related-object-list", html)
        self.assertNotIn('name="reported_times"', html)
        self.assertNotIn("report/moderation action(s)", html)

    @override_settings(ALLOW_RATINGS=True)
    def test_rating_category_appears_when_ratings_enabled(self):
        model_admin = admin.site._registry[Media]
        fieldsets = dict(model_admin.get_fieldsets(self.admin_request(), obj=self.public))
        self.assertIn("rating_category", fieldsets["Content"]["fields"])

    def test_clear_reports_action_available_to_editors(self):
        model_admin = admin.site._registry[Media]
        editor = make_user("files_admin_editor", is_editor=True, is_staff=True)
        request = RequestFactory().get("/admin/")
        request.user = editor
        self.assertIn("clear_reports", model_admin.get_actions(request))
        self.assertIn("delete_original_media_files", model_admin.get_actions(request))

    def test_force_reencode_action_encodes_with_force_true(self):
        video = create_media(self.superuser, filename=SMALL_VIDEO, title="force reencode video")
        with patch.object(Media, "encode") as encode:
            response = self.client.post(
                reverse("admin:files_media_changelist"),
                {"action": "force_reencode", "_selected_action": [video.pk]},
            )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(encode.call_count, 1)
        self.assertEqual(encode.call_args.kwargs, {"force": True})

    def test_confirm_reports_set_private_keeps_reports(self):
        MediaAction.objects.create(user=self.superuser, media=self.public, action="report", extra_info="spam")
        self.public.reported_times = 2
        self.public.save(update_fields=["reported_times"])
        response = self.client.post(
            reverse("admin:files_media_changelist"),
            {"action": "confirm_reports_set_private", "_selected_action": [self.public.pk]},
        )
        self.assertEqual(response.status_code, 302)
        self.public.refresh_from_db()
        self.assertEqual(self.public.state, "private")
        self.assertEqual(self.public.reported_times, 2)
        self.assertTrue(MediaAction.objects.filter(media=self.public, action="report").exists())
        confirmed = MediaAction.objects.get(media=self.public, action="report_confirmed")
        self.assertEqual(confirmed.user_id, self.superuser.pk)
        self.assertIn("reported_times=2", confirmed.extra_info)

    def test_clear_reports_keep_private_and_set_public(self):
        MediaAction.objects.create(user=self.superuser, media=self.public, action="report", extra_info="spam")
        self.public.reported_times = 2
        self.public.state = "unlisted"
        self.public.save(update_fields=["reported_times", "state"])

        response = self.client.post(
            reverse("admin:files_media_changelist"),
            {"action": "clear_reports_keep_private", "_selected_action": [self.public.pk]},
        )
        self.assertEqual(response.status_code, 302)
        self.public.refresh_from_db()
        self.assertEqual(self.public.state, "private")
        self.assertEqual(self.public.reported_times, 0)

        MediaAction.objects.create(user=self.superuser, media=self.public, action="report", extra_info="again")
        self.public.reported_times = 1
        self.public.save(update_fields=["reported_times"])
        response = self.client.post(
            reverse("admin:files_media_changelist"),
            {"action": "clear_reports_set_public", "_selected_action": [self.public.pk]},
        )
        self.assertEqual(response.status_code, 302)
        self.public.refresh_from_db()
        self.assertEqual(self.public.state, "public")
        self.assertEqual(self.public.reported_times, 0)

    def test_change_owner_intermediate_and_apply(self):
        new_owner = make_user("files_admin_new_owner")
        response = self.client.post(
            reverse("admin:files_media_changelist"),
            {"action": "change_owner", "_selected_action": [self.public.pk]},
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Change media owner")

        response = self.client.post(
            reverse("admin:files_media_changelist"),
            {
                "action": "change_owner",
                "apply": "1",
                "new_owner": new_owner.username,
                "_selected_action": [self.public.pk],
            },
        )
        self.assertEqual(response.status_code, 302)
        self.public.refresh_from_db()
        self.assertEqual(self.public.user_id, new_owner.pk)

    def test_regenerate_hls_queues_task(self):
        video = create_media(self.superuser, filename=SMALL_VIDEO, title="hls regen video")
        with patch("files.tasks.create_hls.delay") as create_hls:
            response = self.client.post(
                reverse("admin:files_media_changelist"),
                {"action": "regenerate_hls", "_selected_action": [video.pk]},
            )
        self.assertEqual(response.status_code, 302)
        create_hls.assert_called_once_with(video.friendly_token)

    def test_refresh_metadata_check_integrity_queues_task(self):
        video = create_media(self.superuser, filename=SMALL_VIDEO, title="metadata refresh video")
        with patch("files.tasks.refresh_media_metadata.delay") as refresh_task:
            response = self.client.post(
                reverse("admin:files_media_changelist"),
                {"action": "refresh_metadata_check_integrity", "_selected_action": [video.pk]},
            )
        self.assertEqual(response.status_code, 302)
        refresh_task.assert_called_once_with(video.friendly_token, self.superuser.pk)


class DeleteOriginalMediaAdminTest(AdminRequestMixin, TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("files_delete_orig_root", is_superuser=True)
        cls.profile = EncodeProfile.objects.filter(extension="mp4").exclude(name="preview").first()

    def setUp(self):
        self.client.force_login(self.superuser)
        self.video = create_media(self.superuser, filename=SMALL_VIDEO, title="delete original video", encoding_status="success")
        Encoding.objects.create(media=self.video, profile=self.profile, status="success", chunk=False)

    def test_helper_blocks_incomplete_encodings(self):
        Encoding.objects.create(media=self.video, profile=self.profile, status="fail", chunk=False)
        ok, reason = can_delete_original_media_file(self.video)
        self.assertFalse(ok)
        self.assertIn("failed", reason)

    def test_helper_blocks_image_media(self):
        image = create_media(self.superuser, title="delete original image", encoding_status="success")
        ok, reason = can_delete_original_media_file(image)
        self.assertFalse(ok)
        self.assertIn("video/audio", reason)

    def test_confirmation_rejects_wrong_phrase(self):
        self.assertTrue(media_has_original_file(self.video))
        response = self.client.post(
            reverse("admin:files_media_changelist"),
            {
                "action": "delete_original_media_files",
                "apply": "1",
                "confirmation_text": "not-the-token",
                "_selected_action": [self.video.pk],
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(media_has_original_file(self.video))
        self.assertFalse(MediaAction.objects.filter(media=self.video, action="original_deleted").exists())

    def test_confirmation_rejects_wrong_case_token(self):
        self.assertTrue(media_has_original_file(self.video))
        wrong_case = self.video.friendly_token.swapcase()
        if wrong_case == self.video.friendly_token:
            wrong_case = self.video.friendly_token + "X"
        response = self.client.post(
            reverse("admin:files_media_changelist"),
            {
                "action": "delete_original_media_files",
                "apply": "1",
                "confirmation_text": wrong_case,
                "_selected_action": [self.video.pk],
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(media_has_original_file(self.video))

    def test_confirmation_deletes_original_and_audits(self):
        path = self.video.media_file.path
        self.assertTrue(os.path.isfile(path))
        response = self.client.post(
            reverse("admin:files_media_changelist"),
            {
                "action": "delete_original_media_files",
                "apply": "1",
                "confirmation_text": self.video.friendly_token,
                "_selected_action": [self.video.pk],
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertFalse(os.path.isfile(path))
        self.video.refresh_from_db()
        self.assertTrue(self.video.media_file.name)
        self.assertEqual(Encoding.objects.filter(media=self.video).count(), 1)
        event = MediaAction.objects.get(media=self.video, action="original_deleted")
        self.assertEqual(event.user_id, self.superuser.pk)
        self.assertIn("deleted original file", event.extra_info)

    def test_helper_delete_requires_eligibility(self):
        image = create_media(self.superuser, title="not eligible delete")
        ok, reason = delete_original_media_file(image, user=self.superuser)
        self.assertFalse(ok)
        self.assertTrue(reason)


@override_settings(SECURE_SSL_REDIRECT=False)
class MediaActionAdminTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("mediaaction_admin_root", is_superuser=True)
        cls.media = create_media(cls.superuser, title="reported media")
        cls.report = MediaAction.objects.create(user=cls.superuser, media=cls.media, action="report", extra_info="offensive")
        cls.media.reported_times = 2
        cls.media.save(update_fields=["reported_times"])

    def setUp(self):
        self.client.force_login(self.superuser)

    def test_change_form_is_read_only_audit_record(self):
        model_admin = admin.site._registry[MediaAction]
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        self.assertFalse(model_admin.has_add_permission(request))
        self.assertFalse(model_admin.has_change_permission(request))
        for field in ("action", "extra_info", "action_date", "remote_ip", "session_key"):
            self.assertIn(field, model_admin.readonly_fields)

        self.report.remote_ip = "203.0.113.10"
        self.report.save(update_fields=["remote_ip"])
        response = self.client.get(reverse("admin:actions_mediaaction_change", args=[self.report.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "field-display_media")
        self.assertContains(response, "field-display_user")
        self.assertContains(response, "field-display_action")
        self.assertContains(response, "media-metric__inspect")
        self.assertContains(response, 'title="Inspect"')
        self.assertContains(response, reverse("admin:files_media_change", args=[self.media.pk]) + "#reports-tab")
        self.assertContains(response, reverse("admin:users_user_change", args=[self.superuser.pk]))
        self.assertContains(response, "fa-flag")
        self.assertContains(response, "changelist-status-icon__text")
        self.assertContains(response, ">Report<")
        self.assertContains(response, 'data-copy-value="offensive"')
        self.assertContains(response, 'data-copy-value="203.0.113.10"')
        self.assertContains(response, 'title="Copy"')
        self.assertContains(response, "fa-copy")
        self.assertNotContains(response, 'name="extra_info"')
        self.assertNotContains(response, 'id="id_action"')

    def test_extra_info_column_and_clear_related_action(self):
        model_admin = admin.site._registry[MediaAction]
        self.assertIn("display_extra_info", model_admin.list_display)
        self.assertIn("display_remote_ip", model_admin.list_display)
        response = self.client.post(
            reverse("admin:actions_mediaaction_changelist"),
            {"action": "clear_reports_for_related_media", "_selected_action": [self.report.pk]},
        )
        self.assertEqual(response.status_code, 302)
        self.media.refresh_from_db()
        self.assertEqual(self.media.reported_times, 0)
        self.assertFalse(MediaAction.objects.filter(media=self.media, action="report").exists())
        self.assertTrue(MediaAction.objects.filter(media=self.media, action="report_cleared", user=self.superuser).exists())

    def test_optional_columns_hidden_by_default_and_column_chooser(self):
        model_admin = admin.site._registry[MediaAction]
        url = reverse("admin:actions_mediaaction_changelist")
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        request.session = {}
        default_display = model_admin.get_list_display(request)
        self.assertNotIn("display_remote_ip", default_display)
        self.assertNotIn("display_extra_info", default_display)
        self.assertEqual(default_display, ["action_date", "display_action", "link_user", "link_media", "open_on_site"])

        response = self.client.get(
            url,
            {
                "set_mediaaction_columns": "1",
                "mediaaction_col": ["display_remote_ip", "display_extra_info"],
                "q": "reported",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("q=reported", response["Location"])
        self.assertNotIn("set_mediaaction_columns", response["Location"])
        self.assertNotIn("mediaaction_col", response["Location"])

        response = self.client.get(url, {"q": "reported"})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "fas fa-flag")
        self.assertContains(response, 'aria-label="Report"')
        self.assertContains(response, "changelist-status-icon--warning")
        display = [col for col in response.context["cl"].list_display if col != "action_checkbox"]
        self.assertEqual(
            display,
            ["action_date", "display_action", "link_user", "link_media", "display_remote_ip", "display_extra_info", "open_on_site"],
        )
        self.assertContains(response, "Apply columns")
        self.assertContains(response, "Reset columns")
        self.assertContains(response, 'name="mediaaction_col"')
        self.assertContains(response, 'name="reset_mediaaction_columns"')
        html = response.content.decode()
        chooser_pos = html.find('class="mediaaction-column-chooser')
        form_pos = html.find('id="changelist-form"')
        self.assertNotEqual(chooser_pos, -1)
        self.assertNotEqual(form_pos, -1)
        self.assertLess(chooser_pos, form_pos)

        response = self.client.get(
            url,
            {
                "set_mediaaction_columns": "1",
                "reset_mediaaction_columns": "1",
                "mediaaction_col": ["display_remote_ip", "display_extra_info"],
                "q": "reported",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("q=reported", response["Location"])
        response = self.client.get(url, {"q": "reported"})
        display = [col for col in response.context["cl"].list_display if col != "action_checkbox"]
        self.assertEqual(display, ["action_date", "display_action", "link_user", "link_media", "open_on_site"])

    def test_long_extra_info_is_clipped_with_the_full_text_in_a_tooltip(self):
        report = "This report explains the problem.\n\n" + ("detail " * 30)
        MediaAction.objects.create(
            user=self.superuser,
            media=self.media,
            action="report",
            extra_info=report,
            remote_ip="2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        )
        url = reverse("admin:actions_mediaaction_changelist")
        self.client.get(
            url,
            {"set_mediaaction_columns": "1", "mediaaction_col": ["display_remote_ip", "display_extra_info"]},
        )
        response = self.client.get(url)
        self.assertContains(response, "changelist-clipped-text__full")
        self.assertContains(response, "This report explains the problem.")
        self.assertContains(response, "2001:0db8:85a3:0000:0000:8a2e:0370:7334")
        preview = response.content.decode().split('changelist-clipped-text__preview">', 1)[1].split("<", 1)[0]
        self.assertLessEqual(len(preview), 40)
        self.assertTrue(preview.endswith("…"))
        html = str(admin.site._registry[Media].report_actions_table(self.media))
        self.assertNotIn("This report explains the problem.", html)
        self.assertLess(html.find(">When<"), html.find(">Action<"))
        self.assertLess(html.find(">Action<"), html.find(">Inspect<"))
        self.assertIn("report-actions-table__inspect", html)
        self.assertIn(">Report<", html)

    def test_clipped_admin_text_always_tooltip_for_short_values(self):
        self.assertNotIn("changelist-clipped-text", str(clipped_admin_text("short")))
        html = str(clipped_admin_text("short", always_tooltip=True))
        self.assertIn("changelist-clipped-text__preview", html)
        self.assertIn("changelist-clipped-text__full", html)
        self.assertIn("short", html)

    def test_grouped_action_choices_and_reports_tab_media_link(self):
        from admin_customizations.action_choices import ACTIONS_PLACEHOLDER

        model_admin = admin.site._registry[MediaAction]
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        choices = model_admin.get_action_choices(request)
        self.assertEqual(choices[0], ACTIONS_PLACEHOLDER)
        choice_values = [value for value, _label in choices]
        self.assertIn("clear_reports_for_related_media", choice_values)
        self.assertIn("delete_selected", choice_values)

        html = str(model_admin.link_media(self.report))
        self.assertIn("#reports-tab", html)
        self.assertIn('title="reported media"', html)
        like = MediaAction.objects.create(user=self.superuser, media=self.media, action="like")
        like_html = str(model_admin.link_media(like))
        self.assertNotIn("#reports-tab", like_html)

    def test_changelist_header_sort_links_replace_prior_sorts(self):
        response = self.client.get(reverse("admin:actions_mediaaction_changelist"))
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn("?o=2", html)
        self.assertNotIn("?o=2.-1", html)

        response = self.client.get(reverse("admin:actions_mediaaction_changelist"), {"o": "2"})
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        # Only Action should show an active sort marker once date is no longer in ``o``.
        self.assertEqual(html.count("fa-sort-alpha-"), 1)
        self.assertContains(response, "fa-times")

    def test_extra_info_sort_puts_filled_values_before_blanks(self):
        MediaAction.objects.create(user=self.superuser, media=self.media, action="like", extra_info="")
        MediaAction.objects.create(user=self.superuser, media=self.media, action="like", extra_info=None)
        filled = MediaAction.objects.create(user=self.superuser, media=self.media, action="report", extra_info="zebra report detail")
        url = reverse("admin:actions_mediaaction_changelist")
        self.client.get(url, {"set_mediaaction_columns": "1", "mediaaction_col": ["display_extra_info"]})

        response = self.client.get(url, {"o": "5"})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "fa-sort-alpha-down")
        rows = list(response.context["cl"].queryset[:10])
        filled_indexes = [i for i, row in enumerate(rows) if (row.extra_info or "").strip()]
        blank_indexes = [i for i, row in enumerate(rows) if not (row.extra_info or "").strip()]
        self.assertTrue(filled_indexes)
        self.assertTrue(blank_indexes)
        self.assertLess(max(filled_indexes), min(blank_indexes))

        response = self.client.get(url, {"o": "-5"})
        self.assertEqual(response.status_code, 200)
        rows = list(response.context["cl"].queryset[:10])
        self.assertEqual(rows[0].pk, filled.pk)
        self.assertTrue(all((row.extra_info or "").strip() for row in rows[:2]))


class EncodingAdminTest(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def test_title_and_has_file_columns(self):
        user = make_user("files_encoding_admin")
        media = create_media(user, title="encoding admin media")
        encoding = Encoding.objects.create(media=media, profile=EncodeProfile.objects.first(), status="pending")
        model_admin = admin.site._registry[Encoding]
        self.assertEqual(model_admin.get_title(encoding), str(encoding))
        self.assertIsNone(encoding.media_encoding_url)
        self.assertIn("changelist-status-icon", str(model_admin.has_file(encoding)))
        self.assertIn("fa-ban", str(model_admin.has_file(encoding)))

    def test_changelist_status_chunk_and_file_use_icons(self):
        user = make_user("files_encoding_icons", is_superuser=True)
        profile = EncodeProfile.objects.first()
        media = create_media(user, title="encoding icons media")
        # Keep status pending so Encoding post_save chunk completion hooks are skipped.
        Encoding.objects.create(media=media, profile=profile, status="pending", chunk=True, progress=10)
        self.client.force_login(user)
        url = reverse("admin:files_encoding_changelist")
        self.client.get(url, {"set_encoding_columns": "1", "encoding_col": ["display_chunk"]})
        response = self.client.get(url, {"q": "encoding icons"})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "changelist-status-icon")
        self.assertContains(response, "fas fa-clock")
        self.assertContains(response, 'title="Pending"')
        self.assertContains(response, "fas fa-th-large")
        self.assertContains(response, "fas fa-ban")
        self.assertContains(response, reverse("get_media") + f"?m={media.friendly_token}")

    def test_optional_columns_hidden_by_default_and_column_chooser(self):
        user = make_user("files_encoding_columns", is_superuser=True)
        profile = EncodeProfile.objects.first()
        media = create_media(user, title="encoding columns media")
        Encoding.objects.create(media=media, profile=profile, status="pending", chunk=True, progress=42)
        model_admin = admin.site._registry[Encoding]
        request = RequestFactory().get("/admin/")
        request.user = user
        request.session = {}
        self.assertEqual(model_admin.get_list_display(request), ["get_title", "link_media", "display_status", "has_file", "open_on_site"])

        self.client.force_login(user)
        url = reverse("admin:files_encoding_changelist")
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Apply columns")
        self.assertContains(response, "Reset columns")
        self.assertContains(response, 'name="encoding_col"')
        for value in ("display_chunk", "profile", "progress"):
            self.assertContains(response, f'value="{value}"')
        html = response.content.decode()
        self.assertLess(html.find("encoding-column-chooser"), html.find('id="changelist-form"'))
        self.assertNotIn("field-display_chunk", html)
        self.assertNotIn("field-profile", html)
        self.assertNotIn("field-progress", html)

        # Force columns via related filters without session opt-in.
        filter_request = RequestFactory().get("/admin/", {"chunk__exact": "1"})
        filter_request.user = user
        filter_request.session = {}
        self.assertIn("display_chunk", model_admin.get_list_display(filter_request))
        profile_request = RequestFactory().get("/admin/", {"profile__id__exact": str(profile.pk)})
        profile_request.user = user
        profile_request.session = {}
        self.assertIn("profile", model_admin.get_list_display(profile_request))

        response = self.client.get(
            url,
            {
                "set_encoding_columns": "1",
                "encoding_col": ["display_chunk", "profile", "progress"],
                "q": "encoding columns",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("q=encoding+columns", response["Location"])
        self.assertNotIn("set_encoding_columns", response["Location"])

        response = self.client.get(url, {"q": "encoding columns"})
        display = [col for col in response.context["cl"].list_display if col != "action_checkbox"]
        self.assertEqual(
            display,
            ["get_title", "link_media", "display_chunk", "profile", "progress", "display_status", "has_file", "open_on_site"],
        )
        html = response.content.decode()
        self.assertIn("field-display_chunk", html)
        self.assertIn("field-profile", html)
        self.assertIn("field-progress", html)

        response = self.client.get(
            url,
            {
                "set_encoding_columns": "1",
                "reset_encoding_columns": "1",
                "encoding_col": ["display_chunk"],
                "q": "encoding columns",
            },
        )
        self.assertEqual(response.status_code, 302)
        response = self.client.get(url, {"q": "encoding columns"})
        display = [col for col in response.context["cl"].list_display if col != "action_checkbox"]
        self.assertEqual(display, ["get_title", "link_media", "display_status", "has_file", "open_on_site"])

    @override_settings(SECURE_SSL_REDIRECT=False)
    def test_change_form_fields_are_read_only(self):
        user = make_user("files_encoding_readonly", is_superuser=True)
        media = create_media(user, title="encoding readonly media")
        profile = EncodeProfile.objects.first()
        encoding = Encoding.objects.create(media=media, profile=profile, status="pending", progress=42, chunk=True)
        model_admin = admin.site._registry[Encoding]
        request = RequestFactory().get("/admin/")
        request.user = user
        self.assertFalse(model_admin.has_add_permission(request))
        self.assertTrue(model_admin.has_change_permission(request))
        for field in ("profile", "status", "progress", "chunk", "has_file", "link_media"):
            self.assertIn(field, model_admin.readonly_fields)
        fields = list(dict(model_admin.get_fieldsets(request, obj=encoding))["Encoding"]["fields"])
        self.assertEqual(
            fields,
            ["display_media", "display_profile", "display_chunk", "display_status", "display_progress", "has_file"],
        )
        self.assertLess(fields.index("display_chunk"), fields.index("display_status"))

        self.client.force_login(user)
        response = self.client.get(reverse("admin:files_encoding_change", args=[encoding.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'name="status"')
        self.assertNotContains(response, 'name="profile"')
        self.assertContains(response, "media-metric__inspect")
        self.assertContains(response, 'title="Inspect"')
        self.assertContains(response, reverse("admin:files_media_change", args=[media.pk]))
        self.assertContains(response, reverse("admin:files_encodeprofile_change", args=[profile.pk]))
        self.assertContains(response, "fa-th-large")
        self.assertContains(response, "fa-clock")
        self.assertContains(response, "encoding-progress")
        self.assertContains(response, 'aria-valuenow="42"')
        self.assertContains(response, "42%")

    def test_retry_failed_encodings_action(self):
        user = make_user("files_encoding_retry", is_superuser=True)
        media = create_media(user, filename=SMALL_VIDEO, title="encoding retry media")
        profile = EncodeProfile.objects.filter(extension="mp4").exclude(name="preview").first()
        failed = Encoding.objects.create(media=media, profile=profile, status="fail", chunk=False)
        pending = Encoding.objects.create(media=media, profile=profile, status="pending", chunk=False)
        self.client.force_login(user)
        with patch.object(Media, "encode") as encode:
            response = self.client.post(
                reverse("admin:files_encoding_changelist"),
                {"action": "retry_failed_encodings", "_selected_action": [failed.pk, pending.pk]},
            )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(encode.call_count, 1)
        self.assertEqual(encode.call_args.kwargs.get("force"), True)
        self.assertEqual(encode.call_args.kwargs.get("chunkize"), False)


class PageAdminFormTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("page_admin_root", is_superuser=True)
        cls.page = Page.objects.create(slug="about-us", title="About us", description="<p>hi</p>")

    def setUp(self):
        self.client.force_login(self.superuser)

    def test_changelist_links_slug_and_full_page_url(self):
        response = self.client.get(reverse("admin:files_page_changelist"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'class="field-link_slug"')
        self.assertContains(response, 'class="field-page_url"')
        self.assertContains(response, f'href="{self.page.get_absolute_url()}"')
        self.assertContains(response, f">{self.page.slug}</a>")
        full_url = f"{settings.SSL_FRONTEND_HOST.rstrip('/')}{self.page.get_absolute_url()}"
        self.assertContains(response, full_url)

    def test_iframes_are_sandboxed(self):
        form = PageAdminForm(data={"slug": "sandboxed", "title": "Sandboxed", "description": '<p>x</p><iframe src="https://example.org"></iframe>'})
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.cleaned_data["description"], '<p>x</p><iframe sandbox="allow-scripts allow-same-origin allow-presentation" src="https://example.org"></iframe>')


class CategoryAdminConfigurationTest(AdminRequestMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("files_category_root", is_superuser=True)

    def model_admin(self):
        return admin.site._registry[Category]

    def fieldset_fields(self):
        return [field for _, options in self.model_admin().get_fieldsets(self.admin_request()) for field in options["fields"]]

    def test_defaults_without_feature_flags(self):
        request = self.admin_request()
        request.session = {}
        self.assertEqual(self.model_admin().get_list_filter(request), [])
        self.assertEqual(self.model_admin().get_list_display(request), ["add_date", "title", "user", "open_on_site"])
        self.assertNotIn("uid", self.model_admin().get_list_display(request))
        self.assertNotIn("related_media_count", self.model_admin().get_list_display(request))
        self.assertNotIn("is_rbac_category", self.fieldset_fields())
        self.assertNotIn("lti_platform", self.fieldset_fields())
        self.assertIn("related_media", self.fieldset_fields())

    @override_settings(USE_RBAC=True)
    def test_rbac_adds_filter_column_and_group_fieldsets(self):
        request = self.admin_request()
        request.session = {}
        self.assertEqual(self.model_admin().get_list_filter(request), ["is_rbac_category"])
        self.assertEqual(self.model_admin().get_list_display(request), ["add_date", "title", "user", "is_rbac_category", "open_on_site"])
        self.assertIn("rbac_groups", self.fieldset_fields())
        self.assertNotIn("identity_provider", self.fieldset_fields())

    @override_settings(USE_RBAC=True, USE_IDENTITY_PROVIDERS=True, USE_LTI=True)
    def test_all_flags_add_identity_provider_and_lti_options(self):
        request = self.admin_request()
        request.session = {}
        self.assertEqual(self.model_admin().get_list_filter(request), ["identity_provider", "is_rbac_category", "is_lms_course"])
        self.assertIn("identity_provider", self.model_admin().get_list_display(request))
        self.assertIn("is_lms_course", self.model_admin().get_list_display(request))
        fields = self.fieldset_fields()
        self.assertIn("identity_provider", fields)
        self.assertIn("lti_platform", fields)

    @override_settings(USE_RBAC=True, USE_IDENTITY_PROVIDERS=True, USE_LTI=True)
    def test_category_pages_render_with_all_flags(self):
        category = Category.objects.create(title="All flags category", is_rbac_category=True)
        self.client.force_login(self.superuser)
        self.assertEqual(self.client.get(reverse("admin:files_category_changelist"), {"is_rbac_category__exact": "1"}).status_code, 200)
        self.assertEqual(self.client.get(reverse("admin:files_category_change", args=[category.pk])).status_code, 200)
        self.assertEqual(self.client.get(reverse("admin:files_category_add")).status_code, 200)

    def test_optional_columns_hidden_by_default_and_column_chooser(self):
        category = Category.objects.create(title="Chooser category", media_count=1)
        create_media(self.superuser, title="category chooser media", category=[category])
        category.update_category_media()
        self.client.force_login(self.superuser)
        url = reverse("admin:files_category_changelist")

        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Apply columns")
        self.assertContains(response, "Reset columns")
        self.assertContains(response, 'name="category_col"')
        self.assertContains(response, 'value="uid"')
        self.assertContains(response, 'value="related_media_count"')
        html = response.content.decode()
        self.assertLess(html.find('class="category-column-chooser'), html.find('id="changelist-form"'))
        self.assertNotIn("field-uid", html)
        self.assertIn(f"?c={category.uid}", html)
        self.assertNotContains(response, f"category__id__exact={category.pk}")

        response = self.client.get(
            url,
            {
                "set_category_columns": "1",
                "category_col": ["uid", "related_media_count"],
                "q": "Chooser",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("q=Chooser", response["Location"])
        self.assertNotIn("set_category_columns", response["Location"])

        response = self.client.get(url, {"q": "Chooser"})
        display = [col for col in response.context["cl"].list_display if col != "action_checkbox"]
        self.assertEqual(display, ["add_date", "title", "user", "uid", "related_media_count", "open_on_site"])
        self.assertContains(response, category.uid)
        self.assertContains(response, f"category__id__exact={category.pk}")
        self.assertContains(response, ">1<")

        response = self.client.get(
            url,
            {
                "set_category_columns": "1",
                "reset_category_columns": "1",
                "category_col": ["uid"],
                "q": "Chooser",
            },
        )
        self.assertEqual(response.status_code, 302)
        response = self.client.get(url, {"q": "Chooser"})
        display = [col for col in response.context["cl"].list_display if col != "action_checkbox"]
        self.assertEqual(display, ["add_date", "title", "user", "open_on_site"])

    @override_settings(SECURE_SSL_REDIRECT=False)
    def test_media_count_links_and_change_lists_media(self):
        category = Category.objects.create(title="Linked media category", media_count=1)
        create_media(self.superuser, title="category listed media", category=[category])
        category.update_category_media()
        self.client.force_login(self.superuser)

        filtered = reverse("admin:files_media_changelist") + f"?category__id__exact={category.pk}"
        url = reverse("admin:files_category_changelist")
        self.client.get(url, {"set_category_columns": "1", "category_col": ["related_media_count"]})
        list_response = self.client.get(url)
        self.assertEqual(list_response.status_code, 200)
        self.assertContains(list_response, filtered)
        self.assertContains(list_response, ">1<")

        category.user = self.superuser
        category.listings_thumbnail = "https://example.com/category.jpg"
        category.save(update_fields=["user", "listings_thumbnail"])
        change_response = self.client.get(reverse("admin:files_category_change", args=[category.pk]))
        self.assertEqual(change_response.status_code, 200)
        self.assertContains(change_response, "View 1 media item(s)")
        self.assertContains(change_response, "field-display_user")
        self.assertContains(change_response, "media-metric__inspect")
        self.assertContains(change_response, 'title="Inspect"')
        self.assertContains(change_response, reverse("admin:users_user_change", args=[self.superuser.pk]))
        self.assertContains(change_response, "field-display_uid")
        self.assertContains(change_response, f'data-copy-value="{category.uid}"')
        self.assertContains(change_response, 'title="Copy"')
        self.assertNotContains(change_response, 'name="uid"')
        self.assertContains(change_response, "category-images__notice")
        self.assertContains(change_response, "category-images__priority")
        self.assertContains(change_response, "Visitors see one image, chosen in this order.")
        self.assertContains(change_response, "Most-viewed public media")
        self.assertContains(change_response, "Default image")
        self.assertContains(change_response, "An uploaded file. It is shown first, and the scheduled task does not replace it.")
        self.assertContains(change_response, "A scheduled task replaces this with the most-viewed eligible media image")
        self.assertContains(change_response, "category-image-cards")
        self.assertContains(change_response, "category-thumbnail-card")
        self.assertContains(change_response, "image-dropzone")
        self.assertContains(change_response, "Click or drop to replace")
        self.assertContains(change_response, "category-listings-card")
        self.assertContains(change_response, "listings-thumbnail-url")
        self.assertContains(change_response, 'value="https://example.com/category.jpg"')
        self.assertContains(change_response, filtered)
        self.assertContains(change_response, "related-links-tab")
        self.assertNotContains(change_response, "related-objects-tab")


@override_settings(USE_RBAC=True)
class CategoryAdminFormTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("files_category_form_root", is_superuser=True)
        cls.idp = SocialApp.objects.create(provider="saml", provider_id="cat-form-idp", name="Cat form IdP", client_id="cat-form-idp")
        cls.group = RBACGroup.objects.create(name="Category form group")
        cls.second_group = RBACGroup.objects.create(name="Second category form group")
        cls.idp_group = RBACGroup.objects.create(name="IdP category form group", identity_provider=cls.idp)

    def test_initial_groups_reflect_current_assignment(self):
        category = Category.objects.create(title="Initial groups", is_rbac_category=True)
        self.group.categories.add(category)
        form = CategoryAdminForm(instance=category)
        self.assertEqual(list(form.fields["rbac_groups"].initial), [self.group])

    def test_assigning_groups_turns_category_into_rbac_category(self):
        category = Category.objects.create(title="Becomes rbac")
        form = CategoryAdminForm(data=category_form_data(category, rbac_groups=[self.group.pk]), instance=category)
        self.assertTrue(form.is_valid(), form.errors)
        form.save()
        category.refresh_from_db()
        self.assertTrue(category.is_rbac_category)
        self.assertEqual(list(category.rbac_groups.all()), [self.group])

    def test_saving_replaces_group_assignment(self):
        category = Category.objects.create(title="Swap groups", is_rbac_category=True)
        self.group.categories.add(category)
        form = CategoryAdminForm(data=category_form_data(category, is_rbac_category="on", rbac_groups=[self.second_group.pk]), instance=category)
        self.assertTrue(form.is_valid(), form.errors)
        form.save()
        self.assertEqual(list(category.rbac_groups.all()), [self.second_group])

    def test_groups_of_another_identity_provider_are_rejected(self):
        category = Category.objects.create(title="Mismatched provider", is_rbac_category=True)
        form = CategoryAdminForm(data=category_form_data(category, is_rbac_category="on", rbac_groups=[self.idp_group.pk]), instance=category)
        self.assertFalse(form.is_valid())
        self.assertIn("rbac_groups", form.errors)

    def test_groups_matching_category_identity_provider_are_accepted(self):
        category = Category.objects.create(title="Matched provider", is_rbac_category=True, identity_provider=self.idp)
        form = CategoryAdminForm(data=category_form_data(category, is_rbac_category="on", identity_provider=self.idp.pk, rbac_groups=[self.idp_group.pk]), instance=category)
        self.assertTrue(form.is_valid(), form.errors)
        form.save()
        self.assertEqual(list(category.rbac_groups.all()), [self.idp_group])

    def test_admin_change_post_updates_groups(self):
        category = Category.objects.create(title="Posted category")
        self.client.force_login(self.superuser)
        response = self.client.post(reverse("admin:files_category_change", args=[category.pk]), category_form_data(category, rbac_groups=[self.group.pk, self.second_group.pk]))
        self.assertEqual(response.status_code, 302)
        category.refresh_from_db()
        self.assertTrue(category.is_rbac_category)
        self.assertEqual(set(category.rbac_groups.all()), {self.group, self.second_group})


class UserAdminTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("users_admin_root", is_superuser=True)
        cls.editor = make_user("users_admin_editor", is_editor=True)

    def test_optional_columns_hidden_until_selected_or_filtered(self):
        self.client.force_login(self.superuser)
        url = reverse("admin:users_user_changelist")
        response = self.client.get(url)
        display = list(response.context["cl"].list_display)
        self.assertEqual(display[:3], ["action_checkbox", "date_added", "is_active"])
        self.assertEqual(list(response.context["cl"].list_display_links), ["username"])
        self.assertNotIn("logo", display)
        for column in ("username", "name", "email", "date_added"):
            self.assertIn(column, display)
        for column in ("is_superuser", "is_editor", "is_manager", "media_count"):
            self.assertNotIn(column, display)
        self.assertContains(response, "Apply columns")
        self.assertContains(response, 'value="is_superuser"')
        self.assertContains(response, 'value="media_count"')
        self.assertNotContains(response, "Shown because an active filter needs this column")
        html = response.content.decode()
        self.assertLess(html.find('class="user-column-chooser'), html.find('id="changelist-form"'))

        filtered = self.client.get(url, {"is_editor__exact": "1", "is_superuser__exact": "0"})
        filtered_display = list(filtered.context["cl"].list_display)
        self.assertIn("is_editor", filtered_display)
        self.assertIn("is_superuser", filtered_display)
        self.assertNotIn("is_manager", filtered_display)
        self.assertNotIn("media_count", filtered_display)
        self.assertContains(filtered, "Shown because an active filter needs this column")

        cleared = self.client.get(url)
        self.assertNotIn("is_editor", list(cleared.context["cl"].list_display))

    def test_column_chooser_persists_user_columns(self):
        self.client.force_login(self.superuser)
        url = reverse("admin:users_user_changelist")
        response = self.client.get(url, {"set_user_columns": "1", "user_col": ["media_count", "is_manager"], "q": "users_admin"})
        self.assertEqual(response.status_code, 302)
        self.assertIn("q=users_admin", response["Location"])
        self.assertNotIn("set_user_columns", response["Location"])
        self.assertNotIn("user_col", response["Location"])

        response = self.client.get(url, {"q": "users_admin"})
        display = list(response.context["cl"].list_display)
        self.assertIn("media_count", display)
        self.assertIn("is_manager", display)
        self.assertNotIn("is_superuser", display)
        self.assertNotIn("logo", display)
        self.assertEqual(display[:3], ["action_checkbox", "date_added", "is_active"])
        self.assertContains(response, "Reset columns")
        self.assertContains(response, 'name="reset_user_columns"')

        response = self.client.get(
            url,
            {
                "set_user_columns": "1",
                "reset_user_columns": "1",
                "user_col": ["media_count", "is_manager"],
                "q": "users_admin",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("q=users_admin", response["Location"])
        response = self.client.get(url, {"q": "users_admin"})
        display = list(response.context["cl"].list_display)
        self.assertNotIn("media_count", display)
        self.assertNotIn("is_manager", display)

    def test_role_filters_and_search(self):
        self.client.force_login(self.superuser)
        response = self.client.get(reverse("admin:users_user_changelist"), {"is_editor__exact": "1"})
        self.assertEqual([user.username for user in response.context["cl"].result_list], ["users_admin_editor"])
        response = self.client.get(reverse("admin:users_user_changelist"), {"q": "users_admin_root"})
        self.assertEqual([user.username for user in response.context["cl"].result_list], ["users_admin_root"])

    def test_sensitive_fields_are_not_editable(self):
        self.client.force_login(self.superuser)
        response = self.client.get(reverse("admin:users_user_change", args=[self.editor.pk]))
        form_fields = response.context["adminform"].form.fields
        self.assertNotIn("password", form_fields)
        self.assertNotIn("user_permissions", form_fields)
        self.assertIn("is_editor", form_fields)
        self.assertIn("is_active", form_fields)

    def test_user_change_fieldsets_and_related_tabs(self):
        media = create_media(self.editor, title="editor owned media")
        Playlist.objects.create(title="editor playlist", user=self.editor)
        Comment.objects.create(media=media, user=self.editor, text="editor comment")
        MediaAction.objects.create(user=self.editor, media=media, action="like")
        self.client.force_login(self.superuser)

        model_admin = admin.site._registry[User]
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        fieldsets = dict(model_admin.get_fieldsets(request, obj=self.editor))
        self.assertEqual(list(fieldsets.keys()), ["Profile", "Access", "Related"])
        self.assertIn("tab", fieldsets["Profile"]["classes"])
        self.assertNotIn("media_count", fieldsets["Profile"]["fields"])
        self.assertIn("related_media", fieldsets["Related"]["fields"])
        self.assertIn("related_likes", fieldsets["Related"]["fields"])
        self.assertNotIn("related_encodings", fieldsets["Related"]["fields"])
        self.assertIn("related-links-tab", fieldsets["Related"]["classes"])
        self.assertFalse(getattr(model_admin, "inlines", ()))

        response = self.client.get(reverse("admin:users_user_change", args=[self.editor.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("admin:files_media_changelist"))
        self.assertContains(response, f"user__id__exact={self.editor.pk}")
        self.assertContains(response, reverse("admin:actions_mediaaction_changelist"))
        self.assertContains(response, "action__exact=like")
        self.assertContains(response, reverse("admin:files_comment_changelist"))
        self.assertContains(response, "related-links-tab")
        self.assertNotContains(response, "related-objects-tab")

    def test_deactivate_and_reactivate_actions(self):
        self.client.force_login(self.superuser)
        response = self.client.post(
            reverse("admin:users_user_changelist"),
            {"action": "deactivate_users", "_selected_action": [self.editor.pk]},
        )
        self.assertEqual(response.status_code, 302)
        self.editor.refresh_from_db()
        self.assertFalse(self.editor.is_active)

        response = self.client.post(
            reverse("admin:users_user_changelist"),
            {"action": "reactivate_users", "_selected_action": [self.editor.pk]},
        )
        self.assertEqual(response.status_code, 302)
        self.editor.refresh_from_db()
        self.assertTrue(self.editor.is_active)

    def _reload_users_admin(self, site):
        if User in site._registry:
            site.unregister(User)
        if Channel in site._registry:
            site.unregister(Channel)
        importlib.reload(users.admin)

    def test_approval_column_and_filter_appear_when_approval_is_required(self):
        site = AdminSite(name="users_approval_site")
        self.addCleanup(all_sites.discard, site)
        with patch.object(admin, "site", site):
            with override_settings(USERS_NEEDS_TO_BE_APPROVED=True):
                importlib.reload(users.admin)
            approval_admin = site._registry[User]
            self._reload_users_admin(site)
        self.assertIn("is_approved", approval_admin.list_display)
        self.assertIn("is_approved", approval_admin.list_filter)
        self.assertIn("is_approved", approval_admin.list_editable)
        self.assertNotIn("is_approved", approval_admin.exclude)
        self.assertNotIn("is_approved", users.admin.UserAdmin.list_display)

    def test_approve_users_action_when_approval_required(self):
        site = AdminSite(name="users_approve_action_site")
        self.addCleanup(all_sites.discard, site)
        pending = make_user("users_admin_pending")
        pending.is_approved = False
        pending.save(update_fields=["is_approved"])

        with patch.object(admin, "site", site):
            with override_settings(USERS_NEEDS_TO_BE_APPROVED=True):
                importlib.reload(users.admin)
                approval_admin = site._registry[User]
                request = RequestFactory().get("/admin/")
                request.user = self.superuser
                self.assertIn("approve_users", approval_admin.get_actions(request))
                with patch.object(approval_admin, "message_user"):
                    approval_admin.approve_users(request, User.objects.filter(pk=pending.pk))
            self._reload_users_admin(site)

        pending.refresh_from_db()
        self.assertTrue(pending.is_approved)


class PlaylistChannelAdminTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("playlist_channel_root", is_superuser=True)
        cls.playlist = Playlist.objects.create(title="Admin playlist", user=cls.superuser)
        cls.media = create_media(cls.superuser, title="playlist member media")
        PlaylistMedia.objects.create(playlist=cls.playlist, media=cls.media, ordering=1)

    def setUp(self):
        self.client.force_login(self.superuser)

    def test_playlist_and_channel_changelists_render(self):
        self.assertEqual(self.client.get(reverse("admin:files_playlist_changelist")).status_code, 200)
        self.assertEqual(self.client.get(reverse("admin:users_channel_changelist")).status_code, 200)
        channel = Channel.objects.get(user=self.superuser)
        self.assertEqual(self.client.get(reverse("admin:users_channel_change", args=[channel.pk])).status_code, 200)

    @override_settings(SECURE_SSL_REDIRECT=False)
    def test_channel_change_shows_related_media_link(self):
        channel = Channel.objects.get(user=self.superuser)
        Media.objects.filter(pk=self.media.pk).update(channel=channel)
        response = self.client.get(reverse("admin:users_channel_change", args=[channel.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "View 1 media item(s)")
        self.assertContains(response, f"channel__id__exact={channel.pk}")
        self.assertContains(response, 'id="jazzy-tabs"')
        self.assertContains(response, "Related")
        self.assertContains(response, "related-links-tab")
        self.assertNotContains(response, "related-objects-tab")
        self.assertContains(response, "channel-banner-card")
        self.assertContains(response, "image-dropzone")
        self.assertContains(response, "Click or drop to replace")
        model_admin = admin.site._registry[Channel]
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        fields = list(dict(model_admin.get_fieldsets(request, obj=channel))["Channel"]["fields"])
        self.assertEqual(fields[-1], "banner_logo")
        self.assertIn("display_user", fields)
        self.assertContains(response, "field-display_user")
        self.assertContains(response, "media-metric__inspect")
        self.assertContains(response, 'title="Inspect"')
        self.assertContains(response, reverse("admin:users_user_change", args=[self.superuser.pk]))
        banner = model_admin.formfield_for_dbfield(Channel._meta.get_field("banner_logo"), request)
        self.assertEqual(banner.widget.template_name, "admin/widgets/image_dropzone.html")

    @override_settings(SECURE_SSL_REDIRECT=False)
    def test_playlist_change_shows_related_media_link(self):
        response = self.client.get(reverse("admin:files_playlist_change", args=[self.playlist.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "View 1 media item(s)")
        self.assertContains(response, f"playlist__id__exact={self.playlist.pk}")
        self.assertContains(response, "related-links-tab")
        self.assertNotContains(response, "related-objects-tab")
        self.assertContains(response, "field-display_user")
        self.assertContains(response, "media-metric__inspect")
        self.assertContains(response, 'title="Inspect"')
        self.assertContains(response, reverse("admin:users_user_change", args=[self.superuser.pk]))
        self.assertContains(response, self.superuser.username)

    def test_playlist_change_puts_title_before_description(self):
        model_admin = admin.site._registry[Playlist]
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        fieldsets = dict(model_admin.get_fieldsets(request, obj=self.playlist))
        fields = list(fieldsets["Playlist"]["fields"])
        self.assertLess(fields.index("title"), fields.index("description"))
        self.assertIn("related-links-tab", fieldsets["Related"]["classes"])

    def test_playlist_optional_columns_hidden_by_default_and_column_chooser(self):
        model_admin = admin.site._registry[Playlist]
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        request.session = {}
        default_display = model_admin.get_list_display(request)
        self.assertEqual(default_display, ["add_date", "title", "link_user", "open_on_site"])
        self.assertNotIn("friendly_token", default_display)
        self.assertNotIn("related_media_count", default_display)

        url = reverse("admin:files_playlist_changelist")
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Apply columns")
        self.assertContains(response, "Reset columns")
        self.assertContains(response, 'name="playlist_col"')
        self.assertContains(response, 'value="friendly_token"')
        self.assertContains(response, 'value="related_media_count"')
        html = response.content.decode()
        self.assertLess(html.find('class="playlist-column-chooser'), html.find('id="changelist-form"'))
        self.assertNotIn("field-friendly_token", html)
        self.assertIn(f"/playlists/{self.playlist.friendly_token}", html)
        self.assertNotContains(response, f"playlist__id__exact={self.playlist.pk}")

        response = self.client.get(
            url,
            {
                "set_playlist_columns": "1",
                "playlist_col": ["friendly_token", "related_media_count"],
                "q": "Admin",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("q=Admin", response["Location"])
        self.assertNotIn("set_playlist_columns", response["Location"])
        self.assertNotIn("playlist_col", response["Location"])

        response = self.client.get(url, {"q": "Admin"})
        display = [col for col in response.context["cl"].list_display if col != "action_checkbox"]
        self.assertEqual(display, ["add_date", "title", "link_user", "friendly_token", "related_media_count", "open_on_site"])
        self.assertContains(response, self.playlist.friendly_token)

        response = self.client.get(
            url,
            {
                "set_playlist_columns": "1",
                "reset_playlist_columns": "1",
                "playlist_col": ["friendly_token"],
                "q": "Admin",
            },
        )
        self.assertEqual(response.status_code, 302)
        response = self.client.get(url, {"q": "Admin"})
        display = [col for col in response.context["cl"].list_display if col != "action_checkbox"]
        self.assertEqual(display, ["add_date", "title", "link_user", "open_on_site"])

    def test_playlist_changelist_media_count_links_to_filtered_media(self):
        url = reverse("admin:files_playlist_changelist")
        self.client.get(url, {"set_playlist_columns": "1", "playlist_col": ["related_media_count"]})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        filtered = reverse("admin:files_media_changelist") + f"?playlist__id__exact={self.playlist.pk}"
        self.assertContains(response, filtered)
        self.assertContains(response, ">1<")

        media_response = self.client.get(reverse("admin:files_media_changelist"), {"playlist__id__exact": self.playlist.pk})
        self.assertEqual(media_response.status_code, 200)
        titles = {m.title for m in media_response.context["cl"].result_list}
        self.assertEqual(titles, {"playlist member media"})

    def test_channel_optional_columns_hidden_by_default_and_column_chooser(self):
        channel = Channel.objects.get(user=self.superuser)
        Media.objects.filter(pk=self.media.pk).update(channel=channel)
        model_admin = admin.site._registry[Channel]
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        request.session = {}
        default_display = model_admin.get_list_display(request)
        self.assertEqual(default_display, ["add_date", "title", "link_user", "open_on_site"])
        self.assertNotIn("friendly_token", default_display)
        self.assertNotIn("related_media_count", default_display)

        url = reverse("admin:users_channel_changelist")
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Apply columns")
        self.assertContains(response, "Reset columns")
        self.assertContains(response, 'name="channel_col"')
        self.assertContains(response, 'value="friendly_token"')
        self.assertContains(response, 'value="related_media_count"')
        html = response.content.decode()
        self.assertLess(html.find('class="channel-column-chooser'), html.find('id="changelist-form"'))
        self.assertNotIn("field-friendly_token", html)
        self.assertIn(f"/channel/{channel.friendly_token}", html)
        self.assertNotContains(response, f"channel__id__exact={channel.pk}")

        response = self.client.get(
            url,
            {
                "set_channel_columns": "1",
                "channel_col": ["friendly_token", "related_media_count"],
                "q": channel.title,
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("q=", response["Location"])
        self.assertNotIn("set_channel_columns", response["Location"])
        self.assertNotIn("channel_col", response["Location"])

        response = self.client.get(url, {"q": channel.title})
        display = [col for col in response.context["cl"].list_display if col != "action_checkbox"]
        self.assertEqual(display, ["add_date", "title", "link_user", "friendly_token", "related_media_count", "open_on_site"])
        self.assertContains(response, channel.friendly_token)
        self.assertContains(response, f"channel__id__exact={channel.pk}")
        self.assertContains(response, ">1<")

        response = self.client.get(
            url,
            {
                "set_channel_columns": "1",
                "reset_channel_columns": "1",
                "channel_col": ["friendly_token"],
                "q": channel.title,
            },
        )
        self.assertEqual(response.status_code, 302)
        response = self.client.get(url, {"q": channel.title})
        display = [col for col in response.context["cl"].list_display if col != "action_checkbox"]
        self.assertEqual(display, ["add_date", "title", "link_user", "open_on_site"])


class TagAdminTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("tag_admin_root", is_superuser=True)
        cls.tag = Tag.objects.create(title="admintag", media_count=1)
        cls.media = create_media(cls.superuser, title="tagged admin media")
        cls.media.tags.add(cls.tag)
        cls.tag.update_tag_media()

    def setUp(self):
        self.client.force_login(self.superuser)

    def test_tag_optional_media_count_hidden_by_default_and_column_chooser(self):
        model_admin = admin.site._registry[Tag]
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        request.session = {}
        self.assertEqual(model_admin.get_list_display(request), ["title", "link_user", "open_on_site"])

        url = reverse("admin:files_tag_changelist")
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "admintag")
        self.assertContains(response, "Apply columns")
        self.assertContains(response, "Reset columns")
        self.assertContains(response, 'name="tag_col"')
        self.assertContains(response, 'value="related_media_count"')
        html = response.content.decode()
        self.assertLess(html.find('class="tag-column-chooser'), html.find('id="changelist-form"'))
        self.assertNotContains(response, f"tags__id__exact={self.tag.pk}")

        response = self.client.get(url, {"set_tag_columns": "1", "tag_col": ["related_media_count"], "q": "admintag"})
        self.assertEqual(response.status_code, 302)
        self.assertIn("q=admintag", response["Location"])

        response = self.client.get(url, {"q": "admintag"})
        display = [col for col in response.context["cl"].list_display if col != "action_checkbox"]
        self.assertEqual(display, ["title", "link_user", "related_media_count", "open_on_site"])
        filtered = reverse("admin:files_media_changelist") + f"?tags__id__exact={self.tag.pk}"
        self.assertContains(response, filtered)

        response = self.client.get(
            url,
            {"set_tag_columns": "1", "reset_tag_columns": "1", "tag_col": ["related_media_count"], "q": "admintag"},
        )
        self.assertEqual(response.status_code, 302)
        response = self.client.get(url, {"q": "admintag"})
        display = [col for col in response.context["cl"].list_display if col != "action_checkbox"]
        self.assertEqual(display, ["title", "link_user", "open_on_site"])

    def test_tag_changelist_shows_media_count_link(self):
        url = reverse("admin:files_tag_changelist")
        self.client.get(url, {"set_tag_columns": "1", "tag_col": ["related_media_count"]})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "admintag")
        filtered = reverse("admin:files_media_changelist") + f"?tags__id__exact={self.tag.pk}"
        self.assertContains(response, filtered)

    @override_settings(SECURE_SSL_REDIRECT=False)
    def test_tag_change_inspects_user_and_uploads_listings_thumbnail(self):
        from io import BytesIO

        from PIL import Image

        self.tag.user = self.superuser
        self.tag.listings_thumbnail = "/media/original/tags/existing.jpg"
        self.tag.save(update_fields=["user", "listings_thumbnail"])
        url = reverse("admin:files_tag_change", args=[self.tag.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "field-display_user")
        self.assertContains(response, "media-metric__inspect")
        self.assertContains(response, 'title="Inspect"')
        self.assertContains(response, reverse("admin:users_user_change", args=[self.superuser.pk]))
        self.assertContains(response, "tag-listings-card")
        self.assertContains(response, "image-dropzone")
        self.assertContains(response, "Click or drop to replace")
        self.assertContains(response, "/media/original/tags/existing.jpg")

        buffer = BytesIO()
        Image.new("RGB", (8, 8), "red").save(buffer, format="JPEG")
        upload = SimpleUploadedFile("tag-thumb.jpg", buffer.getvalue(), content_type="image/jpeg")
        response = self.client.post(url, {"title": self.tag.title, "listings_thumbnail": upload})
        self.assertEqual(response.status_code, 302, response.content.decode()[:500] if response.status_code != 302 else "")
        self.tag.refresh_from_db()
        self.assertTrue(self.tag.listings_thumbnail)
        self.assertNotEqual(self.tag.listings_thumbnail, "/media/original/tags/existing.jpg")
        self.assertEqual(self.tag.user_id, self.superuser.pk)

        response = self.client.post(url, {"title": self.tag.title, "listings_thumbnail-clear": "on"})
        self.assertEqual(response.status_code, 302)
        self.tag.refresh_from_db()
        self.assertIsNone(self.tag.listings_thumbnail)

    def test_tag_changelist_links_user_by_username(self):
        self.tag.user = self.superuser
        self.tag.save(update_fields=["user"])
        response = self.client.get(reverse("admin:files_tag_changelist"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'class="field-link_user"')
        row_html = response.content.decode().split('class="field-link_user"', 1)[1].split("</td>", 1)[0]
        self.assertIn(reverse("admin:users_user_change", args=[self.superuser.pk]), row_html)
        self.assertIn(self.superuser.username, row_html)
        self.assertNotIn(f"{self.superuser.name} - {self.superuser.email}", row_html)

    def test_tag_changelist_fills_the_start_column_first(self):
        Tag.objects.create(title="secondadmintag", user=self.superuser)
        Tag.objects.create(title="zzzadmintag", user=self.superuser)
        response = self.client.get(reverse("admin:files_tag_changelist"))
        html = response.content.decode()
        self.assertEqual(response.status_code, 200)
        tables = html.split('<table class="table table-striped tag-result-table">')
        self.assertEqual(len(tables), 3)
        self.assertEqual(html.count('id="action-toggle"'), 1)
        self.assertIn(">admintag<", tables[1])
        self.assertIn(">secondadmintag<", tables[1])
        self.assertNotIn(">zzzadmintag<", tables[1])
        self.assertIn(">zzzadmintag<", tables[2])
        self.assertNotIn(">admintag<", tables[2])
        self.assertContains(response, reverse("search") + "?t=admintag")
        self.assertContains(response, "changelist-sort-hint")

    def test_tag_change_shows_related_media_link(self):
        response = self.client.get(reverse("admin:files_tag_change", args=[self.tag.pk]))
        self.assertEqual(response.status_code, 200)
        # Related tab shows total tagged media (not public/reviewed-only media_count).
        self.assertContains(response, "View 1 media item(s)")
        self.assertContains(response, f"tags__id__exact={self.tag.pk}")
        self.assertContains(response, 'id="jazzy-tabs"')
        self.assertContains(response, "General")
        self.assertContains(response, "Related")
        self.assertContains(response, "related-links-tab")
        self.assertNotContains(response, "related-objects-tab")

    def test_media_changelist_filters_by_tag(self):
        other = create_media(self.superuser, title="untagged admin media")
        response = self.client.get(reverse("admin:files_media_changelist"), {"tags__id__exact": self.tag.pk})
        self.assertEqual(response.status_code, 200)
        titles = {m.title for m in response.context["cl"].result_list}
        self.assertEqual(titles, {"tagged admin media"})
        self.assertNotIn(other.title, titles)


class TinyMCEMediaAdminTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("tinymce_admin_root", is_superuser=True)
        cls.media = TinyMCEMedia.objects.create(
            file=SimpleUploadedFile("tinymce-smoke.png", b"png"),
            file_type="image",
            original_filename="tinymce-smoke.png",
            user=cls.superuser,
        )

    def setUp(self):
        self.client.force_login(self.superuser)

    def test_changelist_links_user_by_username(self):
        response = self.client.get(reverse("admin:files_tinymcemedia_changelist"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'class="field-link_user"')
        row_html = response.content.decode().split('class="field-link_user"', 1)[1].split("</td>", 1)[0]
        self.assertIn(reverse("admin:users_user_change", args=[self.superuser.pk]), row_html)
        self.assertIn(self.superuser.username, row_html)
        self.assertNotIn(f"{self.superuser.name} - {self.superuser.email}", row_html)


class LicenseAdminTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("license_admin_root", is_superuser=True)
        cls.license = License.objects.create(title="CC BY 4.0", description="Attribution required")
        cls.media = create_media(cls.superuser, title="licensed media")
        Media.objects.filter(pk=cls.media.pk).update(license=cls.license)
        cls.media.refresh_from_db()

    def setUp(self):
        self.client.force_login(self.superuser)

    def test_license_changelist_shows_media_count_link(self):
        response = self.client.get(reverse("admin:files_license_changelist"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "CC BY 4.0")
        filtered = reverse("admin:files_media_changelist") + f"?license__id__exact={self.license.pk}"
        self.assertContains(response, filtered)
        self.assertContains(response, ">1<")

    def test_license_change_shows_related_media_link(self):
        response = self.client.get(reverse("admin:files_license_change", args=[self.license.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "View 1 media item(s)")
        self.assertContains(response, f"license__id__exact={self.license.pk}")

    def test_license_change_has_related_tab_without_inline(self):
        response = self.client.get(reverse("admin:files_license_change", args=[self.license.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "View 1 media item(s)")
        self.assertContains(response, f"license__id__exact={self.license.pk}")
        self.assertContains(response, 'id="jazzy-tabs"')
        self.assertContains(response, "General")
        self.assertContains(response, "Related")
        self.assertContains(response, "related-links-tab")
        self.assertNotContains(response, "related-objects-tab")
        model_admin = admin.site._registry[License]
        self.assertFalse(getattr(model_admin, "inlines", ()))

    def test_media_changelist_filters_by_license(self):
        other = create_media(self.superuser, title="unlicensed media")
        response = self.client.get(reverse("admin:files_media_changelist"), {"license__id__exact": self.license.pk})
        self.assertEqual(response.status_code, 200)
        titles = {m.title for m in response.context["cl"].result_list}
        self.assertEqual(titles, {"licensed media"})
        self.assertNotIn(other.title, titles)


@override_settings(SECURE_SSL_REDIRECT=False)
class VideoTrimRequestAdminTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("trim_request_admin_root", is_superuser=True)
        cls.media = create_media(cls.superuser, title="trim request media")
        cls.request = VideoTrimRequest.objects.create(
            media=cls.media,
            status="initial",
            video_action="replace",
            media_trim_style="no_encoding",
            timestamps=[{"startTime": "00:00:00.000", "endTime": "00:00:01.000"}],
        )

    def setUp(self):
        self.client.force_login(self.superuser)

    def test_list_links_to_trim_request_change(self):
        model_admin = admin.site._registry[VideoTrimRequest]
        self.assertEqual(model_admin.list_display_links, ("display_id", "display_status"))
        response = self.client.get(reverse("admin:files_videotrimrequest_changelist"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("admin:files_videotrimrequest_change", args=[self.request.pk]))
        # Media column still links to the media, separately from the request change link.
        self.assertContains(response, reverse("admin:files_media_change", args=[self.media.pk]))
        self.assertContains(response, "changelist-id-link")
        self.assertContains(response, "fas fa-search")
        self.assertContains(response, "fas fa-hourglass-start")
        self.assertContains(response, "fas fa-exchange-alt")
        self.assertContains(response, "fas fa-bolt")
        self.assertContains(response, reverse("get_media") + f"?m={self.media.friendly_token}")

    def test_add_date_is_optional_and_id_sorts_descending(self):
        model_admin = admin.site._registry[VideoTrimRequest]
        self.assertEqual(model_admin.ordering, ("-id",))
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        request.session = {}
        self.assertEqual(
            model_admin.get_list_display(request),
            ["display_id", "link_media", "display_status", "display_video_action", "display_media_trim_style", "open_on_site"],
        )

        url = reverse("admin:files_videotrimrequest_changelist")
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertNotIn("field-add_date", html)
        self.assertLess(html.find('class="videotrimrequest-column-chooser'), html.find('id="changelist-form"'))
        self.assertNotIn('videotrimrequest-column-chooser admin-column-chooser card card-outline card-secondary mb-3" open', html)
        self.assertContains(response, 'value="add_date"')
        self.assertContains(response, "Add date")
        id_header = html.split("column-display_id", 1)[1].split("</th>", 1)[0]
        self.assertIn("fa-sort-alpha-up", id_header)

        newer = VideoTrimRequest.objects.create(
            media=self.media,
            status="success",
            video_action="save_new",
            timestamps=[{"startTime": "00:00:00.000", "endTime": "00:00:02.000"}],
        )
        response = self.client.get(url)
        ids = [obj.pk for obj in response.context["cl"].result_list]
        self.assertEqual(ids, sorted(ids, reverse=True))
        self.assertEqual(ids[0], newer.pk)

        response = self.client.get(url, {"set_videotrimrequest_columns": "1", "videotrimrequest_col": "add_date", "q": "trim"})
        self.assertEqual(response.status_code, 302)
        self.assertIn("q=trim", response["Location"])
        self.assertNotIn("set_videotrimrequest_columns", response["Location"])

        response = self.client.get(url, {"q": "trim"})
        display = [col for col in response.context["cl"].list_display if col != "action_checkbox"]
        self.assertEqual(display[0], "add_date")
        self.assertIn("field-add_date", response.content.decode())

        response = self.client.get(url, {"reset_videotrimrequest_columns": "1", "q": "trim"})
        self.assertEqual(response.status_code, 302)
        response = self.client.get(url, {"q": "trim"})
        self.assertNotIn("field-add_date", response.content.decode())

        response = self.client.get(url, {"add_date__gte": "2000-01-01"})
        display = [col for col in response.context["cl"].list_display if col != "action_checkbox"]
        self.assertEqual(display[0], "add_date")

    def test_change_form_is_read_only(self):
        model_admin = admin.site._registry[VideoTrimRequest]
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        self.assertFalse(model_admin.has_add_permission(request))
        self.assertFalse(model_admin.has_change_permission(request))
        for field in ("status", "video_action", "media_trim_style", "timestamps", "add_date", "link_media"):
            self.assertIn(field, model_admin.readonly_fields)

        response = self.client.get(reverse("admin:files_videotrimrequest_change", args=[self.request.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'name="status"')
        self.assertNotContains(response, 'name="video_action"')
        self.assertNotContains(response, 'name="timestamps"')

        # POST must not mutate the request snapshot.
        response = self.client.post(
            reverse("admin:files_videotrimrequest_change", args=[self.request.pk]),
            {
                "status": "fail",
                "video_action": "save_new",
                "media_trim_style": "precise",
                "timestamps": '[{"startTime": "00:00:01.000", "endTime": "00:00:02.000"}]',
                "_continue": "Save and continue editing",
            },
        )
        self.assertIn(response.status_code, (200, 403))
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, "initial")
        self.assertEqual(self.request.video_action, "replace")
        self.assertEqual(self.request.media_trim_style, "no_encoding")
        self.assertEqual(self.request.timestamps, [{"startTime": "00:00:00.000", "endTime": "00:00:01.000"}])

    def test_media_change_shows_related_trim_request_link(self):
        response = self.client.get(reverse("admin:files_media_change", args=[self.media.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "View 1 trim request(s)")
        self.assertContains(response, reverse("admin:files_videotrimrequest_changelist"))
        self.assertContains(response, f"media__id__exact={self.media.pk}")
        self.assertContains(response, "related-links-tab")
        self.assertNotContains(response, "related-objects-tab")


@override_settings(SECURE_SSL_REDIRECT=False)
class TranscriptionRequestAdminTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("caption_request_admin_root", is_superuser=True)
        cls.media = create_media(cls.superuser, title="caption request media")
        cls.request = TranscriptionRequest.objects.create(media=cls.media, status="pending", logs="waiting")

    def setUp(self):
        self.client.force_login(self.superuser)

    def test_list_links_to_change_and_is_not_editable(self):
        model_admin = admin.site._registry[TranscriptionRequest]
        self.assertEqual(model_admin.list_display_links, ("display_id",))
        self.assertFalse(getattr(model_admin, "list_editable", ()))
        self.assertIn("logs", model_admin.readonly_fields)

        response = self.client.get(reverse("admin:files_transcriptionrequest_changelist"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("admin:files_transcriptionrequest_change", args=[self.request.pk]))
        self.assertContains(response, reverse("admin:files_media_change", args=[self.media.pk]))
        self.assertContains(response, "changelist-id-link")
        self.assertContains(response, "fas fa-search")
        self.assertNotContains(response, 'name="form-0-status"')
        self.assertContains(response, "fas fa-clock")
        self.assertContains(response, "fas fa-minus")
        self.assertContains(response, reverse("get_media") + f"?m={self.media.friendly_token}")

    def test_add_date_is_optional_and_id_sorts_descending(self):
        model_admin = admin.site._registry[TranscriptionRequest]
        self.assertEqual(model_admin.ordering, ("-id",))
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        request.session = {}
        self.assertEqual(
            model_admin.get_list_display(request),
            ["display_id", "link_media", "display_status", "display_translate_to_english", "open_on_site"],
        )

        url = reverse("admin:files_transcriptionrequest_changelist")
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertNotIn("field-add_date", html)
        self.assertLess(html.find('class="transcriptionrequest-column-chooser'), html.find('id="changelist-form"'))
        self.assertNotIn('transcriptionrequest-column-chooser admin-column-chooser card card-outline card-secondary mb-3" open', html)
        self.assertContains(response, 'value="add_date"')
        self.assertContains(response, "Add date")
        id_header = html.split("column-display_id", 1)[1].split("</th>", 1)[0]
        self.assertIn("fa-sort-alpha-up", id_header)

        newer = TranscriptionRequest.objects.create(media=self.media, status="success", logs="done")
        response = self.client.get(url)
        ids = [obj.pk for obj in response.context["cl"].result_list]
        self.assertEqual(ids, sorted(ids, reverse=True))
        self.assertEqual(ids[0], newer.pk)

        response = self.client.get(url, {"set_transcriptionrequest_columns": "1", "transcriptionrequest_col": "add_date", "q": "caption"})
        self.assertEqual(response.status_code, 302)
        self.assertIn("q=caption", response["Location"])
        self.assertNotIn("set_transcriptionrequest_columns", response["Location"])

        response = self.client.get(url, {"q": "caption"})
        display = [col for col in response.context["cl"].list_display if col != "action_checkbox"]
        self.assertEqual(display[0], "add_date")
        self.assertIn("field-add_date", response.content.decode())

        response = self.client.get(url, {"reset_transcriptionrequest_columns": "1", "q": "caption"})
        self.assertEqual(response.status_code, 302)
        response = self.client.get(url, {"q": "caption"})
        self.assertNotIn("field-add_date", response.content.decode())

        response = self.client.get(url, {"add_date__gte": "2000-01-01"})
        display = [col for col in response.context["cl"].list_display if col != "action_checkbox"]
        self.assertEqual(display[0], "add_date")

    def test_change_form_is_read_only(self):
        model_admin = admin.site._registry[TranscriptionRequest]
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        self.assertFalse(model_admin.has_add_permission(request))
        self.assertFalse(model_admin.has_change_permission(request))
        for field in ("status", "translate_to_english", "logs", "add_date", "link_media"):
            self.assertIn(field, model_admin.readonly_fields)

        response = self.client.get(reverse("admin:files_transcriptionrequest_change", args=[self.request.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'name="status"')
        self.assertNotContains(response, 'name="logs"')

        response = self.client.post(
            reverse("admin:files_transcriptionrequest_change", args=[self.request.pk]),
            {
                "status": "fail",
                "translate_to_english": "",
                "logs": "manual failure note",
                "_continue": "Save and continue editing",
            },
        )
        self.assertIn(response.status_code, (200, 403))
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, "pending")
        self.assertEqual(self.request.logs, "waiting")

    def test_media_change_shows_related_caption_request_link(self):
        response = self.client.get(reverse("admin:files_media_change", args=[self.media.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "View 1 transcription request(s)")
        self.assertContains(response, reverse("admin:files_transcriptionrequest_changelist"))
        self.assertContains(response, f"media__id__exact={self.media.pk}")
        self.assertNotContains(response, "related-objects-tab")


@override_settings(SECURE_SSL_REDIRECT=False)
class MediaPermissionAdminTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("media_permission_admin_root", is_superuser=True)
        cls.media = create_media(cls.superuser, title="permission media")
        cls.permission = MediaPermission.objects.create(
            media=cls.media,
            user=cls.superuser,
            owner_user=cls.superuser,
            permission="viewer",
        )

    def setUp(self):
        self.client.force_login(self.superuser)

    def test_list_is_not_editable_but_supports_bulk_delete(self):
        model_admin = admin.site._registry[MediaPermission]
        self.assertFalse(getattr(model_admin, "list_editable", ()))
        self.assertEqual(model_admin.list_display_links, ("display_id",))

        response = self.client.get(reverse("admin:files_mediapermission_changelist"))
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'name="form-0-permission"')
        self.assertContains(response, 'name="_selected_action"')
        self.assertContains(response, 'value="delete_selected"')
        self.assertContains(response, reverse("admin:files_mediapermission_change", args=[self.permission.pk]))
        self.assertContains(response, reverse("admin:files_media_change", args=[self.media.pk]))
        self.assertContains(response, "changelist-id-link")
        self.assertContains(response, "fas fa-search")
        self.assertContains(response, "fas fa-eye")
        self.assertContains(response, 'aria-label="Viewer"')
        self.assertContains(response, "fas fa-user-check")
        self.assertContains(response, 'aria-label="Explicit"')
        self.assertContains(response, reverse("get_media") + f"?m={self.media.friendly_token}")

    def test_created_at_is_optional_and_id_sorts_ascending(self):
        model_admin = admin.site._registry[MediaPermission]
        self.assertEqual(model_admin.ordering, ("id",))
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        request.session = {}
        self.assertEqual(
            model_admin.get_list_display(request),
            ["display_id", "link_media", "link_user", "link_owner", "display_permission", "display_source", "open_on_site"],
        )

        url = reverse("admin:files_mediapermission_changelist")
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertNotIn("field-created_at", html)
        self.assertLess(html.find('class="mediapermission-column-chooser'), html.find('id="changelist-form"'))
        self.assertNotIn("mediapermission-column-chooser admin-column-chooser card card-outline card-secondary mb-3\" open", html)
        self.assertContains(response, 'value="created_at"')
        self.assertContains(response, "Created at")
        id_header = html.split("column-display_id", 1)[1].split("</th>", 1)[0]
        self.assertIn("fa-sort-alpha-down", id_header)

        older = MediaPermission.objects.create(
            media=self.media,
            user=make_user("media_permission_older"),
            owner_user=self.superuser,
            permission="editor",
        )
        response = self.client.get(url)
        ids = [obj.pk for obj in response.context["cl"].result_list]
        self.assertIn(older.pk, ids)
        self.assertEqual(ids, sorted(ids))

        response = self.client.get(url, {"set_mediapermission_columns": "1", "mediapermission_col": "created_at", "q": "permission"})
        self.assertEqual(response.status_code, 302)
        self.assertIn("q=permission", response["Location"])
        self.assertNotIn("set_mediapermission_columns", response["Location"])

        response = self.client.get(url, {"q": "permission"})
        display = [col for col in response.context["cl"].list_display if col != "action_checkbox"]
        self.assertEqual(display[0], "created_at")
        self.assertIn("field-created_at", response.content.decode())
        id_header = response.content.decode().split("column-display_id", 1)[1].split("</th>", 1)[0]
        self.assertIn("fa-sort-alpha-down", id_header)

        response = self.client.get(url, {"reset_mediapermission_columns": "1", "q": "permission"})
        self.assertEqual(response.status_code, 302)
        response = self.client.get(url, {"q": "permission"})
        self.assertNotIn("field-created_at", response.content.decode())


@override_settings(SECURE_SSL_REDIRECT=False)
class LanguageAdminTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("language_admin_root", is_superuser=True)
        cls.language = Language.objects.create(code="en", title="English")
        cls.media = create_media(cls.superuser, title="captioned language media")
        Subtitle.objects.create(
            language=cls.language,
            media=cls.media,
            user=cls.superuser,
            subtitle_file=SimpleUploadedFile("language-admin.vtt", b"WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nhi\n"),
        )

    def setUp(self):
        self.client.force_login(self.superuser)

    def test_language_changelist_shows_caption_count_link(self):
        response = self.client.get(reverse("admin:files_language_changelist"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "English")
        filtered = reverse("admin:files_subtitle_changelist") + f"?language__id__exact={self.language.pk}"
        self.assertContains(response, filtered)
        self.assertContains(response, ">1<")

    def test_language_change_shows_related_captions_link(self):
        response = self.client.get(reverse("admin:files_language_change", args=[self.language.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "View 1 caption(s)")
        self.assertContains(response, f"language__id__exact={self.language.pk}")
        self.assertContains(response, "related-links-tab")
        self.assertNotContains(response, "related-objects-tab")

    def test_caption_changelist_links_language(self):
        response = self.client.get(reverse("admin:files_subtitle_changelist"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("admin:files_language_change", args=[self.language.pk]))
        self.assertContains(response, "English")
        self.assertContains(response, "changelist-id-link")
        self.assertContains(response, "fa-search")

    def test_caption_change_shows_linked_media_and_user_once(self):
        subtitle = Subtitle.objects.get(media=self.media, language=self.language)
        model_admin = admin.site._registry[Subtitle]
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        fieldsets = dict(model_admin.get_fieldsets(request, obj=subtitle))
        self.assertEqual(list(fieldsets.keys()), ["Caption"])
        self.assertEqual(
            list(fieldsets["Caption"]["fields"]),
            ["link_language", "link_media", "link_user", "subtitle_file"],
        )
        self.assertNotIn("media", fieldsets["Caption"]["fields"])
        self.assertNotIn("user", fieldsets["Caption"]["fields"])

        response = self.client.get(reverse("admin:files_subtitle_change", args=[subtitle.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'field-link_media')
        self.assertContains(response, 'field-link_user')
        self.assertNotContains(response, 'field-media')
        self.assertNotContains(response, 'field-user')
        self.assertContains(response, reverse("admin:files_media_change", args=[self.media.pk]))
        self.assertContains(response, f">{self.superuser.username}</a>")
        self.assertNotContains(response, "related-links-tab")

    def test_media_change_related_shows_captions_without_inline_tab(self):
        response = self.client.get(reverse("admin:files_media_change", args=[self.media.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "View 1 caption(s)")
        self.assertContains(response, reverse("admin:files_subtitle_changelist"))
        self.assertContains(response, f"media__id__exact={self.media.pk}")
        self.assertContains(response, 'id="jazzy-tabs"')
        self.assertNotContains(response, "related-objects-tab")

    def test_media_related_shows_caption_count_link(self):
        model_admin = admin.site._registry[Media]
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        fieldsets = dict(model_admin.get_fieldsets(request, obj=self.media))
        self.assertIn("related_captions", fieldsets["Related"]["fields"])
        response = self.client.get(reverse("admin:files_media_change", args=[self.media.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "View 1 caption(s)")
        self.assertContains(response, reverse("admin:files_subtitle_changelist"))
        self.assertContains(response, f"media__id__exact={self.media.pk}")
        self.assertContains(response, "related-links-tab")
        self.assertNotContains(response, "related-objects-tab")


class MediaRelationshipNavigationTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("media_nav_root", is_superuser=True)
        cls.media = create_media(cls.superuser, title="nav media with comments")
        cls.comment = Comment.objects.create(media=cls.media, user=cls.superuser, text="visible on media change")
        cls.playlist = Playlist.objects.create(title="nav playlist", user=cls.superuser)
        PlaylistMedia.objects.create(playlist=cls.playlist, media=cls.media, ordering=1)

    def setUp(self):
        self.client.force_login(self.superuser)

    def test_media_change_shows_related_comment_and_playlist_links(self):
        response = self.client.get(reverse("admin:files_media_change", args=[self.media.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "View 1 comment(s)")
        self.assertContains(response, reverse("admin:files_comment_changelist"))
        self.assertContains(response, f"media__id__exact={self.media.pk}")
        self.assertContains(response, "nav playlist")
        self.assertNotContains(response, "visible on media change")
        self.assertNotContains(response, "related-objects-tab")

    def test_comment_changelist_clips_long_text(self):
        long_text = "First line of the comment.\n\n" + ("continued " * 30)
        Comment.objects.create(media=self.media, user=self.superuser, text=long_text)
        response = self.client.get(reverse("admin:files_comment_changelist"))
        self.assertContains(response, "changelist-clipped-text__full")
        self.assertContains(response, "First line of the comment.")
        self.assertContains(response, "visible on media change")
        self.assertContains(response, "changelist-text-with-link")
        self.assertContains(response, reverse("admin:files_comment_change", args=[self.comment.pk]))
        self.assertContains(response, reverse("get_media") + f"?m={self.media.friendly_token}")
        linked = response.content.decode().split('class="changelist-text-with-link"', 1)[1]
        self.assertNotIn("open-on-site", linked.split("</a>", 1)[0])
        preview = response.content.decode().split('changelist-clipped-text__preview">', 1)[1].split("<", 1)[0]
        self.assertLessEqual(len(preview), ADMIN_CLIPPED_TEXT_LENGTH)
        self.assertTrue(preview.endswith("…"))
        self.assertNotIn("changelist-clipped-text", str(clipped_admin_text("visible on media change")))

    def test_comment_changelist_filters_by_media(self):
        other = create_media(self.superuser, title="other nav media")
        Comment.objects.create(media=other, user=self.superuser, text="other comment")
        response = self.client.get(reverse("admin:files_comment_changelist"), {"media__id__exact": self.media.pk})
        self.assertEqual(response.status_code, 200)
        texts = {c.text for c in response.context["cl"].result_list}
        self.assertEqual(texts, {"visible on media change"})

    @override_settings(SECURE_SSL_REDIRECT=False)
    def test_comment_change_shows_linked_user_and_media_once(self):
        reply = Comment.objects.create(media=self.media, user=self.superuser, text="reply on media change", parent=self.comment)
        model_admin = admin.site._registry[Comment]
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        fieldsets = dict(model_admin.get_fieldsets(request, obj=reply))
        self.assertEqual(list(fieldsets.keys()), ["Comment"])
        self.assertEqual(
            list(fieldsets["Comment"]["fields"]),
            ["add_date", "display_user", "display_media", "text", "display_parent", "display_uid"],
        )
        self.assertNotIn("user", fieldsets["Comment"]["fields"])
        self.assertNotIn("media", fieldsets["Comment"]["fields"])

        response = self.client.get(reverse("admin:files_comment_change", args=[reply.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "field-display_user")
        self.assertContains(response, "field-display_media")
        self.assertContains(response, "field-display_parent")
        self.assertNotContains(response, "field-user")
        self.assertNotContains(response, "field-media")
        self.assertContains(response, "media-metric__inspect")
        self.assertContains(response, 'title="Inspect"')
        self.assertContains(response, reverse("admin:users_user_change", args=[self.superuser.pk]))
        self.assertContains(response, reverse("admin:files_media_change", args=[self.media.pk]))
        self.assertContains(response, reverse("admin:files_comment_change", args=[self.comment.pk]))
        self.assertContains(response, 'data-copy-value="{}"'.format(reply.uid))
        self.assertContains(response, 'title="Copy"')
        self.assertNotContains(response, "related-links-tab")

    def test_user_change_shows_related_media_link(self):
        response = self.client.get(reverse("admin:users_user_change", args=[self.superuser.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("admin:files_media_changelist"))
        self.assertContains(response, f"user__id__exact={self.superuser.pk}")


@override_settings(SECURE_SSL_REDIRECT=False)
class EmailAddressAdminTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("email_admin_root", is_superuser=True, name="Email Admin")
        cls.member = make_user("email_member", name="Member Person")
        EmailAddress.objects.create(user=cls.superuser, email=cls.superuser.email, primary=True, verified=True)
        EmailAddress.objects.create(user=cls.member, email=cls.member.email, primary=False, verified=False)

    def setUp(self):
        self.client.force_login(self.superuser)

    def test_changelist_uses_status_icons_and_username(self):
        response = self.client.get(reverse("admin:account_emailaddress_changelist"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "fa-star")
        self.assertContains(response, "fa-check-circle")
        self.assertContains(response, "fa-times-circle")
        self.assertContains(response, "fa-minus")
        self.assertNotContains(response, "icon-yes.svg")
        self.assertNotContains(response, f"{self.member.name} - {self.member.email}")
        self.assertContains(response, self.member.username)
        self.assertContains(response, "column-display_primary")
        self.assertContains(response, "column-display_verified")
