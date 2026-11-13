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

from files.admin_helpers import (
    MEDIA_ACTION_ICONS,
    MEDIA_ENCODING_STATUS_ICONS,
    MEDIA_PERMISSION_ICONS,
    MEDIA_PERMISSION_SOURCE_ICONS,
    MEDIA_STATE_STATUS_ICONS,
    MEDIA_TYPE_STATUS_ICONS,
    TRIM_ACTION_ICONS,
    TRIM_STATUS_ICONS,
    TRIM_STYLE_ICONS,
)
from files.frontend_translations import translate_string
from files.templatetags.custom_filters import CHANGELIST_COLUMN_ICONS

register = template.Library()

# Filter field name -> changelist column whose header icon should label that filter.
_FILTER_ICON_ALIAS = {
    "media_type": "display_media_type",
    "state": "display_state",
    "encoding_status": "display_encoding_status",
    "status": "display_status",
    "listable": "display_listable",
    "reported": "display_reported_times",
    "video_action": "display_video_action",
    "media_trim_style": "display_media_trim_style",
    "permission": "display_permission",
    "source": "display_source",
    "chunk": "display_chunk",
    "translate_to_english": "display_translate_to_english",
}
_FILTER_FIELD_ICONS = {
    "user": "fas fa-user",
    "owner_user": "fas fa-user-tie",
    "channel": "fas fa-bullhorn",
    "category": "fas fa-folder",
    "tags": "fas fa-tag",
    "tag": "fas fa-tag",
    "media": "fas fa-photo-video",
    "playlist": "fas fa-list",
    "license": "fas fa-certificate",
    "language": "fas fa-language",
    "profile": "fas fa-sliders-h",
    "add_date": "fas fa-calendar-alt",
    "action_date": "fas fa-calendar-alt",
    "joined": "fas fa-calendar-check",
    "encoding_queue": "fas fa-cogs",
    "integrity": "fas fa-exclamation-triangle",
    "missing_metadata": "fas fa-exclamation-circle",
    "action": "fas fa-bolt",
    "role": "fas fa-user-tag",
    "activity": "fas fa-chart-line",
    "extension": "fas fa-file-code",
    "codec": "fas fa-film",
    "resolution": "fas fa-expand",
    "active": "fas fa-check-circle",
}
_CHOICE_ICON_OVERRIDES = {
    ("encoding_queue", "yes"): "fas fa-clock",
    ("encoding_queue", "fail"): "fas fa-times-circle",
    ("reported", "yes"): "fas fa-flag",
    ("reported", "threshold"): "fas fa-exclamation-triangle",
    ("reported", "clean"): "fas fa-check",
    ("missing_metadata", "1"): "fas fa-exclamation-circle",
}
# Choice value -> icon, used when the filter field does not override it.
_VALUE_ICONS = {}
for _icon_map in (
    MEDIA_TYPE_STATUS_ICONS,
    MEDIA_STATE_STATUS_ICONS,
    MEDIA_ENCODING_STATUS_ICONS,
    TRIM_STATUS_ICONS,
    TRIM_ACTION_ICONS,
    TRIM_STYLE_ICONS,
    MEDIA_PERMISSION_ICONS,
    MEDIA_PERMISSION_SOURCE_ICONS,
    MEDIA_ACTION_ICONS,
):
    for _value, (_icon, _modifier) in _icon_map.items():
        _VALUE_ICONS.setdefault(_value, _icon)

# Changelist columns whose cells are icon-only status values.
_COLUMN_STATUS_FIELD = {
    "display_media_type": ("media_type", (MEDIA_TYPE_STATUS_ICONS,)),
    "display_state": ("state", (MEDIA_STATE_STATUS_ICONS,)),
    "display_encoding_status": ("encoding_status", (MEDIA_ENCODING_STATUS_ICONS,)),
    "display_status": ("status", (MEDIA_ENCODING_STATUS_ICONS, TRIM_STATUS_ICONS)),
    "display_action": ("action", (MEDIA_ACTION_ICONS,)),
    "display_video_action": ("video_action", (TRIM_ACTION_ICONS,)),
    "display_media_trim_style": ("media_trim_style", (TRIM_STYLE_ICONS,)),
    "display_permission": ("permission", (MEDIA_PERMISSION_ICONS,)),
    "display_source": ("source", (MEDIA_PERMISSION_SOURCE_ICONS,)),
}
_COLUMN_YES_NO = {
    "display_listable": (("fas fa-eye", "Yes"), ("fas fa-eye-slash", "No")),
    "display_primary": (("fas fa-star", "Yes"), ("fas fa-minus", "No")),
    "display_verified": (("fas fa-check-circle", "Yes"), ("fas fa-times-circle", "No")),
    "display_chunk": (("fas fa-th-large", "Yes"), ("fas fa-file", "No")),
    "has_file": (("fas fa-file", "Yes"), ("fas fa-ban", "No")),
    "display_translate_to_english": (("fas fa-language", "Yes"), ("fas fa-minus", "No")),
}

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


def field_icon(field_name, widget):
    """Icon shown with a filter's label. Every filter has one."""
    column = _FILTER_ICON_ALIAS.get(field_name, field_name)
    icon = CHANGELIST_COLUMN_ICONS.get(f"column-{column}") or _FILTER_FIELD_ICONS.get(field_name)
    if icon:
        return icon
    if widget == "date":
        return "fas fa-calendar-alt"
    return "fas fa-filter"


def choice_icon(field_name, params, widget):
    """Icon shown beside one filter choice. Boolean and known statuses use their own glyph."""
    value = ""
    if params:
        value = str(next(iter(params.values())))
    override = _CHOICE_ICON_OVERRIDES.get((field_name, value))
    if override:
        return override
    if widget == "boolean":
        if value in ("1", "True", "true"):
            return "fas fa-check"
        if value in ("0", "False", "false"):
            return "fas fa-times"
    return _VALUE_ICONS.get(value) or field_icon(field_name, widget)


def _column_label(model_admin, name):
    attr = getattr(model_admin, name, None)
    description = getattr(attr, "short_description", None)
    if description:
        return str(description)
    try:
        return str(model_admin.model._meta.get_field(name).verbose_name)
    except FieldDoesNotExist:
        return str(name).replace("_", " ")


def _status_rows(model, field_name, icon_maps):
    try:
        field = model._meta.get_field(field_name)
    except FieldDoesNotExist:
        return []
    labels = dict(getattr(field, "flatchoices", ()) or ())
    icons = {}
    for icon_map in icon_maps:
        for key, (icon, _modifier) in icon_map.items():
            icons.setdefault(key, icon)
    return [(icons[key], str(label)) for key, label in labels.items() if key in icons and label not in (None, "")]


def changelist_legend(cl):
    """Icon plus text for the glyphs on this changelist. Header icons, then cell values."""
    items = []
    seen = set()

    def add(icon, label):
        key = (icon, str(label))
        if not icon or not label or key in seen:
            return
        seen.add(key)
        items.append({"icon": icon, "label": str(label)})

    model = cl.model
    model_admin = cl.model_admin
    for name in cl.list_display:
        if name == "open_on_site" or name == "display_text":
            add("fas fa-eye", "Open on site")
            if name == "open_on_site":
                continue
        if name == "display_id":
            add("fas fa-search", "Inspect")
        header_icon = CHANGELIST_COLUMN_ICONS.get(f"column-{name}")
        if header_icon:
            add(header_icon, capfirst(_column_label(model_admin, name)))
        status = _COLUMN_STATUS_FIELD.get(name)
        if status:
            field_name, icon_maps = status
            for icon, label in _status_rows(model, field_name, icon_maps):
                add(icon, label)
        for icon, label in _COLUMN_YES_NO.get(name, ()):
            add(icon, label)
    # Filters use the same glyphs. Long selects keep the field icon only,
    # so a user or category list does not turn into one legend row per object.
    for spec in getattr(cl, "filter_specs", ()) or ():
        widget = classify_filter(spec)
        field_name = filter_id(spec)
        add(field_icon(field_name, widget), capfirst(str(spec.title)))
        if widget not in ("boolean", "segmented", "checkbox"):
            continue
        for choice in prepared_filter_choices(spec, cl):
            if choice["params"]:
                add(choice_icon(field_name, choice["params"], widget), choice["display"])
            else:
                add("fas fa-ellipsis-h", "Any")
    return items


def active_filter_chips(cl):
    chips = []
    for spec in cl.filter_specs:
        widget = classify_filter(spec)
        field_name = filter_id(spec)
        for choice in prepared_filter_choices(spec, cl):
            if choice["selected"] and choice["params"]:
                chips.append(
                    {
                        "title": spec.title,
                        "value": choice["display"],
                        "icon": choice_icon(field_name, choice["params"], widget),
                    }
                )
    return chips


@register.simple_tag
def changelist_active_filters(cl):
    return active_filter_chips(cl)


@register.simple_tag
def changelist_clear_filters_query(cl):
    return clear_filters_query(cl)


@register.simple_tag
def changelist_icon_legend(cl):
    return changelist_legend(cl)


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
    widget = classify_filter(spec)
    field_name = filter_id(spec)
    for choice in real:
        choice["icon"] = choice_icon(field_name, choice["params"], widget)
    return {
        "title": spec.title,
        "field_name": field_name,
        "field_icon": field_icon(field_name, widget),
        "widget": widget,
        "choices": real,
        "unset_display": unset["display"] if unset else "",
        "unset_selected": not active,
        "active": active,
    }
