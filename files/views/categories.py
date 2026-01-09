from django.conf import settings
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework.response import Response
from rest_framework.settings import api_settings
from rest_framework.views import APIView

from ..methods import is_mediacms_editor
from ..models import Category, Tag
from ..serializers import CategorySerializer, TagSerializer


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
        base_filters = {}

        if not is_mediacms_editor(request.user):
            base_filters = {"is_rbac_category": False}

        base_queryset = Category.objects.prefetch_related("user")
        categories = base_queryset.filter(**base_filters)

        if not is_mediacms_editor(request.user):
            if getattr(settings, 'USE_RBAC', False) and request.user.is_authenticated:
                rbac_categories = request.user.get_rbac_categories_as_member()
                categories = categories.union(rbac_categories)

        categories = categories.order_by("title")

        serializer = CategorySerializer(categories, many=True, context={"request": request})
        ret = serializer.data
        return Response(ret)


class CategoryListContributor(APIView):
    """List categories where user has contributor access"""

    @swagger_auto_schema(
        manual_parameters=[],
        tags=['Categories'],
        operation_summary='Lists Categories for Contributors',
        operation_description='Lists all categories where the user has contributor access',
        responses={
            200: openapi.Response('response description', CategorySerializer),
        },
    )
    def get(self, request, format=None):
        if not request.user.is_authenticated:
            return Response([])

        categories = Category.objects.none()

        # Get global/public categories (non-RBAC)
        public_categories = Category.objects.filter(is_rbac_category=False).prefetch_related("user")

        # Get RBAC categories where user has contributor access
        if getattr(settings, 'USE_RBAC', False):
            rbac_categories = request.user.get_rbac_categories_as_contributor()
            categories = public_categories.union(rbac_categories)
        else:
            categories = public_categories

        categories = categories.order_by("title")

        serializer = CategorySerializer(categories, many=True, context={"request": request})
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
