from urllib.parse import urlencode

from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html
from django.utils.safestring import mark_safe


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


def join_links(links, empty="—"):
    parts = [str(link) for link in links if link]
    if not parts:
        return empty
    return mark_safe(", ".join(parts))


class ReadOnlyTabularInline(admin.TabularInline):
    extra = 0
    max_num = 0
    can_delete = False
    show_change_link = True

    def has_add_permission(self, request, obj=None):
        return False
