from django.conf import settings
from django.conf.urls import include, url
from django.conf.urls.static import static
from django.urls import path

from . import management_views, views
from .feeds import IndexRSSFeed, SearchRSSFeed

urlpatterns = [
    url(r"^$", views.index),
    url(r"^about", views.about, name="about"),
    url(r"^add_subtitle", views.add_subtitle, name="add_subtitle"),
    url(r"^categories$", views.categories, name="categories"),
    url(r"^contact$", views.contact, name="contact"),
    url(r"^edit", views.edit_media, name="edit_media"),
    url(r"^embed", views.embed_media, name="get_embed"),
    url(r"^featured$", views.featured_media),
    url(r"^fu/", include(("uploader.urls", "uploader"), namespace="uploader")),
    url(r"^history$", views.history, name="history"),
    url(r"^liked$", views.liked_media, name="liked_media"),
    url(r"^latest$", views.latest_media),
    url(r"^members", views.members, name="members"),
    url(
        r"^playlist/(?P<friendly_token>[\w]*)$",
        views.view_playlist,
        name="get_playlist",
    ),
    url(
        r"^playlists/(?P<friendly_token>[\w]*)$",
        views.view_playlist,
        name="get_playlist",
    ),
    url(r"^popular$", views.recommended_media),
    url(r"^recommended$", views.recommended_media),
    path("rss/", IndexRSSFeed()),
    url("^rss/search", SearchRSSFeed()),
    url(r"^search", views.search, name="search"),
    url(r"^scpublisher", views.upload_media, name="upload_media"),
    url(r"^tags", views.tags, name="tags"),
    url(r"^tos$", views.tos, name="terms_of_service"),
    url(r"^view", views.view_media, name="get_media"),
    url(r"^upload", views.upload_media, name="upload_media"),
    # API VIEWS
    url(r"^api/v1/media$", views.MediaList.as_view()),
    url(r"^api/v1/media/$", views.MediaList.as_view()),
    url(
        r"^api/v1/media/(?P<friendly_token>[\w]*)$",
        views.MediaDetail.as_view(),
        name="api_get_media",
    ),
    url(
        r"^api/v1/media/encoding/(?P<encoding_id>[\w]*)$",
        views.EncodingDetail.as_view(),
        name="api_get_encoding",
    ),
    url(r"^api/v1/search$", views.MediaSearch.as_view()),
    url(
        r"^api/v1/media/(?P<friendly_token>[\w]*)/actions$",
        views.MediaActions.as_view(),
    ),
    url(r"^api/v1/categories$", views.CategoryList.as_view()),
    url(r"^api/v1/tags$", views.TagList.as_view()),
    url(r"^api/v1/comments$", views.CommentList.as_view()),
    url(
        r"^api/v1/media/(?P<friendly_token>[\w]*)/comments$",
        views.CommentDetail.as_view(),
    ),
    url(
        r"^api/v1/media/(?P<friendly_token>[\w]*)/comments/(?P<uid>[\w-]*)$",
        views.CommentDetail.as_view(),
    ),
    url(r"^api/v1/playlists$", views.PlaylistList.as_view()),
    url(r"^api/v1/playlists/$", views.PlaylistList.as_view()),
    url(
        r"^api/v1/playlists/(?P<friendly_token>[\w]*)$",
        views.PlaylistDetail.as_view(),
        name="api_get_playlist",
    ),
    url(r"^api/v1/user/action/(?P<action>[\w]*)$", views.UserActions.as_view()),
    # ADMIN VIEWS
    url(r"^api/v1/encode_profiles/$", views.EncodeProfileList.as_view()),
    url(r"^api/v1/manage_media$", management_views.MediaList.as_view()),
    url(r"^api/v1/manage_comments$", management_views.CommentList.as_view()),
    url(r"^api/v1/manage_users$", management_views.UserList.as_view()),
    url(r"^api/v1/tasks$", views.TasksList.as_view()),
    url(r"^api/v1/tasks/$", views.TasksList.as_view()),
    url(r"^api/v1/tasks/(?P<friendly_token>[\w|\W]*)$", views.TaskDetail.as_view()),
    url(r"^manage/comments$", views.manage_comments, name="manage_comments"),
    url(r"^manage/media$", views.manage_media, name="manage_media"),
    url(r"^manage/users$", views.manage_users, name="manage_users"),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
