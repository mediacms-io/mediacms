from django.apps import AppConfig
from django.contrib import admin
from django.urls import path


class AdminCustomizationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'admin_customizations'

    def ready(self):
        # Import here to avoid AppRegistryNotReady error
        from .action_choices import patch_model_admin_action_choices
        from .admin import calculate_statistics
        from .object_actions import patch_model_admin_object_actions
        from .sidebar import build_workflow_app_list
        from .views import dashboard_section

        patch_model_admin_action_choices()
        patch_model_admin_object_actions()

        # Patch the index method to add statistics
        original_index = admin.site.index

        def custom_index(self, request, extra_context=None):
            """Custom index with statistics"""
            extra_context = extra_context or {}

            force_refresh = request.GET.get("refresh_stats") == "1" and request.user.is_staff
            extra_context["dashboard_stats"] = calculate_statistics(force_refresh=force_refresh)

            # Call original index to get app_list and other context
            response = original_index(request, extra_context)

            return response

        # Patch the index method
        admin.site.index = custom_index.__get__(admin.site, admin.AdminSite)

        # Set custom index template
        admin.site.index_template = 'admin/index.html'

        original_get_urls = admin.AdminSite.get_urls

        def get_urls(self):
            custom = [
                path(
                    "dashboard/<slug:section>/",
                    self.admin_view(dashboard_section),
                    name="dashboard_section",
                ),
            ]
            return custom + original_get_urls(self)

        admin.AdminSite.get_urls = get_urls

        original_get_app_list = admin.AdminSite.get_app_list

        def get_app_list(self, request, app_label=None):
            """Group admin navigation by workflow instead of Django app labels."""
            # Always build from the full permitted list so models can move across groups.
            raw_app_list = original_get_app_list(self, request, None)
            app_list = build_workflow_app_list(raw_app_list)

            if app_label:
                matching = [app for app in app_list if app["app_label"] == app_label]
                if matching:
                    return matching
                # Preserve /admin/<real-app>/ indexes (e.g. files) for bookmarks and tests.
                return original_get_app_list(self, request, app_label)

            return app_list

        # Apply custom get_app_list to admin site
        admin.AdminSite.get_app_list = get_app_list
