from django.conf import settings
from django.contrib.auth.backends import ModelBackend


class ApprovalBackend(ModelBackend):
    def user_can_authenticate(self, user):
        can_authenticate = super().user_can_authenticate(user)
        if can_authenticate and settings.USERS_NEEDS_TO_BE_APPROVED and not user.is_superuser:
            return getattr(user, 'is_approved', False)
        return can_authenticate
