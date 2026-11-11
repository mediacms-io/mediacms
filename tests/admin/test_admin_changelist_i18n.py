from django.conf import settings
from django.test import TestCase
from django.urls import reverse

from files.frontend_translations import translate_string
from files.models import Comment, Media, TranscriptionRequest
from files.tests import create_account, create_media

PASSWORD = "admin-changelist-i18n-password"


class AdminChangelistI18nTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = create_account(
            username="changelist_i18n_root",
            email="changelist_i18n_root@example.com",
            password=PASSWORD,
            is_superuser=True,
        )
        cls.media = create_media(title="i18n media", user=cls.superuser)
        Comment.objects.create(media=cls.media, user=cls.superuser, text="hello")
        TranscriptionRequest.objects.create(media=cls.media, status="pending", logs="waiting")

    def setUp(self):
        self.client.force_login(self.superuser)
        self.client.cookies[settings.LANGUAGE_COOKIE_NAME] = "el"

    def test_media_add_button_uses_natural_greek_order(self):
        response = self.client.get(reverse("admin:files_media_changelist"))
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        add_label = f'{translate_string("el", "Add")} {translate_string("el", Media._meta.verbose_name)}'
        self.assertIn(add_label, html)
        self.assertNotIn("media: προσθήκη", html.lower())
        self.assertNotIn("media: greek", html.lower())

    def test_comment_add_button_uses_natural_greek_order(self):
        response = self.client.get(reverse("admin:files_comment_changelist"))
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        add_label = f'{translate_string("el", "Add")} {translate_string("el", Comment._meta.verbose_name)}'
        self.assertIn(add_label, html)
        self.assertNotIn("comment: προσθήκη", html.lower())

    def test_pagination_footer_uses_translated_model_name(self):
        response = self.client.get(reverse("admin:files_media_changelist"))
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        # One result uses the singular verbose_name in the footer.
        singular = translate_string("el", Media._meta.verbose_name)
        self.assertRegex(html, rf"\d+\s+{singular}")
        self.assertNotIn(">medias<", html)

    def test_optional_column_chooser_labels_translated(self):
        response = self.client.get(reverse("admin:files_media_changelist"))
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn(translate_string("el", "Columns"), html)
        self.assertIn(translate_string("el", "Apply columns"), html)
        self.assertIn(translate_string("el", "Duration"), html)
        self.assertIn(translate_string("el", "Allow download"), html)

    def test_column_headers_and_filters_translated(self):
        response = self.client.get(reverse("admin:files_media_changelist"))
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn(translate_string("el", "title"), html)
        self.assertIn(translate_string("el", "Reports"), html)
        self.assertIn(translate_string("el", "Encoding queue"), html)
        self.assertIn(translate_string("el", "Has reports"), html)

    def test_optional_column_labels_translated_in_context(self):
        response = self.client.get(reverse("admin:files_media_changelist"))
        self.assertEqual(response.status_code, 200)
        labels = {col["label"] for col in response.context["media_optional_columns"]}
        self.assertIn(translate_string("el", "Duration"), labels)
        self.assertIn(translate_string("el", "Comments"), labels)
        self.assertNotIn("Duration", labels)

    def test_media_choice_cell_values_translated(self):
        response = self.client.get(reverse("admin:files_media_changelist"))
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn(translate_string("el", self.media.get_media_type_display()), html)
        self.assertIn(translate_string("el", self.media.get_state_display()), html)
        self.assertIn(translate_string("el", self.media.get_encoding_status_display()), html)

    def test_delete_selected_action_natural_order_for_caption_requests(self):
        response = self.client.get(reverse("admin:files_transcriptionrequest_changelist"))
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        expected = f'{translate_string("el", "Delete selected")} ' f'{translate_string("el", TranscriptionRequest._meta.verbose_name_plural)}'
        self.assertIn(expected, html)
        self.assertNotIn(f"{TranscriptionRequest._meta.verbose_name_plural}:", html)

    def test_caption_request_filter_title_translated(self):
        response = self.client.get(reverse("admin:files_transcriptionrequest_changelist"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, translate_string("el", "translate to english"))
