import re
from datetime import date, datetime
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from django import template
from django.utils import timezone
from django.utils.html import format_html
from django.utils.translation import get_language

from files.frontend_translations import translate_string

register = template.Library()

_WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
_WEEKDAY_SHORT = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
# Clock-style labels give way to calendar words after this many hours.
_HOUR_LIMIT = 6


def _local(value):
    if isinstance(value, datetime):
        moment = value
    elif isinstance(value, date):
        moment = datetime.combine(value, datetime.min.time())
    else:
        return None
    if timezone.is_naive(moment):
        moment = timezone.make_aware(moment, timezone.get_current_timezone())
    return timezone.localtime(moment)


def _phrase(language_code, text):
    return translate_string(language_code, text) or text


def _format_count(language_code, template, count):
    translated = _phrase(language_code, template)
    try:
        return translated.format(count=count)
    except (IndexError, KeyError, ValueError):
        return template.format(count=count)


def _count_labels(count, unit, short, language_code):
    """Full, medium, and short labels: '2 hours ago', '2h ago', '2h'."""
    suffix = unit if count == 1 else f"{unit}s"
    full = _format_count(language_code, f"{{count}} {suffix} ago", count)
    mid = _format_count(language_code, f"{{count}}{short} ago", count)
    compact = _format_count(language_code, f"{{count}}{short}", count)
    return full, mid, compact


def _widths(language_code, full, mid, short):
    return _phrase(language_code, full), _phrase(language_code, mid), _phrase(language_code, short)


def _calendar_months(start, end):
    months = (end.year - start.year) * 12 + (end.month - start.month)
    if end.day < start.day:
        months -= 1
    return months


def describe_relative_when(value, now=None, language_code=None):
    """Relative labels for a dashboard timestamp.

    Returns full, mid, and short text so a narrow column can show a shorter form.
    Under a minute is "recently". Minutes and hours use a count. Older times use
    today, yesterday, last weekday, weeks, months, or last year.
    """
    local_value = _local(value)
    if local_value is None:
        return None

    if language_code is None:
        language_code = get_language() or "en"
    local_now = _local(now or timezone.now())
    delta_seconds = (local_now - local_value).total_seconds()
    exact = local_value.strftime("%Y-%m-%d %H:%M")
    iso = local_value.isoformat()

    if delta_seconds < 60:
        full, mid, short = _widths(language_code, "recently", "recent", "now")
    elif delta_seconds < 3600:
        count = max(1, int(delta_seconds // 60))
        full, mid, short = _count_labels(count, "minute", "m", language_code)
    elif delta_seconds < _HOUR_LIMIT * 3600:
        count = max(1, int(delta_seconds // 3600))
        full, mid, short = _count_labels(count, "hour", "h", language_code)
    else:
        day_delta = (local_now.date() - local_value.date()).days
        if day_delta <= 0:
            full, mid, short = _widths(language_code, "today", "tod.", "tdy")
        elif day_delta == 1:
            full, mid, short = _widths(language_code, "yesterday", "yest.", "yday")
        elif day_delta < 7:
            weekday = local_value.weekday()
            name = _WEEKDAYS[weekday]
            abbr = _WEEKDAY_SHORT[weekday]
            full, mid, short = _widths(language_code, f"last {name}", f"last {abbr}", f"l{abbr}")
        elif day_delta < 30:
            count = max(1, day_delta // 7)
            full, mid, short = _count_labels(count, "week", "w", language_code)
        else:
            months = _calendar_months(local_value, local_now)
            if months < 1:
                months = 1
            if months < 12:
                full, mid, short = _count_labels(months, "month", "mo", language_code)
            elif months < 24:
                full, mid, short = _widths(language_code, "last year", "last yr", "1y")
            else:
                full, mid, short = _count_labels(months // 12, "year", "y", language_code)

    return {"full": full, "mid": mid, "short": short, "exact": exact, "iso": iso}


@register.filter
def relative_when(value):
    """Render a timestamp as relative text that shortens when the column is narrow."""
    parts = describe_relative_when(value)
    if not parts:
        return ""
    return format_html(
        '<time class="when-fit" datetime="{}" title="{}" aria-label="{}">' '<span class="when-full">{}</span>' '<span class="when-mid">{}</span>' '<span class="when-short">{}</span>' "</time>",
        parts["iso"],
        parts["exact"],
        parts["full"],
        parts["full"],
        parts["mid"],
        parts["short"],
    )


@register.filter
def custom_translate(string, lang_code):
    return translate_string(lang_code, string)


@register.simple_tag
def translate_link(language_code, sentence, link_text, url):
    """Translate a sentence that contains ``{link}`` and put the link text in the anchor."""
    from django.utils.html import format_html

    text = translate_string(language_code, sentence) or sentence
    label = translate_string(language_code, link_text) or link_text
    anchor = format_html('<a href="{}">{}</a>', url, label)
    try:
        return format_html(text, link=anchor) if "{link}" not in text else format_html(text.replace("{link}", "{}"), anchor)
    except (KeyError, ValueError, IndexError):
        return format_html("{} {}", text, anchor)


@register.filter
def header_column_class(class_attrib):
    """Return the class name from a changelist header ``class_attrib`` string."""
    match = re.search(r'class="([^"]+)"', str(class_attrib or ""))
    return match.group(1) if match else ""


# Columns sized for a status glyph. The header shows the same kind of icon,
# with the full column name kept in the tooltip.
CHANGELIST_COLUMN_ICONS = {
    "column-open_on_site": "fas fa-eye",
    "column-display_media_type": "fas fa-photo-video",
    "column-display_state": "fas fa-globe",
    "column-display_encoding_status": "fas fa-cogs",
    "column-display_listable": "fas fa-eye",
    "column-display_reported_times": "fas fa-flag",
    "column-display_duration": "fas fa-stopwatch",
    "column-is_reviewed": "fas fa-check-circle",
    "column-featured": "fas fa-star",
    "column-allow_download": "fas fa-download",
    "column-enable_comments": "fas fa-comments",
    "column-display_status": "fas fa-info-circle",
    "column-display_chunk": "fas fa-puzzle-piece",
    "column-has_file": "fas fa-file",
    "column-display_video_action": "fas fa-cut",
    "column-display_media_trim_style": "fas fa-crop-alt",
    "column-display_translate_to_english": "fas fa-language",
    "column-is_rbac_category": "fas fa-user-shield",
    "column-is_lms_course": "fas fa-graduation-cap",
    "column-is_active": "fas fa-user-check",
    "column-is_superuser": "fas fa-user-shield",
    "column-is_editor": "fas fa-user-edit",
    "column-is_manager": "fas fa-user-tie",
    "column-is_staff": "fas fa-user-cog",
    "column-is_approved": "fas fa-user-check",
    "column-display_permission": "fas fa-key",
    "column-display_source": "fas fa-sign-in-alt",
    "column-display_primary": "fas fa-star",
    "column-display_verified": "fas fa-check-circle",
}


@register.filter
def column_key_icon(column_key):
    """Header icon for an optional-column key, or an empty string."""
    return CHANGELIST_COLUMN_ICONS.get(f"column-{column_key}", "")


@register.filter
def changelist_column_icon(class_name):
    """Font Awesome classes for a narrow changelist column, or an empty string."""
    classes = set(str(class_name or "").split())
    for name, icon in CHANGELIST_COLUMN_ICONS.items():
        if name in classes:
            return icon
    return ""


@register.filter
def tag_columns(results):
    """Split a tag page so the first half fills the start column before the other.

    DOM order is first half, then second half. The admin page is ``dir="rtl"`` for
    bidirectional languages, so the start column is on the right there and on the
    left otherwise.
    """
    rows = list(results)
    if len(rows) < 2:
        return [rows] if rows else []
    midpoint = (len(rows) + 1) // 2
    return [rows[:midpoint], rows[midpoint:]]


@register.filter
def any_column_checked(columns):
    return any(column.get("checked") for column in columns or [])


@register.filter
def single_sort_url(url):
    """Keep only the primary ``o`` field so changelist header clicks replace prior sorts.

    Django's ``url_primary`` / ``url_toggle`` keep secondary orderings (``o=2.-1``), which
    leaves sort icons on previously selected columns. Header clicks should be single-field.
    """
    if not url:
        return url
    parts = urlsplit(str(url))
    query = []
    for key, value in parse_qsl(parts.query, keep_blank_values=True):
        if key == "o" and value:
            query.append((key, value.split(".", 1)[0]))
        else:
            query.append((key, value))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


@register.simple_tag
def admin_detail(check):
    """Translate a health-check detail template, then fill its placeholders."""
    from files.admin_helpers import admin_text

    if not isinstance(check, dict):
        return check or ""
    template = check.get("detail_template") or check.get("detail") or ""
    kwargs = check.get("detail_kwargs") or {}
    return admin_text(get_language(), template, **kwargs)
