import contextvars
import uuid
from io import BytesIO

from django import forms
from django.conf import settings
from django.contrib import admin, messages
from django.contrib.admin.widgets import RelatedFieldWidgetWrapper
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Count
from django.forms.widgets import FILE_INPUT_CONTRADICTION
from django.http import HttpResponseRedirect
from django.template.response import TemplateResponse
from django.urls import reverse
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from django.utils.translation import get_language
from imagekit.processors import ResizeToFit
from PIL import Image
from tinymce.widgets import TinyMCE

from actions.models import MODERATION_MEDIA_ACTIONS, MediaAction
from admin_customizations.action_choices import (
    GroupedActionForm,
    build_grouped_action_choices,
)
from files.admin_helpers import (
    MEDIA_ENCODING_STATUS_ICONS,
    MEDIA_PERMISSION_ICONS,
    MEDIA_PERMISSION_SOURCE_ICONS,
    MEDIA_STATE_STATUS_ICONS,
    MEDIA_TYPE_STATUS_ICONS,
    REPORT_ACTION_ICONS,
    TRIM_ACTION_ICONS,
    TRIM_STATUS_ICONS,
    TRIM_STYLE_ICONS,
    OpenOnSiteMixin,
    OptionalColumnsMixin,
    TranslateChoiceLabelsMixin,
    TranslateManyToManyHelpMixin,
    admin_change_link,
    admin_change_url,
    admin_copy_value,
    admin_inspect_link,
    admin_changelist_link,
    admin_changelist_url,
    admin_inspect_id,
    admin_open_on_site_link,
    admin_relation_link,
    admin_status_icon,
    admin_text,
    clipped_admin_text,
    translated_choice_display,
)
from files.frontend_translations import translate_string
from files.helpers import show_file_size
from files.integrity import (
    INTEGRITY_CHECKS,
    INTEGRITY_FILTER_PARAM,
    get_integrity_check,
)
from files.metadata_integrity import (
    MISSING_METADATA_FILTER_PARAM,
    qs_missing_media_metadata,
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
    Subtitle,
    Tag,
    TinyMCEMedia,
    TranscriptionRequest,
    VideoTrimRequest,
)

# Set for the duration of a media change form so object links can show Edit or Inspect.
_media_change_request = contextvars.ContextVar("media_change_request", default=None)


class ImageDropzoneWidget(forms.ClearableFileInput):
    template_name = "admin/widgets/image_dropzone.html"


class FileDropzoneWidget(forms.ClearableFileInput):
    template_name = "admin/widgets/file_dropzone.html"


class ListingsThumbnailUrlWidget(forms.TextInput):
    """Text control for a listings image address, with a preview when it is a URL or path."""

    template_name = "admin/widgets/listings_thumbnail_url.html"

    def get_context(self, name, value, attrs):
        context = super().get_context(name, value, attrs)
        text = value.strip() if isinstance(value, str) else ""
        preview = text if text.startswith(("http://", "https://", "/")) else ""
        context["widget"]["preview_url"] = preview
        return context


class ListingsThumbnailWidget(forms.ClearableFileInput):
    """File dropzone whose current value is a stored image URL."""

    template_name = "admin/widgets/listings_thumbnail.html"

    def __init__(self, attrs=None):
        super().__init__({"accept": "image/*", **(attrs or {})})

    def get_context(self, name, value, attrs):
        context = super().get_context(name, value, attrs)
        preview = ""
        if isinstance(value, str):
            preview = value
        elif getattr(value, "url", None):
            preview = value.url
        context["widget"]["preview_url"] = preview
        context["widget"]["is_initial"] = bool(preview)
        return context


def store_listings_thumbnail(uploaded):
    """Resize an uploaded listing image and return its media URL."""
    image = ResizeToFit(width=344, height=None).process(Image.open(uploaded))
    if image.mode != "RGB":
        image = image.convert("RGB")
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=85)
    filename = f"{settings.MEDIA_UPLOAD_DIR}tags/{uuid.uuid4().hex}.jpg"
    saved = default_storage.save(filename, ContentFile(buffer.getvalue()))
    return default_storage.url(saved)


class ListingsThumbnailFormField(forms.ImageField):
    """Upload replaces the stored URL. Leaving the control alone keeps it."""

    widget = ListingsThumbnailWidget

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("required", False)
        super().__init__(*args, **kwargs)

    def has_changed(self, initial, data):
        return data not in (None, "")

    def bound_data(self, data, initial):
        if data in (None, ""):
            return initial
        return data

    def clean(self, data, initial=None):
        if data is FILE_INPUT_CONTRADICTION:
            raise ValidationError(self.error_messages["contradiction"], code="contradiction")
        if data is False:
            return None
        if not data:
            return initial or None
        uploaded = super().clean(data)
        return store_listings_thumbnail(uploaded)


def format_thumbnail_clock(seconds):
    """Seconds as a zero-padded clock with one decimal: 00:01:05.0."""
    if seconds in (None, ""):
        return ""
    tenths = int(round(float(seconds) * 10))
    if tenths < 0:
        tenths = 0
    whole, frac = divmod(tenths, 10)
    hours, whole = divmod(whole, 3600)
    minutes, secs = divmod(whole, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{frac}"


def parse_thumbnail_clock(value):
    """Clock text or a seconds number. Raises ValueError when it is not a time."""
    text = str(value).strip()
    if not text:
        return None
    if ":" not in text:
        return round(float(text), 1)
    parts = text.split(":")
    if len(parts) < 2 or len(parts) > 3:
        raise ValueError(text)
    seconds = float(parts[-1])
    minutes = int(parts[-2])
    hours = int(parts[0]) if len(parts) == 3 else 0
    if minutes < 0 or minutes > 59 or seconds < 0 or seconds >= 60 or hours < 0:
        raise ValueError(text)
    return round(hours * 3600 + minutes * 60 + seconds, 1)


class ThumbnailTimeWidget(forms.TextInput):
    template_name = "admin/widgets/thumbnail_time.html"

    def __init__(self, duration=0, attrs=None):
        self.duration = duration or 0
        defaults = {
            "placeholder": "00:00:00.0",
            "autocomplete": "off",
            "spellcheck": "false",
            "inputmode": "decimal",
        }
        super().__init__({**defaults, **(attrs or {})})

    def format_value(self, value):
        if value in (None, ""):
            return ""
        try:
            seconds = value if isinstance(value, (int, float)) else parse_thumbnail_clock(value)
        except (TypeError, ValueError):
            return value
        return format_thumbnail_clock(seconds)

    def get_context(self, name, value, attrs):
        context = super().get_context(name, value, attrs)
        context["widget"]["duration"] = self.duration
        return context


class ThumbnailTimeFormField(forms.FloatField):
    def to_python(self, value):
        if value in self.empty_values:
            return None
        try:
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                return round(float(value), 1)
            return parse_thumbnail_clock(value)
        except (TypeError, ValueError):
            raise ValidationError("Enter a time as 00:00:00.0.", code="invalid")


class MediaAdminForm(forms.ModelForm):
    class Meta:
        model = Media
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        field = self.fields.get("thumbnail_time")
        if isinstance(field, ThumbnailTimeFormField):
            field.widget.duration = self.instance.duration or 0
        help_texts = dict(self._meta.help_texts or {})
        help_texts.setdefault("display_listable", "Whether it will appear on listings")
        for name, source in (
            ("display_friendly_token", "friendly_token"),
            ("display_uid", "uid"),
            ("display_md5sum", "md5sum"),
            ("display_media_info", "media_info"),
            ("display_search", "search"),
        ):
            help_text = Media._meta.get_field(source).help_text
            if help_text:
                help_texts.setdefault(name, help_text)
        self._meta.help_texts = help_texts

    def clean_thumbnail_time(self):
        value = self.cleaned_data.get("thumbnail_time")
        if value is None:
            return None
        if value <= 0:
            raise ValidationError("Enter a time greater than 0.")
        duration = self.instance.duration or 0
        if value > duration:
            raise ValidationError(
                "Enter a time no later than the video duration (%(duration)s).",
                params={"duration": format_thumbnail_clock(duration)},
            )
        return value


class LicenseInspectWidgetWrapper(RelatedFieldWidgetWrapper):
    """Related-object wrapper that links the current license for inspection."""

    def get_context(self, name, value, attrs):
        context = super().get_context(name, value, attrs)
        if value not in (None, ""):
            context["license_inspect_url"] = reverse("admin:files_license_change", args=[value])
        return context


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


class IntegrityIssuesFilter(admin.SimpleListFilter):
    title = "Integrity issues"
    parameter_name = INTEGRITY_FILTER_PARAM

    def lookups(self, request, model_admin):
        return tuple((check.id, check.label) for check in INTEGRITY_CHECKS)

    def queryset(self, request, queryset):
        check = get_integrity_check(self.value()) if self.value() else None
        if check is None:
            return queryset
        # Intersect with the canonical check queryset (avoids annotation clashes).
        return queryset.filter(pk__in=check.queryset().values("pk"))


class MissingMetadataFilter(admin.SimpleListFilter):
    title = "Missing metadata"
    parameter_name = MISSING_METADATA_FILTER_PARAM

    def lookups(self, request, model_admin):
        return (("1", "Missing md5sum or size"),)

    def queryset(self, request, queryset):
        if self.value() == "1":
            return queryset.filter(pk__in=qs_missing_media_metadata().values("pk"))
        return queryset


class CommentAdmin(admin.ModelAdmin):
    search_fields = ["text", "user__username", "media__title"]
    list_display = ["add_date", "link_media", "link_user", "display_text"]
    # The text cell draws its own change link beside the open-on-site eye.
    # Django's wrapper would nest those anchors and drop the eye onto a second line.
    list_display_links = None
    list_filter = ["add_date", ("media", admin.RelatedOnlyFieldListFilter), ("user", admin.RelatedOnlyFieldListFilter)]
    list_select_related = ("user", "media")
    ordering = ("-add_date",)
    date_hierarchy = "add_date"
    readonly_fields = (
        "link_user",
        "link_media",
        "parent",
        "add_date",
        "uid",
        "display_user",
        "display_media",
        "display_parent",
        "display_uid",
    )
    exclude = ("media", "user")
    fieldsets = (
        (
            "Comment",
            {
                "fields": ("add_date", "display_user", "display_media", "text", "display_parent", "display_uid"),
                "classes": ("tab",),
            },
        ),
    )

    @admin.display(description="Text", ordering="text")
    def display_text(self, obj):
        text = format_html('<a href="{}">{}</a>', reverse("admin:files_comment_change", args=[obj.pk]), clipped_admin_text(obj.text))
        if not obj.media_id:
            return text
        return format_html(
            '<span class="changelist-text-with-link">{}{}</span>',
            text,
            admin_open_on_site_link(obj.get_absolute_url()),
        )

    @admin.display(description="User", ordering="user__username")
    def link_user(self, obj):
        return admin_change_link(obj.user, obj.user.username if obj.user_id else None)

    @admin.display(description="User")
    def display_user(self, obj):
        if not obj.user_id:
            return "—"
        return admin_inspect_link(obj.user, obj.user.username)

    @admin.display(description="Media", ordering="media__title")
    def link_media(self, obj):
        if not obj.media_id:
            return "—"
        title = obj.media.title
        return format_html(
            '<a href="{}" title="{}">{}</a>',
            admin_change_url(obj.media),
            title,
            clipped_admin_text(title),
        )

    @admin.display(description="Media")
    def display_media(self, obj):
        if not obj.media_id:
            return "—"
        return admin_inspect_link(obj.media, clipped_admin_text(obj.media.title, always_tooltip=True))

    @admin.display(description="Parent")
    def display_parent(self, obj):
        if not obj.parent_id:
            return "—"
        return admin_inspect_link(obj.parent, clipped_admin_text(obj.parent.text, always_tooltip=True))

    @admin.display(description="Uid")
    def display_uid(self, obj):
        return admin_copy_value(obj.uid)


class MediaAdmin(OpenOnSiteMixin, TranslateChoiceLabelsMixin, TranslateManyToManyHelpMixin, admin.ModelAdmin):
    form = MediaAdminForm
    search_fields = ["title", "user__username", "friendly_token"]
    change_form_template = "admin/files/media/change_form.html"
    change_list_template = "admin/files/media/change_list.html"
    # Full column set; get_list_display() hides optional ones unless opted-in or filtered.
    list_display = [
        "add_date",
        "display_title",
        "link_user",
        "display_media_type",
        "display_duration",
        "display_state",
        "is_reviewed",
        "display_encoding_status",
        "display_listable",
        "display_reported_times",
        "featured",
        "allow_download",
        "enable_comments",
        "get_comments_count",
        "get_encodings_count",
    ]
    # Hidden by default; shown via column chooser and/or when a related filter is active.
    optional_list_columns = (
        ("link_user", "User", ()),
        ("display_duration", "Duration", ()),
        ("is_reviewed", "Is reviewed", ("is_reviewed__exact",)),
        ("featured", "Featured", ("featured__exact",)),
        ("get_comments_count", "Comments", ()),
        ("get_encodings_count", "Encodings", ("encoding_status__exact", "encoding_queue", INTEGRITY_FILTER_PARAM, MISSING_METADATA_FILTER_PARAM)),
        ("display_reported_times", "Reported times", ("reported",)),
        ("allow_download", "Allow download", ("allow_download__exact",)),
        ("enable_comments", "Allow comments", ("enable_comments__exact",)),
    )
    optional_columns_session_key = "mediacms_media_admin_optional_columns"
    list_display_links = ("display_title",)
    list_filter = [
        "state",
        "is_reviewed",
        "encoding_status",
        EncodingQueueFilter,
        IntegrityIssuesFilter,
        MissingMetadataFilter,
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
            "refresh_metadata_check_integrity",
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
        return build_grouped_action_choices(
            self.get_actions(request),
            self.action_groups,
            opts=self.opts,
            language_code=getattr(request, "LANGUAGE_CODE", None),
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
        columns = [column for column in self.list_display if column not in self._optional_column_keys() or column in visible_optional]
        return self._append_open_on_site(columns)

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
        if request.method == "GET" and (request.GET.get("reset_media_columns") == "1" or request.GET.get("set_media_columns") == "1"):
            if request.GET.get("reset_media_columns") == "1":
                request.session.pop(self.optional_columns_session_key, None)
            else:
                allowed = self._optional_column_keys()
                selected = [key for key in request.GET.getlist("media_col") if key in allowed]
                request.session[self.optional_columns_session_key] = selected
            request.session.modified = True
            params = request.GET.copy()
            params.pop("set_media_columns", None)
            params.pop("reset_media_columns", None)
            params.pop("media_col", None)
            query = params.urlencode()
            url = request.path
            if query:
                url = f"{url}?{query}"
            return HttpResponseRedirect(url)

        extra_context = extra_context or {}
        visible = self._visible_optional_columns(request)
        filter_forced = self._filter_enabled_optional_columns(request)
        lang = getattr(request, "LANGUAGE_CODE", "en")
        extra_context["media_optional_columns"] = [
            {
                "key": key,
                "label": translate_string(lang, label),
                "checked": key in visible,
                "filter_forced": key in filter_forced,
            }
            for key, label, _filters in self.optional_list_columns
        ]
        # Preserve current filters/search when submitting the column chooser.
        preserved = request.GET.copy()
        preserved.pop("set_media_columns", None)
        preserved.pop("reset_media_columns", None)
        preserved.pop("media_col", None)
        extra_context["media_column_chooser_preserved_qsl"] = list(preserved.items())
        return super().changelist_view(request, extra_context=extra_context)

    readonly_fields = (
        "link_user",
        "link_channel",
        "display_listable",
        "display_media_type",
        "display_encoding_status",
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
        "display_uid",
        "display_friendly_token",
        "display_md5sum",
        "display_media_info",
        "display_search",
        "display_views",
        "display_likes",
        "display_dislikes",
        "reported_times",
        "display_current_poster",
        "display_current_thumbnail",
        "report_actions_table",
        "related_comments",
        "related_encodings",
        "related_actions",
        "related_permissions",
        "related_playlists",
        "related_trim_requests",
        "related_transcription_requests",
        "related_captions",
    )
    autocomplete_fields = ("license",)
    exclude = ("user", "channel")

    def get_fieldsets(self, request, obj=None):
        """Organize the change form into purpose-based Jazzmin tabs.

        Object tabs come first, then Reports (Media-only), then Related
        (one-to-many changelist links).
        """
        media_type = getattr(obj, "media_type", "") if obj is not None else ""
        content_fields = [
            "title",
            "description",
            "license",
            "tags",
            "category",
        ]
        if getattr(settings, "ALLOW_RATINGS", False):
            content_fields.append("rating_category")
        content_fields.append("media_file")
        if media_type in ("video", "audio") and getattr(settings, "USE_WHISPER_TRANSCRIBE", False):
            content_fields.extend(
                [
                    "allow_whisper_transcribe",
                    "allow_whisper_transcribe_and_translate",
                ]
            )
        content_fields.extend(
            [
                "display_current_poster",
                "uploaded_poster",
                "display_current_thumbnail",
                "uploaded_thumbnail",
            ]
        )
        if obj is None or media_type == "video":
            content_fields.append("thumbnail_time")

        return (
            (
                "Content",
                {
                    "fields": tuple(content_fields),
                    "classes": ("tab", "media-content"),
                },
            ),
            (
                "Publishing",
                {
                    "fields": (
                        "display_listable",
                        "state",
                        "is_reviewed",
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
                    "description": "How viewers can interact with this media. Per-user grants are linked from the Related tab.",
                },
            ),
            (
                "Details",
                {
                    "fields": (
                        "display_views",
                        "display_likes",
                        "display_dislikes",
                        "display_uid",
                        "display_friendly_token",
                        "display_md5sum",
                        "display_media_info",
                        "display_search",
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
                        "related_permissions",
                        "related_actions",
                    ),
                    "classes": ("tab", "related-links-tab"),
                    "description": "Links to filtered admin lists for related one-to-many records.",
                },
            ),
        )

    def changeform_view(self, request, object_id=None, form_url="", extra_context=None):
        token = _media_change_request.set(request)
        try:
            response = super().changeform_view(request, object_id, form_url, extra_context)
        except Exception:
            _media_change_request.reset(token)
            raise
        if getattr(response, "is_rendered", True) or not hasattr(response, "add_post_render_callback"):
            _media_change_request.reset(token)
        else:

            def _reset(rendered):
                _media_change_request.reset(token)
                return rendered

            response.add_post_render_callback(_reset)
        return response

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        if db_field.name == "add_date":
            # One datetime-local control instead of Django's split date and time widgets.
            kwargs["form_class"] = forms.DateTimeField
            kwargs["widget"] = forms.DateTimeInput(attrs={"type": "datetime-local", "step": "1"}, format="%Y-%m-%dT%H:%M:%S")
            kwargs["input_formats"] = ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"]
        formfield = super().formfield_for_dbfield(db_field, request, **kwargs)
        if formfield and db_field.name in ("uploaded_poster", "uploaded_thumbnail"):
            formfield.widget = ImageDropzoneWidget()
        if formfield and db_field.name == "media_file":
            formfield.widget = FileDropzoneWidget()
        if formfield and db_field.name == "license" and isinstance(formfield.widget, RelatedFieldWidgetWrapper):
            formfield.widget.__class__ = LicenseInspectWidgetWrapper
        if formfield and db_field.name == "thumbnail_time":
            formfield.__class__ = ThumbnailTimeFormField
            formfield.widget = ThumbnailTimeWidget()
        return formfield

    def render_change_form(self, request, context, add=False, change=False, form_url="", obj=None):
        context["media_glance_cards"] = self._glance_cards(obj)
        return super().render_change_form(request, context, add, change, form_url, obj)

    def _glance_cards(self, obj):
        """Readonly facts above every tab.

        Type-agnostic placards stay in a fixed order. Type-specific metrics follow them,
        so a video's duration never shifts State, User, or the other shared cards.
        """
        if not obj or not obj.pk:
            return []
        cards = [
            {"label": "Media type", "value": self.display_media_type(obj)},
            {"label": "State", "value": self.display_state(obj)},
            {"label": "Is reviewed", "value": self._yes_no_status(obj.is_reviewed, "fas fa-check-circle", "fas fa-times-circle")},
            {"label": "Featured", "value": self._yes_no_status(obj.featured, "fas fa-star", "fas fa-star")},
            {"label": "User featured", "value": self._yes_no_status(obj.user_featured, "fas fa-user-check", "fas fa-user")},
            {"label": "Listable", "value": self.display_listable(obj)},
            {"label": "User", "value": self._placard_inspect(obj.user, obj.user.username if obj.user_id else None)},
            {"label": "Channel", "value": self._placard_inspect(obj.channel, str(obj.channel) if obj.channel_id else None)},
            {"label": "Allow download", "value": self._yes_no_status(obj.allow_download, "fas fa-download", "fas fa-ban")},
            {"label": "Enable comments", "value": self._yes_no_status(obj.enable_comments, "fas fa-comments", "fas fa-comment-slash")},
        ]
        media_type = obj.media_type
        if media_type in ("video", "audio"):
            cards.append({"label": "Duration", "value": self._format_duration(obj.duration)})
        if media_type == "video" and (obj.video_height or 0) > 1:
            cards.append({"label": "Resolution", "value": f"{obj.video_height}p"})
        size = obj.size or self._file_size_label(obj)
        if size:
            cards.append({"label": "Size", "value": size})
        if media_type == "video":
            cards.append({"label": "Encoding status", "value": self.display_encoding_status(obj)})
        return cards

    def _placard_inspect(self, related, name):
        """Name plus an icon-only Inspect link. The tooltip carries the word."""
        if related is None or not getattr(related, "pk", None):
            return "—"
        label = admin_text(None, "Inspect")
        return format_html(
            '<span class="media-metric">{} <a class="media-metric__inspect" href="{}" title="{}" aria-label="{}">'
            '<i class="fas fa-search" aria-hidden="true"></i></a></span>',
            name or str(related),
            admin_change_url(related),
            label,
            label,
        )

    def _yes_no_status(self, enabled, on_icon, off_icon):
        if enabled:
            return admin_status_icon(on_icon, admin_text(None, "Yes"), modifier="listable")
        return admin_status_icon(off_icon, admin_text(None, "No"), modifier="not-listable")

    def _file_size_label(self, obj):
        media_file = getattr(obj, "media_file", None)
        if not media_file:
            return ""
        try:
            size = show_file_size(media_file.size)
        except (OSError, ValueError):
            return ""
        return size or ""

    @admin.display(description="Duration", ordering="duration")
    def display_duration(self, obj):
        """Brief length in the cell. The full clock time is the tooltip."""
        if not obj or obj.media_type not in ("video", "audio"):
            # An empty string is replaced by the admin dash, so return a blank cell.
            return mark_safe("<span></span>")
        brief = self._format_duration_brief(obj.duration)
        clock = self._format_duration_clock(obj.duration)
        return format_html('<span title="{}">{}</span>', clock, brief)

    @staticmethod
    def _format_duration_brief(seconds):
        """Largest whole unit: 15s, 15m, 4h, or 2d."""
        total = max(int(seconds or 0), 0)
        if total < 60:
            return f"{total}s"
        if total < 3600:
            return f"{total // 60}m"
        if total < 86400:
            return f"{total // 3600}h"
        return f"{total // 86400}d"

    @staticmethod
    def _format_duration_clock(seconds):
        """Clock time with leading zero groups omitted: 0:15, 15:00, 4:00:00, 2:00:00:00."""
        total = max(int(seconds or 0), 0)
        days, remainder = divmod(total, 86400)
        hours, remainder = divmod(remainder, 3600)
        minutes, secs = divmod(remainder, 60)
        if days:
            return f"{days}:{hours:02d}:{minutes:02d}:{secs:02d}"
        if hours:
            return f"{hours}:{minutes:02d}:{secs:02d}"
        return f"{minutes}:{secs:02d}"

    @staticmethod
    def _format_duration(seconds):
        return MediaAdmin._format_duration_clock(seconds)

    def _engagement_count(self, obj, count, action):
        """Counter plus an Inspect link to this media's actions of that type."""
        if not obj or not obj.pk:
            return "—"
        label = admin_text(None, "Inspect")
        url = admin_changelist_url(MediaAction, media__id__exact=obj.pk, action__exact=action)
        return format_html(
            '<span class="media-metric">{} <a class="media-metric__inspect" href="{}" title="{}" aria-label="{}">'
            '<i class="fas fa-search" aria-hidden="true"></i></a></span>',
            count or 0,
            url,
            label,
            label,
        )

    @admin.display(description="Uid")
    def display_uid(self, obj):
        return admin_copy_value(obj.uid)

    @admin.display(description="Friendly token")
    def display_friendly_token(self, obj):
        return admin_copy_value(obj.friendly_token)

    @admin.display(description="Md5sum")
    def display_md5sum(self, obj):
        return admin_copy_value(obj.md5sum)

    @admin.display(description="Media info")
    def display_media_info(self, obj):
        return admin_copy_value(obj.media_info)

    @admin.display(description="Search")
    def display_search(self, obj):
        return admin_copy_value(obj.search)

    @admin.display(description="Views")
    def display_views(self, obj):
        return self._engagement_count(obj, obj.views, "watch")

    @admin.display(description="Likes")
    def display_likes(self, obj):
        return self._engagement_count(obj, obj.likes, "like")

    @admin.display(description="Dislikes")
    def display_dislikes(self, obj):
        return self._engagement_count(obj, obj.dislikes, "dislike")

    def _current_image(self, url):
        if not url:
            return "—"
        return format_html('<img class="media-image-preview" src="{}" alt="">', url)

    @admin.display(description="Poster")
    def display_current_poster(self, obj):
        if not obj or not obj.pk:
            return "—"
        return self._current_image(obj.poster_url)

    @admin.display(description="Thumbnail")
    def display_current_thumbnail(self, obj):
        if not obj or not obj.pk:
            return "—"
        return self._current_image(obj.thumbnail_url)

    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related("user", "channel")
        display = set(self.get_list_display(request))
        annotations = {}
        if "get_comments_count" in display:
            annotations["_comments_count"] = Count("comments", distinct=True)
        if "get_encodings_count" in display:
            annotations["_encodings_count"] = Count("encodings", distinct=True)
        if annotations:
            qs = qs.annotate(**annotations)
        return qs

    @admin.display(description="title", ordering="title")
    def display_title(self, obj):
        return clipped_admin_text(obj.title, always_tooltip=True)

    @admin.display(description="User", ordering="user__username")
    def link_user(self, obj):
        if not obj.user_id:
            return "—"
        label = clipped_admin_text(obj.user.username, always_tooltip=True)
        request = _media_change_request.get()
        if request is not None:
            return admin_relation_link(obj.user, request, label)
        return admin_change_link(obj.user, label)

    @admin.display(description="Media type", ordering="media_type")
    def display_media_type(self, obj):
        label = translated_choice_display(obj, "media_type") or obj.media_type or "—"
        icon, modifier = MEDIA_TYPE_STATUS_ICONS.get(obj.media_type, ("fas fa-question-circle", "unknown"))
        return admin_status_icon(icon, label, modifier=modifier)

    @admin.display(description="state", ordering="state")
    def display_state(self, obj):
        label = translated_choice_display(obj, "state")
        icon, modifier = MEDIA_STATE_STATUS_ICONS.get(obj.state, ("fas fa-question-circle", "unknown"))
        return admin_status_icon(icon, label, modifier=modifier)

    @admin.display(description="Encoding status", ordering="encoding_status")
    def display_encoding_status(self, obj):
        label = translated_choice_display(obj, "encoding_status")
        icon, modifier = MEDIA_ENCODING_STATUS_ICONS.get(obj.encoding_status, ("fas fa-question-circle", "unknown"))
        return admin_status_icon(icon, label, modifier=modifier)

    @admin.display(description="Listable", ordering="listable")
    def display_listable(self, obj):
        if obj.listable:
            return admin_status_icon("fas fa-eye", admin_text(None, "Yes"), modifier="listable")
        return admin_status_icon("fas fa-eye-slash", admin_text(None, "No"), modifier="not-listable")

    @admin.display(description="Reported times", ordering="reported_times")
    def display_reported_times(self, obj):
        count = obj.reported_times or 0
        if count <= 0:
            return "—"
        label = f"{admin_text(None, 'Reported times')}: {count}"
        return admin_status_icon("fas fa-flag", label, modifier="warning", text=str(count))

    @admin.display(description="Channel")
    def link_channel(self, obj):
        if not obj.channel_id:
            return "—"
        request = _media_change_request.get()
        if request is not None:
            return admin_relation_link(obj.channel, request)
        return admin_change_link(obj.channel)

    @admin.display(description="Comments", ordering="_comments_count")
    def get_comments_count(self, obj):
        count = getattr(obj, "_comments_count", obj.comments.count())
        label = admin_text(None, "{count} comments", count=count)
        return format_html(
            '<a href="{}" title="{}">{}</a>',
            admin_changelist_url(Comment, media__id__exact=obj.pk),
            label,
            count,
        )

    @admin.display(description="Encodings", ordering="_encodings_count")
    def get_encodings_count(self, obj):
        count = getattr(obj, "_encodings_count", obj.encodings.count())
        label = admin_text(None, "{count} encodings", count=count)
        return format_html(
            '<a href="{}" title="{}">{}</a>',
            admin_changelist_url(Encoding, media__id__exact=obj.pk),
            label,
            count,
        )

    @admin.display(description="Comments")
    def related_comments(self, obj):
        if not obj.pk:
            return "—"
        count = obj.comments.count()
        return admin_changelist_link(Comment, admin_text(None, "View {count} comment(s)", count=count), media__id__exact=obj.pk)

    @admin.display(description="Encodings")
    def related_encodings(self, obj):
        if not obj.pk:
            return "—"
        count = obj.encodings.count()
        return admin_changelist_link(Encoding, admin_text(None, "View {count} encoding(s)", count=count), media__id__exact=obj.pk)

    @admin.display(description="Actions / reports")
    def related_actions(self, obj):
        if not obj.pk:
            return "—"
        count = obj.mediaactions.count()
        return admin_changelist_link(MediaAction, admin_text(None, "View {count} action(s)", count=count), media__id__exact=obj.pk)

    @admin.display(description="Report & moderation actions")
    def report_actions_table(self, obj):
        """Timestamp, then the action icon and name, for report and moderation MediaActions."""
        if not obj or not obj.pk:
            return "—"

        lang = get_language() or "en"
        actions = MediaAction.objects.filter(media=obj, action__in=MEDIA_REPORT_TAB_ACTIONS).order_by("-action_date")
        if not actions.exists():
            return admin_text(lang, "No report or moderation actions yet.")

        inspect_label = admin_text(lang, "Inspect")
        rows = []
        for action in actions:
            raw_label = action.get_action_display() if hasattr(action, "get_action_display") else action.action
            label = admin_text(lang, raw_label)
            icon, modifier = REPORT_ACTION_ICONS.get(action.action, ("fas fa-question-circle", "unknown"))
            when = action.action_date.strftime("%Y-%m-%d %H:%M") if action.action_date else "—"
            change_url = admin_change_url(action)
            rows.append(
                format_html(
                    "<tr><td>{}</td><td>{}</td><td class=\"report-actions-table__inspect\">{}</td></tr>",
                    when,
                    format_html('<a href="{}">{}</a>', change_url, admin_status_icon(icon, label, modifier=modifier)),
                    format_html(
                        '<a class="report-actions-table__inspect" href="{}" title="{}" aria-label="{}">'
                        '<i class="fas fa-search" aria-hidden="true"></i></a>',
                        change_url,
                        inspect_label,
                        inspect_label,
                    ),
                )
            )

        return format_html(
            '<table class="table table-sm table-striped report-actions-table"><thead><tr>'
            "<th>{}</th><th>{}</th>"
            '<th class="report-actions-table__inspect"><i class="fas fa-search" aria-hidden="true" title="{}"></i>'
            '<span class="sr-only">{}</span></th>'
            "</tr></thead><tbody>{}</tbody></table>",
            admin_text(lang, "When"),
            admin_text(lang, "Action"),
            inspect_label,
            inspect_label,
            mark_safe("".join(str(row) for row in rows)),
        )

    @admin.display(description="Playlists")
    def related_playlists(self, obj):
        if not obj.pk:
            return "—"
        count = obj.playlist_set.count()
        return admin_changelist_link(Playlist, admin_text(None, "View {count} playlist(s)", count=count), media__id__exact=obj.pk)

    @admin.display(description="Trim requests")
    def related_trim_requests(self, obj):
        if not obj.pk:
            return "—"
        count = obj.trim_requests.count()
        return admin_changelist_link(VideoTrimRequest, admin_text(None, "View {count} trim request(s)", count=count), media__id__exact=obj.pk)

    @admin.display(description="Transcription requests")
    def related_transcription_requests(self, obj):
        if not obj.pk:
            return "—"
        count = obj.transcriptionrequests.count()
        return admin_changelist_link(TranscriptionRequest, admin_text(None, "View {count} transcription request(s)", count=count), media__id__exact=obj.pk)

    @admin.display(description="Captions")
    def related_captions(self, obj):
        if not obj.pk:
            return "—"
        count = obj.subtitles.count()
        return admin_changelist_link(Subtitle, admin_text(None, "View {count} caption(s)", count=count), media__id__exact=obj.pk)

    @admin.display(description="User permissions")
    def related_permissions(self, obj):
        if not obj.pk:
            return "—"
        count = obj.permissions.count()
        return admin_changelist_link(
            MediaPermission,
            admin_text(None, "View {count} user permission(s)", count=count),
            media__id__exact=obj.pk,
        )

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
            admin_text(getattr(request, "LANGUAGE_CODE", None), "Queued missing encodings for {queued} media item(s); skipped {skipped} without an original file.", queued=queued, skipped=skipped),
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
            admin_text(getattr(request, "LANGUAGE_CODE", None), "Queued force re-encode for {queued} media item(s); skipped {skipped}.", queued=queued, skipped=skipped),
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
            admin_text(getattr(request, "LANGUAGE_CODE", None), "Regenerated thumbnails for {done} media item(s); skipped {skipped}.", done=done, skipped=skipped),
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
            admin_text(getattr(request, "LANGUAGE_CODE", None), "Queued sprite regeneration for {done} media item(s); skipped {skipped}.", done=done, skipped=skipped),
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
            admin_text(getattr(request, "LANGUAGE_CODE", None), "Queued preview regeneration for {done} media item(s); skipped {skipped}.", done=done, skipped=skipped),
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
            admin_text(getattr(request, "LANGUAGE_CODE", None), "Queued HLS regeneration for {done} media item(s); skipped {skipped}.", done=done, skipped=skipped),
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
            admin_text(getattr(request, "LANGUAGE_CODE", None), "Queued derivative refresh for {done} media item(s); skipped {skipped}.", done=done, skipped=skipped),
            messages.SUCCESS if done else messages.WARNING,
        )

    @admin.action(description="Refresh metadata / check integrity", permissions=["change"])
    def refresh_metadata_check_integrity(self, request, queryset):
        from files.tasks import refresh_media_metadata

        queued = 0
        user_id = getattr(request.user, "pk", None)
        for m in queryset:
            refresh_media_metadata.delay(m.friendly_token, user_id)
            queued += 1
        self.message_user(
            request,
            admin_text(
                getattr(request, "LANGUAGE_CODE", None),
                "Queued metadata refresh / integrity check for {queued} media item(s).",
                queued=queued,
            ),
            messages.SUCCESS if queued else messages.WARNING,
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
        self.message_user(request, admin_text(getattr(request, "LANGUAGE_CODE", None), "Marked {count} media item(s) as reviewed.", count=count), messages.SUCCESS)

    @admin.action(description="Mark as not reviewed", permissions=["change"])
    def mark_as_unreviewed(self, request, queryset):
        count = 0
        for media in queryset:
            if set_media_reviewed(media, False, user=request.user):
                count += 1
        self.message_user(request, admin_text(getattr(request, "LANGUAGE_CODE", None), "Marked {count} media item(s) as not reviewed.", count=count), messages.SUCCESS)

    @admin.action(description="Clear reports", permissions=["clear_reports"])
    def clear_reports(self, request, queryset):
        count = clear_media_reports(queryset, user=request.user)
        self.message_user(request, admin_text(getattr(request, "LANGUAGE_CODE", None), "Cleared reports for {count} media item(s).", count=count), messages.SUCCESS)

    @admin.action(description="Confirm reports and set private", permissions=["change"])
    def confirm_reports_set_private(self, request, queryset):
        count = confirm_media_reports(queryset, user=request.user)
        self.message_user(
            request,
            admin_text(getattr(request, "LANGUAGE_CODE", None), "Confirmed reports for {count} media item(s) by setting state to private (reports kept).", count=count),
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
            admin_text(getattr(request, "LANGUAGE_CODE", None), "Cleared reports for {cleared} media item(s) and kept/set private.", cleared=cleared),
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
            admin_text(getattr(request, "LANGUAGE_CODE", None), "Cleared reports for {cleared} media item(s) and set public.", cleared=cleared),
            messages.SUCCESS,
        )

    @admin.action(description="Set public", permissions=["change"])
    def set_state_public(self, request, queryset):
        count = 0
        for media in queryset:
            media.state = "public"
            media.save()
            count += 1
        self.message_user(request, admin_text(getattr(request, "LANGUAGE_CODE", None), "Set {count} media item(s) to public.", count=count), messages.SUCCESS)

    @admin.action(description="Set private", permissions=["change"])
    def set_state_private(self, request, queryset):
        count = 0
        for media in queryset:
            media.state = "private"
            media.save()
            count += 1
        self.message_user(request, admin_text(getattr(request, "LANGUAGE_CODE", None), "Set {count} media item(s) to private.", count=count), messages.SUCCESS)

    @admin.action(description="Set unlisted", permissions=["change"])
    def set_state_unlisted(self, request, queryset):
        count = 0
        for media in queryset:
            media.state = "unlisted"
            media.save()
            count += 1
        self.message_user(request, admin_text(getattr(request, "LANGUAGE_CODE", None), "Set {count} media item(s) to unlisted.", count=count), messages.SUCCESS)

    @admin.action(description="Enable download", permissions=["change"])
    def enable_download(self, request, queryset):
        updated = queryset.update(allow_download=True)
        self.message_user(request, admin_text(getattr(request, "LANGUAGE_CODE", None), "Enabled download for {updated} media item(s).", updated=updated), messages.SUCCESS)

    @admin.action(description="Disable download", permissions=["change"])
    def disable_download(self, request, queryset):
        updated = queryset.update(allow_download=False)
        self.message_user(request, admin_text(getattr(request, "LANGUAGE_CODE", None), "Disabled download for {updated} media item(s).", updated=updated), messages.SUCCESS)

    @admin.action(description="Enable comments", permissions=["change"])
    def enable_comments(self, request, queryset):
        updated = queryset.update(enable_comments=True)
        self.message_user(request, admin_text(getattr(request, "LANGUAGE_CODE", None), "Enabled comments for {updated} media item(s).", updated=updated), messages.SUCCESS)

    @admin.action(description="Disable comments", permissions=["change"])
    def disable_comments(self, request, queryset):
        updated = queryset.update(enable_comments=False)
        self.message_user(request, admin_text(getattr(request, "LANGUAGE_CODE", None), "Disabled comments for {updated} media item(s).", updated=updated), messages.SUCCESS)

    @admin.action(description="Feature", permissions=["change"])
    def feature_selected(self, request, queryset):
        updated = queryset.update(featured=True)
        self.message_user(request, admin_text(getattr(request, "LANGUAGE_CODE", None), "Featured {updated} media item(s).", updated=updated), messages.SUCCESS)

    @admin.action(description="Unfeature", permissions=["change"])
    def unfeature_selected(self, request, queryset):
        updated = queryset.update(featured=False)
        self.message_user(request, admin_text(getattr(request, "LANGUAGE_CODE", None), "Unfeatured {updated} media item(s).", updated=updated), messages.SUCCESS)

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
                self.message_user(
                    request,
                    translate_string(getattr(request, "LANGUAGE_CODE", None), "The media ID does not match. Enter the exact media ID."),
                    messages.ERROR,
                )
            elif not eligible:
                self.message_user(
                    request,
                    translate_string(getattr(request, "LANGUAGE_CODE", None), "No media can be deleted. Change the selection and try again."),
                    messages.ERROR,
                )
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
                    admin_text(getattr(request, "LANGUAGE_CODE", None), "Deleted original file for {deleted} media item(s); blocked/failed {failed}.", deleted=deleted, failed=failed + len(blocked)),
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
                self.message_user(
                    request,
                    translate_string(getattr(request, "LANGUAGE_CODE", None), "Enter a valid username for the new owner."),
                    messages.ERROR,
                )
            else:
                changed = 0
                for media in queryset:
                    if change_media_owner(media.id, new_user):
                        changed += 1
                self.message_user(
                    request,
                    admin_text(getattr(request, "LANGUAGE_CODE", None), "Changed owner to {username} for {changed} media item(s).", username=new_user.username, changed=changed),
                    messages.SUCCESS,
                )
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
        refresh_metadata_check_integrity,
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


class CategoryAdmin(OpenOnSiteMixin, admin.ModelAdmin):
    form = CategoryAdminForm

    search_fields = ["title", "uid"]
    change_list_template = "admin/files/category/change_list.html"
    # Full column set; get_list_display() hides optional ones unless opted-in.
    # Feature-flag columns (RBAC/IdP/LTI) are inserted dynamically when enabled.
    list_display = ["add_date", "title", "user", "uid", "related_media_count"]
    list_display_links = ("title",)
    optional_list_columns = (
        ("uid", "Uid", ()),
        ("related_media_count", "Media count", ()),
    )
    optional_columns_session_key = "mediacms_category_admin_optional_columns"
    list_filter = []
    ordering = ("-add_date",)
    readonly_fields = ("user", "uid", "display_user", "display_uid", "related_media", "lti_platform", "lti_context_id")
    change_form_template = 'admin/files/category/change_form.html'

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
        visible_optional = self._visible_optional_columns(request)
        optional = self._optional_column_keys()
        list_display = [column for column in self.list_display if column not in optional or column in visible_optional]

        insert_at = list_display.index("related_media_count") if "related_media_count" in list_display else len(list_display)
        extras = []
        if getattr(settings, 'USE_RBAC', False):
            extras.append("is_rbac_category")
        if getattr(settings, 'USE_IDENTITY_PROVIDERS', False):
            extras.append("identity_provider")
        if getattr(settings, 'USE_LTI', False):
            extras.append("is_lms_course")
        for offset, column in enumerate(extras):
            list_display.insert(insert_at + offset, column)

        return self._append_open_on_site(list_display)

    def changelist_view(self, request, extra_context=None):
        if request.method == "GET" and (request.GET.get("reset_category_columns") == "1" or request.GET.get("set_category_columns") == "1"):
            if request.GET.get("reset_category_columns") == "1":
                request.session.pop(self.optional_columns_session_key, None)
            else:
                allowed = self._optional_column_keys()
                selected = [key for key in request.GET.getlist("category_col") if key in allowed]
                request.session[self.optional_columns_session_key] = selected
            request.session.modified = True
            params = request.GET.copy()
            params.pop("set_category_columns", None)
            params.pop("reset_category_columns", None)
            params.pop("category_col", None)
            query = params.urlencode()
            url = request.path
            if query:
                url = f"{url}?{query}"
            return HttpResponseRedirect(url)

        extra_context = extra_context or {}
        visible = self._visible_optional_columns(request)
        filter_forced = self._filter_enabled_optional_columns(request)
        lang = getattr(request, "LANGUAGE_CODE", "en")
        extra_context["category_optional_columns"] = [
            {
                "key": key,
                "label": translate_string(lang, label),
                "checked": key in visible,
                "filter_forced": key in filter_forced,
            }
            for key, label, _filters in self.optional_list_columns
        ]
        preserved = request.GET.copy()
        preserved.pop("set_category_columns", None)
        preserved.pop("reset_category_columns", None)
        preserved.pop("category_col", None)
        extra_context["category_column_chooser_preserved_qsl"] = list(preserved.items())
        return super().changelist_view(request, extra_context=extra_context)

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        formfield = super().formfield_for_dbfield(db_field, request, **kwargs)
        if formfield and db_field.name == "thumbnail":
            formfield.widget = ImageDropzoneWidget()
        elif formfield and db_field.name == "listings_thumbnail":
            formfield.widget = ListingsThumbnailUrlWidget()
        return formfield

    def get_fieldsets(self, request, obj=None):
        fieldsets = [
            (
                "General",
                {
                    "fields": ("display_uid", "title", "description", "display_user", "thumbnail", "listings_thumbnail"),
                    "classes": ("tab", "category-fields"),
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
                    "description": "Links to filtered admin lists for related one-to-many records.",
                },
            )
        )
        return fieldsets

    @admin.display(description="User")
    def display_user(self, obj):
        if not obj or not obj.user_id:
            return "—"
        return admin_inspect_link(obj.user, obj.user.username)

    @admin.display(description="Uid")
    def display_uid(self, obj):
        if not obj or not obj.uid:
            return "—"
        return admin_copy_value(obj.uid)

    @admin.display(description="Media")
    def related_media(self, obj):
        if not obj.pk:
            return "—"
        count = obj.media_count if obj.media_count is not None else Media.objects.filter(category=obj).count()
        return admin_changelist_link(Media, admin_text(None, "View {count} media item(s)", count=count), category__id__exact=obj.pk)

    @admin.display(description="Media count", ordering="media_count")
    def related_media_count(self, obj):
        count = obj.media_count if obj.media_count is not None else Media.objects.filter(category=obj).count()
        return admin_changelist_link(Media, str(count), category__id__exact=obj.pk)


class TagAdmin(OpenOnSiteMixin, admin.ModelAdmin):
    search_fields = ["title"]
    change_list_template = "admin/files/tag/change_list.html"
    # Full column set; get_list_display() hides optional ones unless opted-in.
    list_display = ["title", "link_user", "related_media_count"]
    list_display_links = ("title",)
    optional_list_columns = (("related_media_count", "Media count", ()),)
    optional_columns_session_key = "mediacms_tag_admin_optional_columns"
    list_select_related = ("user",)
    readonly_fields = ("link_user", "display_user", "related_media")
    fieldsets = (
        (
            "General",
            {
                "fields": ("title", "display_user", "listings_thumbnail"),
                "classes": ("tab", "tag-fields"),
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
        if request.method == "GET" and (request.GET.get("reset_tag_columns") == "1" or request.GET.get("set_tag_columns") == "1"):
            if request.GET.get("reset_tag_columns") == "1":
                request.session.pop(self.optional_columns_session_key, None)
            else:
                allowed = self._optional_column_keys()
                selected = [key for key in request.GET.getlist("tag_col") if key in allowed]
                request.session[self.optional_columns_session_key] = selected
            request.session.modified = True
            params = request.GET.copy()
            params.pop("set_tag_columns", None)
            params.pop("reset_tag_columns", None)
            params.pop("tag_col", None)
            query = params.urlencode()
            url = request.path
            if query:
                url = f"{url}?{query}"
            return HttpResponseRedirect(url)

        extra_context = extra_context or {}
        visible = self._visible_optional_columns(request)
        filter_forced = self._filter_enabled_optional_columns(request)
        lang = getattr(request, "LANGUAGE_CODE", "en")
        extra_context["tag_optional_columns"] = [
            {
                "key": key,
                "label": translate_string(lang, label),
                "checked": key in visible,
                "filter_forced": key in filter_forced,
            }
            for key, label, _filters in self.optional_list_columns
        ]
        preserved = request.GET.copy()
        preserved.pop("set_tag_columns", None)
        preserved.pop("reset_tag_columns", None)
        preserved.pop("tag_col", None)
        extra_context["tag_column_chooser_preserved_qsl"] = list(preserved.items())
        return super().changelist_view(request, extra_context=extra_context)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Total tagged media (not the public/reviewed-only media_count field).
        if "related_media_count" in self.get_list_display(request):
            qs = qs.annotate(_media_total=Count("media"))
        return qs

    def _media_total(self, obj):
        if hasattr(obj, "_media_total"):
            return obj._media_total
        if not obj.pk:
            return 0
        return Media.objects.filter(tags=obj).count()

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        if db_field.name == "listings_thumbnail":
            return ListingsThumbnailFormField(label=db_field.verbose_name, help_text=db_field.help_text)
        return super().formfield_for_dbfield(db_field, request, **kwargs)

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
        count = self._media_total(obj)
        return admin_changelist_link(Media, admin_text(None, "View {count} media item(s)", count=count), tags__id__exact=obj.pk)

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
                "description": "Links to filtered admin lists for related one-to-many records.",
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
        return admin_changelist_link(Subtitle, admin_text(None, "View {count} caption(s)", count=count), language__id__exact=obj.pk)

    @admin.display(description="Captions", ordering="_captions_count")
    def related_captions_count(self, obj):
        count = getattr(obj, "_captions_count", obj.subtitle_set.count())
        return admin_changelist_link(Subtitle, str(count), language__id__exact=obj.pk)


class SubtitleAdmin(OpenOnSiteMixin, admin.ModelAdmin):
    open_on_site_uses_media = True
    list_display = ["display_id", "link_language", "link_media", "link_user"]
    list_display_links = ("display_id",)
    list_filter = ["language"]
    search_fields = ["media__title", "user__username"]
    list_select_related = ("media", "user", "language")
    readonly_fields = ("link_language", "link_media", "link_user")
    exclude = ("media", "user", "language")
    fieldsets = (
        (
            "Caption",
            {
                "fields": ("link_language", "link_media", "link_user", "subtitle_file"),
                "classes": ("tab",),
            },
        ),
    )

    @admin.display(description="ID", ordering="id")
    def display_id(self, obj):
        return admin_inspect_id(obj.pk)

    @admin.display(description="Language", ordering="language__title")
    def link_language(self, obj):
        return admin_change_link(obj.language, obj.language.title if obj.language_id else None)

    @admin.display(description="Media", ordering="media__title")
    def link_media(self, obj):
        return admin_change_link(obj.media, obj.media.title if obj.media_id else None)

    @admin.display(description="User", ordering="user__username")
    def link_user(self, obj):
        return admin_change_link(obj.user, obj.user.username if obj.user_id else None)


class VideoTrimRequestAdmin(OptionalColumnsMixin, OpenOnSiteMixin, admin.ModelAdmin):
    open_on_site_uses_media = True
    """Pipeline request snapshot. Inspect or delete; do not rewrite request params or status."""

    change_list_template = "admin/files/videotrimrequest/change_list.html"
    # Full column set; get_list_display() hides optional ones unless opted-in or filtered.
    list_display = ["add_date", "display_id", "link_media", "display_status", "display_video_action", "display_media_trim_style"]
    list_display_links = ("display_id", "display_status")
    optional_list_columns = (("add_date", "Add date", ("add_date__gte", "add_date__lt")),)
    optional_columns_session_key = "mediacms_videotrimrequest_admin_optional_columns"
    optional_columns_prefix = "videotrimrequest"
    list_filter = ["status", "video_action", "media_trim_style", "add_date"]
    search_fields = ["media__title"]
    list_select_related = ("media",)
    readonly_fields = ("status", "video_action", "media_trim_style", "timestamps", "add_date", "link_media")
    exclude = ("media",)
    ordering = ("-id",)
    fieldsets = (
        (
            "Trim request",
            {
                "fields": ("link_media", "status", "video_action", "media_trim_style", "timestamps", "add_date"),
                "classes": ("tab",),
            },
        ),
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    @admin.display(description="ID", ordering="id")
    def display_id(self, obj):
        return admin_inspect_id(obj.pk)

    @admin.display(description="Media", ordering="media__title")
    def link_media(self, obj):
        if not obj.media_id:
            return "—"
        title = obj.media.title
        return format_html(
            '<a href="{}" title="{}">{}</a>',
            admin_change_url(obj.media),
            title,
            clipped_admin_text(title, always_tooltip=True),
        )

    @admin.display(description="status", ordering="status")
    def display_status(self, obj):
        label = translated_choice_display(obj, "status")
        icon, modifier = TRIM_STATUS_ICONS.get(obj.status, ("fas fa-question-circle", "unknown"))
        return admin_status_icon(icon, label, modifier=modifier)

    @admin.display(description="video action", ordering="video_action")
    def display_video_action(self, obj):
        label = translated_choice_display(obj, "video_action")
        icon, modifier = TRIM_ACTION_ICONS.get(obj.video_action, ("fas fa-question-circle", "unknown"))
        return admin_status_icon(icon, label, modifier=modifier)

    @admin.display(description="media trim style", ordering="media_trim_style")
    def display_media_trim_style(self, obj):
        label = translated_choice_display(obj, "media_trim_style")
        icon, modifier = TRIM_STYLE_ICONS.get(obj.media_trim_style, ("fas fa-question-circle", "unknown"))
        return admin_status_icon(icon, label, modifier=modifier)


class EncodingAdmin(OpenOnSiteMixin, admin.ModelAdmin):
    open_on_site_uses_media = True
    """Encoding job rows are pipeline-owned. Inspect or retry/delete; do not hand-edit state."""

    change_list_template = "admin/files/encoding/change_list.html"
    # Full column set; get_list_display() hides optional ones unless opted-in or filtered.
    list_display = ["get_title", "link_media", "display_chunk", "profile", "progress", "display_status", "has_file"]
    list_display_links = ("get_title",)
    optional_list_columns = (
        ("display_chunk", "Chunk", ("chunk__exact",)),
        ("profile", "Profile", ("profile__id__exact",)),
        ("progress", "Progress", ()),
    )
    optional_columns_session_key = "mediacms_encoding_admin_optional_columns"
    list_filter = ["chunk", "profile", "status"]
    search_fields = ["media__title", "media__friendly_token"]
    list_select_related = ("media", "profile")
    readonly_fields = (
        "profile",
        "status",
        "progress",
        "chunk",
        "has_file",
        "link_media",
        "display_media",
        "display_profile",
        "display_chunk",
        "display_status",
        "display_progress",
    )
    exclude = ("media",)
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
                "fields": ("display_media", "display_profile", "display_chunk", "display_status", "display_progress", "has_file"),
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
        if request.method == "GET" and (request.GET.get("reset_encoding_columns") == "1" or request.GET.get("set_encoding_columns") == "1"):
            if request.GET.get("reset_encoding_columns") == "1":
                request.session.pop(self.optional_columns_session_key, None)
            else:
                allowed = self._optional_column_keys()
                selected = [key for key in request.GET.getlist("encoding_col") if key in allowed]
                request.session[self.optional_columns_session_key] = selected
            request.session.modified = True
            params = request.GET.copy()
            params.pop("set_encoding_columns", None)
            params.pop("reset_encoding_columns", None)
            params.pop("encoding_col", None)
            query = params.urlencode()
            url = request.path
            if query:
                url = f"{url}?{query}"
            return HttpResponseRedirect(url)

        extra_context = extra_context or {}
        visible = self._visible_optional_columns(request)
        filter_forced = self._filter_enabled_optional_columns(request)
        lang = getattr(request, "LANGUAGE_CODE", "en")
        extra_context["encoding_optional_columns"] = [
            {
                "key": key,
                "label": translate_string(lang, label),
                "checked": key in visible,
                "filter_forced": key in filter_forced,
            }
            for key, label, _filters in self.optional_list_columns
        ]
        preserved = request.GET.copy()
        preserved.pop("set_encoding_columns", None)
        preserved.pop("reset_encoding_columns", None)
        preserved.pop("encoding_col", None)
        extra_context["encoding_column_chooser_preserved_qsl"] = list(preserved.items())
        return super().changelist_view(request, extra_context=extra_context)

    def has_add_permission(self, request):
        return False

    def get_action_choices(self, request, default_choices=None):
        return build_grouped_action_choices(
            self.get_actions(request),
            self.action_groups,
            opts=self.opts,
            language_code=getattr(request, "LANGUAGE_CODE", None),
        )

    @admin.display(description="Encoding", ordering="media__title")
    def get_title(self, obj):
        return str(obj)

    @admin.display(description="Media", ordering="media__title")
    def link_media(self, obj):
        if not obj.media_id:
            return "—"
        title = obj.media.title
        return format_html(
            '<a href="{}" title="{}">{}</a>',
            admin_change_url(obj.media),
            title,
            clipped_admin_text(title, always_tooltip=True),
        )

    @admin.display(description="Media")
    def display_media(self, obj):
        if not obj.media_id:
            return "—"
        return admin_inspect_link(obj.media, clipped_admin_text(obj.media.title, always_tooltip=True))

    @admin.display(description="Profile")
    def display_profile(self, obj):
        if not obj.profile_id:
            return "—"
        return admin_inspect_link(obj.profile, obj.profile.name)

    @admin.display(description="Progress")
    def display_progress(self, obj):
        progress = max(0, min(int(obj.progress or 0), 100))
        return format_html(
            '<div class="encoding-progress">'
            '<div class="progress" role="progressbar" aria-valuenow="{}" aria-valuemin="0" aria-valuemax="100" aria-label="{}%">'
            '<div class="progress-bar" style="width: {}%;"></div>'
            "</div>"
            '<span class="encoding-progress__value">{}%</span>'
            "</div>",
            progress,
            progress,
            progress,
            progress,
        )

    @admin.display(description="Chunk", ordering="chunk")
    def display_chunk(self, obj):
        if obj.chunk:
            return admin_status_icon("fas fa-th-large", admin_text(None, "Yes"), modifier="running")
        return admin_status_icon("fas fa-file", admin_text(None, "No"), modifier="not-listable")

    @admin.display(description="Has file")
    def has_file(self, obj):
        if obj.media_encoding_url is not None:
            return admin_status_icon("fas fa-file", admin_text(None, "Yes"), modifier="success")
        return admin_status_icon("fas fa-ban", admin_text(None, "No"), modifier="fail")

    @admin.display(description="status", ordering="status")
    def display_status(self, obj):
        label = translated_choice_display(obj, "status")
        icon, modifier = MEDIA_ENCODING_STATUS_ICONS.get(obj.status, ("fas fa-question-circle", "unknown"))
        return admin_status_icon(icon, label, modifier=modifier)

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
            admin_text(getattr(request, "LANGUAGE_CODE", None), "Queued retry for {queued} failed encoding(s); skipped {skipped}.", queued=queued, skipped=skipped),
            messages.SUCCESS if queued else messages.WARNING,
        )


class TranscriptionRequestAdmin(OptionalColumnsMixin, OpenOnSiteMixin, admin.ModelAdmin):
    open_on_site_uses_media = True
    """Whisper caption request snapshot. Inspect or delete; do not rewrite request params or logs."""

    change_list_template = "admin/files/transcriptionrequest/change_list.html"
    # Full column set; get_list_display() hides optional ones unless opted-in or filtered.
    list_display = ["add_date", "display_id", "link_media", "display_status", "display_translate_to_english"]
    list_display_links = ("display_id",)
    optional_list_columns = (("add_date", "Add date", ("add_date__gte", "add_date__lt")),)
    optional_columns_session_key = "mediacms_transcriptionrequest_admin_optional_columns"
    optional_columns_prefix = "transcriptionrequest"
    list_filter = ["status", "translate_to_english", "add_date"]
    search_fields = ["media__title", "logs"]
    list_select_related = ("media",)
    readonly_fields = ("status", "translate_to_english", "logs", "add_date", "link_media")
    exclude = ("media",)
    ordering = ("-id",)
    fieldsets = (
        (
            "Caption request",
            {
                "fields": ("link_media", "status", "translate_to_english", "logs", "add_date"),
                "classes": ("tab",),
            },
        ),
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    @admin.display(description="ID", ordering="id")
    def display_id(self, obj):
        return admin_inspect_id(obj.pk)

    @admin.display(description="Media", ordering="media__title")
    def link_media(self, obj):
        if not obj.media_id:
            return "—"
        title = obj.media.title
        return format_html(
            '<a href="{}" title="{}">{}</a>',
            admin_change_url(obj.media),
            title,
            clipped_admin_text(title, always_tooltip=True),
        )

    @admin.display(description="status", ordering="status")
    def display_status(self, obj):
        label = translated_choice_display(obj, "status")
        icon, modifier = MEDIA_ENCODING_STATUS_ICONS.get(obj.status, ("fas fa-question-circle", "unknown"))
        return admin_status_icon(icon, label, modifier=modifier)

    @admin.display(description="Translate to English", ordering="translate_to_english")
    def display_translate_to_english(self, obj):
        if obj.translate_to_english:
            return admin_status_icon("fas fa-language", admin_text(None, "Yes"), modifier="running")
        return admin_status_icon("fas fa-minus", admin_text(None, "No"), modifier="not-listable")


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


class PageAdmin(OpenOnSiteMixin, admin.ModelAdmin):
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
                "fields": ("title", "slug", "description", "link_slug", "page_url", "add_date", "edit_date"),
                "classes": ("tab",),
            },
        ),
    )

    @admin.display(description="slug", ordering="slug")
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


class PlaylistAdmin(OpenOnSiteMixin, admin.ModelAdmin):
    search_fields = ["title", "friendly_token", "user__username"]
    change_list_template = "admin/files/playlist/change_list.html"
    # Full column set; get_list_display() hides optional ones unless opted-in.
    list_display = ["add_date", "title", "link_user", "friendly_token", "related_media_count"]
    list_display_links = ("title",)
    optional_list_columns = (
        ("friendly_token", "Friendly token", ()),
        ("related_media_count", "Media count", ()),
    )
    optional_columns_session_key = "mediacms_playlist_admin_optional_columns"
    list_select_related = ("user",)
    list_filter = ["add_date", ("user", admin.RelatedOnlyFieldListFilter), ("media", admin.RelatedOnlyFieldListFilter)]
    ordering = ("-add_date",)
    date_hierarchy = "add_date"
    readonly_fields = ("uid", "friendly_token", "link_user", "display_user", "related_media")
    exclude = ("user",)
    fieldsets = (
        (
            "Playlist",
            {
                "fields": ("title", "description", "display_user", "friendly_token", "uid"),
                "classes": ("tab",),
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
        if request.method == "GET" and (request.GET.get("reset_playlist_columns") == "1" or request.GET.get("set_playlist_columns") == "1"):
            if request.GET.get("reset_playlist_columns") == "1":
                request.session.pop(self.optional_columns_session_key, None)
            else:
                allowed = self._optional_column_keys()
                selected = [key for key in request.GET.getlist("playlist_col") if key in allowed]
                request.session[self.optional_columns_session_key] = selected
            request.session.modified = True
            params = request.GET.copy()
            params.pop("set_playlist_columns", None)
            params.pop("reset_playlist_columns", None)
            params.pop("playlist_col", None)
            query = params.urlencode()
            url = request.path
            if query:
                url = f"{url}?{query}"
            return HttpResponseRedirect(url)

        extra_context = extra_context or {}
        visible = self._visible_optional_columns(request)
        filter_forced = self._filter_enabled_optional_columns(request)
        lang = getattr(request, "LANGUAGE_CODE", "en")
        extra_context["playlist_optional_columns"] = [
            {
                "key": key,
                "label": translate_string(lang, label),
                "checked": key in visible,
                "filter_forced": key in filter_forced,
            }
            for key, label, _filters in self.optional_list_columns
        ]
        preserved = request.GET.copy()
        preserved.pop("set_playlist_columns", None)
        preserved.pop("reset_playlist_columns", None)
        preserved.pop("playlist_col", None)
        extra_context["playlist_column_chooser_preserved_qsl"] = list(preserved.items())
        return super().changelist_view(request, extra_context=extra_context)

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
        count = getattr(obj, "_media_count", obj.media.count())
        return admin_changelist_link(Media, admin_text(None, "View {count} media item(s)", count=count), playlist__id__exact=obj.pk)

    @admin.display(description="Media count", ordering="_media_count")
    def related_media_count(self, obj):
        count = getattr(obj, "_media_count", obj.media.count())
        return admin_changelist_link(Media, str(count), playlist__id__exact=obj.pk)


class MediaPermissionAdmin(OpenOnSiteMixin, admin.ModelAdmin):
    open_on_site_uses_media = True
    change_list_template = "admin/files/mediapermission/change_list.html"
    # Full column set; get_list_display() hides optional ones unless opted-in.
    list_display = ["created_at", "display_id", "link_media", "link_user", "link_owner", "display_permission", "display_source"]
    list_display_links = ("display_id",)
    optional_list_columns = (("created_at", "Created at", ()),)
    optional_columns_session_key = "mediacms_mediapermission_admin_optional_columns"
    list_filter = ["permission", "source", ("media", admin.RelatedOnlyFieldListFilter)]
    search_fields = ["media__title", "user__username", "owner_user__username"]
    list_select_related = ("media", "user", "owner_user")
    autocomplete_fields = ("media", "user", "owner_user")
    readonly_fields = ("created_at",)
    ordering = ("id",)
    fieldsets = (
        (
            "Permission",
            {
                "fields": ("media", "user", "owner_user", "permission", "source", "created_at"),
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
        set_columns = request.GET.get("set_mediapermission_columns") == "1"
        reset_columns = request.GET.get("reset_mediapermission_columns") == "1"
        if request.method == "GET" and (set_columns or reset_columns):
            if reset_columns:
                request.session.pop(self.optional_columns_session_key, None)
            else:
                allowed = self._optional_column_keys()
                selected = [key for key in request.GET.getlist("mediapermission_col") if key in allowed]
                request.session[self.optional_columns_session_key] = selected
            request.session.modified = True
            params = request.GET.copy()
            params.pop("set_mediapermission_columns", None)
            params.pop("reset_mediapermission_columns", None)
            params.pop("mediapermission_col", None)
            query = params.urlencode()
            url = request.path
            if query:
                url = f"{url}?{query}"
            return HttpResponseRedirect(url)

        extra_context = extra_context or {}
        visible = self._visible_optional_columns(request)
        filter_forced = self._filter_enabled_optional_columns(request)
        lang = getattr(request, "LANGUAGE_CODE", "en")
        extra_context["mediapermission_optional_columns"] = [
            {
                "key": key,
                "label": translate_string(lang, label),
                "checked": key in visible,
                "filter_forced": key in filter_forced,
            }
            for key, label, _filters in self.optional_list_columns
        ]
        preserved = request.GET.copy()
        preserved.pop("set_mediapermission_columns", None)
        preserved.pop("reset_mediapermission_columns", None)
        preserved.pop("mediapermission_col", None)
        extra_context["mediapermission_column_chooser_preserved_qsl"] = list(preserved.items())
        return super().changelist_view(request, extra_context=extra_context)

    @admin.display(description="ID", ordering="id")
    def display_id(self, obj):
        return admin_inspect_id(obj.pk)

    @admin.display(description="Media", ordering="media__title")
    def link_media(self, obj):
        if not obj.media_id:
            return "—"
        title = obj.media.title
        return format_html(
            '<a href="{}" title="{}">{}</a>',
            admin_change_url(obj.media),
            title,
            clipped_admin_text(title, always_tooltip=True),
        )

    @admin.display(description="User", ordering="user__username")
    def link_user(self, obj):
        return admin_change_link(obj.user, obj.user.username if obj.user_id else None)

    @admin.display(description="Owner", ordering="owner_user__username")
    def link_owner(self, obj):
        return admin_change_link(obj.owner_user, obj.owner_user.username if obj.owner_user_id else None)

    @admin.display(description="permission", ordering="permission")
    def display_permission(self, obj):
        label = translated_choice_display(obj, "permission")
        icon, modifier = MEDIA_PERMISSION_ICONS.get(obj.permission, ("fas fa-question-circle", "unknown"))
        return admin_status_icon(icon, label, modifier=modifier)

    @admin.display(description="source", ordering="source")
    def display_source(self, obj):
        label = translated_choice_display(obj, "source")
        icon, modifier = MEDIA_PERMISSION_SOURCE_ICONS.get(obj.source, ("fas fa-question-circle", "unknown"))
        return admin_status_icon(icon, label, modifier=modifier)


class LicenseAdmin(admin.ModelAdmin):
    search_fields = ["title", "description"]
    list_display = ["title", "related_media_count"]
    readonly_fields = ("related_media",)
    ordering = ("title",)
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
                "description": "Links to filtered admin lists for related one-to-many records.",
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
        return admin_changelist_link(Media, admin_text(None, "View {count} media item(s)", count=count), license__id__exact=obj.pk)

    @admin.display(description="Media count", ordering="_media_count")
    def related_media_count(self, obj):
        count = getattr(obj, "_media_count", Media.objects.filter(license=obj).count())
        return admin_changelist_link(Media, str(count), license__id__exact=obj.pk)


@admin.register(TinyMCEMedia)
class TinyMCEMediaAdmin(TranslateChoiceLabelsMixin, admin.ModelAdmin):
    list_display = ["uploaded_at", "original_filename", "display_file_type", "link_user"]
    list_display_links = ("original_filename",)
    list_filter = ["file_type", "uploaded_at"]
    list_select_related = ("user",)
    search_fields = ["original_filename", "user__username"]
    readonly_fields = ["uploaded_at", "link_user"]
    date_hierarchy = "uploaded_at"

    @admin.display(description="User", ordering="user__username")
    def link_user(self, obj):
        return admin_change_link(obj.user, obj.user.username if obj.user_id else None)

    @admin.display(description="file type", ordering="file_type")
    def display_file_type(self, obj):
        return translated_choice_display(obj, "file_type")


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
