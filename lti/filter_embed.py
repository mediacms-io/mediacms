# TODO JUST AN F EXAMPLEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE
"""
Filter Embed Token API for MediaCMS

Provides signed embed tokens for Moodle filter-based embeds
without requiring full LTI launch flow
"""

import hashlib
import hmac
import json
import time

from django.http import JsonResponse
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt

from files.models import Media

from .models import LTIPlatform


@method_decorator(csrf_exempt, name='dispatch')
class FilterEmbedTokenView(View):
    """
    Generate a signed embed token for Moodle filter embeds

    This bypasses the full LTI launch flow which doesn't work for filters
    """

    def post(self, request):
        """Handle token request from Moodle filter"""
        try:
            data = json.loads(request.body)

            media_token = data.get('media_token')
            user_id = data.get('user_id')  # noqa: F841
            # user_email and user_name reserved for future RBAC implementation
            client_id = data.get('client_id')
            timestamp = data.get('timestamp')
            signature = data.get('signature')

            if not all([media_token, user_id, client_id, signature, timestamp]):
                return JsonResponse({'error': 'Missing required parameters'}, status=400)

            # Check timestamp is recent (within 5 minutes)
            if abs(time.time() - timestamp) > 300:
                return JsonResponse({'error': 'Request expired'}, status=400)

            # Verify platform exists
            try:
                LTIPlatform.objects.get(client_id=client_id)
            except LTIPlatform.DoesNotExist:
                return JsonResponse({'error': 'Invalid client'}, status=403)

            # Get shared secret from platform or settings
            # Option 1: Store it in LTIPlatform model (add a field)
            # Option 2: Use Django settings
            from django.conf import settings

            shared_secret = getattr(settings, 'FILTER_EMBED_SHARED_SECRET', None)

            if not shared_secret:
                return JsonResponse({'error': 'Server not configured for filter embeds'}, status=500)

            # Verify signature
            payload_copy = data.copy()
            del payload_copy['signature']
            expected_sig = hmac.new(shared_secret.encode(), json.dumps(payload_copy).encode(), hashlib.sha256).hexdigest()

            if not hmac.compare_digest(signature, expected_sig):
                return JsonResponse({'error': 'Invalid signature'}, status=403)

            # Get media
            try:
                media = Media.objects.get(friendly_token=media_token)
            except Media.DoesNotExist:
                return JsonResponse({'error': 'Media not found'}, status=404)

            # Check if media is public/unlisted (allow) or private (would need RBAC check)
            # For now, allow public and unlisted
            if media.state not in ['public', 'unlisted']:
                # TODO: Implement RBAC check here based on cmid/course context
                return JsonResponse({'error': 'Access denied'}, status=403)

            # Generate embed URL (simple embed, no auth needed for public/unlisted)
            embed_url = request.build_absolute_uri(reverse('get_embed') + f'?m={media_token}')

            return JsonResponse(
                {
                    'embed_url': embed_url,
                    'media_token': media_token,
                    'title': media.title,
                }
            )

        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
