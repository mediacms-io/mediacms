"""
LTI 1.3 Views for MediaCMS

Implements the LTI 1.3 / LTI Advantage flow:
- OIDC Login Initiation
- LTI Launch (JWT validation and processing)
- JWKS endpoint (public keys)
- My Media view (iframe-compatible)
- Embed Media view (LTI-authenticated)
- Manual NRPS Sync
"""

import uuid
from urllib.parse import urlencode

import jwt
from django.http import HttpResponseRedirect, JsonResponse
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.clickjacking import xframe_options_exempt
from django.views.decorators.csrf import csrf_exempt
from pylti1p3.exception import LtiException
from pylti1p3.message_launch import MessageLaunch
from pylti1p3.oidc_login import OIDCLogin
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from files.models import Media
from rbac.models import RBACMembership

from .adapters import DjangoRequest, DjangoSessionService, DjangoToolConfig
from .handlers import (
    apply_lti_roles,
    create_lti_session,
    provision_lti_context,
    provision_lti_user,
    validate_lti_session,
)
from .models import LTILaunchLog, LTIPlatform, LTIResourceLink
from .services import LTINRPSClient


def get_client_ip(request):
    """Get client IP address from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


@method_decorator(csrf_exempt, name='dispatch')
class OIDCLoginView(View):
    """
    OIDC Login Initiation - Step 1 of LTI 1.3 launch

    Flow: Moodle → This endpoint → Redirect to Moodle auth endpoint
    """

    def get(self, request):
        return self.handle_oidc_login(request)

    def post(self, request):
        return self.handle_oidc_login(request)

    def handle_oidc_login(self, request):
        """Handle OIDC login initiation"""
        try:
            # Get target_link_uri and other OIDC params
            target_link_uri = request.GET.get('target_link_uri') or request.POST.get('target_link_uri')
            iss = request.GET.get('iss') or request.POST.get('iss')
            client_id = request.GET.get('client_id') or request.POST.get('client_id')
            login_hint = request.GET.get('login_hint') or request.POST.get('login_hint')
            lti_message_hint = request.GET.get('lti_message_hint') or request.POST.get('lti_message_hint')

            if not all([target_link_uri, iss, client_id]):
                return JsonResponse({'error': 'Missing required OIDC parameters'}, status=400)

            # Get platform configuration
            platform = get_object_or_404(LTIPlatform, platform_id=iss, client_id=client_id, active=True)

            # Create tool config for this platform
            tool_config = DjangoToolConfig.from_platform(platform)

            # Wrap Django request for PyLTI1p3
            lti_request = DjangoRequest(request)

            # Create OIDC login handler with session and cookie services
            session_service = DjangoSessionService(request)
            cookie_service = DjangoSessionService(request)  # Using same service for cookies

            oidc_login = OIDCLogin(lti_request, tool_config, session_service=session_service, cookie_service=cookie_service)

            # Redirect to platform's authorization endpoint
            try:
                oidc_with_cookies = oidc_login.enable_check_cookies()
                redirect_url = oidc_with_cookies.redirect(target_link_uri)

                if not redirect_url:
                    # Manual OIDC redirect construction with all required OAuth 2.0 parameters

                    state = str(uuid.uuid4())
                    nonce = str(uuid.uuid4())

                    # Store state and nonce in session for validation
                    session_service.save_launch_data(f'state-{state}', {'target_link_uri': target_link_uri, 'nonce': nonce})

                    # Build redirect URL with all required parameters
                    params = {
                        'response_type': 'id_token',
                        'redirect_uri': target_link_uri,
                        'state': state,
                        'client_id': client_id,
                        'login_hint': login_hint,
                        'scope': 'openid',
                        'response_mode': 'form_post',
                        'prompt': 'none',
                        'nonce': nonce,
                    }

                    # Add optional parameters if present
                    if lti_message_hint:
                        params['lti_message_hint'] = lti_message_hint

                    redirect_url = f"{platform.auth_login_url}?{urlencode(params)}"

                return HttpResponseRedirect(redirect_url)
            except Exception:
                raise

        except LtiException as e:
            return render(request, 'lti/launch_error.html', {'error': 'OIDC Login Failed', 'message': str(e)}, status=400)
        except Exception:
            return JsonResponse({'error': 'Internal server error during OIDC login'}, status=500)


@method_decorator(csrf_exempt, name='dispatch')
@method_decorator(xframe_options_exempt, name='dispatch')
class LaunchView(View):
    """
    LTI Launch Handler - Step 3 of LTI 1.3 launch

    Flow: Moodle → This endpoint (with JWT) → Validate → Provision → Session → Redirect
    """

    def post(self, request):
        """Handle LTI launch with JWT validation"""
        platform = None
        user = None
        error_message = ''
        claims = {}

        try:
            # Get issuer from request
            id_token = request.POST.get('id_token')
            if not id_token:
                raise ValueError("Missing id_token in launch request")

            # Decode JWT to get issuer (without validation first)

            unverified = jwt.decode(id_token, options={"verify_signature": False})
            iss = unverified.get('iss')
            aud = unverified.get('aud')

            # Get platform
            platform = get_object_or_404(LTIPlatform, platform_id=iss, client_id=aud, active=True)

            # Create tool config
            tool_config = DjangoToolConfig.from_platform(platform)

            # Wrap Django request for PyLTI1p3
            lti_request = DjangoRequest(request)

            # Validate JWT and get launch data
            session_service = DjangoSessionService(request)
            cookie_service = DjangoSessionService(request)

            # Create custom MessageLaunch that properly implements _get_request_param
            class CustomMessageLaunch(MessageLaunch):
                def _get_request_param(self, key):
                    """Override to properly get request parameters"""
                    return self._request.get_param(key)

            message_launch = CustomMessageLaunch(lti_request, tool_config, session_service=session_service, cookie_service=cookie_service)

            # Get validated launch data
            launch_data = message_launch.get_launch_data()
            claims = self.sanitize_claims(launch_data)

            # Extract key claims
            sub = launch_data.get('sub')
            resource_link = launch_data.get('https://purl.imsglobal.org/spec/lti/claim/resource_link', {})
            resource_link_id = resource_link.get('id', 'default')
            roles = launch_data.get('https://purl.imsglobal.org/spec/lti/claim/roles', [])

            # Check launch type
            message_type = launch_data.get('https://purl.imsglobal.org/spec/lti/claim/message_type')

            if message_type == 'LtiDeepLinkingRequest':
                # Deep linking request - handle separately
                return self.handle_deep_linking_launch(request, message_launch, platform, launch_data)

            # Provision user
            if platform.auto_create_users:
                user = provision_lti_user(platform, launch_data)
            else:
                # Must find existing user
                from .models import LTIUserMapping

                mapping = LTIUserMapping.objects.filter(platform=platform, lti_user_id=sub).first()
                if not mapping:
                    raise ValueError("User auto-creation disabled and no existing mapping found")
                user = mapping.user

            # Provision context (category + RBAC group)
            if 'https://purl.imsglobal.org/spec/lti/claim/context' in launch_data:
                category, rbac_group, resource_link_obj = provision_lti_context(platform, launch_data, resource_link_id)

                # Apply roles
                apply_lti_roles(user, platform, roles, rbac_group)
            else:
                # No context - might be a direct media embed
                resource_link_obj = None

            # Create session
            create_lti_session(request, user, message_launch, platform)

            # Log successful launch
            LTILaunchLog.objects.create(platform=platform, user=user, resource_link=resource_link_obj, launch_type='resource_link', success=True, claims=claims, ip_address=get_client_ip(request))

            # Determine where to redirect
            redirect_url = self.determine_redirect(launch_data, resource_link_obj)

            return HttpResponseRedirect(redirect_url)

        except LtiException as e:
            error_message = f"LTI Launch Error: {str(e)}"
        except Exception as e:
            error_message = f"Launch Error: {str(e)}"

        # Log failed launch
        if platform:
            LTILaunchLog.objects.create(platform=platform, user=user, launch_type='resource_link', success=False, error_message=error_message, claims=claims, ip_address=get_client_ip(request))

        return render(request, 'lti/launch_error.html', {'error': 'LTI Launch Failed', 'message': error_message}, status=400)

    def sanitize_claims(self, claims):
        """Remove sensitive data from claims before logging"""
        safe_claims = claims.copy()
        # Remove any sensitive keys if needed
        return safe_claims

    def determine_redirect(self, launch_data, resource_link):
        """Determine where to redirect after successful launch"""

        # Check for custom parameters indicating what to show
        custom = launch_data.get('https://purl.imsglobal.org/spec/lti/claim/custom', {})

        # Check for custom redirect URL (any MediaCMS path)
        custom_path = custom.get('redirect_path')

        if custom_path:
            # Ensure it starts with / and doesn't include domain
            if not custom_path.startswith('/'):
                custom_path = '/' + custom_path
            return custom_path

        # Check if specific media is requested
        media_id = custom.get('media_id') or custom.get('media_friendly_token')
        if media_id:
            try:
                media = Media.objects.get(friendly_token=media_id)
                return reverse('lti:embed_media', args=[media.friendly_token])
            except Media.DoesNotExist:
                pass

        # Default: redirect to my media
        return reverse('lti:my_media')

    def handle_deep_linking_launch(self, request, message_launch, platform, launch_data):
        """Handle deep linking request"""
        # Get deep linking settings from launch data
        deep_linking_settings = launch_data.get('https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings', {})

        if not deep_linking_settings:
            raise ValueError("Missing deep linking settings in launch data")

        deep_link_return_url = deep_linking_settings.get('deep_link_return_url')

        if not deep_link_return_url:
            raise ValueError("Missing deep_link_return_url in deep linking settings")

        # Store deep link data in session for use in SelectMediaView
        request.session['lti_deep_link'] = {
            'deep_link_return_url': deep_link_return_url,
            'deployment_id': launch_data.get('https://purl.imsglobal.org/spec/lti/claim/deployment_id'),
            'platform_id': platform.id,
            'message_launch_data': launch_data,  # Store full launch data for JWT creation
        }

        # Redirect to media selection page
        return HttpResponseRedirect(reverse('lti:select_media'))


class JWKSView(View):
    """
    JWKS Endpoint - Provides tool's public keys

    Used by Moodle to validate signatures from MediaCMS
    """

    def get(self, request):
        """Return tool's public JWK Set"""
        # For now, return empty JWKS since we're not signing responses
        # In the future, we can generate and store keys for signing deep linking responses
        jwks = {"keys": []}

        return JsonResponse(jwks, content_type='application/json')


@method_decorator(xframe_options_exempt, name='dispatch')
class MyMediaLTIView(View):
    """
    My Media page for LTI-authenticated users

    Shows user's media profile in iframe
    """

    def get(self, request):
        """Display my media page"""
        # Validate LTI session
        lti_session = validate_lti_session(request)

        if not lti_session:
            return JsonResponse({'error': 'Not authenticated via LTI'}, status=403)

        # Redirect to user's profile page
        # The existing user profile page is already iframe-compatible
        profile_url = f"/user/{request.user.username}"
        return HttpResponseRedirect(profile_url)


@method_decorator(xframe_options_exempt, name='dispatch')
class EmbedMediaLTIView(View):
    """
    Embed media with LTI authentication

    Pattern: Extends existing /embed functionality
    """

    def get(self, request, friendly_token):
        """Display embedded media"""
        media = get_object_or_404(Media, friendly_token=friendly_token)

        # Check LTI session
        lti_session = validate_lti_session(request)

        if lti_session and request.user.is_authenticated:
            if request.user.has_member_access_to_media(media):
                can_view = True
            else:
                can_view = False

        if media.state in ["public", "unlisted"]:
            can_view = True

        if not can_view:
            return JsonResponse({'error': 'Access denied', 'message': 'You do not have permission to view this media'}, status=403)

        # Redirect to media view page
        return HttpResponseRedirect(f"/view?m={friendly_token}")


class ManualSyncView(APIView):
    """
    Manual NRPS sync for course members/roles

    Endpoint: POST /lti/sync/<platform_id>/<context_id>/
    Requires: User must be manager in the course RBAC group
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, platform_id, context_id):
        """Manually trigger NRPS sync"""
        try:
            # Get platform
            platform = get_object_or_404(LTIPlatform, id=platform_id, active=True)

            # Find resource link by context
            resource_link = LTIResourceLink.objects.filter(platform=platform, context_id=context_id).first()

            if not resource_link:
                return Response({'error': 'Context not found', 'message': f'No resource link found for context {context_id}'}, status=status.HTTP_404_NOT_FOUND)

            # Verify user has manager role in the course
            rbac_group = resource_link.rbac_group
            if not rbac_group:
                return Response({'error': 'No RBAC group', 'message': 'This context does not have an associated RBAC group'}, status=status.HTTP_400_BAD_REQUEST)

            is_manager = RBACMembership.objects.filter(user=request.user, rbac_group=rbac_group, role='manager').exists()

            if not is_manager:
                return Response({'error': 'Insufficient permissions', 'message': 'You must be a course manager to sync members'}, status=status.HTTP_403_FORBIDDEN)

            # Check NRPS is enabled
            if not platform.enable_nrps:
                return Response({'error': 'NRPS disabled', 'message': 'Names and Role Provisioning Service is disabled for this platform'}, status=status.HTTP_400_BAD_REQUEST)

            # Get last successful launch for NRPS endpoint
            last_launch = LTILaunchLog.objects.filter(platform=platform, resource_link=resource_link, success=True).order_by('-created_at').first()

            if not last_launch:
                return Response({'error': 'No launch data', 'message': 'No successful launch data found for NRPS'}, status=status.HTTP_400_BAD_REQUEST)

            # Perform NRPS sync
            nrps_client = LTINRPSClient(platform, last_launch.claims)
            result = nrps_client.sync_members_to_rbac_group(rbac_group)

            return Response(
                {
                    'status': 'success',
                    'message': f'Successfully synced {result["synced"]} members',
                    'synced_count': result['synced'],
                    'removed_count': result.get('removed', 0),
                    'synced_at': result['synced_at'],
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response({'error': 'Sync failed', 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
