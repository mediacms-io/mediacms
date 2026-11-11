from django import forms
from django.conf import settings
from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count
from django.http import HttpResponseRedirect
from django.template.response import TemplateResponse
from django.urls import reverse
from django.utils.html import escape, format_html
from django.utils.safestring import mark_safe
from tinymce.widgets import TinyMCE

from actions.models import MODERATION_MEDIA_ACTIONS, MediaAction
from admin_customizations.action_choices import (
    GroupedActionForm,
    build_grouped_action_choices,
)
from files.admin_helpers import (
    ReadOnlyTabularInline,
    admin_change_link,
    admin_change_url,
    admin_changelist_link,
    admin_changelist_url,
    join_links,
)
from files.methods import (
    can_delete_original_media_file,
    change_media_owner,
    clear_media_reports,
    confirm_media_reports,
    delete_original_media_file,
    is_mediacms_editor,
    media_has_original_file,
    record_moderation_action,
    set_media_reviewed,
)
from files.models.utils import PREVIEW_PROFILE_NAME
from rbac.models import RBACGroup
from users.models import User

from .models import (
    Category,
    Comment,
    EncodeProfile,
    Encoding,
    Language,
    License,
    Media,
    MediaPermission,
    Page,
    Playlist,
    PlaylistMedia,
    Subtitle,
    Tag,
    TinyMCEMedia,
    TranscriptionRequest,
    VideoTrimRequest,
)

# Open reports plus moderation audit events shown on the Media "Reports" tab.
MEDIA_REPORT_TAB_ACTIONS = ("report",) + tuple(name for name, _label in MODERATION_MEDIA_ACTIONS)


class ReportedTimesFilter(admin.SimpleListFilter):
    title = "Reports"
    parameter_name = "reported"

    def lookups(self, request, model_admin):
        return (
            ("yes", "Has reports"),
            ("threshold", "Above threshold"),
            ("clean", "No reports"),
        )

    def queryset(self, request, queryset):
        threshold = getattr(settings, "REPORTED_TIMES_THRESHOLD", 10)
        if self.value() == "yes":
            return queryset.filter(reported_times__gt=0)
        if self.value() == "threshold":
            return queryset.filter(reported_times__gte=threshold)
        if self.value() == "clean":
            return queryset.filter(reported_times=0)
        return queryset


class EncodingQueueFilter(admin.SimpleListFilter):
    title = "Encoding queue"
    parameter_name = "encoding_queue"

    def lookups(self, request, model_admin):
        return (
            ("yes", "In queue (pending/running)"),
            ("fail", "Failed"),
        )

    def queryset(self, request, queryset):
        if self.value() == "yes":
            return queryset.filter(encoding_status__in=["pending", "running"])
        if self.value() == "fail":
            return queryset.filter(encoding_status="fail")
        return queryset


class CommentInline(ReadOnlyTabularInline):
    model = Comment
    fields = ("user", "text", "add_date")
    readonly_fields = ("user", "text", "add_date")
    ordering = ("-add_date",)
    can_delete = True
    classes = ["tab", "related-objects-tab"]
    verbose_name = "Comment"
    verbose_name_plural = "Comments"


class EncodingInline(ReadOnlyTabularInline):
    model = Encoding
    fields = ("profile", "status", "progress", "chunk", "update_date")
    readonly_fields = ("profile", "status", "progress", "chunk", "update_date")
    ordering = ("-update_date",)
    classes = ["tab", "related-objects-tab"]
    verbose_name = "Encoding"
    verbose_name_plural = "Encodings"


class SubtitleInline(ReadOnlyTabularInline):
    model = Subtitle
    fields = ("link_caption", "link_language", "link_user")
    readonly_fields = ("link_caption", "link_language", "link_user")
    can_delete = True
    classes = ["tab", "related-objects-tab"]
    verbose_name = "Caption"
    verbose_name_plural = "Captions"

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("language", "user")

    @admin.display(description="Caption")
    def link_caption(self, obj):
        if not obj or not obj.pk:
            return "—"
        label = obj.subtitle_file.name.rsplit("/", 1)[-1] if obj.subtitle_file else f"Caption {obj.pk}"
        return admin_change_link(obj, label)

    @admin.display(description="Language")
    def link_language(self, obj):
        if not obj or not obj.language_id:
            return "—"
        return admin_change_link(obj.language, obj.language.title)

    @admin.display(description="User")
    def link_user(self, obj):
        if not obj or not obj.user_id:
            return "—"
        return admin_change_link(obj.user, obj.user.username)


class TranscriptionRequestInline(ReadOnlyTabularInline):
    model = TranscriptionRequest
    fields = ("status", "translate_to_english", "add_date")
    readonly_fields = ("status", "translate_to_english", "add_date")
    ordering = ("-add_date",)
    can_delete = True
    classes = ["tab", "related-objects-tab"]
    verbose_name = "Caption Request"
    verbose_name_plural = "Caption Requests"


class VideoTrimRequestInline(ReadOnlyTabularInline):
    model = VideoTrimRequest
    fields = ("link_request", "status", "video_action", "media_trim_style", "add_date")
    readonly_fields = ("link_request", "status", "video_action", "media_trim_style", "add_date")
    ordering = ("-add_date",)
    can_delete = True
    classes = ["tab", "related-objects-tab"]
    verbose_name = "Trim Request"
    verbose_name_plural = "Trim Requests"

    @admin.display(description="Trim request")
    def link_request(self, obj):
        if not obj or not obj.pk:
            return "—"
        return admin_change_link(obj, f"#{obj.pk}")


class LanguageCaptionInline(ReadOnlyTabularInline):
    model = Subtitle
    fields = ("link_media", "link_user")
    readonly_fields = ("link_media", "link_user")
    ordering = ("media__title",)
    can_delete = True
    classes = ["tab", "related-objects-tab"]
    verbose_name = "Caption"
    verbose_name_plural = "Captions"

    @admin.display(description="Media")
    def link_media(self, obj):
        if not obj or not obj.media_id:
            return "—"
        return admin_change_link(obj.media, obj.media.title)

    @admin.display(description="User")
    def link_user(self, obj):
        if not obj or not obj.user_id:
            return "—"
        return admin_change_link(obj.user, obj.user.username)


class MediaPermissionInline(ReadOnlyTabularInline):
    model = MediaPermission
    fields = ("user", "owner_user", "permission", "source")
    readonly_fields = ("user", "owner_user", "permission", "source")
    ordering = ("-created_at",)
    classes = ["tab", "related-objects-tab"]
    verbose_name = "User permission"
    verbose_name_plural = "User permissions"


class PlaylistMediaInline(ReadOnlyTabularInline):
    model = PlaylistMedia
    fields = ("link_media", "link_owner", "is_listable", "ordering")
    readonly_fields = ("link_media", "link_owner", "is_listable", "ordering")
    ordering = ("ordering",)
    can_delete = True
    classes = ["tab", "related-objects-tab"]
    verbose_name = "Media"
    verbose_name_plural = "Media"
    related_changelist_model = Media
    related_changelist_filters = "playlist__id__exact"

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("media", "media__user")

    @admin.display(description="Media")
    def link_media(self, obj):
        if not obj or not obj.media_id:
            return "—"
        return admin_change_link(obj.media, obj.media.title)

    @admin.display(description="Owner")
    def link_owner(self, obj):
        if not obj or not obj.media_id or not obj.media.user_id:
            return "—"
        return admin_change_link(obj.media.user, obj.media.user.username)

    @admin.display(description="Listable", boolean=True)
    def is_listable(self, obj):
        if not obj or not obj.media_id:
            return None
        return obj.media.listable


class CategoryMediaInline(ReadOnlyTabularInline):
    model = Media.category.through
    fields = ("link_media", "link_owner", "is_listable")
    readonly_fields = ("link_media", "link_owner", "is_listable")
    ordering = ("media__title",)
    can_delete = True
    classes = ["tab", "related-objects-tab"]
    verbose_name = "Media"
    verbose_name_plural = "Media"
    related_changelist_model = Media
    related_changelist_filters = "category__id__exact"

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("media", "media__user")

    @admin.display(description="Media")
    def link_media(self, obj):
        if not obj or not obj.media_id:
            return "—"
        return admin_change_link(obj.media, obj.media.title)

    @admin.display(description="Owner")
    def link_owner(self, obj):
        if not obj or not obj.media_id or not obj.media.user_id:
            return "—"
        return admin_change_link(obj.media.user, obj.media.user.username)

    @admin.display(description="Listable", boolean=True)
    def is_listable(self, obj):
        if not obj or not obj.media_id:
            return None
        return obj.media.listable


class TagMediaInline(ReadOnlyTabularInline):
    model = Media.tags.through
    fields = ("link_media", "link_owner", "is_listable")
    readonly_fields = ("link_media", "link_owner", "is_listable")
    ordering = ("media__title",)
    can_delete = True
    classes = ["tab", "related-objects-tab"]
    verbose_name = "Media"
    verbose_name_plural = "Media"
    related_changelist_model = Media
    related_changelist_filters = "tags__id__exact"

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("media", "media__user")

    @admin.display(description="Media")
    def link_media(self, obj):
        if not obj or not obj.media_id:
            return "—"
        return admin_change_link(obj.media, obj.media.title)

    @admin.display(description="Owner")
    def link_owner(self, obj):
        if not obj or not obj.media_id or not obj.media.user_id:
            return "—"
        return admin_change_link(obj.media.user, obj.media.user.username)

    @admin.display(description="Listable", boolean=True)
    def is_listable(self, obj):
        if not obj or not obj.media_id:
            return None
        return obj.media.listable


class LicenseMediaInline(ReadOnlyTabularInline):
    model = Media
    fk_name = "license"
    fields = ("link_title", "link_owner", "is_listable", "state", "media_type")
    readonly_fields = ("link_title", "link_owner", "is_listable", "state", "media_type")
    ordering = ("-add_date",)
    classes = ["tab", "related-objects-tab"]
    verbose_name = "Media"
    verbose_name_plural = "Media"

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("user")

    @admin.display(description="Media")
    def link_title(self, obj):
        if not obj or not obj.pk:
            return "—"
        return admin_change_link(obj, obj.title)

    @admin.display(description="Owner")
    def link_owner(self, obj):
        if not obj or not obj.user_id:
            return "—"
        return admin_change_link(obj.user, obj.user.username)

    @admin.display(description="Listable", boolean=True)
    def is_listable(self, obj):
        if not obj:
            return None
        return obj.listable


class CommentAdmin(admin.ModelAdmin):
    search_fields = ["text", "user__username", "media__title"]
    list_display = ["text", "add_date", "link_user", "link_media"]
    list_filter = ["add_date", ("media", admin.RelatedOnlyFieldListFilter), ("user", admin.RelatedOnlyFieldListFilter)]
    list_select_related = ("user", "media")
    ordering = ("-add_date",)
    date_hierarchy = "add_date"
    readonly_fields = ("link_user", "link_media", "parent", "add_date", "uid")
    exclude = ("media", "user")
    fieldsets = (
        (
            "Comment",
            {
                "fields": ("text", "parent", "add_date", "uid"),
                "classes": ("tab",),
            },
        ),
        (
            "Related",
            {
                "fields": ("link_user", "link_media"),
                "classes": ("tab", "related-links-tab"),
            },
        ),
    )

    @admin.display(description="User", ordering="user__username")
    def link_user(self, obj):
        return admin_change_link(obj.user, obj.user.username if obj.user_id else None)

    @admin.display(description="Media", ordering="media__title")
    def link_media(self, obj):
        return admin_change_link(obj.media, obj.media.title if obj.media_id else None)


class MediaAdmin(admin.ModelAdmin):
    search_fields = ["title", "user__username", "friendly_token"]
    change_list_template = "admin/files/media/change_list.html"
    # Full column set; get_list_display() hides optional ones unless opted-in or filtered.
    list_display = [
        "title",
        "link_user",
        "add_date",
        "media_type",
        "duration",
        "state",
        "is_reviewed",
        "encoding_status",
        "listable",
        "reported_times",
        "featured",
        "allow_download",
        "enable_comments",
        "get_comments_count",
        "get_encodings_count",
    ]
    # Hidden by default; shown via column chooser and/or when a related filter is active.
    optional_list_columns = (
        ("duration", "Duration", ()),
        ("is_reviewed", "Is reviewed", ("is_reviewed__exact",)),
        ("featured", "Featured", ("featured__exact",)),
        ("get_comments_count", "Comments", ()),
        ("get_encodings_count", "Encodings", ("encoding_status__exact", "encoding_queue")),
        ("reported_times", "Reported times", ("reported",)),
        ("allow_download", "Allow download", ("allow_download__exact",)),
        ("enable_comments", "Allow comments", ("enable_comments__exact",)),
    )
    optional_columns_session_key = "mediacms_media_admin_optional_columns"
    list_filter = [
        "state",
        "is_reviewed",
        "encoding_status",
        EncodingQueueFilter,
        "featured",
        "listable",
        "media_type",
        ReportedTimesFilter,
        "allow_download",
        "enable_comments",
        "category",
        ("tags", admin.RelatedOnlyFieldListFilter),
        ("playlist", admin.RelatedOnlyFieldListFilter),
        ("license", admin.RelatedOnlyFieldListFilter),
        ("channel", admin.RelatedOnlyFieldListFilter),
        ("user", admin.RelatedOnlyFieldListFilter),
    ]
    list_editable = ("is_reviewed", "featured", "allow_download", "enable_comments")
    list_select_related = ("user", "channel")
    ordering = ("-add_date",)
    date_hierarchy = "add_date"
    action_form = GroupedActionForm
    action_groups = [
        [
            "generate_missing_encodings",
            "force_reencode",
            "regenerate_thumbnails",
            "regenerate_sprites",
            "regenerate_preview",
            "regenerate_hls",
            "refresh_derivatives",
        ],
        [
            "mark_as_reviewed",
            "mark_as_unreviewed",
            "clear_reports",
            "confirm_reports_set_private",
            "clear_reports_keep_private",
            "clear_reports_set_public",
        ],
        [
            "set_state_public",
            "set_state_private",
            "set_state_unlisted",
        ],
        [
            "enable_download",
            "disable_download",
            "enable_comments",
            "disable_comments",
            "feature_selected",
            "unfeature_selected",
        ],
        [
            "change_owner",
            "delete_original_media_files",
        ],
        [
            "delete_selected",
        ],
    ]

    def get_actions(self, request):
        actions = super().get_actions(request)
        if "delete_selected" in actions:
            func, name, _description = actions["delete_selected"]
            actions["delete_selected"] = (func, name, "Delete selected media")
        return actions

    def get_action_choices(self, request, default_choices=None):
        return build_grouped_action_choices(self.get_actions(request), self.action_groups, opts=self.opts)

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
        return [column for column in self.list_display if column not in self._optional_column_keys() or column in visible_optional]

    def get_list_editable(self, request):
        display = set(self.get_list_display(request))
        return tuple(field for field in self.list_editable if field in display)

    def get_changelist_instance(self, request):
        """Use request-aware list_editable so hidden optional columns are not editable."""
        list_display = self.get_list_display(request)
        list_display_links = self.get_list_display_links(request, list_display)
        if self.get_actions(request):
            list_display = ["action_checkbox", *list_display]
        ChangeList = self.get_changelist(request)
        return ChangeList(
            request,
            self.model,
            list_display,
            list_display_links,
            self.get_list_filter(request),
            self.date_hierarchy,
            self.get_search_fields(request),
            self.get_list_select_related(request),
            self.list_per_page,
            self.list_max_show_all,
            self.get_list_editable(request),
            self,
            self.get_sortable_by(request),
            self.search_help_text,
        )

    def changelist_view(self, request, extra_context=None):
        if request.method == "GET" and request.GET.get("set_media_columns") == "1":
            allowed = self._optional_column_keys()
            selected = [key for key in request.GET.getlist("media_col") if key in allowed]
            request.session[self.optional_columns_session_key] = selected
            request.session.modified = True
            params = request.GET.copy()
            params.pop("set_media_columns", None)
            params.pop("media_col", None)
            query = params.urlencode()
            url = request.path
            if query:
                url = f"{url}?{query}"
            return HttpResponseRedirect(url)

        extra_context = extra_context or {}
        visible = self._visible_optional_columns(request)
        filter_forced = self._filter_enabled_optional_columns(request)
        extra_context["media_optional_columns"] = [
            {
                "key": key,
                "label": label,
                "checked": key in visible,
                "filter_forced": key in filter_forced,
            }
            for key, label, _filters in self.optional_list_columns
        ]
        # Preserve current filters/search when submitting the column chooser.
        preserved = request.GET.copy()
        preserved.pop("set_media_columns", None)
        preserved.pop("media_col", None)
        extra_context["media_column_chooser_preserved_qsl"] = list(preserved.items())
        return super().changelist_view(request, extra_context=extra_context)

    readonly_fields = (
        "link_user",
        "link_channel",
        "listable",
        "media_type",
        "encoding_status",
        "duration",
        "size",
        "video_height",
        "hls_file",
        "preview_file_path",
        "poster",
        "thumbnail",
        "sprites",
        "uid",
        "friendly_token",
        "md5sum",
        "media_info",
        "search",
        "views",
        "likes",
        "dislikes",
        "report_actions_table",
        "related_comments",
        "related_encodings",
        "related_actions",
        "related_reports",
        "related_playlists",
        "related_trim_requests",
        "related_transcription_requests",
        "related_captions",
    )
    autocomplete_fields = ("license",)
    inlines = [
        VideoTrimRequestInline,
        TranscriptionRequestInline,
        SubtitleInline,
        CommentInline,
        EncodingInline,
        MediaPermissionInline,
    ]
    exclude = ("user", "channel")

    def get_fieldsets(self, request, obj=None):
        """Organize the change form into purpose-based Jazzmin tabs.

        Object tabs come first, then Related (links/counts), then related-object
        inline tabs (Trim Requests, Captions, Comments, etc.).
        """
        media_file_fields = [
            "media_file",
            "media_type",
            "encoding_status",
            "duration",
            "size",
            "video_height",
            "hls_file",
            "preview_file_path",
            "poster",
            "thumbnail",
            "sprites",
        ]
        if getattr(settings, "USE_WHISPER_TRANSCRIBE", False):
            media_file_fields.extend(
                [
                    "allow_whisper_transcribe",
                    "allow_whisper_transcribe_and_translate",
                ]
            )

        content_fields = [
            "title",
            "description",
            "link_user",
            "link_channel",
            "license",
            "tags",
            "category",
        ]
        if getattr(settings, "ALLOW_RATINGS", False):
            content_fields.append("rating_category")
        content_fields.extend(
            [
                "uploaded_poster",
                "uploaded_thumbnail",
                "thumbnail_time",
            ]
        )

        return (
            (
                "Content",
                {
                    "fields": tuple(content_fields),
                    "classes": ("tab",),
                },
            ),
            (
                "Publishing",
                {
                    "fields": (
                        "state",
                        "is_reviewed",
                        "listable",
                        "featured",
                        "user_featured",
                        "add_date",
                    ),
                    "classes": ("tab",),
                    "description": "Visibility and editorial status for listings.",
                },
            ),
            (
                "Sharing",
                {
                    "fields": (
                        "allow_download",
                        "enable_comments",
                        "password",
                    ),
                    "classes": ("tab",),
                    "description": "How viewers can interact with this media. Per-user grants are listed under User permissions.",
                },
            ),
            (
                "Media file",
                {
                    "fields": tuple(media_file_fields),
                    "classes": ("tab",),
                    "description": "Original upload and generated derivatives. Most values here are produced by the media pipeline.",
                },
            ),
            (
                "Details",
                {
                    "fields": (
                        "views",
                        "likes",
                        "dislikes",
                        "uid",
                        "friendly_token",
                        "md5sum",
                        "media_info",
                        "search",
                    ),
                    "classes": ("tab",),
                    "description": "Identifiers and engagement counters.",
                },
            ),
            (
                "Reports",
                {
                    "fields": ("reported_times", "report_actions_table"),
                    "classes": ("tab",),
                    "description": "Open reports and related moderation audit events. Use Clear reports actions to reset counters.",
                },
            ),
            (
                "Related",
                {
                    "fields": (
                        "related_playlists",
                        "related_trim_requests",
                        "related_transcription_requests",
                        "related_captions",
                        "related_comments",
                        "related_encodings",
                        "related_actions",
                        "related_reports",
                    ),
                    "classes": ("tab", "related-links-tab"),
                    "description": "Links to filtered admin lists for related records. Detail tables are on the tabs that follow.",
                },
            ),
        )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("user", "channel").annotate(_comments_count=Count("comments", distinct=True), _encodings_count=Count("encodings", distinct=True))

    @admin.display(description="User", ordering="user__username")
    def link_user(self, obj):
        return admin_change_link(obj.user, obj.user.username if obj.user_id else None)

    @admin.display(description="Channel")
    def link_channel(self, obj):
        return admin_change_link(obj.channel) if obj.channel_id else "—"

    @admin.display(description="Comments", ordering="_comments_count")
    def get_comments_count(self, obj):
        count = getattr(obj, "_comments_count", obj.comments.count())
        return admin_changelist_link(Comment, f"{count} comments", media__id__exact=obj.pk)

    @admin.display(description="Encodings", ordering="_encodings_count")
    def get_encodings_count(self, obj):
        count = getattr(obj, "_encodings_count", obj.encodings.count())
        return admin_changelist_link(Encoding, f"{count} encodings", media__id__exact=obj.pk)

    @admin.display(description="Comments")
    def related_comments(self, obj):
        if not obj.pk:
            return "—"
        count = obj.comments.count()
        return admin_changelist_link(Comment, f"View {count} comment(s)", media__id__exact=obj.pk)

    @admin.display(description="Encodings")
    def related_encodings(self, obj):
        if not obj.pk:
            return "—"
        count = obj.encodings.count()
        return admin_changelist_link(Encoding, f"View {count} encoding(s)", media__id__exact=obj.pk)

    @admin.display(description="Actions / reports")
    def related_actions(self, obj):
        if not obj.pk:
            return "—"
        count = obj.mediaactions.count()
        return admin_changelist_link(MediaAction, f"View {count} action(s)", media__id__exact=obj.pk)

    @admin.display(description="Reports")
    def related_reports(self, obj):
        if not obj.pk:
            return "—"
        count = obj.mediaactions.filter(action__in=MEDIA_REPORT_TAB_ACTIONS).count()
        return admin_changelist_link(
            MediaAction,
            f"View {count} report/moderation action(s) (reported_times={obj.reported_times})",
            media__id__exact=obj.pk,
        )

    @admin.display(description="Report & moderation actions")
    def report_actions_table(self, obj):
        """HTML table of report + moderation MediaActions with admin drill-downs."""
        if not obj or not obj.pk:
            return "—"

        actions = MediaAction.objects.filter(media=obj, action__in=MEDIA_REPORT_TAB_ACTIONS).select_related("user").order_by("-action_date")
        changelist = admin_changelist_url(MediaAction, media__id__exact=obj.pk)
        header = format_html(
            '<p style="margin-bottom:0.75em;"><a href="{}">Open all MediaActions for this media</a> · ' '<a href="{}">Open reports only</a></p>',
            changelist,
            admin_changelist_url(MediaAction, media__id__exact=obj.pk, action__exact="report"),
        )
        if not actions.exists():
            return mark_safe(f"{header}<p>No report or moderation actions yet.</p>")

        rows = []
        for action in actions:
            user_cell = admin_change_link(action.user, action.user.username) if action.user_id else escape(action.session_key or "anonymous")
            action_url = admin_change_url(action)
            action_label = escape(action.get_action_display() if hasattr(action, "get_action_display") else action.action)
            extra = escape((action.extra_info or "")[:200])
            when = escape(action.action_date.strftime("%Y-%m-%d %H:%M") if action.action_date else "")
            ip = escape(action.remote_ip or "—")
            rows.append(
                format_html(
                    "<tr>" '<td><a href="{}">{}</a></td>' "<td>{}</td>" "<td>{}</td>" "<td>{}</td>" "<td>{}</td>" '<td><a class="btn btn-xs btn-primary" href="{}">View</a></td>' "</tr>",
                    action_url,
                    action_label,
                    user_cell,
                    extra or "—",
                    when,
                    ip,
                    action_url,
                )
            )

        table = format_html(
            '<table class="table table-sm table-striped">' "<thead><tr>" "<th>Action</th><th>User</th><th>Extra info</th><th>When</th><th>IP</th><th></th>" "</tr></thead><tbody>{}</tbody></table>",
            mark_safe("".join(str(row) for row in rows)),
        )
        return mark_safe(f"{header}{table}")

    @admin.display(description="Playlists")
    def related_playlists(self, obj):
        if not obj.pk:
            return "—"
        playlists = list(obj.playlist_set.all()[:20])
        if not playlists:
            return "—"
        links = [admin_change_link(playlist, playlist.title) for playlist in playlists]
        extra = obj.playlist_set.count() - len(playlists)
        result = join_links(links)
        if extra > 0:
            return format_html("{} (+{} more)", result, extra)
        return result

    @admin.display(description="Trim requests")
    def related_trim_requests(self, obj):
        if not obj.pk:
            return "—"
        count = obj.trim_requests.count()
        return admin_changelist_link(VideoTrimRequest, f"View {count} trim request(s)", media__id__exact=obj.pk)

    @admin.display(description="Transcription requests")
    def related_transcription_requests(self, obj):
        if not obj.pk:
            return "—"
        count = obj.transcriptionrequests.count()
        return admin_changelist_link(TranscriptionRequest, f"View {count} transcription request(s)", media__id__exact=obj.pk)

    @admin.display(description="Captions")
    def related_captions(self, obj):
        if not obj.pk:
            return "—"
        count = obj.subtitles.count()
        return admin_changelist_link(Subtitle, f"View {count} caption(s)", media__id__exact=obj.pk)

    def has_clear_reports_permission(self, request):
        return is_mediacms_editor(request.user)

    def has_delete_original_permission(self, request):
        return is_mediacms_editor(request.user)

    def _media_action_queryset(self, request, queryset):
        """Re-resolve selected media when confirming an intermediate action."""
        if "apply" in request.POST:
            pks = request.POST.getlist("_selected_action")
            return self.model.objects.filter(pk__in=pks)
        return queryset

    def _intermediate_action_context(self, request, queryset, title, action_name, extra=None):
        media_items = list(queryset)
        opts = self.model._meta
        if len(media_items) == 1:
            cancel_url = reverse(f"admin:{opts.app_label}_{opts.model_name}_change", args=[media_items[0].pk])
        else:
            cancel_url = reverse(f"admin:{opts.app_label}_{opts.model_name}_changelist")
        context = {
            **self.admin_site.each_context(request),
            "title": title,
            "opts": opts,
            "media_items": media_items,
            "action_name": action_name,
            "queryset": queryset,
            "action_checkbox_name": admin.helpers.ACTION_CHECKBOX_NAME,
            "cancel_url": cancel_url,
        }
        if extra:
            context.update(extra)
        return context

    @admin.action(description="Generate missing encodings", permissions=["change"])
    def generate_missing_encodings(self, request, queryset):
        queued = 0
        skipped = 0
        for m in queryset:
            if not media_has_original_file(m):
                skipped += 1
                continue
            m.encode(force=False)
            queued += 1
        self.message_user(
            request,
            f"Queued missing encodings for {queued} media item(s); skipped {skipped} without an original file.",
            messages.SUCCESS if queued else messages.WARNING,
        )

    @admin.action(description="Force re-encode", permissions=["change"])
    def force_reencode(self, request, queryset):
        queued = 0
        skipped = 0
        for m in queryset:
            if m.media_type not in ("video", "audio") or not media_has_original_file(m):
                skipped += 1
                continue
            m.encode(force=True)
            queued += 1
        self.message_user(
            request,
            f"Queued force re-encode for {queued} media item(s); skipped {skipped}.",
            messages.SUCCESS if queued else messages.WARNING,
        )

    def _queue_preview_encode(self, media):
        profile = EncodeProfile.objects.filter(name=PREVIEW_PROFILE_NAME, active=True).first()
        if not profile:
            return False
        media.encode(profiles=[profile], force=True, chunkize=False)
        return True

    @admin.action(description="Regenerate thumbnails", permissions=["change"])
    def regenerate_thumbnails(self, request, queryset):
        done = 0
        skipped = 0
        for m in queryset:
            if not media_has_original_file(m):
                skipped += 1
                continue
            try:
                m.set_thumbnail(force=True)
                done += 1
            except Exception:
                skipped += 1
        self.message_user(
            request,
            f"Regenerated thumbnails for {done} media item(s); skipped {skipped}.",
            messages.SUCCESS if done else messages.WARNING,
        )

    @admin.action(description="Regenerate sprites", permissions=["change"])
    def regenerate_sprites(self, request, queryset):
        done = 0
        skipped = 0
        for m in queryset:
            if m.media_type != "video" or not media_has_original_file(m):
                skipped += 1
                continue
            m.produce_sprite_from_video()
            done += 1
        self.message_user(
            request,
            f"Queued sprite regeneration for {done} media item(s); skipped {skipped}.",
            messages.SUCCESS if done else messages.WARNING,
        )

    @admin.action(description="Regenerate preview", permissions=["change"])
    def regenerate_preview(self, request, queryset):
        done = 0
        skipped = 0
        for m in queryset:
            if m.media_type != "video" or not media_has_original_file(m):
                skipped += 1
                continue
            if self._queue_preview_encode(m):
                done += 1
            else:
                skipped += 1
        self.message_user(
            request,
            f"Queued preview regeneration for {done} media item(s); skipped {skipped}.",
            messages.SUCCESS if done else messages.WARNING,
        )

    @admin.action(description="Regenerate HLS", permissions=["change"])
    def regenerate_hls(self, request, queryset):
        from files.tasks import create_hls

        done = 0
        skipped = 0
        for m in queryset:
            if m.media_type != "video":
                skipped += 1
                continue
            create_hls.delay(m.friendly_token)
            done += 1
        self.message_user(
            request,
            f"Queued HLS regeneration for {done} media item(s); skipped {skipped}.",
            messages.SUCCESS if done else messages.WARNING,
        )

    @admin.action(description="Refresh all derivatives", permissions=["change"])
    def refresh_derivatives(self, request, queryset):
        from files.tasks import create_hls

        done = 0
        skipped = 0
        for m in queryset:
            if m.media_type not in ("video", "audio", "image") or not media_has_original_file(m):
                skipped += 1
                continue
            try:
                m.set_thumbnail(force=True)
            except Exception:
                pass
            if m.media_type == "video":
                m.produce_sprite_from_video()
                self._queue_preview_encode(m)
                create_hls.delay(m.friendly_token)
            done += 1
        self.message_user(
            request,
            f"Queued derivative refresh for {done} media item(s); skipped {skipped}.",
            messages.SUCCESS if done else messages.WARNING,
        )

    def save_model(self, request, obj, form, change):
        previous_reviewed = None
        if change and obj.pk:
            previous_reviewed = Media.objects.filter(pk=obj.pk).values_list("is_reviewed", flat=True).first()
        super().save_model(request, obj, form, change)
        if change and previous_reviewed is not None and previous_reviewed != obj.is_reviewed:
            record_moderation_action(
                request.user,
                obj,
                "media_reviewed" if obj.is_reviewed else "media_unreviewed",
            )

    @admin.action(description="Mark as reviewed", permissions=["change"])
    def mark_as_reviewed(self, request, queryset):
        count = 0
        for media in queryset:
            if set_media_reviewed(media, True, user=request.user):
                count += 1
        self.message_user(request, f"Marked {count} media item(s) as reviewed.", messages.SUCCESS)

    @admin.action(description="Mark as not reviewed", permissions=["change"])
    def mark_as_unreviewed(self, request, queryset):
        count = 0
        for media in queryset:
            if set_media_reviewed(media, False, user=request.user):
                count += 1
        self.message_user(request, f"Marked {count} media item(s) as not reviewed.", messages.SUCCESS)

    @admin.action(description="Clear reports", permissions=["clear_reports"])
    def clear_reports(self, request, queryset):
        count = clear_media_reports(queryset, user=request.user)
        self.message_user(request, f"Cleared reports for {count} media item(s).", messages.SUCCESS)

    @admin.action(description="Confirm reports and set private", permissions=["change"])
    def confirm_reports_set_private(self, request, queryset):
        count = confirm_media_reports(queryset, user=request.user)
        self.message_user(
            request,
            f"Confirmed reports for {count} media item(s) by setting state to private (reports kept).",
            messages.SUCCESS,
        )

    @admin.action(description="Clear reports and keep private", permissions=["clear_reports"])
    def clear_reports_keep_private(self, request, queryset):
        cleared = clear_media_reports(queryset, user=request.user)
        for media in queryset:
            media.state = "private"
            media.save()
        self.message_user(
            request,
            f"Cleared reports for {cleared} media item(s) and kept/set private.",
            messages.SUCCESS,
        )

    @admin.action(description="Clear reports and set public", permissions=["clear_reports"])
    def clear_reports_set_public(self, request, queryset):
        cleared = clear_media_reports(queryset, user=request.user)
        for media in queryset:
            media.state = "public"
            media.save()
        self.message_user(
            request,
            f"Cleared reports for {cleared} media item(s) and set public.",
            messages.SUCCESS,
        )

    @admin.action(description="Set public", permissions=["change"])
    def set_state_public(self, request, queryset):
        count = 0
        for media in queryset:
            media.state = "public"
            media.save()
            count += 1
        self.message_user(request, f"Set {count} media item(s) to public.", messages.SUCCESS)

    @admin.action(description="Set private", permissions=["change"])
    def set_state_private(self, request, queryset):
        count = 0
        for media in queryset:
            media.state = "private"
            media.save()
            count += 1
        self.message_user(request, f"Set {count} media item(s) to private.", messages.SUCCESS)

    @admin.action(description="Set unlisted", permissions=["change"])
    def set_state_unlisted(self, request, queryset):
        count = 0
        for media in queryset:
            media.state = "unlisted"
            media.save()
            count += 1
        self.message_user(request, f"Set {count} media item(s) to unlisted.", messages.SUCCESS)

    @admin.action(description="Enable download", permissions=["change"])
    def enable_download(self, request, queryset):
        updated = queryset.update(allow_download=True)
        self.message_user(request, f"Enabled download for {updated} media item(s).", messages.SUCCESS)

    @admin.action(description="Disable download", permissions=["change"])
    def disable_download(self, request, queryset):
        updated = queryset.update(allow_download=False)
        self.message_user(request, f"Disabled download for {updated} media item(s).", messages.SUCCESS)

    @admin.action(description="Enable comments", permissions=["change"])
    def enable_comments(self, request, queryset):
        updated = queryset.update(enable_comments=True)
        self.message_user(request, f"Enabled comments for {updated} media item(s).", messages.SUCCESS)

    @admin.action(description="Disable comments", permissions=["change"])
    def disable_comments(self, request, queryset):
        updated = queryset.update(enable_comments=False)
        self.message_user(request, f"Disabled comments for {updated} media item(s).", messages.SUCCESS)

    @admin.action(description="Feature", permissions=["change"])
    def feature_selected(self, request, queryset):
        updated = queryset.update(featured=True)
        self.message_user(request, f"Featured {updated} media item(s).", messages.SUCCESS)

    @admin.action(description="Unfeature", permissions=["change"])
    def unfeature_selected(self, request, queryset):
        updated = queryset.update(featured=False)
        self.message_user(request, f"Unfeatured {updated} media item(s).", messages.SUCCESS)

    @admin.action(description="Delete original file", permissions=["delete_original"])
    def delete_original_media_files(self, request, queryset):
        queryset = self._media_action_queryset(request, queryset)
        eligible = []
        blocked = []
        for media in queryset:
            ok, reason = can_delete_original_media_file(media)
            if ok:
                eligible.append(media)
            else:
                blocked.append({"media": media, "reason": reason})

        expected_tokens = [media.friendly_token for media in eligible]

        if "apply" in request.POST:
            confirmation = (request.POST.get("confirmation_text") or "").strip()
            entered_tokens = {line.strip() for line in confirmation.splitlines() if line.strip()}
            if entered_tokens != set(expected_tokens):
                self.message_user(request, "The media ID does not match. Enter the exact media ID.", messages.ERROR)
            elif not eligible:
                self.message_user(request, "No media can be deleted. Change the selection and try again.", messages.ERROR)
            else:
                deleted = 0
                failed = 0
                for media in eligible:
                    ok, _reason = delete_original_media_file(media, user=request.user)
                    if ok:
                        deleted += 1
                    else:
                        failed += 1
                self.message_user(
                    request,
                    f"Deleted original file for {deleted} media item(s); blocked/failed {failed + len(blocked)}.",
                    messages.SUCCESS if deleted else messages.WARNING,
                )
                return None

            # Fall through to re-show confirmation after bad phrase / empty eligible

        context = self._intermediate_action_context(
            request,
            queryset,
            "Delete original media files",
            "delete_original_media_files",
            extra={
                "eligible": eligible,
                "blocked": blocked,
                "can_confirm": bool(eligible),
                "expected_tokens": expected_tokens,
            },
        )
        return TemplateResponse(request, "admin/files/media/delete_original_confirmation.html", context)

    @admin.action(description="Change owner", permissions=["change"])
    def change_owner(self, request, queryset):
        queryset = self._media_action_queryset(request, queryset)

        if "apply" in request.POST:
            username = (request.POST.get("new_owner") or "").strip()
            new_user = User.objects.filter(username=username).first() if username else None
            if not new_user:
                self.message_user(request, "Enter a valid username for the new owner.", messages.ERROR)
            else:
                changed = 0
                for media in queryset:
                    if change_media_owner(media.id, new_user):
                        changed += 1
                self.message_user(request, f"Changed owner to {new_user.username} for {changed} media item(s).", messages.SUCCESS)
                return None

        context = self._intermediate_action_context(
            request,
            queryset,
            "Change media owner",
            "change_owner",
            extra={"new_owner": request.POST.get("new_owner", "")},
        )
        return TemplateResponse(request, "admin/files/media/change_owner_confirmation.html", context)

    actions = [
        generate_missing_encodings,
        force_reencode,
        regenerate_thumbnails,
        regenerate_sprites,
        regenerate_preview,
        regenerate_hls,
        refresh_derivatives,
        mark_as_reviewed,
        mark_as_unreviewed,
        clear_reports,
        confirm_reports_set_private,
        clear_reports_keep_private,
        clear_reports_set_public,
        set_state_public,
        set_state_private,
        set_state_unlisted,
        enable_download,
        disable_download,
        enable_comments,
        disable_comments,
        feature_selected,
        unfeature_selected,
        delete_original_media_files,
        change_owner,
    ]


class CategoryAdminForm(forms.ModelForm):
    rbac_groups = forms.ModelMultipleChoiceField(queryset=RBACGroup.objects.all(), required=False, widget=admin.widgets.FilteredSelectMultiple('Groups', False))

    class Meta:
        model = Category
        # LTI fields will be shown as read-only when USE_LTI is enabled
        fields = '__all__'

    def clean(self):
        cleaned_data = super().clean()
        is_rbac_category = cleaned_data.get('is_rbac_category')
        identity_provider = cleaned_data.get('identity_provider')
        # Check if this category has any RBAC groups
        if self.instance.pk:
            has_rbac_groups = cleaned_data.get('rbac_groups')
        else:
            has_rbac_groups = False

        if not is_rbac_category:
            if has_rbac_groups:
                cleaned_data['is_rbac_category'] = True
                # self.add_error('is_rbac_category', ValidationError('This category has RBAC groups assigned. "Is RBAC Category" must be enabled.'))

        for rbac_group in cleaned_data.get('rbac_groups'):
            if rbac_group.identity_provider != identity_provider:
                self.add_error('rbac_groups', ValidationError('Chosen Groups are associated with a different Identity Provider than the one selected here.'))

        return cleaned_data

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if self.instance.pk:
            self.fields['rbac_groups'].initial = self.instance.rbac_groups.all()

    def save(self, commit=True):
        category = super().save(commit=True)

        if commit:
            self.save_m2m()

        if self.instance.rbac_groups.exists() or self.cleaned_data.get('rbac_groups'):
            if not self.cleaned_data['is_rbac_category']:
                category.is_rbac_category = True
                category.save(update_fields=['is_rbac_category'])
        return category

    @transaction.atomic
    def save_m2m(self):
        if self.instance.pk:
            rbac_groups = self.cleaned_data['rbac_groups']
            self._update_rbac_groups(rbac_groups)

    def _update_rbac_groups(self, rbac_groups):
        new_rbac_group_ids = RBACGroup.objects.filter(pk__in=rbac_groups).values_list('pk', flat=True)

        existing_rbac_groups = RBACGroup.objects.filter(categories=self.instance)
        existing_rbac_groups_ids = existing_rbac_groups.values_list('pk', flat=True)

        rbac_groups_to_add = RBACGroup.objects.filter(pk__in=new_rbac_group_ids).exclude(pk__in=existing_rbac_groups_ids)
        rbac_groups_to_remove = existing_rbac_groups.exclude(pk__in=new_rbac_group_ids)

        for rbac_group in rbac_groups_to_add:
            rbac_group.categories.add(self.instance)

        for rbac_group in rbac_groups_to_remove:
            rbac_group.categories.remove(self.instance)


class CategoryAdmin(admin.ModelAdmin):
    form = CategoryAdminForm

    search_fields = ["title", "uid"]
    list_display = ["title", "user", "related_media_count"]
    list_filter = []
    ordering = ("-add_date",)
    readonly_fields = ("user", "related_media", "lti_platform", "lti_context_id")
    inlines = [CategoryMediaInline]
    change_form_template = 'admin/files/category/change_form.html'

    def get_list_filter(self, request):
        list_filter = list(self.list_filter)

        if getattr(settings, 'USE_RBAC', False):
            list_filter.insert(0, "is_rbac_category")
        if getattr(settings, 'USE_IDENTITY_PROVIDERS', False):
            list_filter.insert(-1, "identity_provider")
        if getattr(settings, 'USE_LTI', False):
            list_filter.append("is_lms_course")

        return list_filter

    def get_list_display(self, request):
        list_display = list(self.list_display)
        if getattr(settings, 'USE_RBAC', False):
            list_display.insert(-1, "is_rbac_category")
        if getattr(settings, 'USE_IDENTITY_PROVIDERS', False):
            list_display.insert(-1, "identity_provider")
        if getattr(settings, 'USE_LTI', False):
            list_display.insert(-1, "is_lms_course")

        return list_display

    def get_fieldsets(self, request, obj=None):
        fieldsets = [
            (
                "General",
                {
                    "fields": ("uid", "title", "description", "user", "thumbnail", "listings_thumbnail"),
                    "classes": ("tab",),
                },
            ),
        ]

        if getattr(settings, "USE_LTI", False):
            fieldsets.append(
                (
                    "LTI Integration",
                    {
                        "fields": ("lti_platform", "lti_context_id"),
                        "classes": ("tab",),
                        "description": "LTI/LMS integration settings (automatically managed by LTI provisioning)",
                    },
                )
            )

        if getattr(settings, "USE_RBAC", False):
            rbac_fields = ["is_rbac_category"]
            if getattr(settings, "USE_IDENTITY_PROVIDERS", False):
                rbac_fields.append("identity_provider")
            fieldsets.extend(
                [
                    (
                        "RBAC Settings",
                        {
                            "fields": tuple(rbac_fields),
                            "classes": ("tab",),
                            "description": "Role-Based Access Control settings",
                        },
                    ),
                    (
                        "Group Access",
                        {
                            "fields": ("rbac_groups",),
                            "classes": ("tab",),
                            "description": "Select the Groups that have access to category",
                        },
                    ),
                ]
            )

        fieldsets.append(
            (
                "Related",
                {
                    "fields": ("related_media",),
                    "classes": ("tab", "related-links-tab"),
                    "description": "Links to filtered admin lists for related records. Media items are listed on the following tab.",
                },
            )
        )
        return fieldsets

    @admin.display(description="Media")
    def related_media(self, obj):
        if not obj.pk:
            return "—"
        count = obj.media_count if obj.media_count is not None else Media.objects.filter(category=obj).count()
        return admin_changelist_link(Media, f"View {count} media item(s)", category__id__exact=obj.pk)

    @admin.display(description="Media count", ordering="media_count")
    def related_media_count(self, obj):
        count = obj.media_count if obj.media_count is not None else Media.objects.filter(category=obj).count()
        return admin_changelist_link(Media, str(count), category__id__exact=obj.pk)


class TagAdmin(admin.ModelAdmin):
    search_fields = ["title"]
    list_display = ["title", "link_user", "related_media_count"]
    list_select_related = ("user",)
    readonly_fields = ("link_user", "related_media")
    inlines = [TagMediaInline]
    fieldsets = (
        (
            "General",
            {
                "fields": ("title", "link_user", "listings_thumbnail"),
                "classes": ("tab",),
            },
        ),
        (
            "Related",
            {
                "fields": ("related_media",),
                "classes": ("tab", "related-links-tab"),
                "description": "Links to filtered admin lists for related records. Media items are listed on the following tab.",
            },
        ),
    )

    def get_queryset(self, request):
        # Total tagged media (not the public/reviewed-only media_count field).
        return super().get_queryset(request).annotate(_media_total=Count("media"))

    def _media_total(self, obj):
        if hasattr(obj, "_media_total"):
            return obj._media_total
        if not obj.pk:
            return 0
        return Media.objects.filter(tags=obj).count()

    @admin.display(description="User", ordering="user__username")
    def link_user(self, obj):
        return admin_change_link(obj.user, obj.user.username if obj.user_id else None)

    @admin.display(description="Media")
    def related_media(self, obj):
        if not obj.pk:
            return "—"
        count = self._media_total(obj)
        return admin_changelist_link(Media, f"View {count} media item(s)", tags__id__exact=obj.pk)

    @admin.display(description="Media count", ordering="_media_total")
    def related_media_count(self, obj):
        return admin_changelist_link(Media, str(self._media_total(obj)), tags__id__exact=obj.pk)


class EncodeProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "extension", "resolution", "codec", "description", "active")
    list_editable = ("active",)
    list_filter = ["extension", "resolution", "codec", "active"]
    search_fields = ["name", "extension", "resolution", "codec", "description"]
    ordering = ("-active", "resolution", "name")
    list_per_page = 100
    fieldsets = (
        (
            "General",
            {
                "fields": ("name", "extension", "resolution", "codec", "description", "active"),
                "classes": ("tab",),
            },
        ),
    )


class LanguageAdmin(admin.ModelAdmin):
    list_display = ["title", "code", "related_captions_count"]
    search_fields = ["title", "code"]
    ordering = ("title",)
    readonly_fields = ("related_captions",)
    inlines = [LanguageCaptionInline]
    fieldsets = (
        (
            "General",
            {
                "fields": ("title", "code"),
                "classes": ("tab",),
            },
        ),
        (
            "Related",
            {
                "fields": ("related_captions",),
                "classes": ("tab", "related-links-tab"),
                "description": "Links to filtered admin lists for related records. Captions are listed on the following tab.",
            },
        ),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_captions_count=Count("subtitle"))

    @admin.display(description="Captions")
    def related_captions(self, obj):
        if not obj.pk:
            return "—"
        count = getattr(obj, "_captions_count", obj.subtitle_set.count())
        return admin_changelist_link(Subtitle, f"View {count} caption(s)", language__id__exact=obj.pk)

    @admin.display(description="Captions", ordering="_captions_count")
    def related_captions_count(self, obj):
        count = getattr(obj, "_captions_count", obj.subtitle_set.count())
        return admin_changelist_link(Subtitle, str(count), language__id__exact=obj.pk)


class SubtitleAdmin(admin.ModelAdmin):
    list_display = ["id", "link_language", "link_media", "link_user"]
    list_filter = ["language", ("media", admin.RelatedOnlyFieldListFilter)]
    search_fields = ["media__title", "user__username"]
    list_select_related = ("media", "user", "language")
    readonly_fields = ("link_language", "link_media", "link_user")
    exclude = ("media", "user", "language")
    fieldsets = (
        (
            "Caption",
            {
                "fields": ("subtitle_file",),
                "classes": ("tab",),
            },
        ),
        (
            "Related",
            {
                "fields": ("link_language", "link_media", "link_user"),
                "classes": ("tab", "related-links-tab"),
            },
        ),
    )

    @admin.display(description="Language", ordering="language__title")
    def link_language(self, obj):
        return admin_change_link(obj.language, obj.language.title if obj.language_id else None)

    @admin.display(description="Media", ordering="media__title")
    def link_media(self, obj):
        return admin_change_link(obj.media, obj.media.title if obj.media_id else None)

    @admin.display(description="User", ordering="user__username")
    def link_user(self, obj):
        return admin_change_link(obj.user, obj.user.username if obj.user_id else None)


class VideoTrimRequestAdmin(admin.ModelAdmin):
    list_display = ["id", "link_media", "status", "add_date", "video_action", "media_trim_style"]
    list_display_links = ("id", "status")
    list_filter = ["status", "video_action", "media_trim_style", "add_date", ("media", admin.RelatedOnlyFieldListFilter)]
    search_fields = ["media__title"]
    list_select_related = ("media",)
    autocomplete_fields = ("media",)
    readonly_fields = ("add_date", "link_media")
    ordering = ("-add_date",)
    fieldsets = (
        (
            "Trim request",
            {
                "fields": ("status", "video_action", "media_trim_style", "timestamps", "add_date"),
                "classes": ("tab",),
            },
        ),
        (
            "Related",
            {
                "fields": ("link_media", "media"),
                "classes": ("tab", "related-links-tab"),
            },
        ),
    )

    @admin.display(description="Media", ordering="media__title")
    def link_media(self, obj):
        return admin_change_link(obj.media, obj.media.title if obj.media_id else None)


class EncodingAdmin(admin.ModelAdmin):
    list_display = ["get_title", "link_media", "chunk", "profile", "progress", "status", "has_file"]
    list_filter = ["chunk", "profile", "status", ("media", admin.RelatedOnlyFieldListFilter)]
    search_fields = ["media__title", "media__friendly_token"]
    list_select_related = ("media", "profile")
    readonly_fields = ("link_media", "has_file")
    actions = ["retry_failed_encodings"]
    action_form = GroupedActionForm
    action_groups = [
        ["retry_failed_encodings"],
        ["delete_selected"],
    ]
    fieldsets = (
        (
            "Encoding",
            {
                "fields": ("profile", "status", "progress", "chunk", "has_file"),
                "classes": ("tab",),
            },
        ),
        (
            "Related",
            {
                "fields": ("link_media", "media"),
                "classes": ("tab", "related-links-tab"),
            },
        ),
    )

    def get_action_choices(self, request, default_choices=None):
        return build_grouped_action_choices(self.get_actions(request), self.action_groups, opts=self.opts)

    @admin.display(description="Encoding", ordering="media__title")
    def get_title(self, obj):
        return str(obj)

    @admin.display(description="Media", ordering="media__title")
    def link_media(self, obj):
        return admin_change_link(obj.media, obj.media.title if obj.media_id else None)

    @admin.display(description="Has file", boolean=True)
    def has_file(self, obj):
        return obj.media_encoding_url is not None

    @admin.action(description="Retry failed encodings", permissions=["change"])
    def retry_failed_encodings(self, request, queryset):
        queued = 0
        skipped = 0
        for encoding in queryset.select_related("media", "profile"):
            if encoding.status != "fail":
                skipped += 1
                continue
            media = encoding.media
            if not media or not media_has_original_file(media):
                skipped += 1
                continue
            media.encode(profiles=[encoding.profile], force=True, chunkize=False)
            queued += 1
        self.message_user(
            request,
            f"Queued retry for {queued} failed encoding(s); skipped {skipped}.",
            messages.SUCCESS if queued else messages.WARNING,
        )


class TranscriptionRequestAdmin(admin.ModelAdmin):
    list_display = ["id", "link_media", "status", "translate_to_english", "add_date"]
    list_display_links = ("id", "link_media")
    list_filter = ["status", "translate_to_english", "add_date", ("media", admin.RelatedOnlyFieldListFilter)]
    search_fields = ["media__title", "logs"]
    list_select_related = ("media",)
    readonly_fields = ("add_date", "link_media")
    ordering = ("-add_date",)
    fieldsets = (
        (
            "Caption request",
            {
                "fields": ("status", "translate_to_english", "logs", "add_date"),
                "classes": ("tab",),
            },
        ),
        (
            "Related",
            {
                "fields": ("link_media", "media"),
                "classes": ("tab", "related-links-tab"),
            },
        ),
    )

    @admin.display(description="Media", ordering="media__title")
    def link_media(self, obj):
        return admin_change_link(obj.media, obj.media.title if obj.media_id else None)


class PageAdminForm(forms.ModelForm):
    description = forms.CharField(widget=TinyMCE())

    def clean_description(self):
        content = self.cleaned_data['description']
        # Add sandbox attribute to all iframes
        content = content.replace('<iframe ', '<iframe sandbox="allow-scripts allow-same-origin allow-presentation" ')
        return content

    class Meta:
        model = Page
        fields = "__all__"


class PageAdmin(admin.ModelAdmin):
    form = PageAdminForm
    search_fields = ["title", "slug"]
    list_display = ["title", "link_slug", "page_url"]
    list_display_links = ("title",)
    ordering = ("title",)
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = ("add_date", "edit_date", "link_slug", "page_url")
    fieldsets = (
        (
            "Page",
            {
                "fields": ("title", "slug", "description", "add_date", "edit_date"),
                "classes": ("tab",),
            },
        ),
        (
            "Related",
            {
                "fields": ("link_slug", "page_url"),
                "classes": ("tab", "related-links-tab"),
                "description": "Live site links for this page.",
            },
        ),
    )

    @admin.display(description="Slug", ordering="slug")
    def link_slug(self, obj):
        if not obj or not obj.slug:
            return "—"
        return format_html('<a href="{}" target="_blank" rel="noopener noreferrer">{}</a>', obj.get_absolute_url(), obj.slug)

    @admin.display(description="Page URL")
    def page_url(self, obj):
        if not obj or not obj.slug:
            return "—"
        url = f"{settings.SSL_FRONTEND_HOST.rstrip('/')}{obj.get_absolute_url()}"
        return format_html('<a href="{0}" target="_blank" rel="noopener noreferrer">{0}</a>', url)


class PlaylistAdmin(admin.ModelAdmin):
    search_fields = ["title", "friendly_token", "user__username"]
    list_display = ["title", "link_user", "add_date", "friendly_token", "related_media_count"]
    list_select_related = ("user",)
    list_filter = ["add_date", ("user", admin.RelatedOnlyFieldListFilter)]
    ordering = ("-add_date",)
    date_hierarchy = "add_date"
    readonly_fields = ("uid", "friendly_token", "link_user", "related_media")
    exclude = ("user",)
    inlines = [PlaylistMediaInline]
    fieldsets = (
        (
            "Playlist",
            {
                "fields": ("title", "description", "link_user", "friendly_token", "uid"),
                "classes": ("tab",),
            },
        ),
        (
            "Related",
            {
                "fields": ("related_media",),
                "classes": ("tab", "related-links-tab"),
                "description": "Links to filtered admin lists for related records. Media items are listed on the following tab.",
            },
        ),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_media_count=Count("media"))

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        # Inline deletes leave gaps in ordering; keep remaining media sequential.
        form.instance.resequence_media()

    @admin.display(description="User", ordering="user__username")
    def link_user(self, obj):
        return admin_change_link(obj.user, obj.user.username if obj.user_id else None)

    @admin.display(description="Media")
    def related_media(self, obj):
        if not obj.pk:
            return "—"
        count = getattr(obj, "_media_count", obj.media.count())
        return admin_changelist_link(Media, f"View {count} media item(s)", playlist__id__exact=obj.pk)

    @admin.display(description="Media count", ordering="_media_count")
    def related_media_count(self, obj):
        count = getattr(obj, "_media_count", obj.media.count())
        return admin_changelist_link(Media, str(count), playlist__id__exact=obj.pk)


class MediaPermissionAdmin(admin.ModelAdmin):
    list_display = ["id", "link_media", "link_user", "link_owner", "permission", "source", "created_at"]
    list_display_links = ("id", "link_media")
    list_filter = ["permission", "source", ("media", admin.RelatedOnlyFieldListFilter)]
    search_fields = ["media__title", "user__username", "owner_user__username"]
    list_select_related = ("media", "user", "owner_user")
    autocomplete_fields = ("media", "user", "owner_user")
    readonly_fields = ("created_at", "link_media", "link_user", "link_owner")
    ordering = ("-created_at",)
    fieldsets = (
        (
            "Permission",
            {
                "fields": ("permission", "source", "created_at"),
                "classes": ("tab",),
            },
        ),
        (
            "Related",
            {
                "fields": ("link_media", "media", "link_user", "user", "link_owner", "owner_user"),
                "classes": ("tab", "related-links-tab"),
            },
        ),
    )

    @admin.display(description="Media", ordering="media__title")
    def link_media(self, obj):
        return admin_change_link(obj.media, obj.media.title if obj.media_id else None)

    @admin.display(description="User", ordering="user__username")
    def link_user(self, obj):
        return admin_change_link(obj.user, obj.user.username if obj.user_id else None)

    @admin.display(description="Owner", ordering="owner_user__username")
    def link_owner(self, obj):
        return admin_change_link(obj.owner_user, obj.owner_user.username if obj.owner_user_id else None)


class LicenseAdmin(admin.ModelAdmin):
    search_fields = ["title", "description"]
    list_display = ["title", "related_media_count"]
    readonly_fields = ("related_media",)
    ordering = ("title",)
    inlines = [LicenseMediaInline]
    fieldsets = (
        (
            "General",
            {
                "fields": ("title", "description"),
                "classes": ("tab",),
            },
        ),
        (
            "Related",
            {
                "fields": ("related_media",),
                "classes": ("tab", "related-links-tab"),
                "description": "Links to filtered admin lists for related records. Media items are listed on the following tab.",
            },
        ),
    )

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(_media_count=Count("media"))

    @admin.display(description="Media")
    def related_media(self, obj):
        if not obj.pk:
            return "—"
        count = getattr(obj, "_media_count", Media.objects.filter(license=obj).count())
        return admin_changelist_link(Media, f"View {count} media item(s)", license__id__exact=obj.pk)

    @admin.display(description="Media count", ordering="_media_count")
    def related_media_count(self, obj):
        count = getattr(obj, "_media_count", Media.objects.filter(license=obj).count())
        return admin_changelist_link(Media, str(count), license__id__exact=obj.pk)


@admin.register(TinyMCEMedia)
class TinyMCEMediaAdmin(admin.ModelAdmin):
    list_display = ["original_filename", "file_type", "link_user"]
    list_filter = ["file_type", "uploaded_at"]
    list_select_related = ("user",)
    search_fields = ["original_filename", "user__username"]
    readonly_fields = ["uploaded_at", "link_user"]
    date_hierarchy = "uploaded_at"

    @admin.display(description="User", ordering="user__username")
    def link_user(self, obj):
        return admin_change_link(obj.user, obj.user.username if obj.user_id else None)


admin.site.register(EncodeProfile, EncodeProfileAdmin)
admin.site.register(Comment, CommentAdmin)
admin.site.register(Media, MediaAdmin)
admin.site.register(Encoding, EncodingAdmin)
admin.site.register(Category, CategoryAdmin)
admin.site.register(Page, PageAdmin)
admin.site.register(Tag, TagAdmin)
admin.site.register(Subtitle, SubtitleAdmin)
admin.site.register(Language, LanguageAdmin)
admin.site.register(License, LicenseAdmin)
admin.site.register(VideoTrimRequest, VideoTrimRequestAdmin)
admin.site.register(TranscriptionRequest, TranscriptionRequestAdmin)
admin.site.register(Playlist, PlaylistAdmin)
admin.site.register(MediaPermission, MediaPermissionAdmin)

Media._meta.app_config.verbose_name = "Media"
