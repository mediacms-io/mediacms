from django.apps import AppConfig

from .keys import ensure_keys_exist


class LtiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'lti'
    verbose_name = 'LTI 1.3 Integration'

    def ready(self):
        """Initialize LTI app - ensure keys exist"""
        # Ensure RSA key pair exists for signing Deep Linking responses
        try:
            ensure_keys_exist()
        except Exception:
            # Don't block startup if key generation fails
            pass
