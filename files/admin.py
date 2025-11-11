from django import forms
from django.conf import settings
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.db import transaction
from tinymce.widgets import TinyMCE

from rbac.models import RBACGroup

from .models import (
    Category,
    Comment,
    EncodeProfile,
    Encoding,
    Language,
    Media,
    Page,
    Subtitle,
    Tag,
    TinyMCEMedia,
    TranscriptionRequest,
    VideoTrimRequest,
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


class CategoryAdminForm(forms.ModelForm):
    rbac_groups = forms.ModelMultipleChoiceField(queryset=RBACGroup.objects.all(), required=False, widget=admin.widgets.FilteredSelectMultiple('Groups', False))

    class Meta:
        model = Category
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
    readonly_fields = ("user", "media_count")
    change_form_template = 'admin/files/category/change_form.html'

    def get_list_filter(self, request):
        list_filter = list(self.list_filter)

        if getattr(settings, 'USE_RBAC', False):
            list_filter.insert(0, "is_rbac_category")
        if getattr(settings, 'USE_IDENTITY_PROVIDERS', False):
            list_filter.insert(-1, "identity_provider")

        return list_filter

    def get_list_display(self, request):
        list_display = list(self.list_display)
        if getattr(settings, 'USE_RBAC', False):
            list_display.insert(-1, "is_rbac_category")
        if getattr(settings, 'USE_IDENTITY_PROVIDERS', False):
            list_display.insert(-1, "identity_provider")

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
    list_display = ["id", "language", "media"]
    list_filter = ["language"]
    search_fields = ["media__title"]
    readonly_fields = ("media", "user")


class VideoTrimRequestAdmin(admin.ModelAdmin):
    list_display = ["media", "status", "add_date", "video_action", "media_trim_style", "timestamps"]
    list_filter = ["status", "video_action", "media_trim_style", "add_date"]
    search_fields = ["media__title"]
    readonly_fields = ("add_date",)
    ordering = ("-add_date",)


class EncodingAdmin(admin.ModelAdmin):
    list_display = ["get_title", "chunk", "profile", "progress", "status", "has_file"]
    list_filter = ["chunk", "profile", "status"]

    def get_title(self, obj):
        return str(obj)

    get_title.short_description = "Encoding"

    def has_file(self, obj):
        return obj.media_encoding_url is not None

    has_file.short_description = "Has file"


class TranscriptionRequestAdmin(admin.ModelAdmin):
    list_display = ["media", "add_date", "status", "translate_to_english"]
    list_filter = ["status", "translate_to_english", "add_date"]
    search_fields = ["media__title"]
    readonly_fields = ("add_date", "logs")
    ordering = ("-add_date",)


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

Media._meta.app_config.verbose_name = "Media"
