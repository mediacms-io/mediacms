from django.apps import AppConfig
from django.conf import settings
from django.contrib import admin


class AdminCustomizationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'admin_customizations'

    def ready(self):
        original_get_app_list = admin.AdminSite.get_app_list

        def get_app_list(self, request, app_label=None):
            """Custom get_app_list"""
            app_list = original_get_app_list(self, request, app_label)
            # To see the list: 
            # print([a.get('app_label') for a in app_list])

            # 1. move Social Account EmailAddress to Users
            email_model = None
            rbac_group_model = None
            identity_providers_user_log_model = None

            auth_app = None
            account_app = None
            account_app = None
            rbac_app = None
            socialaccount_app = None
            identity_providers_app = None

            for app in app_list:
                if app['app_label'] == 'users':
                    auth_app = app
                
                elif app['app_label'] == 'account':
                    account_app = app
                    for model in app['models']:
                        if model['object_name'] == 'EmailAddress':
                            email_model = model
                            account_app['models'].remove(model)
                            break
                elif app['app_label'] == 'rbac':
                    if not getattr(settings, 'USE_RBAC', False):
                        continue
                    rbac_app = app
                    for model in app['models']:
                        if model['object_name'] == 'RBACGroup':
                            rbac_group_model = model
                            rbac_app['models'].remove(model)
                            break
                elif app['app_label'] == 'identity_providers':
                    identity_providers_app = app
                    for model in app['models']:
                        if model['object_name'] == 'IdentityProviderUserLog':
                            identity_providers_user_log_model = model
                            identity_providers_app['models'].remove(model)
                            break
                elif app['app_label'] == 'socialaccount':
                    socialaccount_app = app

            if email_model and auth_app:
                auth_app['models'].append(email_model)
            if rbac_group_model and rbac_app:
                auth_app['models'].append(rbac_group_model)
            if identity_providers_user_log_model and socialaccount_app:
                socialaccount_app['models'].append(identity_providers_user_log_model)

            # 2. don't include the following apps
            apps_to_hide = ['authtoken', 'auth', 'account', 'identity_providers', 'saml_auth', 'rbac']
            if not getattr(settings, 'USE_RBAC', False):
                apps_to_hide.append('rbac')
            if not getattr(settings, 'USE_IDENTITY_PROVIDERS', False):
                apps_to_hide.append('socialaccount')

            app_list = [app for app in app_list if app['app_label'] not in apps_to_hide]

            # 3. change the ordering 
            app_order = {
                'files': 1,
                'users': 2,
                'socialaccount': 3,
                'rbac': 5,
            }

            app_list.sort(key=lambda x: app_order.get(x['app_label'], 999))

            return app_list

        admin.AdminSite.get_app_list = get_app_list
