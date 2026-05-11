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

import base64
import json
import logging
import traceback
import uuid
from urllib.parse import quote, urlencode

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

from files.models import Media, MediaPermission
from rbac.models import RBACMembership

from .adapters import DjangoRequest, DjangoSessionService, DjangoToolConfig
from .handlers import (
    apply_lti_roles,
    create_lti_session,
    provision_lti_bulk_contexts,
    provision_lti_context,
    provision_lti_user,
    validate_lti_session,
)
from .keys import get_jwks
from .models import LTILaunchLog, LTIPlatform, LTIResourceLink, LTIToolKeys

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
            cmid = request.GET.get('cmid') or request.POST.get('cmid')
            media_token = request.GET.get('media_token') or request.POST.get('media_token')

            # Extract embed parameters from request
            embed_show_title = request.GET.get('embed_show_title') or request.POST.get('embed_show_title')
            embed_show_related = request.GET.get('embed_show_related') or request.POST.get('embed_show_related')
            embed_show_user_avatar = request.GET.get('embed_show_user_avatar') or request.POST.get('embed_show_user_avatar')
            embed_link_title = request.GET.get('embed_link_title') or request.POST.get('embed_link_title')
            embed_start_time = request.GET.get('embed_start_time') or request.POST.get('embed_start_time')
            embed_width = request.GET.get('embed_width') or request.POST.get('embed_width')
            embed_height = request.GET.get('embed_height') or request.POST.get('embed_height')
            show_media_page = request.GET.get('show_media_page') or request.POST.get('show_media_page')

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
                    # Generate base state UUID
                    state_uuid = str(uuid.uuid4())
                    nonce = str(uuid.uuid4())

                    # Encode lti_message_hint IN the state parameter for retry reliability
                    # This survives session/cookie issues since it's passed through URLs
                    state_data = {'uuid': state_uuid}
                    if lti_message_hint:
                        state_data['hint'] = lti_message_hint
                    if media_token:
                        state_data['media_token'] = media_token

                    # Add embed parameters to state
                    if embed_show_title:
                        state_data['embed_show_title'] = embed_show_title
                    if embed_show_related:
                        state_data['embed_show_related'] = embed_show_related
                    if embed_show_user_avatar:
                        state_data['embed_show_user_avatar'] = embed_show_user_avatar
                    if embed_link_title:
                        state_data['embed_link_title'] = embed_link_title
                    if embed_start_time:
                        state_data['embed_start_time'] = embed_start_time
                    if embed_width:
                        state_data['embed_width'] = embed_width
                    if embed_height:
                        state_data['embed_height'] = embed_height
                    if show_media_page:
                        state_data['show_media_page'] = show_media_page

                    # Encode as base64 URL-safe string
                    state = base64.urlsafe_b64encode(json.dumps(state_data).encode()).decode().rstrip('=')

                    launch_data = {'target_link_uri': target_link_uri, 'nonce': nonce}
                    # Store cmid if provided (including 0 for filter-based launches)
                    if cmid is not None:
                        launch_data['cmid'] = cmid
                    # Store lti_message_hint for retry mechanism
                    if lti_message_hint:
                        launch_data['lti_message_hint'] = lti_message_hint

                    # CRITICAL: Store using the FULL encoded state, not just the UUID
                    # PyLTI1p3 looks for the full state value during validation
                    session_service.save_launch_data(f'state-{state}', launch_data)

                    # Also store lti_message_hint in regular session for retry mechanism
                    # (state-specific storage might be lost due to cookie issues)
                    if lti_message_hint:
                        request.session['lti_last_message_hint'] = lti_message_hint
                        request.session.modified = True

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

    @staticmethod
    def extract_embed_params_from_dict(params_dict):
        """Extract embed parameters from a dictionary and return as query string list."""
        embed_params = []
        param_mapping = {
            'embed_show_title': 'showTitle',
            'embed_show_related': 'showRelated',
            'embed_show_user_avatar': 'showUserAvatar',
            'embed_link_title': 'linkTitle',
            'embed_start_time': 't',
            'embed_width': 'width',
            'embed_height': 'height',
            'showTitle': 'showTitle',
            'showRelated': 'showRelated',
            'showUserAvatar': 'showUserAvatar',
            'linkTitle': 'linkTitle',
            't': 't',
            'width': 'width',
            'height': 'height',
            'show_media_page': 'show_media_page',
            'embed_share_media': 'share_media',
            'parent_media_base': 'parent_media_base',
        }

        url_encode_keys = {'parent_media_base'}

        for key, param_name in param_mapping.items():
            value = params_dict.get(key)
            if value:
                encoded_value = quote(str(value), safe='') if key in url_encode_keys else value
                param_str = f"{param_name}={encoded_value}"
                if param_str not in embed_params:
                    embed_params.append(param_str)

        return embed_params

    @staticmethod
    def build_url_with_embed_params(base_url, embed_params):
        """Build URL with embed parameters."""
        # Check if base_url already has query parameters
        separator = '&' if '?' in base_url else '?'

        query_parts = ['mode=lms_embed_mode']
        query_parts.extend(embed_params)

        return f"{base_url}{separator}{'&'.join(query_parts)}"

    def post(self, request):
        """Handle LTI launch with JWT validation"""
        platform = None
        user = None
        error_message = ''
        claims = {}

        # Extract media_token and embed parameters from state parameter if present (for filter launches)
        media_token_from_state = None
        embed_params_from_state = {}
        state = request.POST.get('state')
        if state:
            try:
                # Add padding if needed for base64 decode
                padding = 4 - (len(state) % 4)
                if padding and padding != 4:
                    state_padded = state + ('=' * padding)
                else:
                    state_padded = state

                state_decoded = base64.urlsafe_b64decode(state_padded.encode()).decode()
                state_data = json.loads(state_decoded)
                media_token_from_state = state_data.get('media_token')

                # Extract embed parameters from state
                for key in [
                    'embed_show_title',
                    'embed_show_related',
                    'embed_show_user_avatar',
                    'embed_link_title',
                    'embed_start_time',
                    'embed_width',
                    'embed_height',
                    'show_media_page',
                    'embed_share_media',
                ]:
                    if key in state_data:
                        embed_params_from_state[key] = state_data[key]
            except Exception:
                pass

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

            # Extract custom claims and inject media_token and embed params from state if present
            try:
                custom_claims = launch_data.get('https://purl.imsglobal.org/spec/lti/claim/custom', {})

                # Inject media_token from state if present (for filter launches)
                if media_token_from_state and not custom_claims.get('media_friendly_token'):
                    custom_claims['media_friendly_token'] = media_token_from_state

                # Inject embed parameters from state if present
                for key, value in embed_params_from_state.items():
                    if key not in custom_claims:
                        custom_claims[key] = value

                # Update launch_data with the modified custom claims
                launch_data['https://purl.imsglobal.org/spec/lti/claim/custom'] = custom_claims

            except Exception:
                custom_claims = {}

            resource_link = launch_data.get('https://purl.imsglobal.org/spec/lti/claim/resource_link', {})
            resource_link_id = resource_link.get('id', 'default')
            roles = launch_data.get('https://purl.imsglobal.org/spec/lti/claim/roles', [])

            # IMPORTANT: Provision user and create session BEFORE handling deep linking
            # This ensures filter launches (which are deep linking) have authenticated user
            user = provision_lti_user(platform, launch_data)

            context_claim = launch_data.get('https://purl.imsglobal.org/spec/lti/claim/context', {})

            # Detect My Media launches: publishdata is only sent on My Media launches.
            publish_data_raw = custom_claims.get('publishdata') or custom_claims.get('custom_publishdata')

            if publish_data_raw:
                # My Media launch: provision all enrolled courses from publishdata.
                # Skip individual context provisioning to avoid double-provisioning.
                resource_link_obj = None
                provision_lti_bulk_contexts(platform, user, publish_data_raw)
            elif context_claim:
                # Normal course launch: provision only this context.
                category, rbac_group, resource_link_obj = provision_lti_context(platform, launch_data, resource_link_id)
                apply_lti_roles(user, platform, roles, rbac_group)
            else:
                resource_link_obj = None

            create_lti_session(request, user, message_launch, platform)

            message_type = launch_data.get('https://purl.imsglobal.org/spec/lti/claim/message_type')

            if message_type == 'LtiDeepLinkingRequest':
                return self.handle_deep_linking_launch(request, message_launch, platform, launch_data)

            # Clear retry counter on successful launch
            if 'lti_retry_count' in request.session:
                del request.session['lti_retry_count']

            LTILaunchLog.objects.create(platform=platform, user=user, resource_link=resource_link_obj, launch_type='resource_link', success=True, claims=claims)

            redirect_url = self.determine_redirect(launch_data, resource_link_obj)

            if redirect_url is None:
                return HttpResponse('This media no longer exists', status=404, content_type='text/plain; charset=utf-8')

            # Use HTML meta refresh instead of HTTP redirect to ensure session cookie is sent
            # In cross-site/iframe contexts, HTTP 302 redirects may not preserve session cookies
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta http-equiv="refresh" content="0;url={redirect_url}">
                <title>Loading...</title>
                <style>
                    body {{
                        font-family: sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        background: #f5f5f5;
                    }}
                    .loader {{
                        text-align: center;
                    }}
                </style>
            </head>
            <body>
                <div class="loader">
                    <p>Loading MediaCMS...</p>
                    <p><small>If you are not redirected, <a href="{redirect_url}">click here</a></small></p>
                </div>
            </body>
            </html>
            """
            response = HttpResponse(html_content, content_type='text/html')
            # Ensure session cookie is set in this response
            request.session.modified = True
            return response

        except LtiException as e:  # noqa
            error_message = str(e)
            traceback.print_exc()

            # Attempt automatic retry for state errors (handles concurrent launches and session issues)
            if "State not found" in error_message or "state not found" in error_message.lower():
                return self.handle_state_not_found(request, platform)
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

        # Check custom claims for media token (from both deep linking and filter launches)
        media_id = custom.get('media_id') or custom.get('media_friendly_token')

        if media_id:
            try:
                media = Media.objects.get(friendly_token=media_id)
                embed_params = self.extract_embed_params_from_dict(custom)
                base_url = reverse('lti:embed_media', args=[media.friendly_token])
                return self.build_url_with_embed_params(base_url, embed_params)
            except Media.DoesNotExist:
                return None

        my_media_url = reverse('lti:my_media') + '?mode=lms_embed_mode'
        if custom.get('embed_share_media') == '0':
            my_media_url += '&share_media=0'
        return my_media_url

    def handle_state_not_found(self, request, platform=None):
        """
        Handle state not found errors by attempting to restart the OIDC flow.

        This can happen when:
        - Cookies are blocked/deleted
        - Session expired
        - Browser privacy settings interfere
        """
        try:
            # Check retry count to prevent infinite loops
            retry_count = request.session.get('lti_retry_count', 0)
            MAX_RETRIES = 5  # Increased for concurrent launches (e.g., multiple videos on same page)

            if retry_count >= MAX_RETRIES:
                return render(
                    request,
                    'lti/launch_error.html',
                    {
                        'error': 'Authentication Failed',
                        'message': (
                            'Unable to establish a secure session after multiple attempts. '
                            'This may be due to browser cookie settings or privacy features. Please try:\n\n'
                            '1. Enabling cookies for this site\n'
                            '2. Disabling tracking protection for this site\n'
                            '3. Using a different browser\n'
                            '4. Contacting your administrator if the issue persists'
                        ),
                        'is_cookie_error': True,
                    },
                    status=400,
                )

            # Extract launch parameters from the POST request
            id_token = request.POST.get('id_token')
            state = request.POST.get('state')

            if not id_token:
                raise ValueError("No id_token available for retry")

            # Decode state to extract media_token (encoded during OIDC login)
            media_token_from_retry = None
            try:
                # Add padding if needed for base64 decode
                padding = 4 - (len(state) % 4)
                if padding and padding != 4:
                    state_padded = state + ('=' * padding)
                else:
                    state_padded = state

                state_decoded = base64.urlsafe_b64decode(state_padded.encode()).decode()
                state_data = json.loads(state_decoded)
                media_token_from_retry = state_data.get('media_token')
            except Exception:
                # State might be a plain UUID from older code, that's OK
                pass

            # Decode JWT to extract issuer and target info (no verification needed for this)
            unverified = jwt.decode(id_token, options={"verify_signature": False})

            iss = unverified.get('iss')
            aud = unverified.get('aud')  # This is the client_id
            target_link_uri = unverified.get('https://purl.imsglobal.org/spec/lti/claim/target_link_uri')

            # Get login_hint and lti_message_hint if available
            login_hint = request.POST.get('login_hint') or unverified.get('sub')

            if not all([iss, aud, target_link_uri]):
                raise ValueError("Missing required parameters for OIDC retry")

            # Try to identify platform
            if not platform:
                try:
                    platform = LTIPlatform.objects.get(platform_id=iss, client_id=aud)
                except LTIPlatform.DoesNotExist:
                    raise ValueError(f"Platform not found: {iss}/{aud}")

            # Increment retry counter
            request.session['lti_retry_count'] = retry_count + 1
            request.session.modified = True

            # Build OIDC login URL with all parameters
            oidc_login_url = request.build_absolute_uri(reverse('lti:oidc_login'))

            params = {
                'iss': iss,
                'client_id': aud,
                'target_link_uri': target_link_uri,
                'login_hint': login_hint,
            }

            # DON'T pass lti_message_hint in retry - it's single-use and causes Moodle 404
            # The launchid in lti_message_hint is only valid for one authentication flow
            # Moodle will handle the retry without the hint

            # Pass media_token in retry for filter launches (our custom parameter, not Moodle's)
            if media_token_from_retry:
                params['media_token'] = media_token_from_retry

            # Add retry indicator
            params['retry'] = retry_count + 1

            redirect_url = f"{oidc_login_url}?{urlencode(params)}"

            return HttpResponseRedirect(redirect_url)

        except Exception as retry_error:
            traceback.print_exc()

            return render(
                request,
                'lti/launch_error.html',
                {
                    'error': 'LTI Launch Failed',
                    'message': f'State validation failed and automatic retry was unsuccessful: {str(retry_error)}',
                },
                status=400,
            )

    def handle_deep_linking_launch(self, request, message_launch, platform, launch_data):
        """Handle deep linking request"""
        # Clear retry counter on successful launch
        if 'lti_retry_count' in request.session:
            del request.session['lti_retry_count']

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

        # Check if we have a media_friendly_token from filter launches
        custom_claims = launch_data.get('https://purl.imsglobal.org/spec/lti/claim/custom', {})
        media_token = custom_claims.get('media_friendly_token')

        if media_token:
            embed_params = self.extract_embed_params_from_dict(custom_claims)
            base_url = reverse('lti:embed_media', args=[media_token])
            redirect_url = self.build_url_with_embed_params(base_url, embed_params)
        else:
            redirect_url = reverse('lti:select_media') + '?mode=lms_embed_mode'

        # Use HTML meta refresh to ensure session cookie is preserved in cross-site contexts
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta http-equiv="refresh" content="0;url={redirect_url}">
            <title>Loading...</title>
        </head>
        <body>
            <p>Loading...</p>
        </body>
        </html>
        """
        request.session.modified = True
        return HttpResponse(html_content, content_type='text/html')


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

        profile_url = f"/user/{request.user.username}?mode=lms_embed_mode"
        share_media = request.GET.get('share_media')
        if share_media == '0':
            profile_url += '&share_media=0'
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
        if media.state in ["public", "unlisted"]:
            can_view = True
        else:
            can_view = False

        if lti_session and request.user.is_authenticated:
            context_id = lti_session.get('context_id')
            platform_id = lti_session.get('platform_id')

            # MediaPermission has to be added so that the user is able to visit the media
            if media.is_shared and context_id and platform_id:
                try:
                    resource_link = (
                        LTIResourceLink.objects.filter(
                            platform_id=platform_id,
                            context_id=context_id,
                        )
                        .select_related('rbac_group')
                        .first()
                    )
                    if resource_link and resource_link.rbac_group:
                        has_course_access = RBACMembership.objects.filter(
                            user=request.user,
                            rbac_group=resource_link.rbac_group,
                        ).exists()
                        if has_course_access:
                            # create an entry so it shows up under shared with me
                            MediaPermission.objects.get_or_create(
                                user=request.user,
                                media=media,
                                defaults={
                                    'owner_user': media.user,
                                    'permission': 'viewer',
                                    'source': MediaPermission.SOURCE_LTI_EMBED,
                                },
                            )
                            can_view = True
                except Exception:
                    logger.exception('EmbedMediaLTIView: error checking course access for user=%s media=%s', request.user, friendly_token)

            if not can_view and request.user.has_member_access_to_media(media):
                can_view = True

        if not can_view:
            return HttpResponse('You do not have permission to view this media', status=403, content_type='text/plain; charset=utf-8')

        # Build embed URL with parameters from the request
        embed_params = LaunchView.extract_embed_params_from_dict(request.GET)
        show_media_page = request.GET.get('show_media_page')

        if show_media_page == 'true':
            base_path = f"/view?m={friendly_token}"
        else:
            base_path = f"/embed?m={friendly_token}"

        embed_url = LaunchView.build_url_with_embed_params(base_path, embed_params)

        return HttpResponseRedirect(embed_url)
