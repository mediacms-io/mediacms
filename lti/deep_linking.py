"""
LTI Deep Linking 2.0 for MediaCMS

Allows instructors to select media from MediaCMS library and embed in Moodle courses
"""

import traceback

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import render
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from pylti1p3.deep_link import DeepLink
from pylti1p3.deep_link_resource import DeepLinkResource

from files.models import Media
from files.views.media import MediaList

from .adapters import DjangoToolConfig
from .models import LTIPlatform


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
        Create JWT response for deep linking using PyLTI1p3
        """
        try:
            platform_id = deep_link_data['platform_id']
            platform = LTIPlatform.objects.get(id=platform_id)
            deployment_id = deep_link_data['deployment_id']
            message_launch_data = deep_link_data['message_launch_data']

            # Recreate tool config
            tool_config = DjangoToolConfig.from_platform(platform)

            # Get registration (tool config for this platform)
            registration = tool_config.find_registration_by_issuer(platform.platform_id, client_id=platform.client_id)

            # Get deep linking settings from original launch data
            deep_linking_settings = message_launch_data.get('https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings', {})

            # Create DeepLink instance directly
            deep_link = DeepLink(registration, deployment_id, deep_linking_settings)

            # Convert content_items to DeepLinkResource objects
            resources = []
            for item in content_items:
                resource = DeepLinkResource()
                resource.set_url(item['url']).set_title(item['title']).set_custom_params(item.get('custom', {}))

                # Add thumbnail if available
                if item.get('thumbnail'):
                    thumb = item['thumbnail']
                    resource.set_icon_url(thumb['url'])

                # Set iframe presentation properties directly on the resource dict
                # PyLTI1p3's DeepLinkResource doesn't expose all setters, so we access internal dict
                if item.get('iframe'):
                    iframe = item['iframe']
                    # Access the internal _resource dict to set presentation properties
                    if not hasattr(resource, '_resource'):
                        resource._resource = {}
                    if 'iframe' not in resource._resource:
                        resource._resource['iframe'] = {}
                    resource._resource['iframe']['width'] = iframe.get('width', 960)
                    resource._resource['iframe']['height'] = iframe.get('height', 540)
                    # Set window target name
                    if 'window' not in resource._resource:
                        resource._resource['window'] = {}
                    resource._resource['window']['targetName'] = 'iframe'

                resources.append(resource)

            # Get the JWT token (not the full HTML form)
            response_jwt = deep_link.get_response_jwt(resources)

            return response_jwt

        except Exception as e:
            # Log error for debugging
            traceback.print_exc()
            raise ValueError(f"Failed to create Deep Linking JWT: {str(e)}")
