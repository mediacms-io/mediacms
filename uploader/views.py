# -*- coding: utf-8 -*-
import logging
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

logger = logging.getLogger(__name__)


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
            logger.warning(
                "Upload denied - user not allowed to upload - user_id=%s, username=%s, path=%s",
                getattr(request.user, 'id', None),
                getattr(request.user, 'username', None),
                request.path,
            )
            raise PermissionDenied  # HTTP 403
        return super(FineUploaderView, self).dispatch(request, *args, **kwargs)

    def form_valid(self, form):
        self.upload = ChunkedFineUploader(form.cleaned_data, self.concurrent)
        logger.info(
            "Upload started - user_id=%s, filename=%s, total_parts=%s, concurrent=%s, chunks_done=%s",
            getattr(self.request.user, 'id', None),
            self.upload.original_filename,
            self.upload.total_parts,
            self.upload.concurrent,
            self.chunks_done,
        )

        if self.upload.concurrent and self.chunks_done:
            try:
                logger.debug(
                    "Combining upload chunks - user_id=%s, filename=%s, total_parts=%s",
                    getattr(self.request.user, 'id', None),
                    self.upload.original_filename,
                    self.upload.total_parts,
                )
                self.upload.combine_chunks()
                logger.debug(
                    "Chunks combined successfully - user_id=%s, filename=%s",
                    getattr(self.request.user, 'id', None),
                    self.upload.original_filename,
                )
            except FileNotFoundError as e:
                logger.error(
                    "File not found during chunk combination - user_id=%s, filename=%s, file_path=%s, error=%s",
                    getattr(self.request.user, 'id', None),
                    self.upload.original_filename,
                    getattr(self.upload, 'file_path', None),
                    str(e),
                )
                data = {"success": False, "error": "Error with File Uploading"}
                return self.make_response(data, status=400)
            except Exception:
                logger.exception(
                    "Unexpected error combining upload chunks - user_id=%s, filename=%s, file_path=%s",
                    getattr(self.request.user, 'id', None),
                    self.upload.original_filename,
                    getattr(self.upload, 'file_path', None),
                )
                data = {"success": False, "error": "Error with File Uploading"}
                return self.make_response(data, status=400)
        elif self.upload.total_parts == 1:
            logger.debug(
                "Saving single-part upload - user_id=%s, filename=%s",
                getattr(self.request.user, 'id', None),
                self.upload.original_filename,
            )
            self.upload.save()
        else:
            logger.debug(
                "Saving multi-part upload chunk - user_id=%s, filename=%s, total_parts=%s",
                getattr(self.request.user, 'id', None),
                self.upload.original_filename,
                self.upload.total_parts,
            )
            self.upload.save()
            return self.make_response({"success": True})
        # create media!
        media_file = os.path.join(settings.MEDIA_ROOT, self.upload.real_path)
        try:
            # Get file size for logging
            file_size = None
            if os.path.exists(media_file):
                file_size = os.path.getsize(media_file)
                logger.debug(
                    "Creating media from uploaded file - user_id=%s, filename=%s, file_size=%s bytes",
                    getattr(self.request.user, 'id', None),
                    self.upload.original_filename,
                    file_size,
                )

            with open(media_file, "rb") as f:
                myfile = File(f)
                new = Media.objects.create(media_file=myfile, user=self.request.user, title=self.upload.original_filename)
            logger.info(
                "Media uploaded successfully - user_id=%s, friendly_token=%s, filename=%s, file_size=%s bytes",
                self.request.user.id,
                new.friendly_token,
                self.upload.original_filename,
                file_size,
            )
            rm_file(media_file)
            upload_dir = os.path.join(settings.MEDIA_ROOT, self.upload.file_path)
            if os.path.exists(upload_dir):
                shutil.rmtree(upload_dir)
                logger.debug(
                    "Cleaned up upload directory - user_id=%s, friendly_token=%s, upload_dir=%s",
                    self.request.user.id,
                    new.friendly_token,
                    self.upload.file_path,
                )
            return self.make_response({"success": True, "media_url": new.get_absolute_url()})
        except Exception:
            logger.exception(
                "Error creating media from upload - user_id=%s, filename=%s, file_size=%s bytes, file_path=%s",
                getattr(self.request.user, 'id', None),
                self.upload.original_filename,
                file_size,
                media_file,
            )
            raise

    def form_invalid(self, form):
        logger.warning(
            "Upload form validation failed - user_id=%s, errors=%s",
            getattr(self.request.user, 'id', None),
            form.errors,
        )
        data = {"success": False, "error": "%s" % repr(form.errors)}
        return self.make_response(data, status=400)
