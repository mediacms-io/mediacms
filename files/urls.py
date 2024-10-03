from django.conf import settings
from django.conf.urls import include
from django.conf.urls.static import static
from django.urls import path, re_path

from . import management_views, views
from .feeds import IndexRSSFeed, SearchRSSFeed

urlpatterns = [
    path("i18n/", include("django.conf.urls.i18n")),
    re_path(r"^$", views.index),
    re_path(r"^about", views.about, name="about"),
    re_path(r"^setlanguage", views.setlanguage, name="setlanguage"),
    re_path(r"^add_subtitle", views.add_subtitle, name="add_subtitle"),
    re_path(r"^categories$", views.categories, name="categories"),
    re_path(r"^contact$", views.contact, name="contact"),
    re_path(r"^edit", views.edit_media, name="edit_media"),
    re_path(r"^embed", views.embed_media, name="get_embed"),
    re_path(r"^featured$", views.featured_media),
    re_path(r"^fu/", include(("uploader.urls", "uploader"), namespace="uploader")),
    re_path(r"^history$", views.history, name="history"),
    re_path(r"^liked$", views.liked_media, name="liked_media"),
    re_path(r"^latest$", views.latest_media),
    re_path(r"^members", views.members, name="members"),
    re_path(
        r"^playlist/(?P<friendly_token>[\w]*)$",
        views.view_playlist,
        name="get_playlist",
    ),
    re_path(
        r"^playlists/(?P<friendly_token>[\w]*)$",
        views.view_playlist,
        name="get_playlist",
    ),
    re_path(r"^popular$", views.recommended_media),
    re_path(r"^recommended$", views.recommended_media),
    path("rss/", IndexRSSFeed()),
    re_path("^rss/search", SearchRSSFeed()),
    re_path(r"^search", views.search, name="search"),
    re_path(r"^scpublisher", views.upload_media, name="upload_media"),
    re_path(r"^tags", views.tags, name="tags"),
    re_path(r"^tos$", views.tos, name="terms_of_service"),
    re_path(r"^view", views.view_media, name="get_media"),
    re_path(r"^upload", views.upload_media, name="upload_media"),
    # API VIEWS
    re_path(r"^api/v1/media$", views.MediaList.as_view()),
    re_path(r"^api/v1/media/$", views.MediaList.as_view()),
    re_path(
        r"^api/v1/media/(?P<friendly_token>[\w]*)$",
        views.MediaDetail.as_view(),
        name="api_get_media",
    ),
    re_path(
        r"^api/v1/media/encoding/(?P<encoding_id>[\w]*)$",
        views.EncodingDetail.as_view(),
        name="api_get_encoding",
    ),
    re_path(r"^api/v1/search$", views.MediaSearch.as_view()),
    re_path(
        r"^api/v1/media/(?P<friendly_token>[\w]*)/actions$",
        views.MediaActions.as_view(),
    ),
    re_path(r"^api/v1/categories$", views.CategoryList.as_view()),
    re_path(r"^api/v1/tags$", views.TagList.as_view()),
    re_path(r"^api/v1/comments$", views.CommentList.as_view()),
    re_path(
        r"^api/v1/media/(?P<friendly_token>[\w]*)/comments$",
        views.CommentDetail.as_view(),
    ),
    re_path(
        r"^api/v1/media/(?P<friendly_token>[\w]*)/comments/(?P<uid>[\w-]*)$",
        views.CommentDetail.as_view(),
    ),
    re_path(r"^api/v1/playlists$", views.PlaylistList.as_view()),
    re_path(r"^api/v1/playlists/$", views.PlaylistList.as_view()),
    re_path(
        r"^api/v1/playlists/(?P<friendly_token>[\w]*)$",
        views.PlaylistDetail.as_view(),
        name="api_get_playlist",
    ),
    re_path(r"^api/v1/user/action/(?P<action>[\w]*)$", views.UserActions.as_view()),
    # ADMIN VIEWS
    re_path(r"^api/v1/encode_profiles/$", views.EncodeProfileList.as_view()),
    re_path(r"^api/v1/manage_media$", management_views.MediaList.as_view()),
    re_path(r"^api/v1/manage_comments$", management_views.CommentList.as_view()),
    re_path(r"^api/v1/manage_users$", management_views.UserList.as_view()),
    re_path(r"^api/v1/tasks$", views.TasksList.as_view()),
    re_path(r"^api/v1/tasks/$", views.TasksList.as_view()),
    re_path(r"^api/v1/tasks/(?P<friendly_token>[\w|\W]*)$", views.TaskDetail.as_view()),
    re_path(r"^manage/comments$", views.manage_comments, name="manage_comments"),
    re_path(r"^manage/media$", views.manage_media, name="manage_media"),
    re_path(r"^manage/users$", views.manage_users, name="manage_users"),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if hasattr(settings, "GENERATE_SITEMAP") and settings.GENERATE_SITEMAP:
    urlpatterns.append(path("sitemap.xml", views.sitemap, name="sitemap"))
