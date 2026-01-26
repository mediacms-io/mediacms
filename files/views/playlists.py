from django.conf import settings
from django.db.models import Q
from drf_yasg import openapi
from django.contrib.auth import get_user_model
from drf_yasg.utils import swagger_auto_schema
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import (
    FileUploadParser,
    FormParser,
    JSONParser,
    MultiPartParser,
)
from rest_framework.response import Response
from rest_framework.settings import api_settings
from rest_framework.views import APIView
from rest_framework.exceptions import NotFound

from cms.permissions import IsAuthorizedToAdd, IsUserOrEditor, IsPlaylistOwnerEditorOrShared
from files.methods import is_mediacms_editor, is_mediacms_manager

from ..models import Media, Playlist, PlaylistMedia
from ..serializers import MediaSerializer, PlaylistDetailSerializer, PlaylistSerializer

User = get_user_model()

class PlaylistList(APIView):
    """Playlists listings and creation views"""

    permission_classes = (permissions.IsAuthenticatedOrReadOnly, IsAuthorizedToAdd, IsPlaylistOwnerEditorOrShared)
    parser_classes = (JSONParser, MultiPartParser, FormParser, FileUploadParser)

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Playlists'],
        operation_summary='to_be_written',
        operation_description='to_be_written',
        responses={
            200: openapi.Response('response description', PlaylistSerializer(many=True)),
        },
    )
    def get(self, request, format=None):
        pagination_class = api_settings.DEFAULT_PAGINATION_CLASS
        paginator = pagination_class()
        playlists = Playlist.objects.filter().prefetch_related("user")

        # Start with all playlists
        playlists = Playlist.objects.all().prefetch_related("user")
        user = request.user

        if user.is_authenticated:
            # Editors / managers / superusers can see all playlists
            if user.is_superuser or is_mediacms_editor(user) or is_mediacms_manager(user):
                pass  # no extra filtering
            else:
                # Normal users see:
                # - their own playlists
                # - playlists shared with them as reader
                # - playlists shared with them as editor
                playlists = playlists.filter(
                    Q(user=user)
                    | Q(shared_readers=user)
                    | Q(shared_editors=user)
                ).distinct()
        else:
            # Anonymous users see nothing for now
            playlists = Playlist.objects.none()

        # Optional filter by author username (applied after visibility filter)
        if "author" in self.request.query_params:
            author = self.request.query_params["author"].strip()
            playlists = playlists.filter(user__username=author)

        page = paginator.paginate_queryset(playlists, request)

        serializer = PlaylistSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Playlists'],
        operation_summary='to_be_written',
        operation_description='to_be_written',
    )
    def post(self, request, format=None):
        serializer = PlaylistSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PlaylistDetail(APIView):
    """Playlist related views"""

    permission_classes = (permissions.IsAuthenticatedOrReadOnly, IsUserOrEditor, IsPlaylistOwnerEditorOrShared)
    parser_classes = (JSONParser, MultiPartParser, FormParser, FileUploadParser)

    def get_playlist(self, friendly_token):
        try:
            playlist = Playlist.objects.get(friendly_token=friendly_token)
            self.check_object_permissions(self.request, playlist)
            return playlist
        except PermissionDenied:
            return Response({"detail": "not enough permissions"}, status=status.HTTP_400_BAD_REQUEST)
        except BaseException:
            return Response(
                {"detail": "Playlist does not exist"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Playlists'],
        operation_summary='to_be_written',
        operation_description='to_be_written',
    )
    def get(self, request, friendly_token, format=None):
        playlist = self.get_playlist(friendly_token)
        if isinstance(playlist, Response):
            return playlist

        serializer = PlaylistDetailSerializer(playlist, context={"request": request})

        # If user is the author, show all media; otherwise, show only public and unlisted media
        if request.user.is_authenticated and request.user == playlist.user:
            playlist_media = PlaylistMedia.objects.filter(playlist=playlist).prefetch_related("media__user").select_related("media")
        else:
            playlist_media = PlaylistMedia.objects.filter(playlist=playlist).filter(Q(media__state="public") | Q(media__state="unlisted")).prefetch_related("media__user").select_related("media")

        playlist_media = [c.media for c in playlist_media]

        playlist_media_serializer = MediaSerializer(playlist_media, many=True, context={"request": request})
        ret = serializer.data
        ret["playlist_media"] = playlist_media_serializer.data

        return Response(ret)

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Playlists'],
        operation_summary='to_be_written',
        operation_description='to_be_written',
    )
    def post(self, request, friendly_token, format=None):
        playlist = self.get_playlist(friendly_token)
        if isinstance(playlist, Response):
            return playlist
        serializer = PlaylistDetailSerializer(playlist, data=request.data, context={"request": request})
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Playlists'],
        operation_summary='to_be_written',
        operation_description='to_be_written',
    )
    def put(self, request, friendly_token, format=None):
        playlist = self.get_playlist(friendly_token)
        if isinstance(playlist, Response):
            return playlist
        action = request.data.get("type")
        media_friendly_token = request.data.get("media_friendly_token")
        ordering = 0
        if request.data.get("ordering"):
            try:
                ordering = int(request.data.get("ordering"))
            except ValueError:
                pass

        if action in ["add", "remove", "ordering"]:
            media = Media.objects.filter(friendly_token=media_friendly_token).first()
            if media:
                if action == "add":
                    media_in_playlist = PlaylistMedia.objects.filter(playlist=playlist).count()
                    if media_in_playlist >= settings.MAX_MEDIA_PER_PLAYLIST:
                        return Response(
                            {"detail": "max number of media for a Playlist reached"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    else:
                        obj, created = PlaylistMedia.objects.get_or_create(
                            playlist=playlist,
                            media=media,
                            ordering=media_in_playlist + 1,
                        )
                        obj.save()
                        return Response(
                            {"detail": "media added to Playlist"},
                            status=status.HTTP_201_CREATED,
                        )
                elif action == "remove":
                    PlaylistMedia.objects.filter(playlist=playlist, media=media).delete()
                    return Response(
                        {"detail": "media removed from Playlist"},
                        status=status.HTTP_201_CREATED,
                    )
                elif action == "ordering":
                    if ordering:
                        playlist.set_ordering(media, ordering)
                        return Response(
                            {"detail": "new ordering set"},
                            status=status.HTTP_201_CREATED,
                        )
            else:
                return Response({"detail": "media is not valid"}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {"detail": "invalid or not specified action"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Playlists'],
        operation_summary='to_be_written',
        operation_description='to_be_written',
    )
    def delete(self, request, friendly_token, format=None):
        playlist = self.get_playlist(friendly_token)
        if isinstance(playlist, Response):
            return playlist

        playlist.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class PlaylistShare(APIView):
    """
    Add a user as reader or editor on a playlist.
    Only the playlist owner (or staff/editor/manager) can modify sharing.
    """

    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = (JSONParser, MultiPartParser, FormParser, FileUploadParser)

    def get_playlist(self, friendly_token):
        try:
            playlist = Playlist.objects.get(friendly_token=friendly_token)
        except Playlist.DoesNotExist:
            # 404 if playlist not found
            raise NotFound({"detail": "Playlist does not exist"})

        user = self.request.user

        # Only owner or staff/editor/manager can modify sharing
        if not (
            user.is_authenticated
            and (
                user == playlist.user
                or user.is_superuser
                or is_mediacms_editor(user)
                or is_mediacms_manager(user)
            )
        ):
            # Return explicit 403 instead of raising PermissionDenied,
            # so it's obvious this is our code, not global DRF permissions.
            return Response(
                {"detail": "You do not have permission to modify sharing for this playlist."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return playlist

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Playlists'],
        operation_summary='Share playlist with a user',
        operation_description='Add a user as reader or editor on a playlist.',
    )
    def put(self, request, friendly_token, format=None):
        playlist = self.get_playlist(friendly_token)
        # If get_playlist returned a Response (403), just bubble it up
        if isinstance(playlist, Response):
            return playlist

        username = (request.data.get("user") or "").strip()
        mode = (request.data.get("mode") or "").strip().lower()  # "reader" or "editor"

        if not username or mode not in ("reader", "editor"):
            return Response(
                {"detail": "Fields 'user' and 'mode' (reader/editor) are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response(
                {"detail": f"User '{username}' does not exist."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Owner already has full access
        if target_user == playlist.user:
            return Response(
                {"detail": "Owner already has full access."},
                status=status.HTTP_200_OK,
            )

        if mode == "reader":
            playlist.shared_readers.add(target_user)
        else:  # editor
            playlist.shared_editors.add(target_user)
            # Optional: also ensure they're in readers
            playlist.shared_readers.add(target_user)

        return Response(
            {
                "detail": "Sharing updated.",
                "playlist": playlist.friendly_token,
                "user": target_user.username,
                "mode": mode,
            },
            status=status.HTTP_200_OK,
        )


class PlaylistUnshare(APIView):
    """
    Remove a user as reader or editor on a playlist.
    Only the playlist owner (or staff/editor/manager) can modify sharing.
    """

    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = (JSONParser, MultiPartParser, FormParser, FileUploadParser)

    def get_playlist(self, friendly_token):
        try:
            playlist = Playlist.objects.get(friendly_token=friendly_token)
        except Playlist.DoesNotExist:
            raise NotFound({"detail": "Playlist does not exist"})

        user = self.request.user

        if not (
            user.is_authenticated
            and (
                user == playlist.user
                or user.is_superuser
                or is_mediacms_editor(user)
                or is_mediacms_manager(user)
            )
        ):
            return Response(
                {"detail": "You do not have permission to modify sharing for this playlist."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return playlist

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Playlists'],
        operation_summary='Unshare playlist with a user',
        operation_description='Remove a user from reader or editor access.',
    )
    def put(self, request, friendly_token, format=None):
        playlist = self.get_playlist(friendly_token)
        if isinstance(playlist, Response):
            return playlist

        username = (request.data.get("user") or "").strip()
        mode = (request.data.get("mode") or "").strip().lower()

        if not username or mode not in ("reader", "editor"):
            return Response(
                {"detail": "Fields 'user' and 'mode' (reader/editor) are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response(
                {"detail": f"User '{username}' does not exist."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if mode == "reader":
            playlist.shared_readers.remove(target_user)
        else:  # editor
            playlist.shared_editors.remove(target_user)

        return Response(
            {
                "detail": "Sharing updated (user removed).",
                "playlist": playlist.friendly_token,
                "user": target_user.username,
                "mode": mode,
            },
            status=status.HTTP_200_OK,
        )

class UserSearch(APIView):
    """
    Lightweight username search for sharing.
    Any authenticated user can search by username prefix.
    """

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, format=None):
        term = request.query_params.get("q", "").strip()
        if not term or len(term) < 2:
            return Response([], status=status.HTTP_200_OK)

        qs = (
            User.objects.filter(username__istartswith=term)
            .order_by("username")
        )[:10]

        data = [
            {
                "username": u.username,
                "full_name": u.get_full_name() or "",
            }
            for u in qs
        ]
        return Response(data, status=status.HTTP_200_OK)
