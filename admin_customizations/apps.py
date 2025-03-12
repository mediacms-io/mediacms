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
            auth_app = None
            account_app = None

            for app in app_list:
                if app['app_label'] == 'users':
                    auth_app = app
                elif app['app_label'] == 'saml_auth':
                    desired_order = ['SAMLConfiguration', 'SAMLConfigurationGlobalRole', 'SAMLConfigurationGroupRole', 'SAMLLog']
                    ordered_models = []
                    model_dict = {model['object_name']: model for model in app['models']}
                    for model_name in desired_order:
                        if model_name in model_dict:
                            ordered_models.append(model_dict[model_name])

                    app['models'] = ordered_models
                
                elif app['app_label'] == 'account':
                    account_app = app
                    for model in app['models']:
                        if model['object_name'] == 'EmailAddress':
                            email_model = model
                            account_app['models'].remove(model)
                            break
            if email_model and auth_app:
                auth_app['models'].append(email_model)

            # 2. don't include the following apps
            apps_to_hide = ['authtoken', 'auth', 'account']
            if not getattr(settings, 'USE_SAML', False):
                apps_to_hide.append('saml_auth')
            if not getattr(settings, 'USE_RBAC', False):
                apps_to_hide.append('rbac')

            app_list = [app for app in app_list if app['app_label'] not in apps_to_hide]

            # 3. change the ordering 
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
