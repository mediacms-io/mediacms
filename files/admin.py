from django import forms
from django.conf import settings
from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count
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
    verbose_name_plural = "Comments"


class EncodingInline(ReadOnlyTabularInline):
    model = Encoding
    fields = ("profile", "status", "progress", "chunk", "update_date")
    readonly_fields = ("profile", "status", "progress", "chunk", "update_date")
    ordering = ("-update_date",)
    verbose_name_plural = "Encodings"


class SubtitleInline(ReadOnlyTabularInline):
    model = Subtitle
    fields = ("language", "user")
    readonly_fields = ("language", "user")
    verbose_name_plural = "Subtitles"


class MediaPermissionInline(ReadOnlyTabularInline):
    model = MediaPermission
    fields = ("user", "owner_user", "permission", "source", "created_at")
    readonly_fields = ("user", "owner_user", "permission", "source", "created_at")
    verbose_name_plural = "Sharing permissions"


class PlaylistMediaInline(admin.TabularInline):
    model = PlaylistMedia
    extra = 0
    fields = ("media", "ordering", "action_date")
    readonly_fields = ("action_date",)
    raw_id_fields = ("media",)
    show_change_link = True
    ordering = ("ordering",)
    verbose_name_plural = "Playlist media"


class CommentAdmin(admin.ModelAdmin):
    search_fields = ["text", "user__username", "media__title"]
    list_display = ["text", "add_date", "link_user", "link_media"]
    list_filter = ["add_date", ("media", admin.RelatedOnlyFieldListFilter), ("user", admin.RelatedOnlyFieldListFilter)]
    list_select_related = ("user", "media")
    ordering = ("-add_date",)
    date_hierarchy = "add_date"
    readonly_fields = ("user", "media", "parent", "link_user", "link_media")

    @admin.display(description="User", ordering="user__username")
    def link_user(self, obj):
        return admin_change_link(obj.user, obj.user.username if obj.user_id else None)

    @admin.display(description="Media", ordering="media__title")
    def link_media(self, obj):
        return admin_change_link(obj.media, obj.media.title if obj.media_id else None)


class MediaAdmin(admin.ModelAdmin):
    search_fields = ["title", "user__username", "friendly_token"]
    list_display = [
        "title",
        "link_user",
        "add_date",
        "media_type",
        "duration",
        "state",
        "is_reviewed",
        "encoding_status",
        "reported_times",
        "featured",
        "allow_download",
        "enable_comments",
        "get_comments_count",
        "get_encodings_count",
    ]
    list_filter = [
        "state",
        "is_reviewed",
        "encoding_status",
        EncodingQueueFilter,
        "featured",
        "media_type",
        ReportedTimesFilter,
        "allow_download",
        "enable_comments",
        "category",
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

    readonly_fields = (
        "link_user",
        "tags",
        "category",
        "link_channel",
        "report_actions_table",
        "related_comments",
        "related_encodings",
        "related_actions",
        "related_reports",
        "related_playlists",
        "related_trim_requests",
        "related_transcription_requests",
    )
    inlines = [CommentInline, EncodingInline, SubtitleInline, MediaPermissionInline]
    exclude = ("user", "channel")

    def get_fieldsets(self, request, obj=None):
        """Single Reports tab: reported_times plus report/clear/moderation MediaActions table."""
        fieldsets = list(super().get_fieldsets(request, obj))
        if not fieldsets:
            return fieldsets

        name, options = fieldsets[0]
        fields = list(options.get("fields", ()))
        for field_name in ("reported_times", "report_actions_table"):
            if field_name in fields:
                fields.remove(field_name)
        fieldsets[0] = (name, {**options, "fields": tuple(fields)})
        fieldsets.append(
            (
                "Reports",
                {
                    "fields": ("reported_times", "report_actions_table"),
                    "classes": ("tab",),
                    "description": "Open reports and related moderation audit events. Use Clear reports actions to reset counters.",
                },
            )
        )
        return fieldsets

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
    list_display = ["title", "user", "add_date", "media_count"]
    list_filter = []
    ordering = ("-add_date",)
    readonly_fields = ("user", "media_count", "lti_platform", "lti_context_id")
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
        basic_fieldset = [
            (
                'Category Information',
                {
                    'fields': ['uid', 'title', 'description', 'user', 'media_count', 'thumbnail', 'listings_thumbnail'],
                },
            ),
        ]

        additional_fieldsets = []

        if getattr(settings, 'USE_LTI', False):
            lti_fieldset = [
                ('LTI Integration', {'fields': ['lti_platform', 'lti_context_id'], 'classes': ['tab'], 'description': 'LTI/LMS integration settings (automatically managed by LTI provisioning)'}),
            ]
            additional_fieldsets.extend(lti_fieldset)

        if getattr(settings, 'USE_RBAC', False):
            rbac_fieldset = [
                ('RBAC Settings', {'fields': ['is_rbac_category'], 'classes': ['tab'], 'description': 'Role-Based Access Control settings'}),
                ('Group Access', {'fields': ['rbac_groups'], 'description': 'Select the Groups that have access to category'}),
            ]
            if getattr(settings, 'USE_IDENTITY_PROVIDERS', False):
                rbac_fieldset = [
                    ('RBAC Settings', {'fields': ['is_rbac_category', 'identity_provider'], 'classes': ['tab'], 'description': 'Role-Based Access Control settings'}),
                    ('Group Access', {'fields': ['rbac_groups'], 'description': 'Select the Groups that have access to category'}),
                ]
            additional_fieldsets.extend(rbac_fieldset)

        return basic_fieldset + additional_fieldsets


class TagAdmin(admin.ModelAdmin):
    search_fields = ["title"]
    list_display = ["title", "user", "media_count"]
    readonly_fields = ("user", "media_count")


class EncodeProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "extension", "resolution", "codec", "description", "active")
    list_editable = ("active",)
    list_filter = ["extension", "resolution", "codec", "active"]
    search_fields = ["name", "extension", "resolution", "codec", "description"]
    list_per_page = 100
    fields = ("name", "extension", "resolution", "codec", "description", "active")


class LanguageAdmin(admin.ModelAdmin):
    pass


class SubtitleAdmin(admin.ModelAdmin):
    list_display = ["id", "language", "link_media", "link_user"]
    list_filter = ["language", ("media", admin.RelatedOnlyFieldListFilter)]
    search_fields = ["media__title", "user__username"]
    list_select_related = ("media", "user", "language")
    readonly_fields = ("media", "user", "link_media", "link_user")

    @admin.display(description="Media", ordering="media__title")
    def link_media(self, obj):
        return admin_change_link(obj.media, obj.media.title if obj.media_id else None)

    @admin.display(description="User", ordering="user__username")
    def link_user(self, obj):
        return admin_change_link(obj.user, obj.user.username if obj.user_id else None)


class VideoTrimRequestAdmin(admin.ModelAdmin):
    list_display = ["link_media", "status", "add_date", "video_action", "media_trim_style", "timestamps"]
    list_filter = ["status", "video_action", "media_trim_style", "add_date", ("media", admin.RelatedOnlyFieldListFilter)]
    search_fields = ["media__title"]
    list_select_related = ("media",)
    readonly_fields = ("add_date",)
    ordering = ("-add_date",)

    @admin.display(description="Media", ordering="media__title")
    def link_media(self, obj):
        return admin_change_link(obj.media, obj.media.title if obj.media_id else None)


class EncodingAdmin(admin.ModelAdmin):
    list_display = ["get_title", "link_media", "chunk", "profile", "progress", "status", "has_file"]
    list_filter = ["chunk", "profile", "status", ("media", admin.RelatedOnlyFieldListFilter)]
    search_fields = ["media__title", "media__friendly_token"]
    list_select_related = ("media", "profile")
    actions = ["retry_failed_encodings"]
    action_form = GroupedActionForm
    action_groups = [
        ["retry_failed_encodings"],
        ["delete_selected"],
    ]

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
    list_display = ["link_media", "add_date", "status", "translate_to_english"]
    list_filter = ["status", "translate_to_english", "add_date", ("media", admin.RelatedOnlyFieldListFilter)]
    search_fields = ["media__title"]
    list_select_related = ("media",)
    readonly_fields = ("add_date", "logs")
    ordering = ("-add_date",)

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


class PlaylistAdmin(admin.ModelAdmin):
    search_fields = ["title", "friendly_token", "user__username"]
    list_display = ["title", "link_user", "add_date", "friendly_token", "get_media_count"]
    list_select_related = ("user",)
    list_filter = ["add_date", ("user", admin.RelatedOnlyFieldListFilter)]
    ordering = ("-add_date",)
    date_hierarchy = "add_date"
    readonly_fields = ("uid", "friendly_token", "link_user")
    exclude = ("user",)
    inlines = [PlaylistMediaInline]

    @admin.display(description="User", ordering="user__username")
    def link_user(self, obj):
        return admin_change_link(obj.user, obj.user.username if obj.user_id else None)

    @admin.display(description="Media count")
    def get_media_count(self, obj):
        return obj.media_count


class MediaPermissionAdmin(admin.ModelAdmin):
    list_display = ["link_media", "link_user", "link_owner", "permission", "source", "created_at"]
    list_filter = ["permission", "source", ("media", admin.RelatedOnlyFieldListFilter)]
    search_fields = ["media__title", "user__username", "owner_user__username"]
    list_select_related = ("media", "user", "owner_user")
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)

    @admin.display(description="Media", ordering="media__title")
    def link_media(self, obj):
        return admin_change_link(obj.media, obj.media.title if obj.media_id else None)

    @admin.display(description="User", ordering="user__username")
    def link_user(self, obj):
        return admin_change_link(obj.user, obj.user.username if obj.user_id else None)

    @admin.display(description="Owner", ordering="owner_user__username")
    def link_owner(self, obj):
        return admin_change_link(obj.owner_user, obj.owner_user.username if obj.owner_user_id else None)


@admin.register(TinyMCEMedia)
class TinyMCEMediaAdmin(admin.ModelAdmin):
    list_display = ['original_filename', 'file_type', 'uploaded_at', 'user']
    list_filter = ['file_type', 'uploaded_at']
    search_fields = ['original_filename']
    readonly_fields = ['uploaded_at']
    date_hierarchy = 'uploaded_at'


admin.site.register(EncodeProfile, EncodeProfileAdmin)
admin.site.register(Comment, CommentAdmin)
admin.site.register(Media, MediaAdmin)
admin.site.register(Encoding, EncodingAdmin)
admin.site.register(Category, CategoryAdmin)
admin.site.register(Page, PageAdmin)
admin.site.register(Tag, TagAdmin)
admin.site.register(Subtitle, SubtitleAdmin)
admin.site.register(Language, LanguageAdmin)
admin.site.register(VideoTrimRequest, VideoTrimRequestAdmin)
admin.site.register(TranscriptionRequest, TranscriptionRequestAdmin)
admin.site.register(Playlist, PlaylistAdmin)
admin.site.register(MediaPermission, MediaPermissionAdmin)

Media._meta.app_config.verbose_name = "Media"
