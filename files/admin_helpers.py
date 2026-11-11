from urllib.parse import urlencode

from django.contrib import admin
from django.forms.models import _get_foreign_key
from django.urls import reverse
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from django.utils.translation import get_language

from files.frontend_translations import translate_string

RELATED_INLINE_LIMIT = 20


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


def join_links(links, empty="—"):
    parts = [str(link) for link in links if link]
    if not parts:
        return empty
    return mark_safe(", ".join(parts))


class ReadOnlyTabularInline(admin.TabularInline):
    """Read-only related-object inline, capped for change-form performance.

    Shows at most ``related_list_limit`` rows (default 20). When more exist, an
    overflow note links to the filtered changelist for the full set.
    """

    extra = 0
    max_num = 0
    can_delete = False
    show_change_link = True
    related_list_limit = RELATED_INLINE_LIMIT
    template = "admin/edit_inline/related_readonly_tabular.html"
    # Optional overrides when the changelist target is not ``self.model``
    # (e.g. M2M through rows that should open the Media list).
    related_changelist_model = None
    related_changelist_filters = None  # str | dict | callable(parent) -> dict

    def has_add_permission(self, request, obj=None):
        return False

    def get_related_changelist_model(self):
        return self.related_changelist_model or self.model

    def get_related_changelist_filters(self, parent):
        custom = self.related_changelist_filters
        if callable(custom):
            return custom(parent)
        if isinstance(custom, dict):
            return {key: (parent.pk if value == "{pk}" else value) for key, value in custom.items()}
        if isinstance(custom, str):
            return {custom: parent.pk}
        fk = _get_foreign_key(self.parent_model, self.model, fk_name=self.fk_name)
        return {f"{fk.name}__id__exact": parent.pk}

    def get_related_overflow_note(self, parent, total, limit):
        model = self.get_related_changelist_model()
        filters = self.get_related_changelist_filters(parent)
        label = self.verbose_name_plural or model._meta.verbose_name_plural
        return format_html(
            "Showing {} of {} related {}. " '<a href="{}">View the full filtered list</a> instead.',
            limit,
            total,
            label,
            admin_changelist_url(model, **filters),
        )

    def get_formset(self, request, obj=None, **kwargs):
        FormSet = super().get_formset(request, obj, **kwargs)
        inline = self
        limit = self.related_list_limit

        class LimitedRelatedFormSet(FormSet):
            related_truncated = False
            related_total = 0
            related_limit = limit
            related_overflow_note = ""

            def __init__(self, data=None, files=None, instance=None, save_as_new=False, prefix=None, queryset=None, **kw):
                if instance is not None and getattr(instance, "pk", None) and queryset is not None:
                    related_qs = queryset.filter(**{self.fk.name: instance.pk})
                    if inline.ordering:
                        related_qs = related_qs.order_by(*inline.ordering)
                    total = related_qs.count()
                    self.related_total = total
                    self.related_limit = limit
                    if total > limit:
                        pks = list(related_qs.values_list("pk", flat=True)[:limit])
                        queryset = queryset.filter(pk__in=pks)
                        if inline.ordering:
                            queryset = queryset.order_by(*inline.ordering)
                        self.related_truncated = True
                        self.related_overflow_note = inline.get_related_overflow_note(instance, total, limit)
                super().__init__(data, files, instance, save_as_new, prefix, queryset, **kw)

        return LimitedRelatedFormSet
