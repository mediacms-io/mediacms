from django.conf import settings
from django.contrib import admin
from django import forms
from rbac.models import RBACGroup
from django.core.exceptions import ValidationError

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


class RBACGroupInline(admin.TabularInline):  # or admin.StackedInline if you prefer
    model = RBACGroup.categories.through
    extra = 1
    verbose_name = "RBAC Group"
    verbose_name_plural = "RBAC Groups"


class CategoryAdminForm(forms.ModelForm):
    class Meta:
        model = Category
        fields = '__all__'

    def clean(self):
        cleaned_data = super().clean()
        is_rbac_category = cleaned_data.get('is_rbac_category')
        identity_provider = cleaned_data.get('identity_provider')

        # Check if this category has any RBAC groups
        if self.instance.pk:
            has_rbac_groups = self.instance.rbac_groups.exists()
        else:
            has_rbac_groups = False

        # Validation: identity_provider and rbac_groups require is_rbac_category to be True
        if not is_rbac_category:
            if identity_provider:
                self.add_error(
                    'identity_provider',
                    ValidationError('Identity provider can only be specified if "Is RBAC Category" is enabled.')
                )

            if has_rbac_groups:
                self.add_error(
                    'is_rbac_category',
                    ValidationError('This category has RBAC groups assigned. "Is RBAC Category" must be enabled.')
                )

        return cleaned_data


class CategoryAdmin(admin.ModelAdmin):
    form = CategoryAdminForm

    search_fields = ["title"]
    list_display = ["title", "user", "add_date", "is_global", "media_count", "is_rbac_category", "identity_provider"]
    list_filter = ["is_global", "is_rbac_category", "identity_provider"]
    ordering = ("-add_date",)
    readonly_fields = ("user", "media_count")
    inlines = []
    
    def get_inlines(self, request, obj=None):
        if getattr(settings, 'USE_RBAC', False):
            return [RBACGroupInline]
        return []


    def get_fieldsets(self, request, obj=None):
        basic_fieldset = [
            ('Category Information', {
                'fields': [
                    'title', 
                    'description',
                    'user',
                    'is_global', 
                    'media_count',
                    'thumbnail',
                    'listings_thumbnail'
                ],
            }),
        ]
        
        if getattr(settings, 'USE_RBAC', False):
            rbac_fieldset = [
                ('RBAC Settings', {
                    'fields': ['is_rbac_category', 'identity_provider'],
                    'classes': ['tab'],
                    'description': 'Role-Based Access Control settings'
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
