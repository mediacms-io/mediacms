from django import forms
from django.conf import settings
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.db import transaction

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
            has_rbac_groups = self.instance.rbac_groups.exists()
        else:
            has_rbac_groups = False

        # Validation: identity_provider and rbac_groups require is_rbac_category to be True
        if not is_rbac_category:
            # if identity_provider:
            #    self.add_error(
            #        'identity_provider',
            #        ValidationError('Identity provider can only be specified if "Is RBAC Category" is enabled.')
            #    )

            if has_rbac_groups:
                self.add_error('is_rbac_category', ValidationError('This category has RBAC groups assigned. "Is RBAC Category" must be enabled.'))

        # TOTHINK: rbac without identity provider should be allowed!
        if False and not identity_provider and has_rbac_groups:
            self.add_error('identity_provider', ValidationError('Identity provider has to be specified if Groups are selected.'))
        for rbac_group in cleaned_data['rbac_groups']:
            if rbac_group.identity_provider != identity_provider:
                self.add_error('rbac_groups', ValidationError('Chosen Groups are associated with a different Identity Provider than the one selected here.'))

        return cleaned_data

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if self.instance.pk:
            # if self.instance.identity_provider:
            #    self.fields['rbac_groups'].queryset=RBACGroup.objects.filter(identity_provider=self.instance.identity_provider)
            self.fields['rbac_groups'].initial = self.instance.rbac_groups.all()

    def save(self, commit=True):
        category = super().save(commit=True)

        if commit:
            self.save_m2m()

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

    search_fields = ["title"]
    list_display = ["title", "user", "add_date", "media_count", "is_rbac_category", "identity_provider"]
    list_filter = ["is_rbac_category", "identity_provider"]
    ordering = ("-add_date",)
    readonly_fields = ("user", "media_count")

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
