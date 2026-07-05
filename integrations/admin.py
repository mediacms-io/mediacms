from django import forms
from django.contrib import admin

from .models import Integration


class IntegrationAdminForm(forms.ModelForm):
    class Meta:
        model = Integration
        fields = '__all__'
        widgets = {
            # Mask the key in the form so it is not shown in plain text on screen.
            'api_key': forms.PasswordInput(render_value=True),
        }


@admin.register(Integration)
class IntegrationAdmin(admin.ModelAdmin):
    form = IntegrationAdminForm
    list_display = ('service', 'enabled', 'model_name', 'updated_at')
    list_filter = ('service', 'enabled')
    search_fields = ('service', 'model_name')
    readonly_fields = ('created_at', 'updated_at')

    fieldsets = (
        (None, {'fields': ('service', 'enabled')}),
        ('Configuration', {'fields': ('model_name', 'api_key', 'config')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )
