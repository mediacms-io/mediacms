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


class CategoryAdminForm(forms.ModelForm):
    rbac_groups = forms.ModelMultipleChoiceField(
        queryset=RBACGroup.objects.all(),
        required=False,
        widget=admin.widgets.FilteredSelectMultiple('RBAC Groups', False),
        help_text='Select RBAC groups that have access to this category'
    )
    
    class Meta:
        model = Category
        fields = '__all__'
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # If this is an existing object, initialize the field with current values
        if self.instance and self.instance.pk:
            self.fields['rbac_groups'].initial = self.instance.rbac_groups.all()
   
    def clean(self):
        cleaned_data = super().clean()
        is_rbac_category = cleaned_data.get('is_rbac_category')
        identity_provider = cleaned_data.get('identity_provider')
        rbac_groups = cleaned_data.get('rbac_groups')
        
        if not is_rbac_category:
            if identity_provider:
                self.add_error(
                    'identity_provider', 
                    ValidationError('Identity provider can only be specified if "Is RBAC Category" is enabled.')
                )
            
            if rbac_groups and rbac_groups.count() > 0:
                self.add_error(
                    'rbac_groups', 
                    ValidationError('RBAC Groups can only be specified if "Is RBAC Category" is enabled.')
                )
        
        return cleaned_data
   
    def save(self, commit=True):
        instance = super().save(commit=False)
        
        # Save the instance first if it's new
        if commit:
            instance.save()
        
        # Handle the m2m relationship manually
        if 'rbac_groups' in self.cleaned_data:
            # Clear existing relationships and add new ones
            self.instance.rbac_groups.set(self.cleaned_data['rbac_groups'])
        
        return instance


class CategoryAdmin(admin.ModelAdmin):
    search_fields = ["title"]
    list_display = ["title", "user", "add_date", "is_global", "media_count", "is_rbac_category", "identity_provider"]
    list_filter = ["is_global", "is_rbac_category", "identity_provider"]
    ordering = ("-add_date",)
    readonly_fields = ("user", "media_count")
    form = CategoryAdminForm

    def get_fieldsets(self, request, obj=None):
        basic_fieldset = [
            (None, {
                'fields': ['title', 'user', 'is_global', 'media_count']
            }),
        ]
        
        if getattr(settings, 'USE_RBAC', False):
            rbac_fieldset = [
                ('RBAC Settings', {
                    'fields': ['is_rbac_category', 'identity_provider', 'rbac_groups'],
                    'classes': ['collapse', 'open'],
                    'description': 'Role-Based Access Control settings for this category'
                }),
            ]
            return basic_fieldset + rbac_fieldset
        else:
            return basic_fieldset
    
    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        if not getattr(settings, 'USE_RBAC', False) and 'rbac_groups' in form.base_fields:
            del form.base_fields['rbac_groups']
        return form


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
