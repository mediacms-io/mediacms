from django.contrib import admin
from django.test import RequestFactory, TestCase

from admin_customizations.action_choices import (
    ACTIONS_PLACEHOLDER,
    SEPARATOR_LABEL,
    SEPARATOR_PREFIX,
    build_grouped_action_choices,
    is_separator_choice,
)
from files.models import Category, Comment, EncodeProfile, Media
from files.tests import create_account

PASSWORD = "admin-action-choices-password"


class ActionChoicesHelperTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = create_account(
            username="action_choices_root",
            email="action_choices_root@example.com",
            password=PASSWORD,
            is_superuser=True,
        )

    def test_media_action_choices_have_placeholder_and_separators(self):
        model_admin = admin.site._registry[Media]
        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        choices = model_admin.get_action_choices(request)
        self.assertEqual(choices[0], ACTIONS_PLACEHOLDER)
        labels = [label for _value, label in choices]
        self.assertIn(SEPARATOR_LABEL, labels)
        self.assertIn("Generate missing encodings", labels)
        self.assertIn("Delete original file", labels)
        self.assertIn("Delete selected media", labels)
        self.assertFalse(any("%(" in label or "%{" in label for label in labels))
        sep_values = [value for value, _label in choices if is_separator_choice(value)]
        self.assertTrue(sep_values)
        self.assertTrue(all(value.startswith(SEPARATOR_PREFIX) for value in sep_values))

    def test_default_only_admins_use_actions_placeholder(self):
        from admin_customizations.action_choices import GroupedActionForm

        request = RequestFactory().get("/admin/")
        request.user = self.superuser
        for model in (Category, Comment, EncodeProfile):
            with self.subTest(model=model.__name__):
                model_admin = admin.site._registry[model]
                self.assertIs(model_admin.action_form, GroupedActionForm)
                choices = model_admin.get_action_choices(request)
                self.assertEqual(choices[0], ACTIONS_PLACEHOLDER)
                labels = [label for _value, label in choices]
                self.assertTrue(any(label.startswith("Delete selected ") for label in labels))
                self.assertFalse(any("%(" in label for label in labels))
                self.assertFalse(any(is_separator_choice(value) for value, _label in choices))

    def test_build_grouped_action_choices_excludes_and_leftovers(self):
        actions = {
            "a": (None, "a", "Alpha"),
            "b": (None, "b", "Beta"),
            "c": (None, "c", "Gamma"),
            "delete_selected": (None, "delete_selected", "Delete selected %(verbose_name_plural)s"),
        }
        choices = build_grouped_action_choices(actions, [["a"], ["b"]], exclude={"delete_selected"})
        values = [value for value, _label in choices]
        self.assertEqual(values[0], "")
        self.assertIn("a", values)
        self.assertIn("b", values)
        self.assertIn("c", values)
        self.assertNotIn("delete_selected", values)

    def test_delete_selected_description_is_formatted(self):
        actions = {
            "delete_selected": (None, "delete_selected", "Delete selected %(verbose_name_plural)s"),
        }
        choices = build_grouped_action_choices(actions, [["delete_selected"]], opts=Media._meta)
        labels = [label for _value, label in choices]
        self.assertFalse(any("%(" in label for label in labels))
        self.assertTrue(any(label.startswith("Delete selected ") for label in labels))

    def test_delete_selected_avoids_django_locale_reorder(self):
        from django.utils.translation import gettext_lazy as _

        actions = {
            "delete_selected": (None, "delete_selected", _("Delete selected %(verbose_name_plural)s")),
        }
        choices = build_grouped_action_choices(
            actions,
            [["delete_selected"]],
            opts=Media._meta,
            language_code="el",
        )
        labels = [label for _value, label in choices if _value == "delete_selected"]
        self.assertEqual(len(labels), 1)
        self.assertFalse(labels[0].startswith(f"{Media._meta.verbose_name_plural}:"))
        self.assertIn("Διαγραφή επιλεγμένων", labels[0])
        self.assertIn("αρχεία", labels[0])

    def test_actions_placeholder_is_translated(self):
        from files.frontend_translations import translate_string

        actions = {
            "delete_selected": (None, "delete_selected", "Delete selected %(verbose_name_plural)s"),
        }
        choices = build_grouped_action_choices(actions, [["delete_selected"]], opts=Media._meta, language_code="el")
        self.assertEqual(choices[0], ("", translate_string("el", "Actions")))
