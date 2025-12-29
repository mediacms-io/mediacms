# -*- coding: utf-8 -*-
import os
import shutil

from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.core.files import File
from django.http import JsonResponse
from django.views import generic

from files.helpers import rm_file
from files.methods import user_allowed_to_upload
from files.models import Media

from .fineuploader import ChunkedFineUploader
from .forms import FineUploaderUploadForm, FineUploaderUploadSuccessForm


class FineUploaderView(generic.FormView):
    http_method_names = ("post",)
    form_class_upload = FineUploaderUploadForm
    form_class_upload_success = FineUploaderUploadSuccessForm

    @property
    def concurrent(self):
        return settings.CONCURRENT_UPLOADS

    @property
    def chunks_done(self):
        return self.chunks_done_param_name in self.request.GET

    @property
    def chunks_done_param_name(self):
        return settings.CHUNKS_DONE_PARAM_NAME

    def make_response(self, data, **kwargs):
        return JsonResponse(data, **kwargs)

    def get_form(self, form_class=None):
        if self.chunks_done:
            form_class = self.form_class_upload_success
        else:
            form_class = self.form_class_upload
        return form_class(**self.get_form_kwargs())

    def dispatch(self, request, *args, **kwargs):
        if not user_allowed_to_upload(request):
            raise PermissionDenied  # HTTP 403
        return super(FineUploaderView, self).dispatch(request, *args, **kwargs)

    def form_valid(self, form):
        self.upload = ChunkedFineUploader(form.cleaned_data, self.concurrent)
        if self.upload.concurrent and self.chunks_done:
            try:
                self.upload.combine_chunks()
            except FileNotFoundError:
                data = {"success": False, "error": "Error with File Uploading"}
                return self.make_response(data, status=400)
        elif self.upload.total_parts == 1:
            self.upload.save()
        else:
            self.upload.save()
            return self.make_response({"success": True})
        # create media!
        media_file = os.path.join(settings.MEDIA_ROOT, self.upload.real_path)
        with open(media_file, "rb") as f:
            myfile = File(f)
            new = Media.objects.create(media_file=myfile, user=self.request.user, title=self.upload.original_filename)

        # Handle LTI category assignment if publish_to_category parameter is provided
        publish_to_category = self.request.GET.get('publish_to_category', '').strip()
        print("=" * 80)
        print("FINE UPLOADER - CATEGORY ASSIGNMENT")
        print(f"publish_to_category parameter: '{publish_to_category}'")
        print(f"User: {self.request.user.username}")
        print(f"Media created: {new.title} (friendly_token={new.friendly_token})")

        if publish_to_category:
            from files.models import Category

            try:
                category = Category.objects.get(uid=publish_to_category)
                print(f"Category found: {category.title} (uid={category.uid})")

                # Check if user has upload access to this category
                has_access = self.request.user.has_member_access_to_category(category)
                print(f"User has member access to category: {has_access}")

                if has_access:
                    print(f"Attempting to add category '{category.title}' (id={category.id}) to media...")
                    new.category.add(category)
                    print("media.category.add() completed")
                    # Verify it was added
                    new.refresh_from_db()
                    current_categories = list(new.category.all())
                    print(f"Media categories after add: {[c.title for c in current_categories]}")
                    if category in current_categories:
                        print(f"SUCCESS: Added media '{new.title}' to category '{category.title}'")
                    else:
                        print("WARNING: Category add was called but category not in media.category.all()")
                else:
                    print(f"SKIPPED: User does not have member access to category '{category.title}'")
            except Category.DoesNotExist:
                # Category doesn't exist, silently ignore
                print(f"ERROR: Category with uid='{publish_to_category}' does not exist")
        else:
            print("No publish_to_category parameter provided")
        print("=" * 80)

        rm_file(media_file)
        shutil.rmtree(os.path.join(settings.MEDIA_ROOT, self.upload.file_path))
        return self.make_response({"success": True, "media_url": new.get_absolute_url()})

    def form_invalid(self, form):
        data = {"success": False, "error": "%s" % repr(form.errors)}
        return self.make_response(data, status=400)
