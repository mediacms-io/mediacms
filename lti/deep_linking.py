"""
LTI Deep Linking 2.0 for MediaCMS

Allows instructors to select media from MediaCMS library and embed in Moodle courses
"""

import time
import traceback
import uuid

import jwt
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import render
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from jwcrypto import jwk

from files.models import Media
from files.views.media import MediaList

from .models import LTIPlatform, LTIToolKeys


@method_decorator(login_required, name='dispatch')
class SelectMediaView(View):
    """
    UI for instructors to select media for deep linking

    Flow: Instructor clicks "Add MediaCMS" in Moodle → Deep link launch →
          This view → Instructor selects media → Return to Moodle
    """

    def get(self, request):
        """Display media selection interface"""

        # Get deep link session data
        deep_link_data = request.session.get('lti_deep_link')
        if not deep_link_data:
            return JsonResponse({'error': 'No deep linking session data found'}, status=400)

        # Reuse MediaList logic to get media with proper permissions
        media_list_view = MediaList()

        # Get base queryset with all permission/RBAC logic applied
        media_queryset = media_list_view._get_media_queryset(request)

        # Apply filtering based on query params
        show_my_media_only = request.GET.get('my_media_only', 'false').lower() == 'true'
        if show_my_media_only:
            media_queryset = media_queryset.filter(user=request.user)

        # Order by recent and limit for performance
        media_list = media_queryset.order_by('-add_date')[:100]

        context = {
            'media_list': media_list,
            'show_my_media_only': show_my_media_only,
            'deep_link_data': deep_link_data,
        }

        return render(request, 'lti/select_media.html', context)

    @method_decorator(csrf_exempt)
    def post(self, request):
        """Return selected media as deep linking content items"""

        print("=" * 80)
        print("DEEP LINKING - MEDIA SELECTION SUBMITTED")
        print("=" * 80)

        # Get deep link session data
        deep_link_data = request.session.get('lti_deep_link')

        if not deep_link_data:
            print("ERROR: No deep link session data found")
            return JsonResponse({'error': 'Invalid session'}, status=400)

        print(f"Deep link data: {deep_link_data}")

        # Get selected media IDs
        selected_ids = request.POST.getlist('media_ids[]')
        print(f"Selected media IDs: {selected_ids}")

        if not selected_ids:
            print("ERROR: No media selected")
            return JsonResponse({'error': 'No media selected'}, status=400)

        # Build content items
        content_items = []

        for media_id in selected_ids:
            try:
                media = Media.objects.get(id=media_id)

                # Build embed URL
                embed_url = request.build_absolute_uri(reverse('lti:embed_media', args=[media.friendly_token]))

                content_item = {
                    'type': 'ltiResourceLink',
                    'title': media.title,
                    'url': embed_url,
                    'custom': {
                        'media_friendly_token': media.friendly_token,
                    },
                }

                # Add thumbnail if available
                if media.thumbnail_url:
                    content_item['thumbnail'] = {'url': media.thumbnail_url, 'width': 344, 'height': 194}

                # Add iframe configuration
                content_item['iframe'] = {'width': 960, 'height': 540}

                content_items.append(content_item)

            except Media.DoesNotExist:
                continue

        if not content_items:
            print("ERROR: No valid media found after processing")
            return JsonResponse({'error': 'No valid media found'}, status=400)

        print(f"Built {len(content_items)} content items")

        # Create deep linking JWT response
        # Note: This is a simplified version
        # Full implementation would use PyLTI1p3's DeepLink response builder
        print("Creating deep linking JWT...")
        jwt_response = self.create_deep_link_jwt(deep_link_data, content_items, request)
        print(f"JWT created successfully (length: {len(jwt_response)})")
        print(f"JWT (first 100 chars): {jwt_response[:100]}...")

        # Return auto-submit form that posts JWT back to Moodle
        context = {
            'return_url': deep_link_data['deep_link_return_url'],
            'jwt': jwt_response,
        }

        print(f"Returning to Moodle at: {deep_link_data['deep_link_return_url']}")
        return render(request, 'lti/deep_link_return.html', context)

    def create_deep_link_jwt(self, deep_link_data, content_items, request):
        """
        Create JWT response for deep linking - manual implementation
        """
        try:
            print("=" * 80)
            print("CREATING DEEP LINKING JWT")
            print("=" * 80)

            platform_id = deep_link_data['platform_id']
            platform = LTIPlatform.objects.get(id=platform_id)
            deployment_id = deep_link_data['deployment_id']
            message_launch_data = deep_link_data['message_launch_data']

            print(f"Platform: {platform.name}")
            print(f"Platform ID: {platform.platform_id}")
            print(f"Client ID: {platform.client_id}")
            print(f"Deployment ID: {deployment_id}")

            # Get deep linking settings from original launch data
            deep_linking_settings = message_launch_data.get('https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings', {})
            print(f"Deep linking settings: {deep_linking_settings}")

            # Get tool's private key for signing
            key_obj = LTIToolKeys.get_or_create_keys()
            jwk_obj = jwk.JWK(**key_obj.private_key_jwk)
            pem_bytes = jwk_obj.export_to_pem(private_key=True, password=None)
            private_key = serialization.load_pem_private_key(pem_bytes, password=None, backend=default_backend())

            # Build JWT payload according to LTI Deep Linking spec
            now = int(time.time())

            # Convert content_items to LTI content item format
            lti_content_items = []
            for item in content_items:
                lti_item = {
                    'type': item['type'],
                    'title': item['title'],
                    'url': item['url'],
                }

                if item.get('custom'):
                    lti_item['custom'] = item['custom']

                if item.get('thumbnail'):
                    lti_item['thumbnail'] = item['thumbnail']

                if item.get('iframe'):
                    lti_item['iframe'] = item['iframe']

                lti_content_items.append(lti_item)

            # Create JWT payload
            tool_issuer = request.build_absolute_uri('/')[:-1]

            # Per LTI spec, aud should be the platform's issuer URL (or an array with issuer and optionally client_id)
            audience = [platform.platform_id]

            payload = {
                'iss': tool_issuer,  # Tool's issuer (MediaCMS URL)
                'aud': audience,
                'exp': now + 3600,
                'iat': now,
                'nonce': str(uuid.uuid4()),
                'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiDeepLinkingResponse',
                'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
                'https://purl.imsglobal.org/spec/lti/claim/deployment_id': deployment_id,
                'https://purl.imsglobal.org/spec/lti-dl/claim/content_items': lti_content_items,
                'https://purl.imsglobal.org/spec/lti-dl/claim/data': deep_linking_settings.get('data', ''),
            }

            print("JWT Payload:")
            print(f"  iss (issuer): {tool_issuer}")
            print(f"  aud (audience): {audience}")
            print(f"  deployment_id: {deployment_id}")
            print(f"  content_items count: {len(lti_content_items)}")

            # Sign JWT with tool's private key
            kid = key_obj.private_key_jwk['kid']
            print(f"Signing JWT with kid: {kid}")
            response_jwt = jwt.encode(payload, private_key, algorithm='RS256', headers={'kid': kid})
            print("JWT signed successfully")

            return response_jwt

        except Exception as e:
            # Log error for debugging
            traceback.print_exc()
            raise ValueError(f"Failed to create Deep Linking JWT: {str(e)}")
