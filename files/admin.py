from django.conf import settings
from django.contrib import admin

from rbac.models import RBACGroup

from .models import (
    Category,
    Comment,
    EncodeProfile,
    Encoding,
    Language,
    Media,
    Subtitle,
    Tag,
)


class CommentAdmin(admin.ModelAdmin):
    search_fields = ["text"]
    list_display = ["text", "add_date", "user", "media"]
    ordering = ("-add_date",)
    readonly_fields = ("user", "media", "parent")


class MediaAdmin(admin.ModelAdmin):
    search_fields = ["title"]
    list_display = [
        "title",
        "user",
        "add_date",
        "media_type",
        "duration",
        "state",
        "is_reviewed",
        "encoding_status",
        "featured",
        "get_comments_count",
    ]
    list_filter = ["state", "is_reviewed", "encoding_status", "featured", "category"]
    ordering = ("-add_date",)
    readonly_fields = ("user", "tags", "category", "channel")

    def get_comments_count(self, obj):
        return obj.comments.count()

    @admin.action(description="Generate missing encoding(s)", permissions=["change"])
    def generate_missing_encodings(modeladmin, request, queryset):
        for m in queryset:
            m.encode(force=False)

    actions = [generate_missing_encodings]
    get_comments_count.short_description = "Comments count"


class RBACGroupInline(admin.TabularInline):
    model = RBACGroup.categories.through
    extra = 0
    verbose_name = "RBAC Group"
    verbose_name_plural = "RBAC Groups"


class CategoryAdmin(admin.ModelAdmin):
    search_fields = ["title"]
    list_display = ["title", "user", "add_date", "is_global", "media_count", "is_rbac_category", "identity_provider"]
    list_filter = ["is_global", "is_rbac_category", "identity_provider"]
    ordering = ("-add_date",)
    readonly_fields = ("user", "media_count")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.inlines = []

        if getattr(settings, 'USE_RBAC', False):
            self.inlines.append(RBACGroupInline)

    def get_fieldsets(self, request, obj=None):
        basic_fieldset = [
            (None, {
                'fields': ['title', 'user', 'is_global', 'media_count']
            }),
        ]
        
        if getattr(settings, 'USE_RBAC', False):
            rbac_fieldset = [
                ('RBAC Settings', {
                    'fields': ['is_rbac_category', 'identity_provider'],
                    'classes': ['collapse', 'open'],
                    'description': 'Role-Based Access Control settings for this category'
                }),
            ]
            return basic_fieldset + rbac_fieldset
        else:
            return basic_fieldset

class TagAdmin(admin.ModelAdmin):
    search_fields = ["title"]
    list_display = ["title", "user", "media_count"]
    readonly_fields = ("user", "media_count")


class EncodeProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "extension", "resolution", "codec", "description", "active")
    list_filter = ["extension", "resolution", "codec", "active"]
    search_fields = ["name", "extension", "resolution", "codec", "description"]
    list_per_page = 100
    fields = ("name", "extension", "resolution", "codec", "description", "active")


class LanguageAdmin(admin.ModelAdmin):
    pass


class SubtitleAdmin(admin.ModelAdmin):
    pass


class EncodingAdmin(admin.ModelAdmin):
    list_display = ["get_title", "chunk", "profile", "progress", "status", "has_file"]
    list_filter = ["chunk", "profile", "status"]

    def get_title(self, obj):
        return str(obj)

    get_title.short_description = "Encoding"

    def has_file(self, obj):
        return obj.media_encoding_url is not None

    has_file.short_description = "Has file"


admin.site.register(EncodeProfile, EncodeProfileAdmin)
admin.site.register(Comment, CommentAdmin)
admin.site.register(Media, MediaAdmin)
admin.site.register(Encoding, EncodingAdmin)
admin.site.register(Category, CategoryAdmin)
admin.site.register(Tag, TagAdmin)
admin.site.register(Subtitle, SubtitleAdmin)
admin.site.register(Language, LanguageAdmin)

Media._meta.app_config.verbose_name = "Media"
