from django.contrib import admin
from django.urls import path
from django.conf.urls import url, include
import debug_toolbar

urlpatterns = [
    url(r"^__debug__/", include(debug_toolbar.urls)),
    url(r"^", include("files.urls")),
    url(r"^", include("users.urls")),
    url(r"^accounts/", include("allauth.urls")),
    url(r"^api-auth/", include("rest_framework.urls")),
    path("admin/", admin.site.urls),
]
