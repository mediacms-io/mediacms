import importlib
import os
from unittest.mock import patch

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
from files.admin import MEDIA_REPORT_TAB_ACTIONS, CategoryAdminForm, PageAdminForm
from files.admin_helpers import RELATED_INLINE_LIMIT
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

    def _media_admin_request(self, params=None, session=None):
        request = RequestFactory().get("/admin/files/media/", params or {})
        request.user = self.superuser
        request.session = session if session is not None else {}
        return request

    def test_optional_columns_hidden_by_default_and_listable_shown(self):
        model_admin = admin.site._registry[Media]
        display = model_admin.get_list_display(self._media_admin_request())
        for column in (
            "duration",
            "is_reviewed",
            "featured",
            "get_comments_count",
            "get_encodings_count",
            "reported_times",
            "allow_download",
            "enable_comments",
        ):
            self.assertNotIn(column, display)
        self.assertIn("listable", display)
        self.assertIn("title", display)
        editable = model_admin.get_list_editable(self._media_admin_request())
        self.assertEqual(editable, ())

    def test_related_filters_force_optional_columns(self):
        model_admin = admin.site._registry[Media]
        reviewed = model_admin.get_list_display(self._media_admin_request({"is_reviewed__exact": "0"}))
        self.assertIn("is_reviewed", reviewed)
        featured = model_admin.get_list_display(self._media_admin_request({"featured__exact": "1"}))
        self.assertIn("featured", featured)
        reported = model_admin.get_list_display(self._media_admin_request({"reported": "yes"}))
        self.assertIn("reported_times", reported)
        encodings = model_admin.get_list_display(self._media_admin_request({"encoding_status__exact": "pending"}))
        self.assertIn("get_encodings_count", encodings)
        queue = model_admin.get_list_display(self._media_admin_request({"encoding_queue": "pending"}))
        self.assertIn("get_encodings_count", queue)
        downloads = model_admin.get_list_display(self._media_admin_request({"allow_download__exact": "0"}))
        self.assertIn("allow_download", downloads)
        comments = model_admin.get_list_display(self._media_admin_request({"enable_comments__exact": "1"}))
        self.assertIn("enable_comments", comments)

    def test_column_chooser_persists_selection_in_session(self):
        url = reverse("admin:files_media_changelist")
        response = self.client.get(url, {"set_media_columns": "1", "media_col": ["duration", "allow_download"], "state": "public"})
        self.assertEqual(response.status_code, 302)
        self.assertIn("state=public", response["Location"])
        self.assertNotIn("set_media_columns", response["Location"])
        self.assertNotIn("media_col", response["Location"])

        response = self.client.get(url, {"state": "public"})
        self.assertEqual(response.status_code, 200)
        display = list(response.context["cl"].list_display)
        self.assertIn("duration", display)
        self.assertIn("allow_download", display)
        self.assertNotIn("reported_times", display)
        self.assertIn("listable", display)
        self.assertContains(response, "Apply columns")
        self.assertContains(response, 'name="media_col"')
        # Column chooser must render outside the changelist POST form.
        html = response.content.decode()
        chooser_pos = html.find('class="media-column-chooser')
        form_pos = html.find('id="changelist-form"')
        self.assertNotEqual(chooser_pos, -1)
        self.assertNotEqual(form_pos, -1)
        self.assertLess(chooser_pos, form_pos)

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
        self.assertIn("spam", html)
        self.assertIn("Report cleared", html)
        self.assertIn("Media reviewed", html)
        self.assertIn("/admin/actions/mediaaction/", html)
        self.assertNotIn(">Like<", html)
        self.assertTrue({"report", "report_cleared", "report_confirmed", "media_reviewed", "original_deleted"}.issubset(set(MEDIA_REPORT_TAB_ACTIONS)))

        related = str(model_admin.related_reports(self.public))
        self.assertIn("3 report/moderation", related)

    def test_media_change_fieldsets_are_grouped_by_purpose(self):
        model_admin = admin.site._registry[Media]
        fieldsets = dict(model_admin.get_fieldsets(self.admin_request(), obj=self.public))
        self.assertEqual(
            list(fieldsets.keys()),
            ["Content", "Publishing", "Sharing", "Media file", "Details", "Reports", "Related"],
        )
        self.assertIn("title", fieldsets["Content"]["fields"])
        self.assertNotIn("rating_category", fieldsets["Content"]["fields"])
        self.assertIn("state", fieldsets["Publishing"]["fields"])
        self.assertEqual(
            fieldsets["Sharing"]["fields"],
            ("allow_download", "enable_comments", "password"),
        )
        self.assertIn("media_file", fieldsets["Media file"]["fields"])
        self.assertNotIn("allow_whisper_transcribe", fieldsets["Media file"]["fields"])
        self.assertIn("friendly_token", fieldsets["Details"]["fields"])
        self.assertNotIn("related_captions", fieldsets["Details"]["fields"])
        self.assertIn("related_captions", fieldsets["Related"]["fields"])
        self.assertIn("related-links-tab", fieldsets["Related"]["classes"])
        self.assertNotIn("allow_download", model_admin.readonly_fields)
        for machine_field in ("display_encoding_status", "duration", "md5sum", "search", "views"):
            self.assertIn(machine_field, model_admin.readonly_fields)
        self.assertIn("display_media_type", model_admin.readonly_fields)
        self.assertIn("display_media_type", fieldsets["Media file"]["fields"])
        self.assertIn("display_encoding_status", fieldsets["Media file"]["fields"])
        self.assertNotIn("media_type", fieldsets["Media file"]["fields"])
        self.assertNotIn("encoding_status", fieldsets["Media file"]["fields"])
        for inline in model_admin.inlines:
            self.assertIn("tab", inline.classes)
            self.assertIn("related-objects-tab", inline.classes)

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

    def test_extra_info_column_and_clear_related_action(self):
        model_admin = admin.site._registry[MediaAction]
        self.assertIn("extra_info", model_admin.list_display)
        response = self.client.post(
            reverse("admin:actions_mediaaction_changelist"),
            {"action": "clear_reports_for_related_media", "_selected_action": [self.report.pk]},
        )
        self.assertEqual(response.status_code, 302)
        self.media.refresh_from_db()
        self.assertEqual(self.media.reported_times, 0)
        self.assertFalse(MediaAction.objects.filter(media=self.media, action="report").exists())
        self.assertTrue(MediaAction.objects.filter(media=self.media, action="report_cleared", user=self.superuser).exists())

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
        like = MediaAction.objects.create(user=self.superuser, media=self.media, action="like")
        like_html = str(model_admin.link_media(like))
        self.assertNotIn("#reports-tab", like_html)


class EncodingAdminTest(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def test_title_and_has_file_columns(self):
        user = make_user("files_encoding_admin")
        media = create_media(user, title="encoding admin media")
        encoding = Encoding.objects.create(media=media, profile=EncodeProfile.objects.first(), status="pending")
        model_admin = admin.site._registry[Encoding]
        self.assertEqual(model_admin.get_title(encoding), str(encoding))
        self.assertFalse(model_admin.has_file(encoding))

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
        self.assertEqual(self.model_admin().get_list_filter(request), [])
        self.assertEqual(self.model_admin().get_list_display(request), ["title", "user", "related_media_count"])
        self.assertNotIn("is_rbac_category", self.fieldset_fields())
        self.assertNotIn("lti_platform", self.fieldset_fields())
        self.assertIn("related_media", self.fieldset_fields())

    @override_settings(USE_RBAC=True)
    def test_rbac_adds_filter_column_and_group_fieldsets(self):
        request = self.admin_request()
        self.assertEqual(self.model_admin().get_list_filter(request), ["is_rbac_category"])
        self.assertEqual(self.model_admin().get_list_display(request), ["title", "user", "is_rbac_category", "related_media_count"])
        self.assertIn("rbac_groups", self.fieldset_fields())
        self.assertNotIn("identity_provider", self.fieldset_fields())

    @override_settings(USE_RBAC=True, USE_IDENTITY_PROVIDERS=True, USE_LTI=True)
    def test_all_flags_add_identity_provider_and_lti_options(self):
        request = self.admin_request()
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

    def test_media_count_links_and_change_lists_media(self):
        category = Category.objects.create(title="Linked media category", media_count=1)
        media = create_media(self.superuser, title="category listed media", category=[category])
        category.update_category_media()
        self.client.force_login(self.superuser)

        filtered = reverse("admin:files_media_changelist") + f"?category__id__exact={category.pk}"
        list_response = self.client.get(reverse("admin:files_category_changelist"))
        self.assertEqual(list_response.status_code, 200)
        self.assertContains(list_response, filtered)
        self.assertContains(list_response, ">1<")

        change_response = self.client.get(reverse("admin:files_category_change", args=[category.pk]))
        self.assertEqual(change_response.status_code, 200)
        self.assertContains(change_response, "View 1 media item(s)")
        self.assertContains(change_response, filtered)
        self.assertContains(change_response, media.title)
        self.assertContains(change_response, self.superuser.username)
        self.assertContains(change_response, "Listable")


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
        inline_models = [inline.model for inline in model_admin.inlines]
        self.assertEqual(inline_models, [Media, Playlist, Channel, Comment, MediaAction])
        for inline in model_admin.inlines:
            self.assertIn("related-objects-tab", inline.classes)

        response = self.client.get(reverse("admin:users_user_change", args=[self.editor.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "editor owned media")
        self.assertContains(response, "editor playlist")
        self.assertContains(response, "editor comment")
        self.assertContains(response, reverse("admin:files_media_changelist"))
        self.assertContains(response, f"user__id__exact={self.editor.pk}")
        self.assertContains(response, reverse("admin:actions_mediaaction_changelist"))
        self.assertContains(response, "action__exact=like")
        self.assertContains(response, reverse("admin:files_comment_changelist"))
        self.assertContains(response, "related-links-tab")
        self.assertContains(response, "related-objects-tab")

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

    def test_channel_change_shows_media_tab(self):
        channel = Channel.objects.get(user=self.superuser)
        Media.objects.filter(pk=self.media.pk).update(channel=channel)
        response = self.client.get(reverse("admin:users_channel_change", args=[channel.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "playlist member media")
        self.assertContains(response, self.superuser.username)
        self.assertContains(response, "Listable")
        self.assertContains(response, f"channel__id__exact={channel.pk}")
        # Jazzmin tab markup for the media inline
        self.assertContains(response, 'id="jazzy-tabs"')
        self.assertContains(response, "Media")

    def test_playlist_change_shows_media_inline(self):
        response = self.client.get(reverse("admin:files_playlist_change", args=[self.playlist.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "playlist member media")
        self.assertContains(response, self.superuser.username)
        self.assertContains(response, "Listable")

    def test_playlist_change_puts_title_before_description(self):
        model_admin = admin.site._registry[Playlist]
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        fieldsets = dict(model_admin.get_fieldsets(request, obj=self.playlist))
        fields = list(fieldsets["Playlist"]["fields"])
        self.assertLess(fields.index("title"), fields.index("description"))
        self.assertIn("related-links-tab", fieldsets["Related"]["classes"])

    def test_playlist_inline_delete_resequences_ordering(self):
        second = create_media(self.superuser, title="playlist member two")
        third = create_media(self.superuser, title="playlist member three")
        pm1 = PlaylistMedia.objects.get(playlist=self.playlist, media=self.media)
        pm2 = PlaylistMedia.objects.create(playlist=self.playlist, media=second, ordering=2)
        pm3 = PlaylistMedia.objects.create(playlist=self.playlist, media=third, ordering=3)

        response = self.client.post(
            reverse("admin:files_playlist_change", args=[self.playlist.pk]),
            {
                "title": self.playlist.title,
                "description": self.playlist.description,
                "playlistmedia_set-TOTAL_FORMS": "3",
                "playlistmedia_set-INITIAL_FORMS": "3",
                "playlistmedia_set-MIN_NUM_FORMS": "0",
                "playlistmedia_set-MAX_NUM_FORMS": "1000",
                "playlistmedia_set-0-id": str(pm1.pk),
                "playlistmedia_set-0-DELETE": "on",
                "playlistmedia_set-1-id": str(pm2.pk),
                "playlistmedia_set-2-id": str(pm3.pk),
                "_save": "Save",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertFalse(PlaylistMedia.objects.filter(pk=pm1.pk).exists())
        orderings = list(PlaylistMedia.objects.filter(playlist=self.playlist).order_by("ordering").values_list("media__title", "ordering"))
        self.assertEqual(orderings, [("playlist member two", 1), ("playlist member three", 2)])

    def test_playlist_changelist_media_count_links_to_filtered_media(self):
        response = self.client.get(reverse("admin:files_playlist_changelist"))
        self.assertEqual(response.status_code, 200)
        filtered = reverse("admin:files_media_changelist") + f"?playlist__id__exact={self.playlist.pk}"
        self.assertContains(response, filtered)
        self.assertContains(response, ">1<")

        media_response = self.client.get(reverse("admin:files_media_changelist"), {"playlist__id__exact": self.playlist.pk})
        self.assertEqual(media_response.status_code, 200)
        titles = {m.title for m in media_response.context["cl"].result_list}
        self.assertEqual(titles, {"playlist member media"})


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

    def test_tag_changelist_shows_media_count_link(self):
        response = self.client.get(reverse("admin:files_tag_changelist"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "admintag")
        filtered = reverse("admin:files_media_changelist") + f"?tags__id__exact={self.tag.pk}"
        self.assertContains(response, filtered)

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

    def test_tag_change_lists_media_inline(self):
        response = self.client.get(reverse("admin:files_tag_change", args=[self.tag.pk]))
        self.assertEqual(response.status_code, 200)
        # Related tab shows total tagged media (not public/reviewed-only media_count).
        self.assertContains(response, "View 1 media item(s)")
        self.assertContains(response, f"tags__id__exact={self.tag.pk}")
        self.assertContains(response, "tagged admin media")
        self.assertContains(response, self.superuser.username)
        self.assertContains(response, "Listable")
        self.assertContains(response, 'id="jazzy-tabs"')
        self.assertContains(response, "General")
        self.assertContains(response, "Related")
        self.assertContains(response, "related-links-tab")
        self.assertContains(response, "related-objects-tab")

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

    def test_license_change_lists_media_inline(self):
        response = self.client.get(reverse("admin:files_license_change", args=[self.license.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "licensed media")
        self.assertContains(response, self.superuser.username)
        self.assertContains(response, "Listable")
        self.assertContains(response, 'id="jazzy-tabs"')
        self.assertContains(response, "General")
        self.assertContains(response, "Related")
        self.assertContains(response, "related-links-tab")
        self.assertContains(response, "related-objects-tab")
        model_admin = admin.site._registry[License]
        self.assertEqual([inline.model for inline in model_admin.inlines], [Media])

    def test_media_changelist_filters_by_license(self):
        other = create_media(self.superuser, title="unlicensed media")
        response = self.client.get(reverse("admin:files_media_changelist"), {"license__id__exact": self.license.pk})
        self.assertEqual(response.status_code, 200)
        titles = {m.title for m in response.context["cl"].result_list}
        self.assertEqual(titles, {"licensed media"})
        self.assertNotIn(other.title, titles)


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
        self.assertEqual(model_admin.list_display_links, ("id", "display_status"))
        response = self.client.get(reverse("admin:files_videotrimrequest_changelist"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("admin:files_videotrimrequest_change", args=[self.request.pk]))
        # Media column still links to the media, separately from the request change link.
        self.assertContains(response, reverse("admin:files_media_change", args=[self.media.pk]))

    def test_change_form_can_update_status_and_timestamps(self):
        response = self.client.post(
            reverse("admin:files_videotrimrequest_change", args=[self.request.pk]),
            {
                "media": self.media.pk,
                "status": "fail",
                "video_action": "save_new",
                "media_trim_style": "precise",
                "timestamps": '[{"startTime": "00:00:01.000", "endTime": "00:00:02.000"}]',
                "_continue": "Save and continue editing",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, "fail")
        self.assertEqual(self.request.video_action, "save_new")
        self.assertEqual(self.request.media_trim_style, "precise")
        self.assertEqual(self.request.timestamps, [{"startTime": "00:00:01.000", "endTime": "00:00:02.000"}])

    def test_media_change_shows_trim_requests_tab(self):
        response = self.client.get(reverse("admin:files_media_change", args=[self.media.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Trim Requests")
        self.assertContains(response, 'id="jazzy-tabs"')
        self.assertContains(response, reverse("admin:files_videotrimrequest_change", args=[self.request.pk]))
        self.assertContains(response, "Initial")
        model_admin = admin.site._registry[Media]
        trim_inline = next(inline for inline in model_admin.inlines if inline.model is VideoTrimRequest)
        self.assertIn("tab", trim_inline.classes)
        self.assertEqual(trim_inline.verbose_name_plural, "Trim Requests")


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
        self.assertEqual(model_admin.list_display_links, ("id", "link_media"))
        self.assertFalse(getattr(model_admin, "list_editable", ()))
        self.assertNotIn("logs", model_admin.readonly_fields)

        response = self.client.get(reverse("admin:files_transcriptionrequest_changelist"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("admin:files_transcriptionrequest_change", args=[self.request.pk]))
        self.assertNotContains(response, 'name="form-0-status"')

    def test_change_form_can_update_status_and_logs(self):
        response = self.client.post(
            reverse("admin:files_transcriptionrequest_change", args=[self.request.pk]),
            {
                "media": self.media.pk,
                "status": "fail",
                "translate_to_english": "",
                "logs": "manual failure note",
                "_continue": "Save and continue editing",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, "fail")
        self.assertEqual(self.request.logs, "manual failure note")

    def test_media_change_shows_caption_request_inline(self):
        response = self.client.get(reverse("admin:files_media_change", args=[self.media.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Caption Requests")
        self.assertContains(response, "Pending")
        self.assertContains(response, reverse("admin:files_transcriptionrequest_change", args=[self.request.pk]))


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

        response = self.client.get(reverse("admin:files_mediapermission_changelist"))
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'name="form-0-permission"')
        self.assertContains(response, 'name="_selected_action"')
        self.assertContains(response, 'value="delete_selected"')


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

    def test_language_change_lists_captions_inline(self):
        response = self.client.get(reverse("admin:files_language_change", args=[self.language.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "captioned language media")
        self.assertContains(response, "View 1 caption(s)")
        self.assertContains(response, f"language__id__exact={self.language.pk}")

    def test_caption_changelist_links_language(self):
        response = self.client.get(reverse("admin:files_subtitle_changelist"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("admin:files_language_change", args=[self.language.pk]))
        self.assertContains(response, "English")

    def test_caption_change_shows_linked_media_and_user_once(self):
        subtitle = Subtitle.objects.get(media=self.media, language=self.language)
        model_admin = admin.site._registry[Subtitle]
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        fieldsets = dict(model_admin.get_fieldsets(request, obj=subtitle))
        self.assertEqual(list(fieldsets["Caption"]["fields"]), ["subtitle_file"])
        self.assertEqual(list(fieldsets["Related"]["fields"]), ["link_language", "link_media", "link_user"])
        self.assertIn("related-links-tab", fieldsets["Related"]["classes"])
        self.assertNotIn("media", fieldsets["Caption"]["fields"])
        self.assertNotIn("user", fieldsets["Caption"]["fields"])
        self.assertNotIn("media", fieldsets["Related"]["fields"])
        self.assertNotIn("user", fieldsets["Related"]["fields"])

        response = self.client.get(reverse("admin:files_subtitle_change", args=[subtitle.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'field-link_media')
        self.assertContains(response, 'field-link_user')
        self.assertNotContains(response, 'field-media')
        self.assertNotContains(response, 'field-user')
        self.assertContains(response, reverse("admin:files_media_change", args=[self.media.pk]))
        self.assertContains(response, f">{self.superuser.username}</a>")
        self.assertContains(response, "related-links-tab")

    def test_media_change_caption_inline_links_language(self):
        response = self.client.get(reverse("admin:files_media_change", args=[self.media.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("admin:files_language_change", args=[self.language.pk]))
        self.assertContains(response, "English")
        self.assertContains(response, "Captions")
        self.assertContains(response, 'id="jazzy-tabs"')
        subtitle = Subtitle.objects.get(media=self.media, language=self.language)
        self.assertContains(response, reverse("admin:files_subtitle_change", args=[subtitle.pk]))
        model_admin = admin.site._registry[Media]
        subtitle_inline = next(inline for inline in model_admin.inlines if inline.model is Subtitle)
        self.assertIn("tab", subtitle_inline.classes)
        self.assertEqual(subtitle_inline.verbose_name_plural, "Captions")

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
        self.assertContains(response, "related-objects-tab")


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

    def test_media_change_shows_comment_inline_and_related_links(self):
        response = self.client.get(reverse("admin:files_media_change", args=[self.media.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "visible on media change")
        self.assertContains(response, reverse("admin:files_comment_changelist"))
        self.assertContains(response, f"media__id__exact={self.media.pk}")
        self.assertContains(response, "nav playlist")
        self.assertNotContains(response, "View the full filtered list")

    def test_media_comment_inline_limits_to_latest_rows_with_overflow_note(self):
        # Oldest through newest; inline orders by -add_date so the newest stay visible.
        for index in range(RELATED_INLINE_LIMIT + 1):
            Comment.objects.create(
                media=self.media,
                user=self.superuser,
                text=f"overflow comment {index:02d}",
            )
        response = self.client.get(reverse("admin:files_media_change", args=[self.media.pk]))
        self.assertEqual(response.status_code, 200)
        content = response.content.decode()
        self.assertIn("View the full filtered list", content)
        self.assertIn(f"Showing {RELATED_INLINE_LIMIT} of {RELATED_INLINE_LIMIT + 2} related Comments", content)
        self.assertIn(reverse("admin:files_comment_changelist"), content)
        self.assertIn(f"media__id__exact={self.media.pk}", content)
        # Newest RELATED_INLINE_LIMIT overflow comments are shown; the oldest overflow one is not.
        self.assertIn(f"overflow comment {RELATED_INLINE_LIMIT:02d}", content)
        self.assertIn("overflow comment 01", content)
        self.assertNotIn("overflow comment 00", content)
        # Original setup comment is older than all overflow comments, so it is truncated away.
        self.assertNotIn("visible on media change", content)

    def test_comment_changelist_filters_by_media(self):
        other = create_media(self.superuser, title="other nav media")
        Comment.objects.create(media=other, user=self.superuser, text="other comment")
        response = self.client.get(reverse("admin:files_comment_changelist"), {"media__id__exact": self.media.pk})
        self.assertEqual(response.status_code, 200)
        texts = {c.text for c in response.context["cl"].result_list}
        self.assertEqual(texts, {"visible on media change"})

    def test_comment_change_shows_linked_user_and_media_once(self):
        model_admin = admin.site._registry[Comment]
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        fieldsets = dict(model_admin.get_fieldsets(request, obj=self.comment))
        self.assertEqual(list(fieldsets["Comment"]["fields"]), ["text", "parent", "add_date", "uid"])
        self.assertEqual(list(fieldsets["Related"]["fields"]), ["link_user", "link_media"])
        self.assertIn("related-links-tab", fieldsets["Related"]["classes"])
        self.assertNotIn("user", fieldsets["Comment"]["fields"])
        self.assertNotIn("media", fieldsets["Comment"]["fields"])

        response = self.client.get(reverse("admin:files_comment_change", args=[self.comment.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "field-link_user")
        self.assertContains(response, "field-link_media")
        self.assertNotContains(response, "field-user")
        self.assertNotContains(response, "field-media")
        self.assertContains(response, f"{self.superuser.username}</a>")
        self.assertContains(response, reverse("admin:files_media_change", args=[self.media.pk]))
        self.assertContains(response, "related-links-tab")

    def test_user_change_shows_related_media_link(self):
        response = self.client.get(reverse("admin:users_user_change", args=[self.superuser.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("admin:files_media_changelist"))
        self.assertContains(response, f"user__id__exact={self.superuser.pk}")
