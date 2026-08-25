from django.urls import path, re_path
from rest_framework.routers import SimpleRouter

from . import views

# SimpleRouter, not DefaultRouter: this module is included at the site root, so
# DefaultRouter's auto generated api-root view would be mounted at "/" itself,
# outside this app's permission class.
router = SimpleRouter()
router.register(r"api/v1/migrations", views.MigrationServiceViewSet, basename="migrations")

urlpatterns = router.urls + [
    re_path(r"^migrations$", views.migrations_list, name="migrations_list"),
    re_path(r"^migrations/new$", views.migration_new, name="migration_new"),
    re_path(r"^migrations/new/(?P<source>[\w-]+)$", views.migration_edit, name="migration_new_source"),
    path("migrations/<int:pk>/edit", views.migration_edit, name="migration_edit"),
    path("migrations/<int:pk>", views.migration_detail, name="migration_detail"),
]
