"""
LTI Deep Linking 2.0 for MediaCMS

Allows instructors to select media from MediaCMS library and embed in Moodle courses
"""

import logging

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import render
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt

from files.models import Media

from .models import LTIPlatform

logger = logging.getLogger(__name__)


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
            return JsonResponse({'error': 'Invalid session', 'message': 'No deep linking session data found'}, status=400)

        # Get accessible media for user
        user = request.user

        if getattr(settings, 'USE_RBAC', False):
            # Get categories user has access to
            categories = user.get_rbac_categories_as_member()
            media_queryset = Media.objects.filter(listable=True, category__in=categories)
        else:
            # Get all public media
            media_queryset = Media.objects.filter(listable=True, state='public')

        # Optionally filter by user's own media
        show_my_media_only = request.GET.get('my_media_only', 'false').lower() == 'true'
        if show_my_media_only:
            media_queryset = media_queryset.filter(user=user)

        # Order by recent
        media_list = media_queryset.order_by('-add_date')[:100]  # Limit to 100 for performance

        context = {
            'media_list': media_list,
            'deep_link_data': deep_link_data,
            'show_my_media_only': show_my_media_only,
        }

        return render(request, 'lti/select_media.html', context)

    @method_decorator(csrf_exempt)
    def post(self, request):
        """Return selected media as deep linking content items"""

        # Get deep link session data
        deep_link_data = request.session.get('lti_deep_link')

        if not deep_link_data:
            return JsonResponse({'error': 'Invalid session'}, status=400)

        # Get selected media IDs
        selected_ids = request.POST.getlist('media_ids[]')

        if not selected_ids:
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
                logger.warning(f"Media {media_id} not found during deep linking")
                continue

        if not content_items:
            return JsonResponse({'error': 'No valid media found'}, status=400)

        # Create deep linking JWT response
        # Note: This is a simplified version
        # Full implementation would use PyLTI1p3's DeepLink response builder
        jwt_response = self.create_deep_link_jwt(deep_link_data, content_items, request)

        # Return auto-submit form that posts JWT back to Moodle
        context = {
            'return_url': deep_link_data['deep_link_return_url'],
            'jwt': jwt_response,
        }

        return render(request, 'lti/deep_link_return.html', context)

    def create_deep_link_jwt(self, deep_link_data, content_items, request):
        """
        Create JWT response for deep linking

        This is a placeholder - full implementation would use PyLTI1p3
        """
        # TODO: Implement proper JWT creation using PyLTI1p3's DeepLink.output_response_form()
        # For now, return a placeholder

        try:
            from .adapters import DjangoToolConfig

            platform_id = deep_link_data['platform_id']
            platform = LTIPlatform.objects.get(id=platform_id)

            DjangoToolConfig.from_platform(platform)

            # This requires the full message launch object to create properly
            # For now, we'll create a simple response

            # In a real implementation, you would:
            # 1. Get the MessageLaunch object from session
            # 2. Call launch.get_deep_link()
            # 3. Call deep_link.output_response_form(content_items)

            logger.warning("Deep linking JWT creation not fully implemented")

            return "JWT_TOKEN_PLACEHOLDER"

        except Exception as e:
            logger.error(f"Error creating deep link JWT: {str(e)}", exc_info=True)
            return "ERROR_CREATING_JWT"
