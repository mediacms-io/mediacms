from django.apps import AppConfig


class LtiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'lti'
    verbose_name = 'LTI 1.3 Integration'

    def ready(self):
        """Import signal handlers when app is ready"""
        # Import any signals here if needed in the future
        pass
