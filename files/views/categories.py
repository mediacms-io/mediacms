from django.conf import settings
from django.db.models import Q
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.settings import api_settings
from rest_framework.views import APIView

from ..methods import is_mediacms_editor
from ..models import Category, Tag
from ..serializers import CategorySerializer, TagSerializer


def visible_categories(request, show_lms=None):
    """Categories the requesting user is allowed to see

    Single place where category visibility is decided, so that listing a
    category and retrieving one by uid can never disagree.
    """

    if show_lms is None:
        show_lms = getattr(settings, 'SHOW_LMS_COURSES_IN_CATEGORIES', True)

    categories = Category.objects.prefetch_related("user")

    if not show_lms:
        categories = categories.filter(is_lms_course=False)

    if not is_mediacms_editor(request.user):
        visible = Q(is_rbac_category=False)
        if getattr(settings, 'USE_RBAC', False) and request.user.is_authenticated:
            member_of = request.user.get_rbac_categories_as_member().values_list("pk", flat=True)
            visible |= Q(pk__in=member_of)
        categories = categories.filter(visible)

    return categories


class CategoryList(APIView):
    """List categories"""

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Categories'],
        operation_summary='Lists Categories',
        operation_description='Lists all categories',
        responses={
            200: openapi.Response('response description', CategorySerializer),
        },
    )
    def get(self, request, format=None):
        categories = visible_categories(request).order_by("title")

        serializer = CategorySerializer(categories, many=True, context={"request": request})
        ret = serializer.data
        return Response(ret)


class CategoryDetail(APIView):
    """Get a single category by uid"""

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Categories'],
        operation_summary='Get Category',
        operation_description='Get a single category by uid',
        responses={
            200: openapi.Response('response description', CategorySerializer),
            404: openapi.Response('category not found'),
        },
    )
    def get(self, request, uid, format=None):
        # visible_categories() keeps this from becoming an oracle for the
        # existence and title of RBAC categories the user is not a member of
        category = visible_categories(request).filter(uid=uid).first()
        if not category:
            return Response({"detail": "not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = CategorySerializer(category, context={"request": request})
        return Response(serializer.data)


class CategoryListContributor(APIView):
    """List LMS courses where the user has contributor access"""

    @swagger_auto_schema(
        tags=['Categories'],
        operation_summary='Lists LMS courses for Contributors',
        operation_description='Lists LMS courses where the user has contributor access',
        responses={
            200: openapi.Response('response description', CategorySerializer),
        },
    )
    def get(self, request, format=None):
        if not request.user.is_authenticated:
            return Response([])

        categories = request.user.get_rbac_categories_as_contributor().filter(is_lms_course=True)

        serializer = CategorySerializer(categories.order_by("title"), many=True, context={"request": request})
        return Response(serializer.data)


class TagList(APIView):
    """List tags"""

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter(name='page', type=openapi.TYPE_INTEGER, in_=openapi.IN_QUERY, description='Page number'),
        ],
        tags=['Tags'],
        operation_summary='Lists Tags',
        operation_description='Paginated listing of all tags',
        responses={
            200: openapi.Response('response description', TagSerializer),
        },
    )
    def get(self, request, format=None):
        tags = Tag.objects.filter().order_by("-media_count")
        pagination_class = api_settings.DEFAULT_PAGINATION_CLASS
        paginator = pagination_class()
        page = paginator.paginate_queryset(tags, request)
        serializer = TagSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)
