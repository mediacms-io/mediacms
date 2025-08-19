from django.conf import settings
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied

from files.methods import (
    is_mediacms_editor,
    is_mediacms_manager,
    user_allowed_to_upload,
)


class IsAuthorizedToAdd(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        if not user_allowed_to_upload(request):
            raise PermissionDenied("You don't have permission to upload media, or have reached max number of media uploads.")

        return True


class IsAuthorizedToAddComment(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return user_allowed_to_comment(request)


class IsUserOrManager(permissions.BasePermission):
    """To be used in cases where request.user is either the
    object owner, or anyone amongst MediaCMS managers
    or superusers
    """

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user.is_superuser:
            return True
        if is_mediacms_manager(request.user):
            return True

        if hasattr(obj, 'user'):
            return obj.user == request.user
        else:
            return obj == request.user


class IsUserOrEditor(permissions.BasePermission):
    """To be used in cases where request.user is either the
    object owner, or anyone amongst MediaCMS editors, managers
    or superusers
    """

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user.is_superuser:
            return True
        if is_mediacms_editor(request.user):
            return True

        return obj.user == request.user


def user_allowed_to_comment(request):
    """Any custom logic for whether a user is allowed
    to comment lives here
    """
    if request.user.is_anonymous:
        return False
    if request.user.is_superuser:
        return True

    # Default is "all"
    if not hasattr(settings, "CAN_COMMENT") or settings.CAN_COMMENT == "all":
        return True
    elif settings.CAN_COMMENT == "email_verified":
        if request.user.email_is_verified:
            return True
    elif settings.CAN_COMMENT == "advancedUser":
        if request.user.advancedUser:
            return True
    return False
