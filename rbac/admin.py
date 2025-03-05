from django.conf import settings

from django.contrib import admin
from django.contrib.auth.models import Group
from django.utils.html import format_html
from allauth.socialaccount.apps import SocialAccountConfig
from allauth.socialaccount.models import SocialAccount, SocialApp, SocialToken


from .models import RBACGroup, RBACMembership

class RBACMembershipInline(admin.TabularInline):
    model = RBACMembership
    extra = 1
    raw_id_fields = ['user']
    autocomplete_fields = ['user']
    fields = ['user', 'role', 'joined_at', 'updated_at']
    readonly_fields = ['joined_at', 'updated_at']


class RBACGroupAdmin(admin.ModelAdmin):
    list_display = [
        'name',
        'uid',
        'social_app',
        'created_at',
        'member_count',
        'categories_list'
    ]
    
    list_filter = [
        'social_app',
        'created_at',
        'categories'
    ]
    
    search_fields = [
        'name',
        'uid',
        'description',
        'social_app__name'
    ]
    
    filter_horizontal = ['categories']
    
    inlines = [RBACMembershipInline]
    
    fieldsets = [
        (None, {
            'fields': [
                'uid',
                'name',
                'description'
            ]
        }),
        ('Associations', {
            'fields': [
                'social_app',
                'categories'
            ]
        }),
        ('Timestamps', {
            'fields': [
                'created_at',
                'updated_at'
            ],
            'classes': ['collapse']
        })
    ]
    
    readonly_fields = ['created_at', 'updated_at']

    def member_count(self, obj):
        """Display number of members in the group"""
        count = obj.memberships.count()
        return format_html(
            '<a href="?rbac_group__id__exact={}">{} members</a>',
            obj.id, count
        )
    member_count.short_description = 'Members'

    def categories_list(self, obj):
        """Display categories as a comma-separated list"""
        return ", ".join([c.title for c in obj.categories.all()])
    categories_list.short_description = 'Categories'

class RBACMembershipAdmin(admin.ModelAdmin):
    list_display = [
        'user',
        'rbac_group',
        'role',
        'joined_at',
        'updated_at'
    ]
    
    list_filter = [
        'role',
        'rbac_group',
        'joined_at',
        'updated_at'
    ]
    
    search_fields = [
        'user__username',
        'user__email',
        'rbac_group__name',
        'rbac_group__uid'
    ]
    
    raw_id_fields = ['user']
    autocomplete_fields = ['user']
    
    readonly_fields = ['joined_at', 'updated_at']
    
    fieldsets = [
        (None, {
            'fields': [
                'user',
                'rbac_group',
                'role'
            ]
        }),
        ('Timestamps', {
            'fields': [
                'joined_at',
                'updated_at'
            ],
            'classes': ['collapse']
        })
    ]

if getattr(settings, 'USE_RBAC', False):
    admin.site.register(RBACGroup, RBACGroupAdmin)
    admin.site.register(RBACMembership, RBACMembershipAdmin)
    admin.site.unregister(Group)

    admin.site.unregister(SocialToken)

    SocialAccount._meta.verbose_name = "User Account"
    SocialAccount._meta.verbose_name_plural = "User Accounts"
   
    SocialApp._meta.verbose_name = "ID Provider"
    SocialApp._meta.verbose_name_plural = "ID Providers"

    SocialAccount._meta.app_config.verbose_name = "Identity Providers"

