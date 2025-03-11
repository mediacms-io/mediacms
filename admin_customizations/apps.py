from django.apps import AppConfig
from django.conf import settings
from django.contrib import admin


class AdminCustomizationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'admin_customizations'

    def ready(self):
        original_get_app_list = admin.AdminSite.get_app_list

        def get_app_list(self, request, app_label=None):
            """Custom get_app_list method with custom ordering."""
            app_list = original_get_app_list(self, request, app_label)
            # print([a.get('app_label') for a in app_list])

            # don't include the following
            apps_to_hide = ['authtoken', 'auth']
            if not getattr(settings, 'USE_SAML', False):
                apps_to_hide.append('saml_auth')
            if not getattr(settings, 'USE_RBAC', False):
                apps_to_hide.append('rbac')

            app_list = [app for app in app_list if app['app_label'] not in apps_to_hide]

            app_order = {
                'files': 1,
                'users': 2,
                'socialaccount': 3,
                'saml_auth': 4,
                'rbac': 5,
            }

            app_list.sort(key=lambda x: app_order.get(x['app_label'], 999))

            return app_list

        admin.AdminSite.get_app_list = get_app_list
