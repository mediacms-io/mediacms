from django import forms
from django.conf import settings
from django.contrib import admin
from django.db import transaction
from django.utils.html import format_html

from files.models import Category
from users.models import User

from .models import RBACGroup, RBACMembership, RBACRole


class RoleFilter(admin.SimpleListFilter):
    title = 'Role'
    parameter_name = 'role'

    def lookups(self, request, model_admin):
        return RBACRole.choices

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(memberships__role=self.value()).distinct()
        return queryset


class RBACGroupAdminForm(forms.ModelForm):
    categories = forms.ModelMultipleChoiceField(
        queryset=Category.objects.filter(is_rbac_category=True),
        required=False,
        widget=admin.widgets.FilteredSelectMultiple('Categories', False),
        help_text='Select categories this RBAC group has access to',
    )

    members_field = forms.ModelMultipleChoiceField(
        queryset=User.objects.all(), required=False, widget=admin.widgets.FilteredSelectMultiple('Members', False), help_text='Users with Member role', label=''
    )

    contributors_field = forms.ModelMultipleChoiceField(
        queryset=User.objects.all(), required=False, widget=admin.widgets.FilteredSelectMultiple('Contributors', False), help_text='Users with Contributor role', label=''
    )

    managers_field = forms.ModelMultipleChoiceField(
        queryset=User.objects.all(), required=False, widget=admin.widgets.FilteredSelectMultiple('Managers', False), help_text='Users with Manager role', label=''
    )

    class Meta:
        model = RBACGroup
        fields = ('name',)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if self.instance.pk:
            self.fields['categories'].initial = self.instance.categories.all()

            self.fields['members_field'].initial = User.objects.filter(rbac_memberships__rbac_group=self.instance, rbac_memberships__role=RBACRole.MEMBER)
            self.fields['contributors_field'].initial = User.objects.filter(rbac_memberships__rbac_group=self.instance, rbac_memberships__role=RBACRole.CONTRIBUTOR)
            self.fields['managers_field'].initial = User.objects.filter(rbac_memberships__rbac_group=self.instance, rbac_memberships__role=RBACRole.MANAGER)

    def save(self, commit=True):
        group = super().save(commit=True)

        if commit:
            self.save_m2m()

        if 'categories' in self.cleaned_data:
            self.instance.categories.set(self.cleaned_data['categories'])

        return group

    @transaction.atomic
    def save_m2m(self):
        if self.instance.pk:
            member_users = self.cleaned_data['members_field']
            contributor_users = self.cleaned_data['contributors_field']
            manager_users = self.cleaned_data['managers_field']

            self._update_role_memberships(RBACRole.MEMBER, member_users)
            self._update_role_memberships(RBACRole.CONTRIBUTOR, contributor_users)
            self._update_role_memberships(RBACRole.MANAGER, manager_users)

    def _update_role_memberships(self, role, new_users):
        new_user_ids = User.objects.filter(pk__in=new_users).values_list('pk', flat=True)

        existing_users = User.objects.filter(rbac_memberships__rbac_group=self.instance, rbac_memberships__role=role)

        existing_user_ids = existing_users.values_list('pk', flat=True)

        users_to_add = User.objects.filter(pk__in=new_user_ids).exclude(pk__in=existing_user_ids)
        users_to_remove = existing_users.exclude(pk__in=new_user_ids)

        for user in users_to_add:
            RBACMembership.objects.get_or_create(user=user, rbac_group=self.instance, role=role)

        RBACMembership.objects.filter(user__in=users_to_remove, rbac_group=self.instance, role=role).delete()


class RBACGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'get_member_count', 'get_contributor_count', 'get_manager_count', 'categories_list')
    form = RBACGroupAdminForm
    list_filter = (RoleFilter,)
    search_fields = ['name', 'uid', 'description', 'identity_provider__name']
    filter_horizontal = ['categories']
    change_form_template = 'admin/rbac/rbacgroup/change_form.html'

    def get_list_filter(self, request):
        list_filter = list(self.list_filter)

        if getattr(settings, 'USE_IDENTITY_PROVIDERS', False):
            list_filter.insert(-1, "identity_provider")

        return list_filter

    def get_list_display(self, request):
        list_display = list(self.list_display)
        if getattr(settings, 'USE_IDENTITY_PROVIDERS', False):
            list_display.insert(-1, "identity_provider")

        return list_display

    def get_member_count(self, obj):
        return obj.memberships.filter(role=RBACRole.MEMBER).count()

    get_member_count.short_description = 'Members'

    def get_contributor_count(self, obj):
        return obj.memberships.filter(role=RBACRole.CONTRIBUTOR).count()

    get_contributor_count.short_description = 'Contributors'

    def get_manager_count(self, obj):
        return obj.memberships.filter(role=RBACRole.MANAGER).count()

    get_manager_count.short_description = 'Managers'

    fieldsets = (
        (
            None,
            {
                'fields': ('uid', 'name', 'description', 'created_at', 'updated_at'),
            },
        ),
    )

    def get_fieldsets(self, request, obj=None):
        fieldsets = super().get_fieldsets(request, obj)
        if getattr(settings, 'USE_IDENTITY_PROVIDERS', False):
            fieldsets = (
                (
                    None,
                    {
                        'fields': ('identity_provider', 'uid', 'name', 'description', 'created_at', 'updated_at'),
                    },
                ),
            )

        if obj:
            fieldsets += (
                ('Members', {'fields': ['members_field'], 'description': 'Select users for members. The same user cannot be contributor or manager'}),
                ('Contributors', {'fields': ['contributors_field'], 'description': 'Select users for contributors. The same user cannot be member or manager'}),
                ('Managers', {'fields': ['managers_field'], 'description': 'Select users for managers. The same user cannot be member or contributor'}),
                ('Access To Categories', {'fields': ['categories'], 'classes': ['collapse', 'open'], 'description': 'Select which categories this RBAC group has access to'}),
            )
        return fieldsets

    readonly_fields = ['created_at', 'updated_at']

    def member_count(self, obj):
        count = obj.memberships.count()
        return format_html('<a href="?rbac_group__id__exact={}">{} members</a>', obj.id, count)

    member_count.short_description = 'Members'

    def categories_list(self, obj):
        return ", ".join([c.title for c in obj.categories.all()])

    categories_list.short_description = 'Categories'

    def formfield_for_dbfield(self, db_field, **kwargs):
        field = super().formfield_for_dbfield(db_field, **kwargs)
        if db_field.name == 'social_app':
            field.label = 'ID Provider'
        return field


class RBACMembershipAdmin(admin.ModelAdmin):
    list_display = ['user', 'rbac_group', 'role', 'joined_at', 'updated_at']

    list_filter = ['role', 'rbac_group', 'joined_at', 'updated_at']

    search_fields = ['user__username', 'user__email', 'rbac_group__name', 'rbac_group__uid']

    raw_id_fields = ['user']
    autocomplete_fields = ['user']

    readonly_fields = ['joined_at', 'updated_at']

    fieldsets = [(None, {'fields': ['user', 'rbac_group', 'role']}), ('Timestamps', {'fields': ['joined_at', 'updated_at'], 'classes': ['collapse']})]


if getattr(settings, 'USE_RBAC', False):
    for field in RBACGroup._meta.fields:
        if field.name == 'social_app':
            field.verbose_name = "ID Provider"

    RBACGroup._meta.verbose_name_plural = "Groups"
    RBACGroup._meta.verbose_name = "Group"
    RBACMembership._meta.verbose_name_plural = "Role Based Access Control Membership"
    RBACGroup._meta.app_config.verbose_name = "Role Based Access Control"

    admin.site.register(RBACGroup, RBACGroupAdmin)
    admin.site.register(RBACMembership, RBACMembershipAdmin)
