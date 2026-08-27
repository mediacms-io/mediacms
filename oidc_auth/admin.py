from django.contrib import admin

from .models import OIDCConfiguration, OIDCScopeConfig


class OIDCConfigurationInline(admin.StackedInline):
    model = OIDCConfiguration
    extra = 0
    can_delete = True
    max_num = 1
    verbose_name = "OIDC Configuration"
    verbose_name_plural = "OIDC Configuration"


class OIDCScopeConfigInline(admin.TabularInline):
    model = OIDCScopeConfig
    extra = 1
    verbose_name = "Claim Handler"
    verbose_name_plural = "Claim Handlers"


@admin.register(OIDCConfiguration)
class OIDCConfigurationAdmin(admin.ModelAdmin):
    list_display = (
        "social_app",
        "uid_claim",
        "email_claim",
        "verified_email",
        "remove_from_groups",
        "save_oidc_response_logs",
    )
    list_filter = ("verified_email", "remove_from_groups", "save_oidc_response_logs")
    search_fields = ("social_app__name",)
    inlines = [OIDCScopeConfigInline]
    fieldsets = (
        (
            "Social App",
            {"fields": ("social_app",)},
        ),
        (
            "Claim Mapping",
            {
                "fields": (
                    "uid_claim",
                    "email_claim",
                    "name_claim",
                    "first_name_claim",
                    "last_name_claim",
                )
            },
        ),
        (
            "Scopes",
            {"fields": ("scopes",)},
        ),
        (
            "Behaviour",
            {
                "fields": (
                    "verified_email",
                    "email_authentication",
                    "remove_from_groups",
                    "save_oidc_response_logs",
                )
            },
        ),
    )
