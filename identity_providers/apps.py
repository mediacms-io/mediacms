from django.apps import AppConfig


class IdentityProvidersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'identity_providers'

    def ready(self):
        from allauth.socialaccount.models import SocialApp
        from django.db.models.signals import post_delete

        from identity_providers.providers import delete_login_option_for_app

        post_delete.connect(delete_login_option_for_app, sender=SocialApp, dispatch_uid="identity_providers.delete_login_option")
