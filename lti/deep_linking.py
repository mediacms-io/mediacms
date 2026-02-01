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
from django.http import HttpResponseRedirect, JsonResponse
from django.shortcuts import render
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from jwcrypto import jwk

from files.models import Media

from .models import LTIPlatform, LTIToolKeys


@method_decorator(login_required, name='dispatch')
class SelectMediaView(View):
    """
    UI for instructors to select media for deep linking

    Flow: Instructor clicks "Add MediaCMS" in Moodle → Deep link launch →
          This view → Instructor selects media → Return to Moodle
    """

    def get(self, request):
        """Display media selection interface - redirects to user's profile page"""
        profile_url = f"/user/{request.user.username}?mode=embed_mode&action=select_media"
        return HttpResponseRedirect(profile_url)

    @method_decorator(csrf_exempt)
    def post(self, request):
        """Return selected media as deep linking content items"""

        deep_link_data = request.session.get('lti_deep_link')

        if not deep_link_data:
            return JsonResponse({'error': 'Invalid session'}, status=400)

        selected_ids = request.POST.getlist('media_ids[]')

        if not selected_ids:
            return JsonResponse({'error': 'No media selected'}, status=400)

        content_items = []

        for media_id in selected_ids:
            try:
                media = Media.objects.get(id=media_id)

                # Build launch URL (must be an LTI launch endpoint that handles POST with id_token)
                # The /lti/launch/ endpoint will use the custom parameter to redirect to the correct media
                launch_url = request.build_absolute_uri(reverse('lti:launch'))

                content_item = {
                    'type': 'ltiResourceLink',
                    'title': media.title,
                    'url': launch_url,
                    'custom': {
                        'media_friendly_token': media.friendly_token,
                    },
                }

                if media.thumbnail_url:
                    thumbnail_url = media.thumbnail_url
                    if not thumbnail_url.startswith('http'):
                        thumbnail_url = request.build_absolute_uri(thumbnail_url)
                    content_item['thumbnail'] = {'url': thumbnail_url, 'width': 344, 'height': 194}

                content_item['iframe'] = {'width': 960, 'height': 540}

                content_items.append(content_item)

            except Media.DoesNotExist:
                continue

        if not content_items:
            return JsonResponse({'error': 'No valid media found'}, status=400)

        # Full implementation would use PyLTI1p3's DeepLink response builder
        jwt_response = self.create_deep_link_jwt(deep_link_data, content_items, request)

        context = {
            'return_url': deep_link_data['deep_link_return_url'],
            'jwt': jwt_response,
        }

        return render(request, 'lti/deep_link_return.html', context)

    def create_deep_link_jwt(self, deep_link_data, content_items, request):
        """
        Create JWT response for deep linking - manual implementation
        """
        try:
            platform_id = deep_link_data['platform_id']
            platform = LTIPlatform.objects.get(id=platform_id)
            deployment_id = deep_link_data['deployment_id']
            message_launch_data = deep_link_data['message_launch_data']

            deep_linking_settings = message_launch_data.get('https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings', {})

            key_obj = LTIToolKeys.get_or_create_keys()
            jwk_obj = jwk.JWK(**key_obj.private_key_jwk)
            pem_bytes = jwk_obj.export_to_pem(private_key=True, password=None)
            private_key = serialization.load_pem_private_key(pem_bytes, password=None, backend=default_backend())

            now = int(time.time())

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

            tool_issuer = platform.client_id

            audience = platform.platform_id

            sub = message_launch_data.get('sub')

            payload = {
                'iss': tool_issuer,
                'aud': audience,
                'exp': now + 3600,
                'iat': now,
                'nonce': str(uuid.uuid4()),
                'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiDeepLinkingResponse',
                'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
                'https://purl.imsglobal.org/spec/lti/claim/deployment_id': deployment_id,
                'https://purl.imsglobal.org/spec/lti-dl/claim/content_items': lti_content_items,
            }

            if sub:
                payload['sub'] = sub

            if 'data' in deep_linking_settings:
                payload['https://purl.imsglobal.org/spec/lti-dl/claim/data'] = deep_linking_settings['data']

            kid = key_obj.private_key_jwk['kid']
            response_jwt = jwt.encode(payload, private_key, algorithm='RS256', headers={'kid': kid})

            return response_jwt

        except Exception as e:
            traceback.print_exc()
            raise ValueError(f"Failed to create Deep Linking JWT: {str(e)}")
