import shutil
from io import StringIO
from os.path import join

from django.conf import settings

from . import utils


class BaseFineUploader(object):
    def __init__(self, data, *args, **kwargs):
        self.data = data
        self.total_filesize = data.get("qqtotalfilesize")
        self.filename = data.get("qqfilename")
        self.uuid = data.get("qquuid")
        self.file = data.get("qqfile")
        self.storage_class = settings.FILE_CHUNKS_STORAGE
        self.actual_storage_class = settings.FILE_STORAGE
        if settings.MEDIA_LOCATION != None:
            self.S3_ROOT_PATH = settings.MEDIA_LOCATION
        else: 
            self.S3_ROOT_PATH = None
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
    def actual_storage(self):
        file_storage = utils.import_class(self.actual_storage_class)
        return file_storage()

    @property
    def url(self):
        if not self.finished:
            return None
        return self.actual_storage.url(self.prep_path_for_s3(self.real_path))

    def prep_path_for_s3(self, path):
        print("Prepping path: {0}".format(path))
        r = path.replace("/home/mediacms.io/media_files/", self.S3_ROOT_PATH)
        print("New Path: {0}".format(r))
        return r



class ChunkedFineUploader(BaseFineUploader):
    concurrent = True

    def __init__(self, data, concurrent=True, *args, **kwargs):
        super(ChunkedFineUploader, self).__init__(data, *args, **kwargs)
        self.concurrent = concurrent
        self.total_parts = data.get("qqtotalparts")
        if not isinstance(self.total_parts, int):
            self.total_parts = 1
        self.part_index = data.get("qqpartindex")

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
        print("Combining chunks. Full File Path: {0}".format(self._full_file_path))
        self.real_path = self.storage.save(self._full_file_path, StringIO())
        print("Real Path: {0}".format(self.real_path))
        with self.actual_storage.open(self.prep_path_for_s3(self.real_path), "wb") as final_file:
            print("Combining files... Total Parts: {0}".format(self.total_parts))
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
            print("Saving full file to actual_storage: {0}".format(self.prep_path_for_s3(self._full_file_path)))
            self.real_path = self.actual_storage.save(self.prep_path_for_s3(self._full_file_path), self.file)
            return self.real_path
