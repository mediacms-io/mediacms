from django.contrib import admin, messages
from django.contrib.admin.views.main import ChangeList
from django.db.models import F, OrderBy, TextField, Value
from django.db.models.functions import NullIf
from django.http import HttpResponseRedirect
from django.utils.html import format_html

from admin_customizations.action_choices import (
    GroupedActionForm,
    build_grouped_action_choices,
)
from files.admin_helpers import (
    MEDIA_ACTION_ICONS,
    OpenOnSiteMixin,
    TranslateChoiceLabelsMixin,
    admin_change_link,
    admin_change_url,
    admin_status_icon,
    clipped_admin_text,
    translated_choice_display,
)
from files.frontend_translations import translate_string
from files.methods import clear_media_reports, is_mediacms_editor
from files.models import Media

from .models import MODERATION_MEDIA_ACTIONS, MediaAction

# Changelist sort key for Extra info: blank/NULL values sort last so page 1 shows real text.
_EXTRA_INFO_SORT = "_extra_info_sort"


class MediaActionChangeList(ChangeList):
    """Keep blank Extra info values last for both ASC and DESC sorts."""

    def get_ordering(self, request, queryset):
        ordering = []
        for field in super().get_ordering(request, queryset):
            if field == _EXTRA_INFO_SORT:
                ordering.append(OrderBy(F(_EXTRA_INFO_SORT), nulls_last=True))
            elif field == f"-{_EXTRA_INFO_SORT}":
                ordering.append(OrderBy(F(_EXTRA_INFO_SORT), descending=True, nulls_last=True))
            else:
                ordering.append(field)
        return ordering


# Keep in sync with files.admin.MEDIA_REPORT_TAB_ACTIONS (avoid importing files.admin here).
MEDIA_REPORT_TAB_ACTIONS = ("report",) + tuple(name for name, _label in MODERATION_MEDIA_ACTIONS)


@admin.register(MediaAction)
class MediaActionAdmin(OpenOnSiteMixin, TranslateChoiceLabelsMixin, admin.ModelAdmin):
    """Append-only audit of user/moderation actions. View and delete (or clear reports); never edit."""

    open_on_site_uses_media = True

    change_list_template = "admin/actions/mediaaction/change_list.html"
    # Full column set; get_list_display() hides optional ones unless opted-in.
    list_display = ["action_date", "display_action", "link_user", "link_media", "display_remote_ip", "display_extra_info"]
    list_display_links = ("display_action",)
    optional_list_columns = (
        ("display_remote_ip", "Remote IP", ()),
        ("display_extra_info", "Extra info", ()),
    )
    optional_columns_session_key = "mediacms_mediaaction_admin_optional_columns"
    list_filter = ["action", "action_date", ("media", admin.RelatedOnlyFieldListFilter), ("user", admin.RelatedOnlyFieldListFilter)]
    search_fields = ["media__title", "user__username", "extra_info"]
    list_select_related = ("media", "user")
    readonly_fields = [
        "action",
        "extra_info",
        "action_date",
        "remote_ip",
        "session_key",
        "link_media",
        "link_user",
    ]
    exclude = ("user", "media")
    ordering = ("-action_date",)
    date_hierarchy = "action_date"
    action_form = GroupedActionForm
    action_groups = [
        ["clear_reports_for_related_media"],
        ["delete_selected"],
    ]

    fieldsets = (
        (
            "Action",
            {
                "fields": ("link_media", "link_user", "action", "extra_info", "action_date", "remote_ip", "session_key"),
                "classes": ("tab",),
            },
        ),
    )

    def _optional_column_keys(self):
        return {key for key, _label, _filters in self.optional_list_columns}

    def _session_optional_columns(self, request):
        stored = request.session.get(self.optional_columns_session_key)
        if stored is None:
            return set()
        allowed = self._optional_column_keys()
        return {key for key in stored if key in allowed}

    def _filter_enabled_optional_columns(self, request):
        """Optional columns forced visible because a related list filter is active."""
        enabled = set()
        for key, _label, filter_params in self.optional_list_columns:
            if any(request.GET.get(param) not in (None, "") for param in filter_params):
                enabled.add(key)
        return enabled

    def _visible_optional_columns(self, request):
        return self._session_optional_columns(request) | self._filter_enabled_optional_columns(request)

    def get_list_display(self, request):
        visible_optional = self._visible_optional_columns(request)
        optional = self._optional_column_keys()
        columns = [column for column in self.list_display if column not in optional or column in visible_optional]
        return self._append_open_on_site(columns)

    def changelist_view(self, request, extra_context=None):
        if request.method == "GET" and (request.GET.get("reset_mediaaction_columns") == "1" or request.GET.get("set_mediaaction_columns") == "1"):
            if request.GET.get("reset_mediaaction_columns") == "1":
                request.session.pop(self.optional_columns_session_key, None)
            else:
                allowed = self._optional_column_keys()
                selected = [key for key in request.GET.getlist("mediaaction_col") if key in allowed]
                request.session[self.optional_columns_session_key] = selected
            request.session.modified = True
            params = request.GET.copy()
            params.pop("set_mediaaction_columns", None)
            params.pop("reset_mediaaction_columns", None)
            params.pop("mediaaction_col", None)
            query = params.urlencode()
            url = request.path
            if query:
                url = f"{url}?{query}"
            return HttpResponseRedirect(url)

        extra_context = extra_context or {}
        visible = self._visible_optional_columns(request)
        filter_forced = self._filter_enabled_optional_columns(request)
        lang = getattr(request, "LANGUAGE_CODE", "en")
        extra_context["mediaaction_optional_columns"] = [
            {
                "key": key,
                "label": translate_string(lang, label),
                "checked": key in visible,
                "filter_forced": key in filter_forced,
            }
            for key, label, _filters in self.optional_list_columns
        ]
        preserved = request.GET.copy()
        preserved.pop("set_mediaaction_columns", None)
        preserved.pop("reset_mediaaction_columns", None)
        preserved.pop("mediaaction_col", None)
        extra_context["mediaaction_column_chooser_preserved_qsl"] = list(preserved.items())
        return super().changelist_view(request, extra_context=extra_context)

    def get_changelist(self, request, **kwargs):
        return MediaActionChangeList

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # NULL and "" both become NULL so Extra info sorting can push blanks last.
        return qs.annotate(**{_EXTRA_INFO_SORT: NullIf(F("extra_info"), Value("", output_field=TextField()))})

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    @admin.display(description="Action", ordering="action")
    def display_action(self, obj):
        label = translated_choice_display(obj, "action")
        icon, modifier = MEDIA_ACTION_ICONS.get(obj.action, ("fas fa-question-circle", "unknown"))
        return admin_status_icon(icon, label, modifier=modifier)

    @admin.display(description="Media", ordering="media__title")
    def link_media(self, obj):
        if not obj.media_id:
            return "—"
        title = obj.media.title
        fragment = "reports-tab" if obj.action in MEDIA_REPORT_TAB_ACTIONS else None
        return format_html(
            '<a href="{}" title="{}">{}</a>',
            admin_change_url(obj.media, fragment=fragment),
            title,
            clipped_admin_text(title),
        )

    @admin.display(description="User", ordering="user__username")
    def link_user(self, obj):
        return admin_change_link(obj.user, obj.user.username if obj.user_id else None)

    @admin.display(description="Remote IP", ordering="remote_ip")
    def display_remote_ip(self, obj):
        return clipped_admin_text(obj.remote_ip, limit=24, always_tooltip=True)

    @admin.display(description="Extra info", ordering=_EXTRA_INFO_SORT)
    def display_extra_info(self, obj):
        return clipped_admin_text(obj.extra_info, limit=40, always_tooltip=True)

    def has_clear_reports_permission(self, request):
        return is_mediacms_editor(request.user)

    @admin.action(description="Clear reports for related media", permissions=["clear_reports"])
    def clear_reports_for_related_media(self, request, queryset):
        media_ids = queryset.filter(action="report").values_list("media_id", flat=True).distinct()
        media_qs = Media.objects.filter(pk__in=media_ids)
        count = clear_media_reports(media_qs, user=request.user)
        self.message_user(request, f"Cleared reports for {count} media item(s).", messages.SUCCESS)

    actions = [clear_reports_for_related_media]

    def get_actions(self, request):
        actions = super().get_actions(request)
        if "delete_selected" in actions:
            func, name, _description = actions["delete_selected"]
            actions["delete_selected"] = (func, name, "Delete selected media actions")
        return actions

    def get_action_choices(self, request, default_choices=None):
        return build_grouped_action_choices(
            self.get_actions(request),
            self.action_groups,
            opts=self.opts,
            language_code=getattr(request, "LANGUAGE_CODE", None),
        )
