import json
import tempfile

from django.conf import settings
from django.core.files import File
from django.db import models
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.urls import reverse

from .. import helpers
from .utils import (
    CODECS,
    ENCODE_EXTENSIONS,
    ENCODE_RESOLUTIONS,
    MEDIA_ENCODING_STATUS,
    encoding_media_file_path,
)


class EncodeProfile(models.Model):
    """Encode Profile model
    keeps information for each profile
    """

    name = models.CharField(max_length=90)

    extension = models.CharField(max_length=10, choices=ENCODE_EXTENSIONS)

    resolution = models.IntegerField(choices=ENCODE_RESOLUTIONS, blank=True, null=True)

    codec = models.CharField(max_length=10, choices=CODECS, blank=True, null=True)

    description = models.TextField(blank=True, help_text="description")

    active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["resolution"]


class Encoding(models.Model):
    """Encoding Media Instances"""

    add_date = models.DateTimeField(auto_now_add=True)

    commands = models.TextField(blank=True, help_text="commands run")

    chunk = models.BooleanField(default=False, db_index=True, help_text="is chunk?")

    chunk_file_path = models.CharField(max_length=400, blank=True)

    chunks_info = models.TextField(blank=True)

    logs = models.TextField(blank=True)

    md5sum = models.CharField(max_length=50, blank=True, null=True)

    media = models.ForeignKey("Media", on_delete=models.CASCADE, related_name="encodings")

    media_file = models.FileField("encoding file", upload_to=encoding_media_file_path, blank=True, max_length=500)

    profile = models.ForeignKey(EncodeProfile, on_delete=models.CASCADE)

    progress = models.PositiveSmallIntegerField(default=0)

    update_date = models.DateTimeField(auto_now=True)

    retries = models.IntegerField(default=0)

    size = models.CharField(max_length=20, blank=True)

    status = models.CharField(max_length=20, choices=MEDIA_ENCODING_STATUS, default="pending")

    temp_file = models.CharField(max_length=400, blank=True)

    task_id = models.CharField(max_length=100, blank=True)

    total_run_time = models.IntegerField(default=0)

    worker = models.CharField(max_length=100, blank=True)

    @property
    def media_encoding_url(self):
        if self.media_file:
            return helpers.url_from_path(self.media_file.path)
        return None

    @property
    def media_chunk_url(self):
        if self.chunk_file_path:
            return helpers.url_from_path(self.chunk_file_path)
        return None

    def save(self, *args, **kwargs):
        if self.media_file:
            cmd = ["stat", "-c", "%s", self.media_file.path]
            stdout = helpers.run_command(cmd).get("out")
            if stdout:
                size = int(stdout.strip())
                self.size = helpers.show_file_size(size)
        if self.chunk_file_path and not self.md5sum:
            cmd = ["md5sum", self.chunk_file_path]
            stdout = helpers.run_command(cmd).get("out")
            if stdout:
                md5sum = stdout.strip().split()[0]
                self.md5sum = md5sum

        super(Encoding, self).save(*args, **kwargs)

    def update_size_without_save(self):
        """Update the size of an encoding without saving to avoid calling signals"""
        if self.media_file:
            cmd = ["stat", "-c", "%s", self.media_file.path]
            stdout = helpers.run_command(cmd).get("out")
            if stdout:
                size = int(stdout.strip())
                size = helpers.show_file_size(size)
                Encoding.objects.filter(pk=self.pk).update(size=size)
                return True
        return False

    def set_progress(self, progress, commit=True):
        if isinstance(progress, int):
            if 0 <= progress <= 100:
                self.progress = progress
                # save object with filter update
                # to avoid calling signals
                Encoding.objects.filter(pk=self.pk).update(progress=progress)
                return True
        return False

    def __str__(self):
        return f"{self.profile.name}-{self.media.title}"

    def get_absolute_url(self):
        return reverse("api_get_encoding", kwargs={"encoding_id": self.id})


@receiver(post_save, sender=Encoding)
def encoding_file_save(sender, instance, created, **kwargs):
    """Performs actions on encoding file delete
    For example, if encoding is a chunk file, with encoding_status success,
    perform a check if this is the final chunk file of a media, then
    concatenate chunks, create final encoding file and delete chunks
    """

    if instance.chunk and instance.status == "success":
        # a chunk got completed

        # check if all chunks are OK
        # then concatenate to new Encoding - and remove chunks
        # this should run only once!
        if instance.media_file:
            try:
                orig_chunks = json.loads(instance.chunks_info).keys()
            except BaseException:
                instance.delete()
                return False

            chunks = Encoding.objects.filter(
                media=instance.media,
                profile=instance.profile,
                chunks_info=instance.chunks_info,
                chunk=True,
            ).order_by("add_date")

            complete = True

            # perform validation, make sure everything is there
            for chunk in orig_chunks:
                if not chunks.filter(chunk_file_path=chunk):
                    complete = False
                    break

            for chunk in chunks:
                if not (chunk.media_file and chunk.media_file.path):
                    complete = False
                    break

            if complete:
                # concatenate chunks and create final encoding file
                chunks_paths = [f.media_file.path for f in chunks]

                with tempfile.TemporaryDirectory(dir=settings.TEMP_DIRECTORY) as temp_dir:
                    seg_file = helpers.create_temp_file(suffix=".txt", dir=temp_dir)
                    tf = helpers.create_temp_file(suffix=f".{instance.profile.extension}", dir=temp_dir)
                    with open(seg_file, "w") as ff:
                        for f in chunks_paths:
                            ff.write(f"file {f}\n")
                    cmd = [
                        settings.FFMPEG_COMMAND,
                        "-y",
                        "-f",
                        "concat",
                        "-safe",
                        "0",
                        "-i",
                        seg_file,
                        "-c",
                        "copy",
                        "-pix_fmt",
                        "yuv420p",
                        "-movflags",
                        "faststart",
                        tf,
                    ]
                    stdout = helpers.run_command(cmd)

                    encoding = Encoding(
                        media=instance.media,
                        profile=instance.profile,
                        status="success",
                        progress=100,
                    )
                    all_logs = "\n".join([st.logs for st in chunks])
                    encoding.logs = f"{chunks_paths}\n{stdout}\n{all_logs}"
                    workers = list(set([st.worker for st in chunks]))
                    encoding.worker = json.dumps({"workers": workers})

                    start_date = min([st.add_date for st in chunks])
                    end_date = max([st.update_date for st in chunks])
                    encoding.total_run_time = (end_date - start_date).seconds
                    encoding.save()

                    with open(tf, "rb") as f:
                        myfile = File(f)
                        output_name = f"{helpers.get_file_name(instance.media.media_file.path)}.{instance.profile.extension}"
                        encoding.media_file.save(content=myfile, name=output_name)

                    # encoding is saved, deleting chunks
                    # and any other encoding that might exist
                    # first perform one last validation
                    # to avoid that this is run twice
                    if (
                        len(orig_chunks)
                        == Encoding.objects.filter(  # noqa
                            media=instance.media,
                            profile=instance.profile,
                            chunks_info=instance.chunks_info,
                        ).count()
                    ):
                        # if two chunks are finished at the same time, this
                        # will be changed
                        who = Encoding.objects.filter(media=encoding.media, profile=encoding.profile).exclude(id=encoding.id)
                        who.delete()
                    else:
                        encoding.delete()
                    if not Encoding.objects.filter(chunks_info=instance.chunks_info):
                        # TODO: in case of remote workers, files should be deleted
                        # example
                        # for worker in workers:
                        #    for chunk in json.loads(instance.chunks_info).keys():
                        #        remove_media_file.delay(media_file=chunk)
                        for chunk in json.loads(instance.chunks_info).keys():
                            helpers.rm_file(chunk)
                    instance.media.post_encode_actions(encoding=instance, action="add")

    elif instance.chunk and instance.status == "fail":
        encoding = Encoding(media=instance.media, profile=instance.profile, status="fail", progress=100)

        chunks = Encoding.objects.filter(media=instance.media, chunks_info=instance.chunks_info, chunk=True).order_by("add_date")

        chunks_paths = [f.media_file.path for f in chunks]

        all_logs = "\n".join([st.logs for st in chunks])
        encoding.logs = f"{chunks_paths}\n{all_logs}"
        workers = list(set([st.worker for st in chunks]))
        encoding.worker = json.dumps({"workers": workers})
        start_date = min([st.add_date for st in chunks])
        end_date = max([st.update_date for st in chunks])
        encoding.total_run_time = (end_date - start_date).seconds
        encoding.save()

        who = Encoding.objects.filter(media=encoding.media, profile=encoding.profile).exclude(id=encoding.id)

        who.delete()
        # TODO: merge with above if, do not repeat code
    else:
        if instance.status in ["fail", "success"]:
            instance.media.post_encode_actions(encoding=instance, action="add")

        encodings = set([encoding.status for encoding in Encoding.objects.filter(media=instance.media)])
        if ("running" in encodings) or ("pending" in encodings):
            return


@receiver(post_delete, sender=Encoding)
def encoding_file_delete(sender, instance, **kwargs):
    """
    Deletes file from filesystem
    when corresponding `Encoding` object is deleted.
    """

    if instance.media_file:
        helpers.rm_file(instance.media_file.path)
        if not instance.chunk:
            instance.media.post_encode_actions(encoding=instance, action="delete")
    # delete local chunks, and remote chunks + media file. Only when the
    # last encoding of a media is complete
