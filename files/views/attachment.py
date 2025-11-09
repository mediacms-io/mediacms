from rest_framework import viewsets, permissions
from rest_framework.parsers import MultiPartParser, FormParser
from ..models import Attachment, Media
from ..serializers import AttachmentSerializer
from django import forms
from django.core.paginator import Paginator
from django.views.decorators.http import require_http_methods
from django.shortcuts import render, get_object_or_404, redirect

class AttachmentForm(forms.ModelForm):
    class Meta:
        model = Attachment
        fields = ['name', 'file']

class AttachmentViewSet(viewsets.ModelViewSet):
    queryset = Attachment.objects.all()
    serializer_class = AttachmentSerializer
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        media_id = self.request.query_params.get('media')
        if media_id:
            # Probeer eerst als integer (numeriek ID)
            try:
                return self.queryset.filter(media_id=int(media_id))
            except ValueError:
                # Probeer als friendly_token
                media_obj = Media.objects.filter(friendly_token=media_id).first()
                if media_obj:
                    return self.queryset.filter(media_id=media_obj.id)
                return self.queryset.none()
        return self.queryset

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        instance.delete()

@require_http_methods(["GET", "POST"])
def edit_attachments(request):
    media_token = request.GET.get('m')
    media_object = get_object_or_404(Media, friendly_token=media_token)
    attachments_qs = Attachment.objects.filter(media=media_object).order_by('-uploaded_at')
    paginator = Paginator(attachments_qs, 10)
    page_number = request.GET.get('page')
    attachments = paginator.get_page(page_number)


    # Handle upload, rename, and delete
    action = request.POST.get('action')
    form = AttachmentForm()
    if request.method == 'POST':
        if action == 'upload':
            form = AttachmentForm(request.POST, request.FILES)
            if form.is_valid():
                attachment = form.save(commit=False)
                attachment.media = media_object
                attachment.save()
                return redirect(request.path + f'?m={media_token}')
        elif action == 'rename':
            attachment_id = request.POST.get('attachment_id')
            new_name = request.POST.get('new_name')
            if attachment_id and new_name:
                att = Attachment.objects.filter(id=attachment_id, media=media_object).first()
                if att:
                    att.name = new_name
                    att.save()
                return redirect(request.path + f'?m={media_token}')
        elif action == 'delete':
            attachment_id = request.POST.get('attachment_id')
            if attachment_id:
                att = Attachment.objects.filter(id=attachment_id, media=media_object).first()
                if att:
                    att.delete()
                return redirect(request.path + f'?m={media_token}')

    return render(request, 'cms/edit_attachments.html', {
        'media_object': media_object,
        'form': form,
        'attachments': attachments,
    })
