from allauth.account.views import LoginView
from django.conf import settings
from django.conf.urls import include
from django.conf.urls.static import static
from django.urls import path, re_path

from . import management_views, tinymce_handlers, views
from .feeds import IndexRSSFeed, SearchRSSFeed

friendly_token = r"(?P<friendly_token>[\w\-_]*)"

urlpatterns = [
    path("i18n/", include("django.conf.urls.i18n")),
    re_path(r"^$", views.index),
    re_path(r"^about", views.about, name="about"),
    re_path(r"^setlanguage", views.setlanguage, name="setlanguage"),
    re_path(r"^add_subtitle", views.add_subtitle, name="add_subtitle"),
    re_path(r"^edit_subtitle", views.edit_subtitle, name="edit_subtitle"),
    re_path(r"^categories$", views.categories, name="categories"),
    re_path(r"^contact$", views.contact, name="contact"),
    re_path(r"^publish", views.publish_media, name="publish_media"),
    re_path(r"^edit_chapters", views.edit_chapters, name="edit_chapters"),
    re_path(r"^replace_media", views.replace_media, name="replace_media"),
    re_path(r"^edit_video", views.edit_video, name="edit_video"),
    re_path(r"^edit", views.edit_media, name="edit_media"),
    re_path(r"^embed", views.embed_media, name="get_embed"),
    re_path(r"^featured$", views.featured_media),
    re_path(r"^fu/", include(("uploader.urls", "uploader"), namespace="uploader")),
    re_path(r"^history$", views.history, name="history"),
    re_path(r"^liked$", views.liked_media, name="liked_media"),
    re_path(r"^latest$", views.latest_media),
    re_path(r"^members", views.members, name="members"),
    re_path(
        rf"^playlist/{friendly_token}$",
        views.view_playlist,
        name="get_playlist",
    ),
    re_path(
        rf"^playlists/{friendly_token}$",
        views.view_playlist,
        name="get_playlist",
    ),
    re_path(r"^popular$", views.recommended_media),
    re_path(r"^recommended$", views.recommended_media),
    path("rss/", IndexRSSFeed()),
    re_path("^rss/search", SearchRSSFeed()),
    re_path(r"^record_screen", views.record_screen, name="record_screen"),
    re_path(r"^search", views.search, name="search"),
    re_path(r"^scpublisher", views.upload_media, name="upload_media"),
    re_path(r"^tags", views.tags, name="tags"),
    re_path(r"^tos$", views.tos, name="terms_of_service"),
    re_path(r"^view", views.view_media, name="get_media"),
    re_path(r"^upload", views.upload_media, name="upload_media"),
    # API VIEWS
    re_path(r"^api/v1/media/user/bulk_actions$", views.MediaBulkUserActions.as_view()),
    re_path(r"^api/v1/media/user/bulk_actions/$", views.MediaBulkUserActions.as_view()),
    re_path(r"^api/v1/media$", views.MediaList.as_view()),
    re_path(r"^api/v1/media/$", views.MediaList.as_view()),
    re_path(
        rf"^api/v1/media/{friendly_token}$",
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
        rf"^api/v1/media/{friendly_token}/actions$",
        views.MediaActions.as_view(),
    ),
    re_path(
        rf"^api/v1/media/{friendly_token}/chapters$",
        views.video_chapters,
    ),
    re_path(
        rf"^api/v1/media/{friendly_token}/trim_video$",
        views.trim_video,
    ),
    re_path(r"^api/v1/categories$", views.CategoryList.as_view()),
    re_path(r"^api/v1/tags$", views.TagList.as_view()),
    re_path(r"^api/v1/comments$", views.CommentList.as_view()),
    re_path(
        rf"^api/v1/media/{friendly_token}/comments$",
        views.CommentDetail.as_view(),
    ),
    re_path(
        rf"^api/v1/media/{friendly_token}/comments/(?P<uid>[\w-]*)$",
        views.CommentDetail.as_view(),
    ),
    re_path(r"^api/v1/playlists$", views.PlaylistList.as_view()),
    re_path(r"^api/v1/playlists/$", views.PlaylistList.as_view()),
    re_path(
        rf"^api/v1/playlists/{friendly_token}$",
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
    # Media uploads in ADMIN created pages
    re_path(r"^tinymce/upload/", tinymce_handlers.upload_image, name="tinymce_upload_image"),
    re_path(r"^(?P<slug>[\w.-]*)$", views.get_page, name="get_page"),  # noqa: W605
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)


if settings.USERS_NEEDS_TO_BE_APPROVED:
    urlpatterns.append(re_path(r"^approval_required/", views.approval_required, name="approval_required"))

if hasattr(settings, "USE_SAML") and settings.USE_SAML:
    urlpatterns.append(re_path(r"^saml/metadata", views.saml_metadata, name="saml-metadata"))

if hasattr(settings, "USE_IDENTITY_PROVIDERS") and settings.USE_IDENTITY_PROVIDERS:
    urlpatterns.append(path('accounts/login_system', LoginView.as_view(), name='login_system'))
    urlpatterns.append(re_path(r"^accounts/login", views.custom_login_view, name='login'))
else:
    urlpatterns.append(path('accounts/login', LoginView.as_view(), name='login_system'))

if hasattr(settings, "GENERATE_SITEMAP") and settings.GENERATE_SITEMAP:
    urlpatterns.append(path("sitemap.xml", views.sitemap, name="sitemap"))
