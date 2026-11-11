"""Shared admin Actions dropdown choices: placeholder + hyphen-separated groups."""

from django import forms
from django.contrib.admin import ModelAdmin
from django.contrib.admin.helpers import ActionForm
from django.contrib.admin.utils import model_format_dict

from files.frontend_translations import translate_string

ACTIONS_PLACEHOLDER = ("", "Actions")
SEPARATOR_PREFIX = "__sep__"
SEPARATOR_LABEL = "---------"


def is_separator_choice(value):
    return str(value).startswith(SEPARATOR_PREFIX)


def format_action_description(description, opts=None):
    """Apply Django admin model placeholders (e.g. %(verbose_name_plural)s)."""
    text = str(description)
    if opts is None:
        return text
    try:
        return text % model_format_dict(opts)
    except (TypeError, ValueError, KeyError):
        return text


def delete_selected_label(opts, language_code=None):
    """Natural-order label for delete_selected (avoids Django locale reorder)."""
    plural = str(opts.verbose_name_plural)
    if language_code:
        return f"{translate_string(language_code, 'Delete selected')} {translate_string(language_code, plural)}"
    return f"Delete selected {plural}"


def resolve_action_label(name, description, opts=None, language_code=None):
    """Format and translate one action label.

    Django's gettext for delete_selected reorders to ``%(name)s: …`` in Greek and
    similar locales. Rebuild that action in natural order via frontend_translations.
    Custom descriptions without placeholders (e.g. MediaAdmin) translate as a whole key.
    """
    if name == "delete_selected" and opts is not None:
        text = str(description)
        plural = str(opts.verbose_name_plural)
        if "%(verbose_name_plural)s" in text or "%(verbose_name)s" in text:
            return delete_selected_label(opts, language_code)
        formatted = format_action_description(description, opts)
        if formatted.startswith(f"{plural}:"):
            return delete_selected_label(opts, language_code)
        if language_code:
            return translate_string(language_code, formatted)
        return formatted

    formatted = format_action_description(description, opts)
    if language_code is None or formatted == SEPARATOR_LABEL:
        return formatted
    return translate_string(language_code, formatted)


def _translate_choice_label(label, language_code=None):
    """Translate action labels; leave separator rows as-is."""
    if language_code is None or label == SEPARATOR_LABEL:
        return label
    return translate_string(language_code, label)


class SeparatorAwareSelect(forms.Select):
    """Mark hyphen separator rows as disabled so they cannot be submitted."""

    def create_option(self, name, value, label, selected, index, subindex=None, attrs=None):
        option = super().create_option(name, value, label, selected, index, subindex=subindex, attrs=attrs)
        if is_separator_choice(value):
            option["attrs"]["disabled"] = True
        return option


class GroupedActionForm(ActionForm):
    action = forms.ChoiceField(label="", widget=SeparatorAwareSelect)


def build_grouped_action_choices(actions_dict, group_order=None, exclude=None, opts=None, language_code=None):
    """
    Build select choices for bulk/object Actions.

    actions_dict: name -> (func, name, description) from ModelAdmin.get_actions()
    group_order: sequence of groups; each group is a sequence of action names
    exclude: action names to omit (e.g. delete_selected on object forms)
    opts: model _meta for formatting Django description placeholders
    language_code: optional LANGUAGE_CODE for frontend_translations

    Returns list of (value, label) tuples. Separator values use SEPARATOR_PREFIX
    and are marked disabled by SeparatorAwareSelect / object-actions template.
    """
    exclude = frozenset(exclude or ())
    placeholder_label = ACTIONS_PLACEHOLDER[1]
    if language_code:
        placeholder_label = translate_string(language_code, placeholder_label)
    choices = [(ACTIONS_PLACEHOLDER[0], placeholder_label)]
    used = set()
    groups_added = 0

    for group in group_order or ():
        group_choices = []
        for name in group:
            if name in exclude or name not in actions_dict:
                continue
            _func, _name, description = actions_dict[name]
            group_choices.append((name, resolve_action_label(name, description, opts, language_code)))
            used.add(name)
        if not group_choices:
            continue
        if groups_added:
            choices.append((f"{SEPARATOR_PREFIX}{groups_added}", SEPARATOR_LABEL))
        choices.extend(group_choices)
        groups_added += 1

    leftovers = []
    for name, (_func, _name, description) in actions_dict.items():
        if name in used or name in exclude:
            continue
        leftovers.append((name, resolve_action_label(name, description, opts, language_code)))
    if leftovers:
        if groups_added:
            choices.append((f"{SEPARATOR_PREFIX}{groups_added}", SEPARATOR_LABEL))
        choices.extend(leftovers)

    return choices


def object_action_select_choices(actions_dict, group_order=None, exclude=None, opts=None, language_code=None):
    """Return (value, label, disabled) triples for the object-actions template."""
    choices = []
    for value, label in build_grouped_action_choices(actions_dict, group_order, exclude, opts=opts, language_code=language_code):
        choices.append((value, label, is_separator_choice(value)))
    return choices


def patch_model_admin_action_choices():
    """Use GroupedActionForm + Actions placeholder for every ModelAdmin changelist."""
    if getattr(ModelAdmin, "_mediacms_action_choices_patched", False):
        return

    ModelAdmin.action_form = GroupedActionForm

    def get_action_choices(self, request, default_choices=None):
        return build_grouped_action_choices(
            self.get_actions(request),
            getattr(self, "action_groups", None),
            opts=self.opts,
            language_code=getattr(request, "LANGUAGE_CODE", None),
        )

    ModelAdmin.get_action_choices = get_action_choices
    ModelAdmin._mediacms_action_choices_patched = True
