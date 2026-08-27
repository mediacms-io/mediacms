from django.apps import AppConfig


class OidcAuthConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "oidc_auth"
    verbose_name = "OIDC Authentication"
