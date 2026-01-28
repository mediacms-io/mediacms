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

import json
import logging
import traceback
import uuid
from urllib.parse import urlencode

import jwt
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.clickjacking import xframe_options_exempt
from django.views.decorators.csrf import csrf_exempt
from jwcrypto import jwk
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
from .keys import get_jwks
from .models import LTILaunchLog, LTIPlatform, LTIResourceLink, LTIToolKeys
from .services import LTINRPSClient

logger = logging.getLogger(__name__)


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
            target_link_uri = request.GET.get('target_link_uri') or request.POST.get('target_link_uri')
            iss = request.GET.get('iss') or request.POST.get('iss')
            client_id = request.GET.get('client_id') or request.POST.get('client_id')
            login_hint = request.GET.get('login_hint') or request.POST.get('login_hint')
            lti_message_hint = request.GET.get('lti_message_hint') or request.POST.get('lti_message_hint')
            media_friendly_token = request.GET.get('media_friendly_token') or request.POST.get('media_friendly_token')
            cmid = request.GET.get('cmid') or request.POST.get('cmid')

            if not all([target_link_uri, iss, client_id]):
                return JsonResponse({'error': 'Missing required OIDC parameters'}, status=400)

            try:
                platform = LTIPlatform.objects.get(platform_id=iss, client_id=client_id)
            except LTIPlatform.DoesNotExist:
                return JsonResponse({'error': 'Platform not found'}, status=404)

            tool_config = DjangoToolConfig.from_platform(platform)

            lti_request = DjangoRequest(request)

            session_service = DjangoSessionService(request)
            cookie_service = DjangoSessionService(request)  # Using same service for cookies

            oidc_login = OIDCLogin(lti_request, tool_config, session_service=session_service, cookie_service=cookie_service)
            try:
                oidc_with_cookies = oidc_login.enable_check_cookies()
                redirect_url = oidc_with_cookies.redirect(target_link_uri)

                if not redirect_url:
                    state = str(uuid.uuid4())
                    nonce = str(uuid.uuid4())

                    launch_data = {'target_link_uri': target_link_uri, 'nonce': nonce}
                    # Store media token and cmid if provided (for filter-based launches)
                    if media_friendly_token:
                        launch_data['media_friendly_token'] = media_friendly_token
                    if cmid:
                        launch_data['cmid'] = cmid

                    session_service.save_launch_data(f'state-{state}', launch_data)

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

                    if lti_message_hint:
                        params['lti_message_hint'] = lti_message_hint

                    redirect_url = f"{platform.auth_login_url}?{urlencode(params)}"

                    # Debug logging for filter launches
                    logger.error(f"[OIDC LOGIN DEBUG] Redirecting to: {redirect_url}")
                    logger.error(f"[OIDC LOGIN DEBUG] Has lti_message_hint: {bool(lti_message_hint)}")
                    logger.error(f"[OIDC LOGIN DEBUG] Has media_friendly_token: {bool(media_friendly_token)}")
                    logger.error(f"[OIDC LOGIN DEBUG] cmid: {cmid}")

                return HttpResponseRedirect(redirect_url)
            except Exception:
                raise

        except LtiException as e:
            traceback.print_exc()
            return render(request, 'lti/launch_error.html', {'error': 'OIDC Login Failed', 'message': str(e)}, status=400)
        except Exception as e:  # noqa
            traceback.print_exc()
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
            id_token = request.POST.get('id_token')
            if not id_token:
                raise ValueError("Missing id_token in launch request")

            unverified = jwt.decode(id_token, options={"verify_signature": False})
            iss = unverified.get('iss')
            aud = unverified.get('aud')
            try:
                platform = LTIPlatform.objects.get(platform_id=iss, client_id=aud)
            except LTIPlatform.DoesNotExist:
                raise

            tool_config = DjangoToolConfig.from_platform(platform)

            lti_request = DjangoRequest(request)

            session_service = DjangoSessionService(request)
            cookie_service = DjangoSessionService(request)

            class CustomMessageLaunch(MessageLaunch):
                def _get_request_param(self, key):
                    """Override to properly get request parameters"""
                    return self._request.get_param(key)

            message_launch = CustomMessageLaunch(lti_request, tool_config, session_service=session_service, cookie_service=cookie_service)

            launch_data = message_launch.get_launch_data()
            claims = self.sanitize_claims(launch_data)

            resource_link = launch_data.get('https://purl.imsglobal.org/spec/lti/claim/resource_link', {})
            resource_link_id = resource_link.get('id', 'default')
            roles = launch_data.get('https://purl.imsglobal.org/spec/lti/claim/roles', [])

            message_type = launch_data.get('https://purl.imsglobal.org/spec/lti/claim/message_type')

            if message_type == 'LtiDeepLinkingRequest':
                return self.handle_deep_linking_launch(request, message_launch, platform, launch_data)

            user = provision_lti_user(platform, launch_data)

            if 'https://purl.imsglobal.org/spec/lti/claim/context' in launch_data:
                category, rbac_group, resource_link_obj = provision_lti_context(platform, launch_data, resource_link_id)

                apply_lti_roles(user, platform, roles, rbac_group)
            else:
                resource_link_obj = None

            create_lti_session(request, user, message_launch, platform)

            # Extract and store message hint data if present (for filter-based launches)
            custom_claims = launch_data.get('https://purl.imsglobal.org/spec/lti/claim/custom', {})

            # DEBUG: Log custom claims to see what we're receiving
            logger.error(f"[LTI LAUNCH DEBUG] Custom claims received: {custom_claims}")
            logger.error(f"[LTI LAUNCH DEBUG] Has media_friendly_token: {bool(custom_claims.get('media_friendly_token'))}")
            if custom_claims.get('media_friendly_token'):
                logger.error(f"[LTI LAUNCH DEBUG] media_friendly_token value: {custom_claims.get('media_friendly_token')}")

            lti_message_hint_str = custom_claims.get('lti_message_hint', '')
            if lti_message_hint_str:
                try:
                    message_hint_data = json.loads(lti_message_hint_str)
                    if isinstance(message_hint_data, dict):
                        # Store in session for later use
                        if 'lti_session' in request.session:
                            request.session['lti_session']['message_hint'] = message_hint_data
                            request.session.modified = True
                except (json.JSONDecodeError, ValueError):
                    pass

            LTILaunchLog.objects.create(platform=platform, user=user, resource_link=resource_link_obj, launch_type='resource_link', success=True, claims=claims)

            redirect_url = self.determine_redirect(launch_data, resource_link_obj)

            return HttpResponseRedirect(redirect_url)

        except LtiException as e:  # noqa
            traceback.print_exc()
        except Exception as e:  # noqa
            traceback.print_exc()

        if platform:
            LTILaunchLog.objects.create(platform=platform, user=user, launch_type='resource_link', success=False, error_message=error_message, claims=claims)

        return render(request, 'lti/launch_error.html', {'error': 'LTI Launch Failed', 'message': error_message}, status=400)

    def sanitize_claims(self, claims):
        """Remove sensitive data from claims before logging"""
        safe_claims = claims.copy()
        return safe_claims

    def determine_redirect(self, launch_data, resource_link):
        """Determine where to redirect after successful launch"""

        custom = launch_data.get('https://purl.imsglobal.org/spec/lti/claim/custom', {})

        custom_path = custom.get('redirect_path')

        if custom_path:
            if not custom_path.startswith('/'):
                custom_path = '/' + custom_path
            return custom_path

        media_id = custom.get('media_id') or custom.get('media_friendly_token')

        # Also check session for media token (from filter-based launches)
        if not media_id and hasattr(self, 'request'):
            media_id = self.request.session.get('filter_media_token')

        if media_id:
            try:
                media = Media.objects.get(friendly_token=media_id)
                return reverse('lti:embed_media', args=[media.friendly_token])
            except Media.DoesNotExist:
                pass

        return reverse('lti:my_media')

    def handle_deep_linking_launch(self, request, message_launch, platform, launch_data):
        """Handle deep linking request"""
        deep_linking_settings = launch_data.get('https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings', {})

        if not deep_linking_settings:
            raise ValueError("Missing deep linking settings in launch data")

        deep_link_return_url = deep_linking_settings.get('deep_link_return_url')

        if not deep_link_return_url:
            raise ValueError("Missing deep_link_return_url in deep linking settings")

        request.session['lti_deep_link'] = {
            'deep_link_return_url': deep_link_return_url,
            'deployment_id': launch_data.get('https://purl.imsglobal.org/spec/lti/claim/deployment_id'),
            'platform_id': platform.id,
            'message_launch_data': launch_data,  # Store full launch data for JWT creation
        }

        return HttpResponseRedirect(reverse('lti:select_media'))


class JWKSView(View):
    """
    JWKS Endpoint - Provides tool's public keys

    Used by Moodle to validate signatures from MediaCMS (e.g., Deep Linking responses)
    """

    def get(self, request):
        """Return tool's public JWK Set"""
        jwks = get_jwks()

        return JsonResponse(jwks, content_type='application/json')


class PublicKeyPEMView(View):
    """
    Display public key in PEM format for easy copy/paste into Moodle
    """

    def get(self, request):
        """Return public key in PEM format"""
        key_obj = LTIToolKeys.get_or_create_keys()

        jwk_obj = jwk.JWK(**key_obj.public_key_jwk)
        pem_bytes = jwk_obj.export_to_pem()
        pem_string = pem_bytes.decode('utf-8')

        return HttpResponse(
            f"MediaCMS LTI Public Key (PEM Format)\n"
            f"{'=' * 80}\n\n"
            f"{pem_string}\n"
            f"{'=' * 80}\n\n"
            f"Instructions:\n"
            f"1. Copy the entire key above (including BEGIN/END lines)\n"
            f"2. In Moodle LTI tool configuration, change 'Public key type' to 'Public key'\n"
            f"3. Paste the key into the 'Public key' field\n"
            f"4. Save and try Deep Linking again\n",
            content_type='text/plain',
        )


@method_decorator(xframe_options_exempt, name='dispatch')
class MyMediaLTIView(View):
    """
    My Media page for LTI-authenticated users

    Shows user's media profile in iframe
    """

    def get(self, request):
        """Display my media page"""
        lti_session = validate_lti_session(request)

        if not lti_session:
            return JsonResponse({'error': 'Not authenticated via LTI'}, status=403)

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

        lti_session = validate_lti_session(request)
        can_view = False

        if lti_session and request.user.is_authenticated:
            if request.user.has_member_access_to_media(media):
                can_view = True

        if media.state in ["public", "unlisted"]:
            can_view = True

        if not can_view:
            return JsonResponse({'error': 'Access denied', 'message': 'You do not have permission to view this media'}, status=403)

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
            platform = get_object_or_404(LTIPlatform, id=platform_id)

            resource_link = LTIResourceLink.objects.filter(platform=platform, context_id=context_id).first()

            if not resource_link:
                return Response({'error': 'Context not found', 'message': f'No resource link found for context {context_id}'}, status=status.HTTP_404_NOT_FOUND)

            rbac_group = resource_link.rbac_group
            if not rbac_group:
                return Response({'error': 'No RBAC group', 'message': 'This context does not have an associated RBAC group'}, status=status.HTTP_400_BAD_REQUEST)

            is_manager = RBACMembership.objects.filter(user=request.user, rbac_group=rbac_group, role='manager').exists()

            if not is_manager:
                return Response({'error': 'Insufficient permissions', 'message': 'You must be a course manager to sync members'}, status=status.HTTP_403_FORBIDDEN)

            if not platform.enable_nrps:
                return Response({'error': 'NRPS disabled', 'message': 'Names and Role Provisioning Service is disabled for this platform'}, status=status.HTTP_400_BAD_REQUEST)

            last_launch = LTILaunchLog.objects.filter(platform=platform, resource_link=resource_link, success=True).order_by('-created_at').first()

            if not last_launch:
                return Response({'error': 'No launch data', 'message': 'No successful launch data found for NRPS'}, status=status.HTTP_400_BAD_REQUEST)

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


@method_decorator(xframe_options_exempt, name='dispatch')
class TinyMCEGetEmbedView(View):
    """
    API endpoint to get embed code for a specific media item (for TinyMCE integration).

    Returns JSON with the embed code for the requested media.
    Requires: User must be logged in (via LTI session)
    """

    def get(self, request, friendly_token):
        """Get embed code for the specified media."""
        # Verify user is authenticated
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Authentication required'}, status=401)

        # Verify media exists
        media = Media.objects.filter(friendly_token=friendly_token).first()

        if not media:
            return JsonResponse({'error': 'Media not found'}, status=404)

        # Build embed URL
        embed_url = request.build_absolute_uri(reverse('get_embed') + f'?m={friendly_token}')

        # Generate iframe embed code
        embed_code = f'<iframe src="{embed_url}" ' f'width="960" height="540" ' f'frameborder="0" ' f'allowfullscreen ' f'title="{media.title}">' f'</iframe>'

        return JsonResponse(
            {
                'embedCode': embed_code,
                'title': media.title,
                'thumbnail': media.thumbnail_url if hasattr(media, 'thumbnail_url') else '',
            }
        )
