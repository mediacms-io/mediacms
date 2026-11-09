import importlib
import os
from unittest.mock import patch

from allauth.socialaccount.models import SocialApp
from django.contrib import admin
from django.contrib.admin import AdminSite
from django.contrib.admin.sites import all_sites
from django.test import RequestFactory, TestCase, override_settings
from django.urls import reverse

import users.admin
from actions.models import MediaAction
from files.admin import MEDIA_REPORT_TAB_ACTIONS, CategoryAdminForm, PageAdminForm
from files.methods import can_delete_original_media_file, delete_original_media_file, media_has_original_file
from files.models import Category, Comment, EncodeProfile, Encoding, Media, Playlist, PlaylistMedia
from files.tests import create_account, create_media
from files.tests.media_utils import SMALL_VIDEO
from rbac.models import RBACGroup
from users.models import Channel, User

PASSWORD = "admin-files-password"


def make_user(username, **kwargs):
    return create_account(username=username, email=f"{username}@example.com", password=PASSWORD, **kwargs)


def category_form_data(category, **overrides):
    data = {"uid": category.uid, "title": category.title, "description": "", "is_global": "", "media_count": 0, "is_rbac_category": "", "is_lms_course": "", "lti_context_id": "", "rbac_groups": []}
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

    def test_reports_tab_shows_report_and_moderation_actions(self):
        model_admin = admin.site._registry[Media]
        fieldsets = model_admin.get_fieldsets(self.admin_request(), obj=self.public)
        reports_fieldsets = [options for name, options in fieldsets if name == "Reports"]
        self.assertEqual(len(reports_fieldsets), 1)
        self.assertEqual(reports_fieldsets[0]["fields"], ("reported_times", "report_actions_table"))
        self.assertIn("tab", reports_fieldsets[0]["classes"])
        main_fields = fieldsets[0][1]["fields"]
        self.assertNotIn("reported_times", main_fields)
        self.assertNotIn("report_actions_table", main_fields)

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
                "confirmation_text": "not sure",
                "_selected_action": [self.video.pk],
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(media_has_original_file(self.video))
        self.assertFalse(MediaAction.objects.filter(media=self.video, action="original_deleted").exists())

    def test_confirmation_deletes_original_and_audits(self):
        path = self.video.media_file.path
        self.assertTrue(os.path.isfile(path))
        response = self.client.post(
            reverse("admin:files_media_changelist"),
            {
                "action": "delete_original_media_files",
                "apply": "1",
                "confirmation_text": "I am sure",
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
        self.assertEqual(self.model_admin().get_list_display(request), ["title", "user", "add_date", "media_count"])
        self.assertNotIn("is_rbac_category", self.fieldset_fields())
        self.assertNotIn("lti_platform", self.fieldset_fields())

    @override_settings(USE_RBAC=True)
    def test_rbac_adds_filter_column_and_group_fieldsets(self):
        request = self.admin_request()
        self.assertEqual(self.model_admin().get_list_filter(request), ["is_rbac_category"])
        self.assertEqual(self.model_admin().get_list_display(request), ["title", "user", "add_date", "is_rbac_category", "media_count"])
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

    def test_playlist_change_shows_media_inline(self):
        response = self.client.get(reverse("admin:files_playlist_change", args=[self.playlist.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "playlist member media")


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

    def test_comment_changelist_filters_by_media(self):
        other = create_media(self.superuser, title="other nav media")
        Comment.objects.create(media=other, user=self.superuser, text="other comment")
        response = self.client.get(reverse("admin:files_comment_changelist"), {"media__id__exact": self.media.pk})
        self.assertEqual(response.status_code, 200)
        texts = {c.text for c in response.context["cl"].result_list}
        self.assertEqual(texts, {"visible on media change"})

    def test_user_change_shows_related_media_link(self):
        response = self.client.get(reverse("admin:users_user_change", args=[self.superuser.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("admin:files_media_changelist"))
        self.assertContains(response, f"user__id__exact={self.superuser.pk}")
