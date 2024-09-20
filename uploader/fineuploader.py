import re
import shutil
import os
import uuid
from io import StringIO
from os.path import join

from django.conf import settings

from . import utils


def is_valid_uuid_format(uuid_string):
    pattern = re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$', re.IGNORECASE)
    return bool(pattern.match(uuid_string))


class BaseFineUploader(object):
    def __init__(self, data, *args, **kwargs):
        self.data = data
        self.filename = data.get("qqfilename")
        self.uuid = data.get("qquuid")

        if not is_valid_uuid_format(self.uuid):
            # something nasty client side could be happening here
            # generate new uuid to ensure this is uuid
            # not sure if this will work with the chunked uploads though
            self.uuid = uuid.uuid4()

        self.filename = os.path.basename(self.filename)
        # avoid possibility of passing a fake path here

        self.file = data.get("qqfile")
        self.storage_class = settings.FILE_STORAGE
        self.real_path = None


    @property
    def finished(self):
        return self.real_path is not None

    @property
    def file_path(self):
        return join(settings.UPLOAD_DIR, self.uuid)

    @property
    def _full_file_path(self):
        return join(self.file_path, self.filename)

    @property
    def storage(self):
        file_storage = utils.import_class(self.storage_class)
        return file_storage()

    @property
    def url(self):
        if not self.finished:
            return None
        return self.storage.url(self.real_path)


class ChunkedFineUploader(BaseFineUploader):
    concurrent = True

    def __init__(self, data, concurrent=True, *args, **kwargs):
        super(ChunkedFineUploader, self).__init__(data, *args, **kwargs)
        self.concurrent = concurrent
        self.total_parts = data.get("qqtotalparts")
        if not isinstance(self.total_parts, int):
            self.total_parts = 1
        qqpartindex = data.get("qqpartindex")
        if not isinstance(qqpartindex, int):
            # something nasty client side could be happening here
            qqpartindex = 0
        self.part_index = qqpartindex

    @property
    def chunks_path(self):
        return join(settings.CHUNKS_DIR, self.uuid)

    @property
    def _abs_chunks_path(self):
        return join(settings.MEDIA_ROOT, self.chunks_path)

    @property
    def chunk_file(self):
        return join(self.chunks_path, str(self.part_index))

    @property
    def chunked(self):
        return self.total_parts > 1

    @property
    def is_time_to_combine_chunks(self):
        return self.total_parts - 1 == self.part_index

    def combine_chunks(self):
        # implement the same behaviour.
        self.real_path = self.storage.save(self._full_file_path, StringIO())

        with self.storage.open(self.real_path, "wb") as final_file:
            for i in range(self.total_parts):
                part = join(self.chunks_path, str(i))
                with self.storage.open(part, "rb") as source:
                    final_file.write(source.read())
        shutil.rmtree(self._abs_chunks_path)

    def _save_chunk(self):
        return self.storage.save(self.chunk_file, self.file)

    def save(self):
        if self.chunked:
            chunk = self._save_chunk()
            if not self.concurrent and self.is_time_to_combine_chunks:
                self.combine_chunks()
                return self.real_path
            return chunk
        else:
            self.real_path = self.storage.save(self._full_file_path, self.file)
            return self.real_path
