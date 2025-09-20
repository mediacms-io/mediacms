from django.conf import settings
from django.db.models import Q
from drf_yasg import openapi as openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.settings import api_settings
from rest_framework.views import APIView

from users.models import User
from users.serializers import UserSerializer

from .methods import is_mediacms_manager
from .models import Comment, Media
from .permissions import IsMediacmsEditor
from .serializers import CommentSerializer, MediaSerializer


class MediaList(APIView):
    """Media listings
    Used on management pages of MediaCMS
    Should be available only to MediaCMS editors,
    managers and admins
    """

    permission_classes = (IsMediacmsEditor,)
    parser_classes = (JSONParser,)

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter(name='sort_by', type=openapi.TYPE_STRING, in_=openapi.IN_QUERY, description='Sort by any of: title, add_date, edit_date, views, likes, reported_times'),
            openapi.Parameter(name='ordering', type=openapi.TYPE_STRING, in_=openapi.IN_QUERY, description='Order by: asc, desc'),
            openapi.Parameter(name='state', type=openapi.TYPE_STRING, in_=openapi.IN_QUERY, description='Media state, options: private", "public", "unlisted'),
            openapi.Parameter(name='encoding_status', type=openapi.TYPE_STRING, in_=openapi.IN_QUERY, description='Encoding status, options "pending", "running", "fail", "success"'),
        ],
        tags=['Manage'],
        operation_summary='Manage Media',
        operation_description='Manage media for MediaCMS managers and reviewers',
    )
    def get(self, request, format=None):
        params = self.request.query_params
        ordering = params.get("ordering", "").strip()
        sort_by = params.get("sort_by", "").strip()
        state = params.get("state", "").strip()
        encoding_status = params.get("encoding_status", "").strip()
        media_type = params.get("media_type", "").strip()

        featured = params.get("featured", "").strip()
        is_reviewed = params.get("is_reviewed", "").strip()
        category = params.get("category", "").strip()

        sort_by_options = [
            "title",
            "add_date",
            "edit_date",
            "views",
            "likes",
            "reported_times",
        ]
        if sort_by not in sort_by_options:
            sort_by = "add_date"
        if ordering == "asc":
            ordering = ""
        else:
            ordering = "-"

        if media_type not in ["video", "image", "audio", "pdf"]:
            media_type = None

        if state not in ["private", "public", "unlisted"]:
            state = None

        if encoding_status not in ["pending", "running", "fail", "success"]:
            encoding_status = None

        if featured == "true":
            featured = True
        elif featured == "false":
            featured = False
        else:
            featured = "all"
        if is_reviewed == "true":
            is_reviewed = True
        elif is_reviewed == "false":
            is_reviewed = False
        else:
            is_reviewed = "all"

        pagination_class = api_settings.DEFAULT_PAGINATION_CLASS
        qs = Media.objects.filter()
        if state:
            qs = qs.filter(state=state)
        if encoding_status:
            qs = qs.filter(encoding_status=encoding_status)
        if media_type:
            qs = qs.filter(media_type=media_type)

        if featured != "all":
            qs = qs.filter(featured=featured)
        if is_reviewed != "all":
            qs = qs.filter(is_reviewed=is_reviewed)

        if category:
            qs = qs.filter(category__title__contains=category)

        media = qs.order_by(f"{ordering}{sort_by}")

        paginator = pagination_class()

        page = paginator.paginate_queryset(media, request)

        serializer = MediaSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Manage'],
        operation_summary='Delete Media',
        operation_description='Delete media for MediaCMS managers and reviewers',
    )
    def delete(self, request, format=None):
        tokens = request.GET.get("tokens")
        if tokens:
            tokens = tokens.split(",")
            Media.objects.filter(friendly_token__in=tokens).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CommentList(APIView):
    """Comments listings
    Used on management pages of MediaCMS
    Should be available only to MediaCMS editors,
    managers and admins
    """

    permission_classes = (IsMediacmsEditor,)
    parser_classes = (JSONParser,)

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Manage'],
        operation_summary='Manage Comments',
        operation_description='Manage comments for MediaCMS managers and reviewers',
    )
    def get(self, request, format=None):
        params = self.request.query_params
        ordering = params.get("ordering", "").strip()
        sort_by = params.get("sort_by", "").strip()

        sort_by_options = ["text", "add_date"]
        if sort_by not in sort_by_options:
            sort_by = "add_date"
        if ordering == "asc":
            ordering = ""
        else:
            ordering = "-"

        pagination_class = api_settings.DEFAULT_PAGINATION_CLASS

        qs = Comment.objects.filter()
        media = qs.order_by(f"{ordering}{sort_by}")

        paginator = pagination_class()

        page = paginator.paginate_queryset(media, request)

        serializer = CommentSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Manage'],
        operation_summary='Delete Comments',
        operation_description='Delete comments for MediaCMS managers and reviewers',
    )
    def delete(self, request, format=None):
        comment_ids = request.GET.get("comment_ids")
        if comment_ids:
            comments = comment_ids.split(",")
            Comment.objects.filter(uid__in=comments).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserList(APIView):
    """Users listings
    Used on management pages of MediaCMS
    Should be available only to MediaCMS editors,
    managers and admins. Delete should be option
    for managers+admins only.
    """

    permission_classes = (IsMediacmsEditor,)
    parser_classes = (JSONParser,)

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Manage'],
        operation_summary='Manage Users',
        operation_description='Manage users for MediaCMS managers and reviewers',
    )
    def get(self, request, format=None):
        params = self.request.query_params
        ordering = params.get("ordering", "").strip()
        sort_by = params.get("sort_by", "").strip()
        role = params.get("role", "all").strip()

        sort_by_options = ["date_added", "name"]
        if sort_by not in sort_by_options:
            sort_by = "date_added"
        if ordering == "asc":
            ordering = ""
        else:
            ordering = "-"

        pagination_class = api_settings.DEFAULT_PAGINATION_CLASS

        qs = User.objects.filter()
        if role == "manager":
            qs = qs.filter(is_manager=True)
        elif role == "editor":
            qs = qs.filter(is_editor=True)

        if settings.USERS_NEEDS_TO_BE_APPROVED:
            is_approved = request.GET.get("is_approved")
            if is_approved == "true":
                qs = qs.filter(is_approved=True)
            elif is_approved == "false":
                qs = qs.filter(Q(is_approved=False) | Q(is_approved__isnull=True))

        users = qs.order_by(f"{ordering}{sort_by}")

        paginator = pagination_class()

        page = paginator.paginate_queryset(users, request)

        serializer = UserSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Manage'],
        operation_summary='Delete Users',
        operation_description='Delete users for MediaCMS managers',
    )
    def delete(self, request, format=None):
        if not is_mediacms_manager(request.user):
            return Response({"detail": "bad permissions"}, status=status.HTTP_400_BAD_REQUEST)

        tokens = request.GET.get("tokens")
        if tokens:
            tokens = tokens.split(",")
            User.objects.filter(username__in=tokens).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
