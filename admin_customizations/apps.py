from django.apps import AppConfig
from django.conf import settings
from django.contrib import admin


class AdminCustomizationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'admin_customizations'

    def ready(self):
        # Import here to avoid AppRegistryNotReady error
        from .admin import calculate_statistics
        
        # Patch the index method to add statistics
        original_index = admin.site.index
        
        def custom_index(self, request, extra_context=None):
            """Custom index with statistics"""
            extra_context = extra_context or {}
            
            # Calculate statistics
            stats = calculate_statistics()
            extra_context['dashboard_stats'] = stats
            
            # Call original index to get app_list and other context
            response = original_index(request, extra_context)
            
            return response
        
        # Patch the index method
        admin.site.index = custom_index.__get__(admin.site, admin.AdminSite)
        
        # Set custom index template
        admin.site.index_template = 'admin/index.html'
        
        original_get_app_list = admin.AdminSite.get_app_list

        def get_app_list(self, request, app_label=None):
            """Custom get_app_list"""
            app_list = original_get_app_list(self, request, app_label)
            # To see the list:
            # print([a.get('app_label') for a in app_list])

            email_model = None
            rbac_group_model = None
            identity_providers_user_log_model = None
            identity_providers_login_option = None
            auth_app = None
            rbac_app = None
            socialaccount_app = None

            for app in app_list:
                if app['app_label'] == 'users':
                    auth_app = app

                elif app['app_label'] == 'account':
                    for model in app['models']:
                        if model['object_name'] == 'EmailAddress':
                            email_model = model
                elif app['app_label'] == 'rbac':
                    if not getattr(settings, 'USE_RBAC', False):
                        continue
                    rbac_app = app
                    for model in app['models']:
                        if model['object_name'] == 'RBACGroup':
                            rbac_group_model = model
                elif app['app_label'] == 'identity_providers':
                    if not getattr(settings, 'USE_IDENTITY_PROVIDERS', False):
                        continue

                    models_to_check = list(app['models'])

                    for model in models_to_check:
                        if model['object_name'] == 'IdentityProviderUserLog':
                            identity_providers_user_log_model = model
                        if model['object_name'] == 'LoginOption':
                            identity_providers_login_option = model
                elif app['app_label'] == 'socialaccount':
                    socialaccount_app = app

            if email_model and auth_app:
                auth_app['models'].append(email_model)
            if rbac_group_model and rbac_app and auth_app:
                auth_app['models'].append(rbac_group_model)
            if identity_providers_login_option and socialaccount_app:
                socialaccount_app['models'].append(identity_providers_login_option)
            if identity_providers_user_log_model and socialaccount_app:
                socialaccount_app['models'].append(identity_providers_user_log_model)

            # 2. don't include the following apps
            apps_to_hide = ['authtoken', 'auth', 'account', 'saml_auth', 'rbac']
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

        # Apply custom get_app_list to admin site
        admin.AdminSite.get_app_list = get_app_list
