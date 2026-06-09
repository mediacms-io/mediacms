from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import TinyMCEMedia


@csrf_exempt
def upload_image(request):
    if not (request.user.is_authenticated and request.user.is_active and request.user.is_staff and request.user.is_superuser):
        return JsonResponse({'error': 'Admin access required'}, status=403)

    if request.method == "POST":
        file_obj = request.FILES.get('file')
        if file_obj:
            # Create a new TinyMCEMedia instance for the image
            media = TinyMCEMedia(file=file_obj, file_type='image', original_filename=file_obj.name, user=request.user if request.user.is_authenticated else None)
            media.save()

            return JsonResponse({'location': media.url})
    return JsonResponse({'error': 'Invalid request'}, status=400)
