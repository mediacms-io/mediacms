from django.conf.urls import url
from . import views

urlpatterns = [
    url(r"^user/(?P<username>[\w@._-]*)$", views.view_user, name="get_user"),
    url(
        r"^user/(?P<username>[\w@.]*)/media$",
        views.view_user_media,
        name="get_user_media",
    ),
    url(
        r"^user/(?P<username>[\w@.]*)/playlists$",
        views.view_user_playlists,
        name="get_user_playlists",
    ),
    url(
        r"^user/(?P<username>[\w@.]*)/about$",
        views.view_user_about,
        name="get_user_about",
    ),
    url(r"^user/(?P<username>[\w@.]*)/edit$", views.edit_user, name="edit_user"),
    url(
        r"^channel/(?P<friendly_token>[\w]*)$", views.view_channel, name="view_channel"
    ),
    url(
        r"^channel/(?P<friendly_token>[\w]*)/edit$",
        views.edit_channel,
        name="edit_channel",
    ),
    # API VIEWS
    url(r"^api/v1/users$", views.UserList.as_view(), name="api_users"),
    url(r"^api/v1/users/$", views.UserList.as_view()),
    url(
        r"^api/v1/users/(?P<username>[\w@._-]*)$",
        views.UserDetail.as_view(),
        name="api_get_user",
    ),
    url(
        r"^api/v1/users/(?P<username>[\w@._-]*)/contact",
        views.contact_user,
        name="api_contact_user",
    ),
]
