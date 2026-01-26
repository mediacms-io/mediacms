#!/usr/bin/env python3
# uploader/management/commands/import_media_from_metadata.py

import re
import time
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple, Set

from django.core.management.base import BaseCommand, CommandError
from django.core.files import File as DjFile
from django.contrib.auth import get_user_model
from django.apps import apps
from django.db import transaction, IntegrityError
from django.utils.crypto import get_random_string

from django.db.models import BooleanField
from django.db.models.fields.files import FileField

# HEIC/HEIF support for Pillow
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except Exception:
    pass

from PIL import Image, ImageOps

VIDEO_EXTS = {"mp4", "mov", "mxf", "m4v", "avi", "mkv", "webm"}
IMAGE_EXTS = {"jpg", "jpeg", "png", "heic", "tif", "tiff"}
MEDIA_EXTS = VIDEO_EXTS | IMAGE_EXTS
HEIC_EXTS = {"heic", "heif"}


def _ext_key(p: Path) -> str:
    return (p.suffix or "").lower().lstrip(".")


def convert_heic_to_jpeg(src_path: Path, out_dir: Path | None = None, quality: int = 92) -> Path:
    if out_dir is None:
        import tempfile
        out_dir = Path(tempfile.gettempdir())
    dst_path = out_dir / (src_path.stem + ".jpg")

    with Image.open(src_path) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")

        exif_bytes = None
        try:
            exif_data = im.getexif()
            exif_bytes = exif_data.tobytes() if exif_data else None
        except Exception:
            exif_bytes = None

        icc = im.info.get("icc_profile")

        import tempfile as _tf, os as _os
        tmp = _tf.NamedTemporaryFile(prefix="heic2jpg_", suffix=".jpg", dir=str(out_dir), delete=False)
        tmp_path = Path(tmp.name)
        try:
            tmp.close()
            save_kwargs = dict(format="JPEG", quality=quality, optimize=True)
            if exif_bytes:
                save_kwargs["exif"] = exif_bytes
            if icc:
                save_kwargs["icc_profile"] = icc
            im.save(tmp_path, **save_kwargs)
            tmp_path.replace(dst_path)
        finally:
            if tmp_path.exists() and not dst_path.exists():
                try:
                    _os.remove(tmp_path)
                except Exception:
                    pass

    return dst_path


def parse_metadata_txt(path: Path) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    if not path.exists():
        return data

    lines = [ln.rstrip("\n") for ln in path.read_text(encoding="utf-8", errors="ignore").splitlines()]
    for ln in lines:
        s = ln.strip()
        if not s or ":" not in s:
            continue
        key, val = s.split(":", 1)
        key = key.strip().lower()
        val = val.strip()

        if key in ("username", "user"):
            data["username"] = val
        elif key in ("full name", "fullname", "name"):
            data["full_name"] = val
        elif key == "year":
            data["year"] = val
        elif key == "tags":
            parts = [p.strip() for p in val.split(";")]
            data["tags"] = [p for p in parts if p]

    return data


def collect_media(folder: Path) -> List[Path]:
    return sorted([p for p in folder.iterdir() if p.is_file() and _ext_key(p) in MEDIA_EXTS])


def sanitize_tag_under(raw: str) -> str:
    """
    NOTE: you currently REMOVE non-alphanumerics entirely.
    If you truly wanted underscores, change the replacement to "_".
    Leaving your current behavior intact for now.
    """
    if not raw:
        return ""
    s = re.sub(r"\s+", " ", raw).strip()
    s = re.sub(r"[^0-9A-Za-z]+", "", s)
    return s


def set_user_fullname(user, full_name: Optional[str]) -> bool:
    if not full_name:
        return False
    full_name = full_name.strip()
    update_fields: List[str] = []

    if hasattr(user, "name"):
        if getattr(user, "name", "") != full_name:
            user.name = full_name
            update_fields.append("name")
    elif hasattr(user, "first_name") or hasattr(user, "last_name"):
        parts = full_name.split()
        first = parts[0]
        last = " ".join(parts[1:]) if len(parts) > 1 else ""
        if hasattr(user, "first_name") and getattr(user, "first_name", "") != first:
            user.first_name = first
            update_fields.append("first_name")
        if hasattr(user, "last_name") and getattr(user, "last_name", "") != last:
            user.last_name = last
            update_fields.append("last_name")
    elif hasattr(user, "full_name"):
        if getattr(user, "full_name", "") != full_name:
            user.full_name = full_name
            update_fields.append("full_name")

    if update_fields:
        user.save(update_fields=update_fields)
        return True
    return False


def user_display_name(user) -> str:
    if hasattr(user, "name") and getattr(user, "name", ""):
        return user.name
    fn = getattr(user, "first_name", "") or ""
    ln = getattr(user, "last_name", "") or ""
    if fn or ln:
        return f"{fn} {ln}".strip()
    if hasattr(user, "full_name") and getattr(user, "full_name", ""):
        return user.full_name
    return getattr(user, "username", None) or str(user)


def ensure_owner_user(User, username: str, full_name: Optional[str]):
    username_field = getattr(User, "USERNAME_FIELD", "username")
    try:
        user = User.objects.get(**{username_field: username})
        set_user_fullname(user, full_name)
        return user
    except User.DoesNotExist:
        pass

    created_pw = get_random_string(16)
    user = User.objects.create_user(**{
        username_field: username,
        "email": "",
        "password": created_pw,
    })
    set_user_fullname(user, full_name)
    return user


def get_models() -> Tuple[Any, Any, Optional[Any]]:
    MediaModel = apps.get_model("files", "Media")
    TagModel = apps.get_model("files", "Tag")
    ChannelModel = None
    for app_label in ("files", "channels"):
        try:
            ChannelModel = apps.get_model(app_label, "Channel")
            if ChannelModel is not None:
                break
        except Exception:
            continue
    if not MediaModel or not TagModel:
        raise CommandError("Could not load files.Media/Tag models from the 'files' app.")
    return MediaModel, TagModel, ChannelModel


def get_media_file_field_name(MediaModel) -> str:
    if hasattr(MediaModel, "media_file"):
        return "media_file"
    for f in MediaModel._meta.get_fields():
        try:
            attr = getattr(MediaModel, f.name, None)
            field_obj = getattr(attr, "field", None)
            if isinstance(field_obj, FileField):
                return f.name
        except Exception:
            continue
    raise CommandError("Could not determine file field on files.Media (e.g., 'media_file').")


def add_tags(media_obj, TagModel, owner, tag_list: List[str], stdout):
    if not tag_list or not hasattr(media_obj, "tags"):
        return

    tag_fields = {f.name: f for f in TagModel._meta.get_fields()}
    user_field = tag_fields.get("user")
    user_required = bool(user_field and hasattr(user_field, "null") and not user_field.null)

    tag_objs = []
    for canon in tag_list:
        obj = TagModel._base_manager.filter(title__iexact=canon).first()
        if not obj:
            try:
                create_kwargs = {"title": canon}
                if user_required:
                    create_kwargs["user"] = owner
                obj = TagModel._base_manager.create(**create_kwargs)
            except IntegrityError:
                obj = TagModel._base_manager.filter(title__iexact=canon).first()
                if not obj:
                    stdout.write(f"[warn] Skipping tag due to race: {canon!r}")
                    try:
                        stdout.flush()
                    except Exception:
                        pass
                    continue
        tag_objs.append(obj)

    if tag_objs:
        media_obj.tags.add(*tag_objs)


_IMPORTED_LINE_RE = re.compile(r"^Imported:\s+(?P<name>.+?)\s+→\s+id=\d+\s*$")


def parse_imported_filenames_from_log(log_path: Path) -> Set[str]:
    """
    Extract filenames from prior runs, based on lines like:
      Imported: IMG_4161.mov → id=1687
    Returns a set of filenames (as logged).
    """
    imported: Set[str] = set()
    try:
        if not log_path.exists() or not log_path.is_file():
            return imported
        for ln in log_path.read_text(encoding="utf-8", errors="replace").splitlines():
            m = _IMPORTED_LINE_RE.match(ln.strip())
            if m:
                imported.add(m.group("name").strip())
    except Exception:
        # If log parse fails, safest behavior is: do NOT skip anything.
        return set()
    return imported


class Command(BaseCommand):
    help = "Import a folder of media into MediaCMS using metadata.txt (Username, Full name, Year, Tags)."

    def add_arguments(self, parser):
        parser.add_argument("folder", type=str, help="Folder containing metadata.txt and media files")
        parser.add_argument("--dry-run", action="store_true", help="Show plan without writing to DB")
        parser.add_argument("--sleep", type=float, default=0.0, help="Seconds to sleep between imports")
        parser.add_argument("--state", type=str, default="public", help="Default visibility state if model has a state field")
        parser.add_argument("--keep-heic", action="store_true", help="Retain original HEIC on disk; upload still uses JPEG.")
        parser.add_argument("--jpeg-quality", type=int, default=92, help="JPEG quality for HEIC conversions (default: 92)")
        parser.add_argument(
            "--resume-log",
            type=str,
            default="",
            help="If set, skip files already listed as Imported: ... in this log file.",
        )

    def handle(self, *args, **opts):
        def _out(msg: str) -> None:
            self.stdout.write(msg)
            try:
                self.stdout.flush()
            except Exception:
                pass

        folder = Path(opts["folder"]).resolve()
        if not folder.exists() or not folder.is_dir():
            raise CommandError(f"Folder not found or not a directory: {folder}")

        meta = parse_metadata_txt(folder / "metadata.txt")
        username = (meta.get("username") or "").strip()
        full_name = (meta.get("full_name") or "").strip()
        year_raw = (meta.get("year") or "").strip()
        try:
            if not re.fullmatch(r"\d{4}", year_raw):
                raise ValueError
            year = int(year_raw)
        except Exception:
            raise CommandError(f"Invalid or missing Year in metadata.txt: {year_raw!r} (expected 4 digits)")

        tags_raw = meta.get("tags", []) or []
        tags = [sanitize_tag_under(t) for t in tags_raw if sanitize_tag_under(t)]
        tags.append(f"dc{year}")

        media_files = collect_media(folder)

        # Resume support
        resume_log = (opts.get("resume_log") or "").strip()
        already_imported: Set[str] = set()
        if resume_log:
            log_path = Path(resume_log).resolve()
            already_imported = parse_imported_filenames_from_log(log_path)
            _out(f"[RESUME] resume_log={str(log_path)} imported_seen={len(already_imported)}")

        _out(f"\n=== Import plan for {folder.name} ===")
        _out(f"Owner (from metadata): {username or '<missing>'}")
        _out(f"Full name: {full_name or '<none>'}")
        _out(f"Year: {year}")
        _out(f"Tags (sanitized): {tags}")
        _out(f"Media files: {len(media_files)}")

        if opts["dry_run"]:
            for p in media_files:
                _out(f"[DRY] {p.name}")
            return

        User = get_user_model()
        MediaModel, TagModel, ChannelModel = get_models()
        file_field_name = get_media_file_field_name(MediaModel)

        if not username:
            raise CommandError("Username is required in metadata.txt (e.g., 'Username: ArchiveUploader').")

        owner = ensure_owner_user(User, username, full_name)

        media_fields = {f.name for f in MediaModel._meta.get_fields()}
        nonnull_boolean_fields = set()
        for f in MediaModel._meta.get_fields():
            try:
                attr = getattr(MediaModel, f.name, None)
                field_obj = getattr(attr, "field", None)
                if isinstance(field_obj, BooleanField) and not getattr(field_obj, "null", True):
                    nonnull_boolean_fields.add(f.name)
            except Exception:
                continue

        channel = None
        if ChannelModel is not None and "channel" in media_fields:
            channel = ChannelModel.objects.filter(user=owner).first()
            if channel is None:
                chan_title = full_name or user_display_name(owner)
                channel = ChannelModel.objects.create(user=owner, title=chan_title)
                _out(f"Created channel for '{chan_title}'")

        def set_visibility_defaults(kwargs: Dict[str, Any]):
            if "state" in media_fields and "state" not in kwargs:
                kwargs["state"] = opts["state"]

            for flag, val in (
                ("listable", True),
                ("is_reviewed", True),
                ("enable_comments", True),
                ("allow_download", True),
            ):
                if flag in media_fields and flag not in kwargs:
                    kwargs[flag] = val

            if "allow_whisper_transcribe" in media_fields and "allow_whisper_transcribe" not in kwargs:
                kwargs["allow_whisper_transcribe"] = False

            for name in nonnull_boolean_fields:
                if name not in kwargs:
                    kwargs[name] = False

        imported = 0
        skipped = 0

        for path in media_files:
            # Resume skip check (filename-based)
            if already_imported and path.name in already_imported:
                skipped += 1
                _out(f"Skipped (already imported): {path.name}")
                continue

            effective_path = path
            temp_jpeg: Optional[Path] = None

            ext = path.suffix.lower().lstrip(".")
            if ext in HEIC_EXTS:
                _out(f"Converting HEIC: {path.name}")
                temp_jpeg = convert_heic_to_jpeg(path, out_dir=None, quality=opts.get("jpeg_quality", 92))
                effective_path = temp_jpeg

            title_prefix = f"Dragon Con {year}"
            media_kwargs = {
                "title": f"{title_prefix} - {path.stem}",
                "description": f"Imported {year} archive by {full_name or username}.",
                "user": owner,
            }
            if channel is not None and "channel" in media_fields:
                media_kwargs["channel"] = channel

            set_visibility_defaults(media_kwargs)

            with transaction.atomic():
                with effective_path.open("rb") as fh:
                    djf = DjFile(fh, name=effective_path.name)
                    create_kwargs = dict(media_kwargs)
                    create_kwargs[file_field_name] = djf
                    media = MediaModel.objects.create(**create_kwargs)

                mf = getattr(media, file_field_name, None)
                if not mf or not getattr(mf, "name", ""):
                    raise CommandError(f"Create-with-file failed: '{file_field_name}' is empty on id={media.pk}")

            if temp_jpeg:
                try:
                    temp_jpeg.unlink(missing_ok=True)
                except Exception:
                    pass

            add_tags(media, TagModel, owner, tags, self.stdout)

            for tag in media.tags.all():
                count = MediaModel.objects.filter(tags__pk=tag.pk).distinct().count()
                if getattr(tag, "media_count", None) != count:
                    tag.media_count = count
                    tag.save(update_fields=["media_count"])

                if not getattr(tag, "listings_thumbnail"):
                    if hasattr(tag, "generate_listings_thumbnail"):
                        try:
                            tag.generate_listings_thumbnail()
                        except Exception as e:
                            _out(f"[WARN] Failed to generate thumbnail for tag '{tag.title}': {e}")

            imported += 1
            _out(self.style.SUCCESS(f"Imported: {path.name} → id={media.pk}"))

            time.sleep(opts["sleep"])

        _out(self.style.SUCCESS(f"\nDone. Imported {imported} file(s). Skipped {skipped} already-imported file(s)."))

