from datetime import timedelta

from allauth.account.admin import EmailAddressAdmin as AllauthEmailAddressAdmin
from allauth.account.models import EmailAddress
from django.conf import settings
from django.contrib import admin, messages
from django.db.models import Count
from django.http import HttpResponseRedirect
from django.utils import timezone

from actions.models import MediaAction
from admin_customizations.action_choices import (
    GroupedActionForm,
    build_grouped_action_choices,
)
from files.admin import ImageDropzoneWidget
from files.admin_helpers import (
    OpenOnSiteMixin,
    admin_change_link,
    admin_changelist_link,
    admin_inspect_link,
    admin_status_icon,
    admin_text,
)
from files.frontend_translations import translate_string
from files.models import Comment, Media, Playlist

from .models import Channel, User


class JoinedRecentlyFilter(admin.SimpleListFilter):
    title = "Joined"
    parameter_name = "joined"

    def lookups(self, request, model_admin):
        return (("7d", "Last 7 days"),)

    def queryset(self, request, queryset):
        if self.value() == "7d":
            return queryset.filter(date_added__gte=timezone.now() - timedelta(days=7))
        return queryset


class ActiveUploaderFilter(admin.SimpleListFilter):
    title = "Activity"
    parameter_name = "activity"

    def lookups(self, request, model_admin):
        return (("30d", "Activity in the last 30 days"),)

    def queryset(self, request, queryset):
        if self.value() == "30d":
            cutoff = timezone.now() - timedelta(days=30)
            return queryset.filter(media__add_date__gte=cutoff).distinct()
        return queryset


class RegularUserFilter(admin.SimpleListFilter):
    title = "Role"
    parameter_name = "role"

    def lookups(self, request, model_admin):
        return (("regular", "Regular users"),)

    def queryset(self, request, queryset):
        if self.value() == "regular":
            return queryset.filter(
                is_superuser=False,
                is_staff=False,
                is_editor=False,
                is_manager=False,
            )
        return queryset


class UserAdmin(OpenOnSiteMixin, admin.ModelAdmin):
    change_list_template = "admin/users/user/change_list.html"
    search_fields = ["email", "username", "name"]
    exclude = [
        "user_permissions",
        "title",
        "password",
        "groups",
        "is_featured",
        "location",
        "first_name",
        "last_name",
        "date_joined",
        "is_approved",
        "media_count",
    ]
    list_display = [
        "date_added",
        "is_active",
        "username",
        "name",
        "email",
        "is_superuser",
        "is_editor",
        "is_manager",
        "media_count",
    ]
    list_display_links = ("username",)
    # Hidden by default; shown via the column chooser and/or when a related filter is active.
    optional_list_columns = (
        ("is_superuser", "Superuser status", ("is_superuser__exact",)),
        ("is_editor", "MediaCMS Editor", ("is_editor__exact",)),
        ("is_manager", "MediaCMS Manager", ("is_manager__exact",)),
        ("media_count", "Media count", ()),
    )
    optional_columns_session_key = "mediacms_user_admin_optional_columns"
    list_filter = ["is_active", "is_superuser", "is_staff", "is_editor", "is_manager", RegularUserFilter, JoinedRecentlyFilter, ActiveUploaderFilter]
    list_editable = []
    ordering = ("-date_added",)
    date_hierarchy = "date_added"
    readonly_fields = (
        "last_login",
        "related_media",
        "related_channels",
        "related_playlists",
        "related_comments",
        "related_likes",
        "related_dislikes",
        "related_watches",
        "related_reports",
        "related_actions",
    )
    action_form = GroupedActionForm
    action_groups = [
        ["approve_users", "unapprove_users"],
        ["deactivate_users", "reactivate_users"],
        ["delete_selected"],
    ]

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
        if request.method == "GET" and (request.GET.get("reset_user_columns") == "1" or request.GET.get("set_user_columns") == "1"):
            if request.GET.get("reset_user_columns") == "1":
                request.session.pop(self.optional_columns_session_key, None)
            else:
                allowed = self._optional_column_keys()
                selected = [key for key in request.GET.getlist("user_col") if key in allowed]
                request.session[self.optional_columns_session_key] = selected
            request.session.modified = True
            params = request.GET.copy()
            params.pop("set_user_columns", None)
            params.pop("reset_user_columns", None)
            params.pop("user_col", None)
            query = params.urlencode()
            url = request.path
            if query:
                url = f"{url}?{query}"
            return HttpResponseRedirect(url)

        extra_context = extra_context or {}
        visible = self._visible_optional_columns(request)
        filter_forced = self._filter_enabled_optional_columns(request)
        lang = getattr(request, "LANGUAGE_CODE", "en")
        extra_context["user_optional_columns"] = [
            {
                "key": key,
                "label": translate_string(lang, label),
                "checked": key in visible,
                "filter_forced": key in filter_forced,
            }
            for key, label, _filters in self.optional_list_columns
        ]
        preserved = request.GET.copy()
        preserved.pop("set_user_columns", None)
        preserved.pop("reset_user_columns", None)
        preserved.pop("user_col", None)
        extra_context["user_column_chooser_preserved_qsl"] = list(preserved.items())
        return super().changelist_view(request, extra_context=extra_context)

    def get_action_choices(self, request, default_choices=None):
        return build_grouped_action_choices(
            self.get_actions(request),
            self.action_groups,
            opts=self.opts,
            language_code=getattr(request, "LANGUAGE_CODE", None),
        )

    if settings.USERS_NEEDS_TO_BE_APPROVED:
        list_display.append("is_approved")
        list_filter.append("is_approved")
        list_editable = ["is_approved"]
        exclude.remove("is_approved")

    def get_fieldsets(self, request, obj=None):
        """Organize the change form into purpose-based Jazzmin tabs."""
        access_fields = [
            "is_active",
            "is_staff",
            "is_superuser",
            "is_editor",
            "is_manager",
            "advancedUser",
            "last_login",
        ]
        if getattr(settings, "USERS_NEEDS_TO_BE_APPROVED", False):
            access_fields.insert(-1, "is_approved")

        return (
            (
                "Profile",
                {
                    "fields": (
                        "username",
                        "name",
                        "email",
                        "logo",
                        "description",
                        "allow_contact",
                        "notification_on_comments",
                        "date_added",
                    ),
                    "classes": ("tab",),
                },
            ),
            (
                "Access",
                {
                    "fields": tuple(access_fields),
                    "classes": ("tab",),
                    "description": "Account status and MediaCMS roles.",
                },
            ),
            (
                "Related",
                {
                    "fields": (
                        "related_media",
                        "related_playlists",
                        "related_channels",
                        "related_comments",
                        "related_likes",
                        "related_dislikes",
                        "related_watches",
                        "related_reports",
                        "related_actions",
                    ),
                    "classes": ("tab", "related-links-tab"),
                    "description": "Links to filtered admin lists for related one-to-many records.",
                },
            ),
        )

    @admin.display(description="Media")
    def related_media(self, obj):
        if not obj.pk:
            return "—"
        count = Media.objects.filter(user=obj).count()
        return admin_changelist_link(Media, admin_text(None, "View {count} media item(s)", count=count), user__id__exact=obj.pk)

    @admin.display(description="Channels")
    def related_channels(self, obj):
        if not obj.pk:
            return "—"
        count = obj.channels.count()
        return admin_changelist_link(Channel, admin_text(None, "View {count} channel(s)", count=count), user__id__exact=obj.pk)

    @admin.display(description="Playlists")
    def related_playlists(self, obj):
        if not obj.pk:
            return "—"
        count = obj.playlists.count()
        return admin_changelist_link(Playlist, admin_text(None, "View {count} playlist(s)", count=count), user__id__exact=obj.pk)

    @admin.display(description="Comments")
    def related_comments(self, obj):
        if not obj.pk:
            return "—"
        count = Comment.objects.filter(user=obj).count()
        return admin_changelist_link(Comment, admin_text(None, "View {count} comment(s)", count=count), user__id__exact=obj.pk)

    @admin.display(description="Likes")
    def related_likes(self, obj):
        if not obj.pk:
            return "—"
        count = MediaAction.objects.filter(user=obj, action="like").count()
        return admin_changelist_link(MediaAction, admin_text(None, "View {count} like(s)", count=count), user__id__exact=obj.pk, action__exact="like")

    @admin.display(description="Dislikes")
    def related_dislikes(self, obj):
        if not obj.pk:
            return "—"
        count = MediaAction.objects.filter(user=obj, action="dislike").count()
        return admin_changelist_link(MediaAction, admin_text(None, "View {count} dislike(s)", count=count), user__id__exact=obj.pk, action__exact="dislike")

    @admin.display(description="Watches")
    def related_watches(self, obj):
        if not obj.pk:
            return "—"
        count = MediaAction.objects.filter(user=obj, action="watch").count()
        return admin_changelist_link(MediaAction, admin_text(None, "View {count} watch(es)", count=count), user__id__exact=obj.pk, action__exact="watch")

    @admin.display(description="Reports")
    def related_reports(self, obj):
        if not obj.pk:
            return "—"
        count = MediaAction.objects.filter(user=obj, action="report").count()
        return admin_changelist_link(MediaAction, admin_text(None, "View {count} report(s)", count=count), user__id__exact=obj.pk, action__exact="report")

    @admin.display(description="All activity")
    def related_actions(self, obj):
        if not obj.pk:
            return "—"
        count = MediaAction.objects.filter(user=obj).count()
        return admin_changelist_link(MediaAction, admin_text(None, "View {count} action(s)", count=count), user__id__exact=obj.pk)

    @admin.action(description="Approve users", permissions=["change"])
    def approve_users(self, request, queryset):
        updated = queryset.update(is_approved=True)
        self.message_user(request, admin_text(getattr(request, "LANGUAGE_CODE", None), "Approved {updated} user(s).", updated=updated), messages.SUCCESS)

    @admin.action(description="Unapprove users", permissions=["change"])
    def unapprove_users(self, request, queryset):
        updated = queryset.update(is_approved=False)
        self.message_user(request, admin_text(getattr(request, "LANGUAGE_CODE", None), "Unapproved {updated} user(s).", updated=updated), messages.SUCCESS)

    @admin.action(description="Deactivate users", permissions=["change"])
    def deactivate_users(self, request, queryset):
        updated = queryset.exclude(pk=request.user.pk).update(is_active=False)
        self.message_user(request, admin_text(getattr(request, "LANGUAGE_CODE", None), "Deactivated {updated} user(s).", updated=updated), messages.SUCCESS)

    @admin.action(description="Reactivate users", permissions=["change"])
    def reactivate_users(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, admin_text(getattr(request, "LANGUAGE_CODE", None), "Reactivated {updated} user(s).", updated=updated), messages.SUCCESS)

    def get_actions(self, request):
        actions = super().get_actions(request)
        if not getattr(settings, "USERS_NEEDS_TO_BE_APPROVED", False):
            actions.pop("approve_users", None)
            actions.pop("unapprove_users", None)
        return actions

    actions = [approve_users, unapprove_users, deactivate_users, reactivate_users]


class ChannelAdmin(OpenOnSiteMixin, admin.ModelAdmin):
    search_fields = ["title", "friendly_token", "user__username"]
    change_list_template = "admin/users/channel/change_list.html"
    # Full column set; get_list_display() hides optional ones unless opted-in.
    list_display = ["add_date", "title", "link_user", "friendly_token", "related_media_count"]
    list_display_links = ("title",)
    optional_list_columns = (
        ("friendly_token", "Friendly token", ()),
        ("related_media_count", "Media count", ()),
    )
    optional_columns_session_key = "mediacms_channel_admin_optional_columns"
    list_select_related = ("user",)
    list_filter = ["add_date", ("user", admin.RelatedOnlyFieldListFilter)]
    ordering = ("-add_date",)
    date_hierarchy = "add_date"
    readonly_fields = ("friendly_token", "link_user", "display_user", "related_media")
    exclude = ("user",)
    fieldsets = (
        (
            "Channel",
            {
                "fields": (
                    "title",
                    "description",
                    "display_user",
                    "friendly_token",
                    "subscribers",
                    "banner_logo",
                ),
                "classes": ("tab", "channel-fields"),
            },
        ),
        (
            "Related",
            {
                "fields": ("related_media",),
                "classes": ("tab", "related-links-tab"),
                "description": "Links to filtered admin lists for related one-to-many records.",
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
        if request.method == "GET" and (request.GET.get("reset_channel_columns") == "1" or request.GET.get("set_channel_columns") == "1"):
            if request.GET.get("reset_channel_columns") == "1":
                request.session.pop(self.optional_columns_session_key, None)
            else:
                allowed = self._optional_column_keys()
                selected = [key for key in request.GET.getlist("channel_col") if key in allowed]
                request.session[self.optional_columns_session_key] = selected
            request.session.modified = True
            params = request.GET.copy()
            params.pop("set_channel_columns", None)
            params.pop("reset_channel_columns", None)
            params.pop("channel_col", None)
            query = params.urlencode()
            url = request.path
            if query:
                url = f"{url}?{query}"
            return HttpResponseRedirect(url)

        extra_context = extra_context or {}
        visible = self._visible_optional_columns(request)
        filter_forced = self._filter_enabled_optional_columns(request)
        lang = getattr(request, "LANGUAGE_CODE", "en")
        extra_context["channel_optional_columns"] = [
            {
                "key": key,
                "label": translate_string(lang, label),
                "checked": key in visible,
                "filter_forced": key in filter_forced,
            }
            for key, label, _filters in self.optional_list_columns
        ]
        preserved = request.GET.copy()
        preserved.pop("set_channel_columns", None)
        preserved.pop("reset_channel_columns", None)
        preserved.pop("channel_col", None)
        extra_context["channel_column_chooser_preserved_qsl"] = list(preserved.items())
        return super().changelist_view(request, extra_context=extra_context)

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        formfield = super().formfield_for_dbfield(db_field, request, **kwargs)
        if formfield and db_field.name == "banner_logo":
            formfield.widget = ImageDropzoneWidget()
        return formfield

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if "related_media_count" in self.get_list_display(request):
            qs = qs.annotate(_media_count=Count("media"))
        return qs

    @admin.display(description="User", ordering="user__username")
    def link_user(self, obj):
        return admin_change_link(obj.user, obj.user.username if obj.user_id else None)

    @admin.display(description="User")
    def display_user(self, obj):
        if not obj or not obj.user_id:
            return "—"
        return admin_inspect_link(obj.user, obj.user.username)

    @admin.display(description="Media")
    def related_media(self, obj):
        if not obj.pk:
            return "—"
        count = getattr(obj, "_media_count", Media.objects.filter(channel=obj).count())
        return admin_changelist_link(Media, admin_text(None, "View {count} media item(s)", count=count), channel__id__exact=obj.pk)

    @admin.display(description="Media count", ordering="_media_count")
    def related_media_count(self, obj):
        count = getattr(obj, "_media_count", Media.objects.filter(channel=obj).count())
        return admin_changelist_link(Media, str(count), channel__id__exact=obj.pk)


admin.site.register(User, UserAdmin)
admin.site.register(Channel, ChannelAdmin)


class EmailAddressAdmin(AllauthEmailAddressAdmin):
    """Email changelist that fits the card and uses status icons for the flags."""

    list_display = ("email", "link_user", "display_primary", "display_verified")
    list_display_links = ("email",)
    list_select_related = ("user",)

    @admin.display(description="User", ordering="user__username")
    def link_user(self, obj):
        return admin_change_link(obj.user, obj.user.username if obj.user_id else None)

    @admin.display(description="Primary", ordering="primary")
    def display_primary(self, obj):
        if obj.primary:
            return admin_status_icon("fas fa-star", admin_text(None, "Yes"), modifier="primary")
        return admin_status_icon("fas fa-minus", admin_text(None, "No"), modifier="not-listable")

    @admin.display(description="Verified", ordering="verified")
    def display_verified(self, obj):
        if obj.verified:
            return admin_status_icon("fas fa-check-circle", admin_text(None, "Yes"), modifier="success")
        return admin_status_icon("fas fa-times-circle", admin_text(None, "No"), modifier="fail")


admin.site.unregister(EmailAddress)
admin.site.register(EmailAddress, EmailAddressAdmin)
