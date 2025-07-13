from datetime import datetime, timedelta

from django.conf import settings
from django.contrib.postgres.search import SearchQuery
from django.db.models import Q
from django.shortcuts import get_object_or_404
from drf_yasg import openapi
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

from actions.models import MediaAction
from cms.custom_pagination import FastPaginationWithoutCount
from cms.permissions import IsAuthorizedToAdd, IsUserOrEditor
from users.models import User

from .. import helpers
from ..methods import (
    change_media_owner,
    copy_media,
    get_user_or_session,
    is_mediacms_editor,
    show_recommended_media,
    show_related_media,
    update_user_ratings,
)
from ..models import EncodeProfile, Media, MediaPermission, Playlist, PlaylistMedia
from ..serializers import MediaSearchSerializer, MediaSerializer, SingleMediaSerializer
from ..stop_words import STOP_WORDS
from ..tasks import save_user_action


class MediaList(APIView):
    """Media listings views"""

    permission_classes = (IsAuthorizedToAdd,)
    parser_classes = (MultiPartParser, FormParser, FileUploadParser)

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter(name='page', type=openapi.TYPE_INTEGER, in_=openapi.IN_QUERY, description='Page number'),
            openapi.Parameter(name='author', type=openapi.TYPE_STRING, in_=openapi.IN_QUERY, description='username'),
            openapi.Parameter(name='show', type=openapi.TYPE_STRING, in_=openapi.IN_QUERY, description='show', enum=['recommended', 'featured', 'latest']),
        ],
        tags=['Media'],
        operation_summary='List Media',
        operation_description='Lists all media',
        responses={200: MediaSerializer(many=True)},
    )
    def _get_media_queryset(self, request, user=None):
        base_filters = Q(listable=True)
        if user:
            base_filters &= Q(user=user)

        base_queryset = Media.objects.prefetch_related("user")

        if not request.user.is_authenticated:
            return base_queryset.filter(base_filters).order_by("-add_date")

        # Build OR conditions for authenticated users
        conditions = base_filters  # Start with listable media

        # Add user permissions
        permission_filter = {'user': request.user}
        if user:
            permission_filter['owner_user'] = user

        if MediaPermission.objects.filter(**permission_filter).exists():
            perm_conditions = Q(permissions__user=request.user)
            if user:
                perm_conditions &= Q(user=user)
            conditions |= perm_conditions

        # Add RBAC conditions
        if getattr(settings, 'USE_RBAC', False):
            rbac_categories = request.user.get_rbac_categories_as_member()
            rbac_conditions = Q(category__in=rbac_categories)
            if user:
                rbac_conditions &= Q(user=user)
            conditions |= rbac_conditions

        return base_queryset.filter(conditions).distinct().order_by("-add_date")[:1000]

    def get(self, request, format=None):
        # Show media
        # authenticated users can see:

        # All listable media (public access)
        # Non-listable media they have RBAC access to
        # Non-listable media they have direct permissions for

        params = self.request.query_params
        show_param = params.get("show", "")

        author_param = params.get("author", "").strip()
        pagination_class = api_settings.DEFAULT_PAGINATION_CLASS

        if show_param == "recommended":
            pagination_class = FastPaginationWithoutCount
            media = show_recommended_media(request, limit=50)
        elif show_param == "featured":
            media = Media.objects.filter(listable=True, featured=True).prefetch_related("user").order_by("-add_date")
        elif show_param == "shared_by_me":
            if not self.request.user.is_authenticated:
                media = Media.objects.none()
            else:
                media = Media.objects.filter(permissions__owner_user=self.request.user).prefetch_related("user")
        elif show_param == "shared_with_me":
            if not self.request.user.is_authenticated:
                media = Media.objects.none()
            else:
                base_queryset = Media.objects.prefetch_related("user")
                user_media_filters = {'permissions__user': request.user}
                media = base_queryset.filter(**user_media_filters)

                if getattr(settings, 'USE_RBAC', False):
                    rbac_categories = request.user.get_rbac_categories_as_member()
                    rbac_filters = {'category__in': rbac_categories}

                    rbac_media = base_queryset.filter(**rbac_filters)
                    media = media.union(rbac_media)
                media = media.order_by("-add_date")[:1000]  # limit to 1000 results
        elif author_param:
            user_queryset = User.objects.all()
            user = get_object_or_404(user_queryset, username=author_param)
            if self.request.user == user:
                media = Media.objects.filter(user=user).prefetch_related("user").order_by("-add_date")
            else:
                media = self._get_media_queryset(request, user)
        else:
            media = self._get_media_queryset(request)

        paginator = pagination_class()

        page = paginator.paginate_queryset(media, request)

        serializer = MediaSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter(name="media_file", in_=openapi.IN_FORM, type=openapi.TYPE_FILE, required=True, description="media_file"),
            openapi.Parameter(name="description", in_=openapi.IN_FORM, type=openapi.TYPE_STRING, required=False, description="description"),
            openapi.Parameter(name="title", in_=openapi.IN_FORM, type=openapi.TYPE_STRING, required=False, description="title"),
        ],
        tags=['Media'],
        operation_summary='Add new Media',
        operation_description='Adds a new media, for authenticated users',
        responses={201: openapi.Response('response description', MediaSerializer), 401: 'bad request'},
    )
    def post(self, request, format=None):
        # Add new media
        serializer = MediaSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            media_file = request.data["media_file"]
            serializer.save(user=request.user, media_file=media_file)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MediaBulkUserActions(APIView):
    """Bulk actions on media items"""

    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = (JSONParser,)

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter(name='media_ids', in_=openapi.IN_FORM, type=openapi.TYPE_ARRAY, items=openapi.Items(type=openapi.TYPE_INTEGER), required=True, description="List of media IDs"),
            openapi.Parameter(
                name='action',
                in_=openapi.IN_FORM,
                type=openapi.TYPE_STRING,
                required=True,
                description="Action to perform",
                enum=[
                    "enable_comments",
                    "disable_comments",
                    "delete_media",
                    "enable_download",
                    "disable_download",
                    "add_to_playlist",
                    "remove_from_playlist",
                    "set_state",
                    "change_owner",
                    "copy_media",
                ],
            ),
            openapi.Parameter(
                name='playlist_ids',
                in_=openapi.IN_FORM,
                type=openapi.TYPE_ARRAY,
                items=openapi.Items(type=openapi.TYPE_INTEGER),
                required=False,
                description="List of playlist IDs (required for add_to_playlist and remove_from_playlist actions)",
            ),
            openapi.Parameter(
                name='state', in_=openapi.IN_FORM, type=openapi.TYPE_STRING, required=False, description="State to set (required for set_state action)", enum=["private", "public", "unlisted"]
            ),
            openapi.Parameter(name='owner', in_=openapi.IN_FORM, type=openapi.TYPE_STRING, required=False, description="New owner username (required for change_owner action)"),
        ],
        tags=['Media'],
        operation_summary='Perform bulk actions on media',
        operation_description='Perform various bulk actions on multiple media items at once',
        responses={
            200: openapi.Response('Action performed successfully'),
            400: 'Bad request',
            401: 'Not authenticated',
        },
    )
    def post(self, request, format=None):
        # Check if user is authenticated
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

        # Get required parameters
        media_ids = request.data.get('media_ids', [])
        action = request.data.get('action')

        # Validate required parameters
        if not media_ids:
            return Response({"detail": "media_ids is required"}, status=status.HTTP_400_BAD_REQUEST)

        if not action:
            return Response({"detail": "action is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Get media objects owned by the user
        media = Media.objects.filter(user=request.user, id__in=media_ids)

        if not media:
            return Response({"detail": "No matching media found"}, status=status.HTTP_400_BAD_REQUEST)

        # Process based on action
        if action == "enable_comments":
            media.update(enable_comments=True)
            return Response({"detail": f"Comments enabled for {media.count()} media items"})

        elif action == "disable_comments":
            media.update(enable_comments=False)
            return Response({"detail": f"Comments disabled for {media.count()} media items"})

        elif action == "delete_media":
            count = media.count()
            media.delete()
            return Response({"detail": f"{count} media items deleted"})

        elif action == "enable_download":
            media.update(allow_download=True)
            return Response({"detail": f"Download enabled for {media.count()} media items"})

        elif action == "disable_download":
            media.update(allow_download=False)
            return Response({"detail": f"Download disabled for {media.count()} media items"})

        elif action == "add_to_playlist":
            playlist_ids = request.data.get('playlist_ids', [])
            if not playlist_ids:
                return Response({"detail": "playlist_ids is required for add_to_playlist action"}, status=status.HTTP_400_BAD_REQUEST)

            playlists = Playlist.objects.filter(user=request.user, id__in=playlist_ids)
            if not playlists:
                return Response({"detail": "No matching playlists found"}, status=status.HTTP_400_BAD_REQUEST)

            added_count = 0
            for playlist in playlists:
                for m in media:
                    media_in_playlist = PlaylistMedia.objects.filter(playlist=playlist).count()
                    if media_in_playlist < settings.MAX_MEDIA_PER_PLAYLIST:
                        obj, created = PlaylistMedia.objects.get_or_create(
                            playlist=playlist,
                            media=m,
                            ordering=media_in_playlist + 1,
                        )
                        if created:
                            added_count += 1

            return Response({"detail": f"Added {added_count} media items to {playlists.count()} playlists"})

        elif action == "remove_from_playlist":
            playlist_ids = request.data.get('playlist_ids', [])
            if not playlist_ids:
                return Response({"detail": "playlist_ids is required for remove_from_playlist action"}, status=status.HTTP_400_BAD_REQUEST)

            playlists = Playlist.objects.filter(user=request.user, id__in=playlist_ids)
            if not playlists:
                return Response({"detail": "No matching playlists found"}, status=status.HTTP_400_BAD_REQUEST)

            removed_count = 0
            for playlist in playlists:
                removed = PlaylistMedia.objects.filter(playlist=playlist, media__in=media).delete()[0]
                removed_count += removed

            return Response({"detail": f"Removed {removed_count} media items from {playlists.count()} playlists"})

        elif action == "set_state":
            state = request.data.get('state')
            if not state:
                return Response({"detail": "state is required for set_state action"}, status=status.HTTP_400_BAD_REQUEST)

            valid_states = ["private", "public", "unlisted"]
            if state not in valid_states:
                return Response({"detail": f"state must be one of {valid_states}"}, status=status.HTTP_400_BAD_REQUEST)

            # Check if user can set public state
            if not is_mediacms_editor(request.user) and settings.PORTAL_WORKFLOW != "public":
                if state == "public":
                    return Response({"detail": "You are not allowed to set media to public state"}, status=status.HTTP_400_BAD_REQUEST)

            # Update media state
            for m in media:
                m.state = state
                if m.state == "public" and m.encoding_status == "success" and m.is_reviewed is True:
                    m.listable = True
                else:
                    m.listable = False

                m.save(update_fields=["state", "listable"])

            return Response({"detail": f"State updated to {state} for {media.count()} media items"})

        elif action == "change_owner":
            owner = request.data.get('owner')
            if not owner:
                return Response({"detail": "owner is required for change_owner action"}, status=status.HTTP_400_BAD_REQUEST)

            new_user = User.objects.filter(username=owner).first()
            if not new_user:
                return Response({"detail": "User not found"}, status=status.HTTP_400_BAD_REQUEST)

            changed_count = 0
            for m in media:
                result = change_media_owner(m.id, new_user)
                if result:
                    changed_count += 1

            return Response({"detail": f"Owner changed for {changed_count} media items"})

        elif action == "copy_media":
            for m in media:
                copy_media(m.id)

            return Response({"detail": f"{media.count()} media items copied"})

        else:
            return Response({"detail": f"Unknown action: {action}"}, status=status.HTTP_400_BAD_REQUEST)


class MediaDetail(APIView):
    """
    Retrieve, update or delete a media instance.
    """

    permission_classes = (permissions.IsAuthenticatedOrReadOnly, IsUserOrEditor)
    parser_classes = (MultiPartParser, FormParser, FileUploadParser)

    def get_object(self, friendly_token):
        try:
            media = Media.objects.select_related("user").prefetch_related("encodings__profile").get(friendly_token=friendly_token)

            # this need be explicitly called, and will call
            # has_object_permission() after has_permission has succeeded
            self.check_object_permissions(self.request, media)
            if media.state == "private":
                if self.request.user.has_member_access_to_media(media) or is_mediacms_editor(self.request.user):
                    pass
                else:
                    return Response(
                        {"detail": "media is private"},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )
            return media
        except PermissionDenied:
            return Response({"detail": "bad permissions"}, status=status.HTTP_401_UNAUTHORIZED)
        except BaseException:
            return Response(
                {"detail": "media file does not exist"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter(name='friendly_token', type=openapi.TYPE_STRING, in_=openapi.IN_PATH, description='unique identifier', required=True),
        ],
        tags=['Media'],
        operation_summary='Get information for Media',
        operation_description='Get information for a media',
        responses={200: SingleMediaSerializer(), 400: 'bad request'},
    )
    def get(self, request, friendly_token, format=None):
        # Get media details
        # password = request.GET.get("password")
        media = self.get_object(friendly_token)
        if isinstance(media, Response):
            return media

        serializer = SingleMediaSerializer(media, context={"request": request})
        if media.state == "private":
            related_media = []
        else:
            related_media = show_related_media(media, request=request, limit=100)
            related_media_serializer = MediaSerializer(related_media, many=True, context={"request": request})
            related_media = related_media_serializer.data
        ret = serializer.data

        # update rattings info with user specific ratings
        # eg user has already rated for this media
        # this only affects user rating and only if enabled
        if settings.ALLOW_RATINGS and ret.get("ratings_info") and not request.user.is_anonymous:
            ret["ratings_info"] = update_user_ratings(request.user, media, ret.get("ratings_info"))

        ret["related_media"] = related_media
        return Response(ret)

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter(name='friendly_token', type=openapi.TYPE_STRING, in_=openapi.IN_PATH, description='unique identifier', required=True),
            openapi.Parameter(name='type', type=openapi.TYPE_STRING, in_=openapi.IN_FORM, description='action to perform', enum=['encode', 'review']),
            openapi.Parameter(
                name='encoding_profiles',
                type=openapi.TYPE_ARRAY,
                items=openapi.Items(type=openapi.TYPE_STRING),
                in_=openapi.IN_FORM,
                description='if action to perform is encode, need to specify list of ids of encoding profiles',
            ),
            openapi.Parameter(name='result', type=openapi.TYPE_BOOLEAN, in_=openapi.IN_FORM, description='if action is review, this is the result (True for reviewed, False for not reviewed)'),
        ],
        tags=['Media'],
        operation_summary='Run action on Media',
        operation_description='Actions for a media, for MediaCMS editors and managers',
        responses={201: 'action created', 400: 'bad request'},
        operation_id='media_manager_actions',
    )
    def post(self, request, friendly_token, format=None):
        """superuser actions
        Available only to MediaCMS editors and managers

        Action is a POST variable, review and encode are implemented
        """

        media = self.get_object(friendly_token)
        if isinstance(media, Response):
            return media

        if not is_mediacms_editor(request.user):
            return Response({"detail": "not allowed"}, status=status.HTTP_400_BAD_REQUEST)

        action = request.data.get("type")
        profiles_list = request.data.get("encoding_profiles")
        result = request.data.get("result", True)
        if action == "encode":
            # Create encoding tasks for specific profiles
            valid_profiles = []
            if profiles_list:
                if isinstance(profiles_list, list):
                    for p in profiles_list:
                        p = EncodeProfile.objects.filter(id=p).first()
                        if p:
                            valid_profiles.append(p)
                elif isinstance(profiles_list, str):
                    try:
                        p = EncodeProfile.objects.filter(id=int(profiles_list)).first()
                        valid_profiles.append(p)
                    except ValueError:
                        return Response(
                            {"detail": "encoding_profiles must be int or list of ints of valid encode profiles"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
            media.encode(profiles=valid_profiles)
            return Response({"detail": "media will be encoded"}, status=status.HTTP_201_CREATED)
        elif action == "review":
            if result:
                media.is_reviewed = True
            elif result is False:
                media.is_reviewed = False
            media.save(update_fields=["is_reviewed"])
            return Response({"detail": "media reviewed set"}, status=status.HTTP_201_CREATED)
        return Response(
            {"detail": "not valid action or no action specified"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter(name="description", in_=openapi.IN_FORM, type=openapi.TYPE_STRING, required=False, description="description"),
            openapi.Parameter(name="title", in_=openapi.IN_FORM, type=openapi.TYPE_STRING, required=False, description="title"),
            openapi.Parameter(name="media_file", in_=openapi.IN_FORM, type=openapi.TYPE_FILE, required=False, description="media_file"),
        ],
        tags=['Media'],
        operation_summary='Update Media',
        operation_description='Update a Media, for Media uploader',
        responses={201: openapi.Response('response description', MediaSerializer), 401: 'bad request'},
    )
    def put(self, request, friendly_token, format=None):
        # Update a media object
        media = self.get_object(friendly_token)
        if isinstance(media, Response):
            return media

        if not (request.user.has_contributor_access_to_media(media) or is_mediacms_editor(request.user)):
            return Response({"detail": "not allowed"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = MediaSerializer(media, data=request.data, context={"request": request})
        if serializer.is_valid():
            serializer.save(user=request.user)
            # no need to update the media file itself, only the metadata
            # if request.data.get('media_file'):
            #    media_file = request.data["media_file"]
            #    serializer.save(user=request.user, media_file=media_file)
            # else:
            #    serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter(name='friendly_token', type=openapi.TYPE_STRING, in_=openapi.IN_PATH, description='unique identifier', required=True),
        ],
        tags=['Media'],
        operation_summary='Delete Media',
        operation_description='Delete a Media, for MediaCMS editors and managers',
        responses={
            204: 'no content',
        },
    )
    def delete(self, request, friendly_token, format=None):
        # Delete a media object
        media = self.get_object(friendly_token)
        if isinstance(media, Response):
            return media
        media.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MediaActions(APIView):
    """
    Retrieve, update or delete a media action instance.
    """

    permission_classes = (permissions.AllowAny,)
    parser_classes = (JSONParser,)

    def get_object(self, friendly_token):
        try:
            media = Media.objects.select_related("user").prefetch_related("encodings__profile").get(friendly_token=friendly_token)
            if media.state == "private" and self.request.user != media.user:
                return Response({"detail": "media is private"}, status=status.HTTP_400_BAD_REQUEST)
            return media
        except PermissionDenied:
            return Response({"detail": "bad permissions"}, status=status.HTTP_400_BAD_REQUEST)
        except BaseException:
            return Response(
                {"detail": "media file does not exist"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Media'],
        operation_summary='to_be_written',
        operation_description='to_be_written',
    )
    def get(self, request, friendly_token, format=None):
        # show date and reason for each time media was reported
        media = self.get_object(friendly_token)
        if not (request.user == media.user or is_mediacms_editor(request.user)):
            return Response({"detail": "not allowed"}, status=status.HTTP_400_BAD_REQUEST)

        if isinstance(media, Response):
            return media

        ret = {}
        reported = MediaAction.objects.filter(media=media, action="report")
        ret["reported"] = []
        for rep in reported:
            item = {"reported_date": rep.action_date, "reason": rep.extra_info}
            ret["reported"].append(item)

        return Response(ret, status=status.HTTP_200_OK)

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Media'],
        operation_summary='to_be_written',
        operation_description='to_be_written',
    )
    def post(self, request, friendly_token, format=None):
        # perform like/dislike/report actions
        media = self.get_object(friendly_token)
        if isinstance(media, Response):
            return media

        action = request.data.get("type")
        extra = request.data.get("extra_info")
        if request.user.is_anonymous:
            # there is a list of allowed actions for
            # anonymous users, specified in settings
            if action not in settings.ALLOW_ANONYMOUS_ACTIONS:
                return Response(
                    {"detail": "action allowed on logged in users only"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if action:
            user_or_session = get_user_or_session(request)
            save_user_action.delay(
                user_or_session,
                friendly_token=media.friendly_token,
                action=action,
                extra_info=extra,
            )

            return Response({"detail": "action received"}, status=status.HTTP_201_CREATED)
        else:
            return Response({"detail": "no action specified"}, status=status.HTTP_400_BAD_REQUEST)

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Media'],
        operation_summary='to_be_written',
        operation_description='to_be_written',
    )
    def delete(self, request, friendly_token, format=None):
        media = self.get_object(friendly_token)
        if isinstance(media, Response):
            return media

        if not request.user.is_superuser:
            return Response({"detail": "not allowed"}, status=status.HTTP_400_BAD_REQUEST)

        action = request.data.get("type")
        if action:
            if action == "report":  # delete reported actions
                MediaAction.objects.filter(media=media, action="report").delete()
                media.reported_times = 0
                media.save(update_fields=["reported_times"])
                return Response(
                    {"detail": "reset reported times counter"},
                    status=status.HTTP_201_CREATED,
                )
        else:
            return Response({"detail": "no action specified"}, status=status.HTTP_400_BAD_REQUEST)


class MediaSearch(APIView):
    """
    Retrieve results for search
    Only GET is implemented here
    """

    parser_classes = (JSONParser,)

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Search'],
        operation_summary='to_be_written',
        operation_description='to_be_written',
    )
    def get(self, request, format=None):
        params = self.request.query_params
        query = params.get("q", "").strip().lower()
        category = params.get("c", "").strip()
        tag = params.get("t", "").strip()

        ordering = params.get("ordering", "").strip()
        sort_by = params.get("sort_by", "").strip()
        media_type = params.get("media_type", "").strip()

        author = params.get("author", "").strip()
        upload_date = params.get('upload_date', '').strip()

        sort_by_options = ["title", "add_date", "edit_date", "views", "likes"]
        if sort_by not in sort_by_options:
            sort_by = "add_date"
        if ordering == "asc":
            ordering = ""
        else:
            ordering = "-"

        if media_type not in ["video", "image", "audio", "pdf"]:
            media_type = None

        if not (query or category or tag):
            ret = {}
            return Response(ret, status=status.HTTP_200_OK)

        if request.user.is_authenticated:
            basic_query = Q(listable=True) | Q(permissions__user=request.user)

            if getattr(settings, 'USE_RBAC', False):
                rbac_categories = request.user.get_rbac_categories_as_member()
                basic_query |= Q(category__in=rbac_categories)

        else:
            basic_query = Q(listable=True)

        media = Media.objects.filter(basic_query).distinct()

        if query:
            # move this processing to a prepare_query function
            query = helpers.clean_query(query)
            q_parts = [q_part.rstrip("y") for q_part in query.split() if q_part not in STOP_WORDS]
            if q_parts:
                query = SearchQuery(q_parts[0] + ":*", search_type="raw")
                for part in q_parts[1:]:
                    query &= SearchQuery(part + ":*", search_type="raw")
            else:
                query = None
        if query:
            media = media.filter(search=query)

        if tag:
            media = media.filter(tags__title=tag)

        if category:
            media = media.filter(category__title__contains=category)

        if media_type:
            media = media.filter(media_type=media_type)

        if author:
            media = media.filter(user__username=author)

        if upload_date:
            gte = None
            if upload_date == 'today':
                gte = datetime.now().date()
            if upload_date == 'this_week':
                gte = datetime.now() - timedelta(days=7)
            if upload_date == 'this_month':
                year = datetime.now().date().year
                month = datetime.now().date().month
                gte = datetime(year, month, 1)
            if upload_date == 'this_year':
                year = datetime.now().date().year
                gte = datetime(year, 1, 1)
            if gte:
                media = media.filter(add_date__gte=gte)

        media = media.order_by(f"{ordering}{sort_by}")

        if self.request.query_params.get("show", "").strip() == "titles":
            media = media.values("title")[:40]
            return Response(media, status=status.HTTP_200_OK)
        else:
            media = media.prefetch_related("user")[:1000]  # limit to 1000 results

            if category or tag:
                pagination_class = api_settings.DEFAULT_PAGINATION_CLASS
            else:
                # pagination_class = FastPaginationWithoutCount
                pagination_class = api_settings.DEFAULT_PAGINATION_CLASS
            paginator = pagination_class()
            page = paginator.paginate_queryset(media, request)
            serializer = MediaSearchSerializer(page, many=True, context={"request": request})
            return paginator.get_paginated_response(serializer.data)
