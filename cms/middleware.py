from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import redirect
from django.urls import reverse


class ApprovalMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if settings.USERS_NEEDS_TO_BE_APPROVED and request.user.is_authenticated and not request.user.is_superuser and not getattr(request.user, 'is_approved', False):
            allowed_paths = [
                reverse('approval_required'),
                reverse('account_logout'),
            ]
            if request.path not in allowed_paths:
                if request.path.startswith('/api/'):
                    return JsonResponse({'detail': 'User account not approved.'}, status=403)
                return redirect('approval_required')

        response = self.get_response(request)
        return response
