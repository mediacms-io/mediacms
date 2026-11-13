from urllib.parse import urlencode

from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from django.utils.translation import get_language

from files.frontend_translations import translate_string


def admin_text(lang, english, **format_kwargs):
    """Translate an English admin UI string, optionally formatting placeholders."""
    if lang is not None and not isinstance(lang, str):
        lang = getattr(lang, "LANGUAGE_CODE", None)
    language = lang or get_language() or "en"
    text = translate_string(language, english)
    if format_kwargs:
        try:
            return text.format(**format_kwargs)
        except (KeyError, ValueError, IndexError):
            return text
    return text


class TranslateManyToManyHelpMixin:
    """Use translated model help_text for M2M fields; drop Django's Control hint.

    Django admin appends a gettext "Hold down Control/Command..." suffix. With
    Jazzmin Select2 that hint is obsolete, and the combined string breaks
    ``custom_translate`` (English model help + already-localized suffix).
    """

    def formfield_for_manytomany(self, db_field, request, **kwargs):
        form_field = super().formfield_for_manytomany(db_field, request, **kwargs)
        if form_field is None:
            return None
        if db_field.help_text:
            form_field.help_text = admin_text(getattr(request, "LANGUAGE_CODE", None), str(db_field.help_text))
        else:
            form_field.help_text = ""
        return form_field


class TranslateChoiceLabelsMixin:
    """Translate CharField/IntegerField choice labels for admin select widgets."""

    def formfield_for_choice_field(self, db_field, request, **kwargs):
        form_field = super().formfield_for_choice_field(db_field, request, **kwargs)
        if form_field is None:
            return None
        choices = getattr(form_field, "choices", None)
        if choices is None:
            return form_field
        lang = getattr(request, "LANGUAGE_CODE", None)
        form_field.choices = [(value, admin_text(lang, str(label)) if label else label) for value, label in choices]
        return form_field


def translated_choice_display(obj, field_name):
    """Return a choice field's display label through frontend_translations."""
    display = getattr(obj, f"get_{field_name}_display")()
    return translate_string(get_language() or "en", display)


def admin_changelist_url(model, **query):
    opts = model._meta
    url = reverse(f"admin:{opts.app_label}_{opts.model_name}_changelist")
    if query:
        return f"{url}?{urlencode(query)}"
    return url


def admin_changelist_link(model, text, **query):
    return format_html('<a href="{}">{}</a>', admin_changelist_url(model, **query), text)


def admin_change_url(obj, fragment=None):
    if obj is None or obj.pk is None:
        return ""
    opts = obj._meta
    url = reverse(f"admin:{opts.app_label}_{opts.model_name}_change", args=[obj.pk])
    if fragment:
        return f"{url}#{fragment.lstrip('#')}"
    return url


def admin_change_link(obj, text=None, fragment=None):
    if obj is None or obj.pk is None:
        return "—"
    label = text if text is not None else str(obj)
    return format_html('<a href="{}">{}</a>', admin_change_url(obj, fragment=fragment), label)


def admin_inspect_id(pk):
    """Numeric id with a search icon so the changelist row link is obvious."""
    return format_html(
        '<span class="changelist-id-link"><i class="fas fa-search" aria-hidden="true"></i><span class="changelist-id-link__value">{}</span><span class="sr-only"> {}</span></span>',
        pk,
        admin_text(None, "Details"),
    )


def join_links(links, empty="—"):
    parts = [str(link) for link in links if link]
    if not parts:
        return empty
    return mark_safe(", ".join(parts))


# Visible length of long comment, report, and extra-info cells. The full text stays in the hover tooltip.
ADMIN_CLIPPED_TEXT_LENGTH = 80

# Font Awesome classes + CSS modifier for Media changelist status cells.
MEDIA_TYPE_STATUS_ICONS = {
    "video": ("fas fa-video", "video"),
    "image": ("fas fa-image", "image"),
    "pdf": ("fas fa-file-pdf", "pdf"),
    "audio": ("fas fa-music", "audio"),
}
MEDIA_STATE_STATUS_ICONS = {
    "public": ("fas fa-globe", "public"),
    "private": ("fas fa-lock", "private"),
    "unlisted": ("fas fa-link", "unlisted"),
}
MEDIA_ENCODING_STATUS_ICONS = {
    "pending": ("fas fa-clock", "pending"),
    "running": ("fas fa-spinner", "running"),
    "success": ("fas fa-check-circle", "success"),
    "fail": ("fas fa-times-circle", "fail"),
}
TRIM_STATUS_ICONS = {
    "initial": ("fas fa-hourglass-start", "pending"),
    "running": ("fas fa-spinner", "running"),
    "success": ("fas fa-check-circle", "success"),
    "fail": ("fas fa-times-circle", "fail"),
}
TRIM_ACTION_ICONS = {
    "replace": ("fas fa-exchange-alt", "running"),
    "save_new": ("fas fa-copy", "video"),
    "create_segments": ("fas fa-cut", "pending"),
}
TRIM_STYLE_ICONS = {
    "no_encoding": ("fas fa-bolt", "success"),
    "precise": ("fas fa-crosshairs", "running"),
}
MEDIA_PERMISSION_ICONS = {
    "viewer": ("fas fa-eye", "private"),
    "editor": ("fas fa-pen", "video"),
    "owner": ("fas fa-crown", "primary"),
}
MEDIA_PERMISSION_SOURCE_ICONS = {
    "explicit": ("fas fa-user-check", "success"),
    "lti_embed": ("fas fa-graduation-cap", "unlisted"),
}
MEDIA_ACTION_ICONS = {
    "like": ("fas fa-thumbs-up", "success"),
    "dislike": ("fas fa-thumbs-down", "fail"),
    "watch": ("fas fa-play", "video"),
    "report": ("fas fa-flag", "warning"),
    "rate": ("fas fa-star", "primary"),
    "report_cleared": ("fas fa-broom", "success"),
    "report_confirmed": ("fas fa-user-shield", "fail"),
    "media_reviewed": ("fas fa-check-circle", "success"),
    "media_unreviewed": ("fas fa-eye-slash", "not-listable"),
    "original_deleted": ("fas fa-trash-alt", "fail"),
    "metadata_refresh": ("fas fa-sync-alt", "running"),
    "integrity_warning": ("fas fa-exclamation-triangle", "warning"),
}


def admin_open_on_site_link(url):
    """Eye icon that opens a public page in a new tab."""
    if not url:
        return "—"
    label = admin_text(None, "Open on site")
    return format_html(
        '<a href="{}" class="open-on-site" target="_blank" rel="noopener noreferrer" title="{}" aria-label="{}">' '<i class="fas fa-eye fa-sm" aria-hidden="true"></i>' "</a>",
        url,
        label,
        label,
    )


class OpenOnSiteMixin:
    """Append a non-sortable eye column. Subclasses that override get_list_display call ``_append_open_on_site``."""

    open_on_site_uses_media = False

    def _append_open_on_site(self, display):
        columns = list(display)
        if "open_on_site" not in columns:
            columns.append("open_on_site")
        return columns

    def get_list_display(self, request):
        return self._append_open_on_site(super().get_list_display(request))

    def get_open_on_site_url(self, obj):
        if self.open_on_site_uses_media:
            media = getattr(obj, "media", None)
            if media is not None and getattr(media, "pk", None):
                return media.get_absolute_url()
            return ""
        getter = getattr(obj, "get_absolute_url", None)
        if not callable(getter):
            return ""
        return getter()

    @admin.display(description="")
    def open_on_site(self, obj):
        return admin_open_on_site_link(self.get_open_on_site_url(obj))


def admin_status_icon(icon_class, label, *, modifier=None, text=None):
    """Icon cell with hover/ARIA label. Optional visible ``text`` (e.g. a count).

    On changelists the label text is screen-reader-only; change forms show it
    beside the icon. Pass ``text`` for a value that should stay visible in lists.
    """
    classes = ["changelist-status-icon"]
    if modifier:
        classes.append(f"changelist-status-icon--{modifier}")
    if text is not None:
        classes.append("changelist-status-icon--with-count")
        visible = text
    else:
        visible = label
    return format_html(
        '<span class="{}" title="{}" aria-label="{}">' '<i class="{}" aria-hidden="true"></i>' '<span class="changelist-status-icon__text">{}</span>' "</span>",
        " ".join(classes),
        label,
        label,
        icon_class,
        visible,
    )


def clipped_admin_text(value, limit=ADMIN_CLIPPED_TEXT_LENGTH, *, always_tooltip=False):
    """One-line preview of admin text. Longer values keep the full text in a hover tooltip.

    When ``always_tooltip`` is true, the hover wrapper is emitted even for short
    values so CSS-ellipsis cells still expose the full text on hover.
    """
    full = "" if value is None else str(value).strip()
    if not full:
        return "—"
    preview = " ".join(full.split())
    if len(preview) <= limit and not always_tooltip:
        return preview
    clipped = preview if len(preview) <= limit else preview[: limit - 1].rstrip() + "…"
    return format_html(
        '<span class="changelist-clipped-text">' '<span class="changelist-clipped-text__preview">{}</span>' '<span class="changelist-clipped-text__full" role="tooltip">{}</span>' "</span>",
        clipped,
        full,
    )
