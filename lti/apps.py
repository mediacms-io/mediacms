from django.apps import AppConfig

from .keys import ensure_keys_exist


class LtiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'lti'
    verbose_name = 'LTI 1.3 Integration'

    def ready(self):
        """Initialize LTI app - ensure keys exist"""
        try:
            ensure_keys_exist()
        except Exception:
            pass
