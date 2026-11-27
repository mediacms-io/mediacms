from django.conf import settings
from django.db.models import Q
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework.parsers import JSONParser
from rest_framework.settings import api_settings
from rest_framework.views import APIView

from actions.models import USER_MEDIA_ACTIONS

from ..methods import is_mediacms_editor
from ..models import Media
from ..serializers import MediaSerializer

VALID_USER_ACTIONS = [action for action, name in USER_MEDIA_ACTIONS]


class UserActions(APIView):
    parser_classes = (JSONParser,)

    @swagger_auto_schema(
        manual_parameters=[
            openapi.Parameter(name='action', type=openapi.TYPE_STRING, in_=openapi.IN_PATH, description='action', required=True, enum=VALID_USER_ACTIONS),
        ],
        tags=['Users'],
        operation_summary='List user actions',
        operation_description='Lists user actions',
    )
    def get(self, request, action):
        media = Media.objects.none()
        if action in VALID_USER_ACTIONS:
            if request.user.is_authenticated:
                media = Media.objects.select_related("user").filter(mediaactions__user=request.user, mediaactions__action=action).order_by("-mediaactions__action_date")
            elif request.session.session_key:
                media = (
                    Media.objects.select_related("user")
                    .filter(
                        mediaactions__session_key=request.session.session_key,
                        mediaactions__action=action,
                    )
                    .order_by("-mediaactions__action_date")
                )
            if not is_mediacms_editor(request.user):
                accessible = Q(state__in=["public", "unlisted"])
                if request.user.is_authenticated:
                    accessible |= Q(user=request.user) | Q(permissions__user=request.user)
                    if getattr(settings, "USE_RBAC", False):
                        accessible |= Q(category__in=request.user.get_rbac_categories_as_member())
                media = media.filter(pk__in=Media.objects.filter(accessible).values("pk"))

        pagination_class = api_settings.DEFAULT_PAGINATION_CLASS
        paginator = pagination_class()
        page = paginator.paginate_queryset(media, request)
        serializer = MediaSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)
