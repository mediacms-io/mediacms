import shutil
from io import StringIO,BytesIO
from os.path import join
import os,errno
from django.conf import settings

from . import utils


class BaseFineUploader(object):
    def __init__(self, data, *args, **kwargs):
        self.data = data
        self.total_filesize = data.get("qqtotalfilesize")
        self.filename = data.get("qqfilename")
        self.uuid = data.get("qquuid")
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
        self.part_index = data.get("qqpartindex")

    @property
    def chunks_path(self):
        return join(settings.CHUNKS_DIR, self.uuid)

    @property
    def _abs_chunks_path(self):
        return join(settings.TEMP_DIRECTORY, self.chunks_path)

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
        self.real_path = self.storage.save(self._full_file_path, BytesIO())
        with self.storage.open(self.real_path, "wb") as final_file:
            for i in range(self.total_parts):
                part = join(self._abs_chunks_path, str(i))
                print("Reading chunk " + str(part) + " and adding to obj " + str(self.real_path))
                with open(part, "rb") as source:
                    final_file.write(source.read())
        print("Cleaning up: " + str(self._abs_chunks_path))
        shutil.rmtree(self._abs_chunks_path)

    def _save_chunk(self):
        chunk_path = join(settings.TEMP_DIRECTORY, self.chunk_file)
        print("Temp Upload Dir: " + settings.TEMP_DIRECTORY)
        if not os.path.exists(chunk_path):
            try:
                os.makedirs(os.path.dirname(chunk_path))
            except OSError as exc:
                if exc.errno != errno.EEXIST:
                    raise
        print("Making directories...")
        print("Processing Chunk: " + str(chunk_path))
        #f = open(chunk_path, "wb")
        print("Temp File: " + str(self.file.temporary_file_path()))
        print("Renaming temp file to chunk file...")
        shutil.move(self.file.temporary_file_path(), chunk_path)
        #c = open(self.file.temporary_file_path(), "rb")
        #f.write(c.read())
        #c.close()
        #f.close()
        return chunk_path #self.storage.save(self.chunk_file, self.file)

    def save(self):
        if self.chunked:
            chunk = self._save_chunk()
            if not self.concurrent and self.is_time_to_combine_chunks:
                self.combine_chunks()
                return self.real_path
            return chunk
        else:
            print("Opening file: " + str(self._full_file_path))
            self.storage.open(self._full_file_path, mode="wb", encoding="utf-8")
            print("Saving file...")
            self.real_path = self.storage.save(self._full_file_path, self.file, encoding="utf-8")
            print("Done.")
            return self.real_path