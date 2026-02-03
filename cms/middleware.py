import logging

from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import redirect
from django.urls import reverse

from .utils import get_client_ip

logger = logging.getLogger(__name__)


class ProxyAwareMiddleware:
    """
    Middleware to handle reverse proxy configurations.

    This middleware extracts the real client IP address from proxy headers
    (X-Forwarded-For, X-Real-IP) when the request comes from a trusted proxy.
    It validates all proxy headers against the TRUSTED_PROXIES setting to
    prevent IP spoofing attacks.

    The middleware can optionally modify request.META['REMOTE_ADDR'] to the
    real client IP (controlled by SET_REAL_IP_IN_META setting), which allows
    Django's built-in middleware to work correctly with proxy configurations.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Check if proxy-aware middleware is enabled
        if getattr(settings, 'PROXY_AWARE_MIDDLEWARE_ENABLED', False):
            # Extract the real client IP using the utility function
            client_ip = get_client_ip(request)

            if client_ip:
                # Always set the client_ip attribute for application use
                request.client_ip = client_ip

                # Optionally modify REMOTE_ADDR in META if configured
                if getattr(settings, 'SET_REAL_IP_IN_META', False):
                    # Preserve the original REMOTE_ADDR for audit purposes
                    if 'REMOTE_ADDR' in request.META:
                        request.META['ORIGINAL_REMOTE_ADDR'] = request.META['REMOTE_ADDR']

                    # Set REMOTE_ADDR to the real client IP
                    # This allows Django's built-in middleware to work correctly
                    request.META['REMOTE_ADDR'] = client_ip
            else:
                # Fallback: set client_ip to REMOTE_ADDR if extraction fails
                request.client_ip = request.META.get('REMOTE_ADDR')
        else:
            # Middleware disabled, set client_ip to REMOTE_ADDR for consistency
            request.client_ip = request.META.get('REMOTE_ADDR')

        response = self.get_response(request)
        return response


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
                logger.warning(
                    "User access blocked - approval required - user_id=%s, username=%s, path=%s, method=%s",
                    request.user.id,
                    request.user.username,
                    request.path,
                    request.method,
                )
                if request.path.startswith('/api/'):
                    return JsonResponse({'detail': 'User account not approved.'}, status=403)
                return redirect('approval_required')

        response = self.get_response(request)
        return response
