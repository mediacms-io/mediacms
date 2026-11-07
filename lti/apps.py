from django.apps import AppConfig


class LtiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'lti'
    verbose_name = 'LTI 1.3 Integration'
