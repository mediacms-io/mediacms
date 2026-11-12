import json
import urllib.parse

from django import template
from django.contrib.admin.filters import (
    AllValuesFieldListFilter,
    DateFieldListFilter,
    RelatedFieldListFilter,
    SimpleListFilter,
)
from django.contrib.admin.views.main import PAGE_VAR
from django.core.exceptions import FieldDoesNotExist
from django.utils.encoding import force_str
from django.utils.text import capfirst

from files.frontend_translations import translate_string

register = template.Library()

# Choice lists longer than this stay a labeled select. Shorter ones are segmented.
SEGMENT_MAX = 5
# These stay unqualified when only one relation uses them ("username", not "user username").
_BARE_RELATION_FIELDS = {"username", "email"}


def filter_id(spec):
    return getattr(spec, "field_path", getattr(spec, "parameter_name", str(spec.title)))


def expected_parameter_names(spec):
    expected = getattr(spec, "expected_parameters", None)
    if callable(expected):
        return set(expected())
    return set()


def classify_filter(spec):
    """Pick a changelist widget. Query parameter names are unchanged."""
    if isinstance(spec, DateFieldListFilter):
        return "date"
    field = getattr(spec, "field", None)
    if field is not None and field.get_internal_type() == "BooleanField":
        return "boolean"
    if isinstance(spec, (RelatedFieldListFilter, AllValuesFieldListFilter)):
        return "select"
    count = _option_count(spec)
    if count <= 1:
        return "checkbox"
    if count <= SEGMENT_MAX:
        return "segmented"
    return "select"


def _option_count(spec):
    if isinstance(spec, SimpleListFilter):
        return len(spec.lookup_choices)
    field = getattr(spec, "field", None)
    if field is not None and field.choices:
        return sum(1 for value, _label in field.flatchoices if value is not None)
    return SEGMENT_MAX + 1


def prepared_filter_choices(spec, changelist):
    """Choices plus only this filter's query params, so empty means 'Any'."""
    expected = expected_parameter_names(spec)
    prepared = []
    for choice in spec.choices(changelist):
        params = _choice_params(choice.get("query_string") or "", expected)
        prepared.append(
            {
                "selected": bool(choice.get("selected")),
                "display": choice.get("display"),
                "params": params,
                "params_json": json.dumps(params),
            }
        )
    return prepared


def _choice_params(query_string, expected):
    params = {}
    query = query_string[1:] if query_string.startswith("?") else query_string
    for key, value in urllib.parse.parse_qsl(query, keep_blank_values=False):
        if key in expected and value != "":
            params[key] = value
    return params


def clear_filters_query(cl):
    """Drop list-filter params and the page number. Keep search and other params."""
    remove = {PAGE_VAR}
    for spec in cl.filter_specs:
        remove.update(expected_parameter_names(spec))
        remove.update(getattr(spec, "used_parameters", {}))
    kept = []
    for key, value in cl.params.items():
        if key in remove:
            continue
        if isinstance(value, (list, tuple)):
            for item in value:
                if item not in (None, ""):
                    kept.append((key, item))
        elif value not in (None, ""):
            kept.append((key, value))
    return urllib.parse.urlencode(kept)


def active_filter_chips(cl):
    chips = []
    for spec in cl.filter_specs:
        for choice in prepared_filter_choices(spec, cl):
            if choice["selected"] and choice["params"]:
                chips.append({"title": spec.title, "value": choice["display"]})
    return chips


@register.simple_tag
def changelist_active_filters(cl):
    return active_filter_chips(cl)


@register.simple_tag
def changelist_clear_filters_query(cl):
    return clear_filters_query(cl)


def search_hint(model, search_fields, language_code="en"):
    """Placeholder listing the fields this changelist search actually queries."""
    resolved = [_resolve_search_lookup(model, lookup) for lookup in search_fields or []]
    resolved = [item for item in resolved if item[1]]
    leaf_counts = {}
    for _relation, leaf_name, _leaf_label in resolved:
        leaf_counts[leaf_name] = leaf_counts.get(leaf_name, 0) + 1

    labels = []
    seen = set()
    for relation, leaf_name, leaf_label in resolved:
        if relation and (leaf_name not in _BARE_RELATION_FIELDS or leaf_counts[leaf_name] > 1):
            label = f"{relation} {leaf_label}"
        else:
            label = leaf_label
        label = capfirst(label)
        key = label.casefold()
        if key in seen:
            continue
        seen.add(key)
        labels.append(label)
    return _join_hint_labels(labels, language_code)


def _resolve_search_lookup(model, lookup):
    """Return (relation label or '', field name, field label) for one search lookup."""
    path = str(lookup).lstrip("^=@")
    parts = [part for part in path.split("__") if part]
    if not parts:
        return "", "", ""
    current = model
    relation = ""
    field = None
    for index, part in enumerate(parts):
        try:
            field = current._meta.get_field(part)
        except FieldDoesNotExist:
            return relation, parts[-1], parts[-1].replace("_", " ")
        if index < len(parts) - 1 and getattr(field, "related_model", None):
            relation = force_str(field.verbose_name)
            current = field.related_model
            field = None
            continue
        if index < len(parts) - 1:
            return relation, parts[-1], parts[-1].replace("_", " ")
    if field is None:
        return relation, parts[-1], parts[-1].replace("_", " ")
    return relation, field.name, force_str(field.verbose_name)


def _join_hint_labels(labels, language_code):
    if not labels:
        return ""
    if len(labels) == 1:
        return labels[0]
    or_word = translate_string(language_code, "or") or "or"
    if len(labels) == 2:
        return f"{labels[0]} {or_word} {labels[1]}"
    return ", ".join(labels[:-1]) + f", {or_word} {labels[-1]}"


@register.simple_tag
def changelist_search_hint(cl, language_code="en"):
    return search_hint(cl.model, getattr(cl, "search_fields", ()), language_code)


@register.inclusion_tag("admin/filter.html")
def changelist_filter(cl, spec):
    choices = prepared_filter_choices(spec, cl)
    real = [choice for choice in choices if choice["params"]]
    unset = next((choice for choice in choices if not choice["params"]), None)
    active = any(choice["selected"] for choice in real)
    return {
        "title": spec.title,
        "field_name": filter_id(spec),
        "widget": classify_filter(spec),
        "choices": real,
        "unset_display": unset["display"] if unset else "",
        "unset_selected": not active,
        "active": active,
    }
