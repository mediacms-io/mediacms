from unittest.mock import patch

from django.contrib import admin
from django.contrib.admin.utils import quote
from django.test import Client, RequestFactory, TestCase
from django.urls import reverse

from files.models import Comment, Encoding, Media
from files.tests import create_account, create_media
from users.models import User

PASSWORD = "admin-object-actions-password"


def make_user(username, **kwargs):
    return create_account(username=username, email=f"{username}@example.com", password=PASSWORD, **kwargs)


class ObjectActionsChangeFormTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("object_actions_root", is_superuser=True)
        cls.media = create_media(cls.superuser, title="object actions media")
        cls.comment = Comment.objects.create(media=cls.media, user=cls.superuser, text="no custom actions")

    def setUp(self):
        self.client.force_login(self.superuser)

    def test_media_change_form_shows_actions_dropdown_without_delete_selected(self):
        response = self.client.get(reverse("admin:files_media_change", args=[self.media.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "object-tools-actions")
        self.assertContains(response, "Generate missing encodings")
        self.assertContains(response, "---------")
        action_url = reverse("admin:files_media_object_action", args=[self.media.pk])
        self.assertContains(response, action_url)
        # Nested <form> is invalid inside Jazzmin's change form; Go must use formaction.
        self.assertContains(response, f'formaction="{action_url}"')
        self.assertContains(response, 'formmethod="post"')
        self.assertNotContains(response, f'<form method="post" action="{action_url}"')
        self.assertContains(response, 'id="id_object_action"')
        self.assertContains(response, "object-tools-actions-go")
        choice_values = [value for value, _label, _disabled in response.context["object_action_choices"]]
        self.assertIn("generate_missing_encodings", choice_values)
        self.assertNotIn("delete_selected", choice_values)
        self.assertIn("generate_missing_encodings", [a["name"] for a in response.context["object_actions"]])
        self.assertNotIn("delete_selected", [a["name"] for a in response.context["object_actions"]])

    def test_comment_change_form_has_no_actions_dropdown(self):
        response = self.client.get(reverse("admin:files_comment_change", args=[self.comment.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context.get("object_actions") or [], [])
        self.assertEqual(response.context.get("object_action_choices") or [], [])
        self.assertNotContains(response, "object-tools-actions")

    def test_object_action_runs_bulk_action_for_single_object(self):
        with patch.object(Media, "encode") as encode:
            response = self.client.post(
                reverse("admin:files_media_object_action", args=[self.media.pk]),
                {"action": "generate_missing_encodings"},
            )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], reverse("admin:files_media_change", args=[self.media.pk]))
        self.assertEqual(encode.call_count, 1)
        self.assertEqual(encode.call_args.kwargs, {"force": False})

    def test_object_action_requires_change_permission(self):
        viewer = make_user("object_actions_viewer")
        client = Client()
        client.force_login(viewer)
        response = client.post(
            reverse("admin:files_media_object_action", args=[self.media.pk]),
            {"action": "generate_missing_encodings"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response["Location"].startswith(reverse("admin:login")))

        model_admin = admin.site._registry[Media]
        request = RequestFactory().get("/admin/")
        request.user = viewer
        self.assertNotIn("generate_missing_encodings", model_admin.get_actions(request))

    def test_change_owner_from_change_form_intermediate_and_apply(self):
        new_owner = make_user("object_actions_new_owner")
        action_url = reverse("admin:files_media_object_action", args=[self.media.pk])
        response = self.client.post(action_url, {"action": "change_owner"})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Change media owner")
        self.assertContains(response, reverse("admin:files_media_change", args=[self.media.pk]))

        response = self.client.post(
            action_url,
            {
                "action": "change_owner",
                "apply": "1",
                "new_owner": new_owner.username,
                "_selected_action": [self.media.pk],
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], reverse("admin:files_media_change", args=[self.media.pk]))
        self.media.refresh_from_db()
        self.assertEqual(self.media.user_id, new_owner.pk)

    def test_encoding_and_user_object_action_urls_resolve(self):
        for model, pk in ((Encoding, 1), (User, self.superuser.pk), (Media, self.media.pk)):
            opts = model._meta
            url = reverse(f"admin:{opts.app_label}_{opts.model_name}_object_action", args=[quote(pk)])
            self.assertTrue(url.endswith("/object-action/"))
