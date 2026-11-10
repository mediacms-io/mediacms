"""Shared admin Actions dropdown choices: placeholder + hyphen-separated groups."""

from django import forms
from django.contrib.admin.helpers import ActionForm
from django.contrib.admin.utils import model_format_dict

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


class SeparatorAwareSelect(forms.Select):
    """Mark hyphen separator rows as disabled so they cannot be submitted."""

    def create_option(self, name, value, label, selected, index, subindex=None, attrs=None):
        option = super().create_option(name, value, label, selected, index, subindex=subindex, attrs=attrs)
        if is_separator_choice(value):
            option["attrs"]["disabled"] = True
        return option


class GroupedActionForm(ActionForm):
    action = forms.ChoiceField(label="", widget=SeparatorAwareSelect)


def build_grouped_action_choices(actions_dict, group_order=None, exclude=None, opts=None):
    """
    Build select choices for bulk/object Actions.

    actions_dict: name -> (func, name, description) from ModelAdmin.get_actions()
    group_order: sequence of groups; each group is a sequence of action names
    exclude: action names to omit (e.g. delete_selected on object forms)
    opts: model _meta for formatting Django description placeholders

    Returns list of (value, label) tuples. Separator values use SEPARATOR_PREFIX
    and are marked disabled by SeparatorAwareSelect / object-actions template.
    """
    exclude = frozenset(exclude or ())
    choices = [ACTIONS_PLACEHOLDER]
    used = set()
    groups_added = 0

    for group in group_order or ():
        group_choices = []
        for name in group:
            if name in exclude or name not in actions_dict:
                continue
            _func, _name, description = actions_dict[name]
            group_choices.append((name, format_action_description(description, opts)))
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
        leftovers.append((name, format_action_description(description, opts)))
    if leftovers:
        if groups_added:
            choices.append((f"{SEPARATOR_PREFIX}{groups_added}", SEPARATOR_LABEL))
        choices.extend(leftovers)

    return choices


def object_action_select_choices(actions_dict, group_order=None, exclude=None, opts=None):
    """Return (value, label, disabled) triples for the object-actions template."""
    choices = []
    for value, label in build_grouped_action_choices(actions_dict, group_order, exclude, opts=opts):
        choices.append((value, label, is_separator_choice(value)))
    return choices
