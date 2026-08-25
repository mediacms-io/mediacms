"""Replace animated gif hover previews with the short mp4 ones.

Migration 0019 switches new media over but deliberately leaves what is already there alone,
so a portal upgraded from an older version keeps serving its gifs. This is the opt in for
finishing the job: it re-encodes the preview for media that still has a gif, and removes the
gif once the mp4 is in place.
"""

from django.core.management.base import BaseCommand

from files.models import EncodeProfile, Encoding, Media
from files.models.utils import PREVIEW_PROFILE_NAME
from files.tasks import encode_media


class Command(BaseCommand):
    help = "Re-encode gif hover previews as mp4 and delete the gif ones"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="List what would change and exit")
        parser.add_argument("--limit", type=int, default=0, help="Stop after this many media")
        parser.add_argument("--token", default="", help="One media's friendly_token, to try a single item first")
        parser.add_argument(
            "--async",
            action="store_true",
            dest="run_async",
            help="Queue the encodes on long_tasks instead of running them here. Returns at once, but the whole library lands on the queue together. The gifs are left behind: run again without this to clear them",
        )

    def handle(self, *args, **options):
        profile = EncodeProfile.objects.filter(name=PREVIEW_PROFILE_NAME, extension="mp4").first()
        if profile is None:
            self.stderr.write(self.style.ERROR("No mp4 preview profile. Run migrate first."))
            return

        gifs = Encoding.objects.filter(profile__name=PREVIEW_PROFILE_NAME, profile__extension="gif").select_related("media")
        if options["token"]:
            gifs = gifs.filter(media__friendly_token=options["token"])
        gifs = gifs.order_by("media_id")

        total = gifs.count()
        self.stdout.write(f"{total} media still have a gif preview")
        if not total:
            return

        if options["dry_run"]:
            for encoding in gifs[: options["limit"] or total]:
                self.stdout.write(f"  would re-encode {encoding.media.friendly_token} ({encoding.media.title[:48]})")
            return

        done, failed = 0, 0
        for encoding in gifs.iterator():
            if options["limit"] and done + failed >= options["limit"]:
                break
            media = encoding.media

            if options["run_async"]:
                self._queue(media, profile)
                self.stdout.write(f"  queued {media.friendly_token}")
                done += 1
                continue

            # the mp4 first: dropping the gif before its replacement exists would leave the
            # media with no preview at all if the encode then failed
            if not self._encode_now(media, profile):
                self.stderr.write(self.style.WARNING(f"  failed {media.friendly_token}, keeping its gif"))
                failed += 1
                continue

            self._drop_gif(encoding)
            done += 1
            self.stdout.write(f"  done {media.friendly_token}")

        if options["run_async"]:
            self.stdout.write(self.style.SUCCESS(f"queued {done}. Run again without --async to drop the gifs once these finish"))
            return
        self.stdout.write(self.style.SUCCESS(f"{done} upgraded, {failed} left as gif"))

    def _existing_mp4(self, media, profile):
        return Encoding.objects.filter(media=media, profile=profile, status="success").exclude(media_file="").first()

    def _new_row(self, media, profile):
        """A row for encode_media to fill in.

        encode_media exits at once on an id it cannot find, so the row has to exist before
        the task is handed its id, in both the queued and the immediate case.
        """
        Encoding.objects.filter(media=media, profile=profile).delete()
        return Encoding.objects.create(media=media, profile=profile, status="pending")

    def _queue(self, media, profile):
        if self._existing_mp4(media, profile):
            return
        row = self._new_row(media, profile)
        encode_media.delay(media.friendly_token, profile.id, row.id, force=True)

    def _encode_now(self, media, profile):
        """Produce the mp4 preview in this process and report whether it landed"""
        if self._existing_mp4(media, profile):
            return True

        row = self._new_row(media, profile)
        # apply() rather than delay(): one at a time, so a whole library does not arrive on
        # the long_tasks queue at once and take the machine down with it
        encode_media.apply(args=[media.friendly_token, profile.id, row.id], kwargs={"force": True})

        return bool(self._existing_mp4(media, profile))

    def _drop_gif(self, encoding):
        """Remove the gif encoding, then point the media at the mp4.

        Encoding's post_delete removes the file and, for a preview, clears the media's
        preview_file_path, so only the re-pointing is left to do here.
        """
        media = encoding.media
        encoding.delete()

        mp4 = (
            Encoding.objects.filter(
                media=media,
                profile__name=PREVIEW_PROFILE_NAME,
                profile__extension="mp4",
                status="success",
            )
            .exclude(media_file="")
            .first()
        )
        Media.objects.filter(pk=media.pk).update(preview_file_path=mp4.media_file.path if mp4 else "")
