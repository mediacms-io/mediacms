#!/usr/bin/env python3
# uploader/management/commands/import_media_batch.py
"""
Import a directory of media (videos & images) into MediaCMS using the local Django ORM.

Folder name patterns:
  - yyyymmdd_day_cameratype_username
  - yyyymmdd_day_cameratype_username_category     (category is optional)

metadata.txt example:
    <title line>
    Device: ...
    Location: ...
    Place: ...
    User: Full Name
    Tags: tag1; tag2; tag3
    Files:
      /path/or/filename1
      /path/or/filename2

Key behavior:
- Attaches `media_file` on create() so MediaCMS post_save hooks run (type detection, encodes/thumbnails).
- Supports VIDEO and IMAGE files (.mp4, .mov, .mxf, .m4v, .avi, .mkv, .webm, .jpg, .jpeg, .png, .heic/.heif).
- Tags are canonicalized (remove spaces & non-alphanumerics) so all media share identical tag rows.
- Tag creation/attach happens OUTSIDE the media create transaction; uniqueness races are handled safely.
- If the owner user is missing and `--create-user` is passed, a new user (and Channel) is created.
- If the optional folder "category" is present, ensure a files.Category exists (create if needed) and assign it.
  *Works for both FK and M2M category fields.*
- Visibility flags are set so items appear in the UI immediately.
- Supports resumable runs via --resume-log by skipping files already logged as Imported.
"""

import re
import time
from pathlib import Path, PureWindowsPath
from typing import Optional, List, Dict, Any, Set

from django.core.management.base import BaseCommand, CommandError
from django.core.files import File as DjFile
from django.contrib.auth import get_user_model
from django.apps import apps
from django.db import transaction, IntegrityError
from django.utils.crypto import get_random_string
from django.utils.text import slugify


# HEIC/HEIF support for Pillow
try:
    import pillow_heif  # pip install pillow-heif
    pillow_heif.register_heif_opener()
except Exception:
    pass

from PIL import Image, ImageOps

# Optional category at the end:
# yyyymmdd_day_camera_username[_category]
DIR_PATTERN = re.compile(
    r"^(?P<date>\d{8})_(?P<day>[a-z]{3})_(?P<camera>[^_]+)_(?P<username>[^_]+)(?:_(?P<category>.+))?$"
)

VIDEO_EXTS = {".mp4", ".mov", ".mxf", ".m4v", ".avi", ".mkv", ".webm"}
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".heic", ".heif"}
MEDIA_EXTS = VIDEO_EXTS | IMAGE_EXTS

HEIC_EXTS = {".heic", ".heif"}


# --------------------------
# Resume-log parsing
# --------------------------

# Accept either:
#   Imported: NAME → id=123
# or older/legacy:
#   Imported: NAME
IMPORTED_RE_WITH_ID = re.compile(r"^\s*Imported:\s+(?P<name>.+?)\s+→\s+id=\d+\s*$")
IMPORTED_RE_NO_ID = re.compile(r"^\s*Imported:\s+(?P<name>.+?)\s*$")


def _load_imported_names_from_log(resume_log: Optional[str]) -> Set[str]:
    """
    Parse the resume log and return a set of display-names already imported.
    We store both:
      - exact string
      - basename (defensive; sometimes people log paths)
    """
    out: Set[str] = set()
    if not resume_log:
        return out

    p = Path(resume_log).expanduser()
    if not p.exists() or not p.is_file():
        return out

    try:
        for ln in p.read_text(encoding="utf-8", errors="replace").splitlines():
            m = IMPORTED_RE_WITH_ID.match(ln) or IMPORTED_RE_NO_ID.match(ln)
            if not m:
                continue
            name = (m.group("name") or "").strip()
            if not name:
                continue
            out.add(name)
            out.add(Path(name).name)
    except Exception:
        # if log is unreadable, just disable resume skipping
        return set()

    return out


# --------------------------
# HEIC conversion
# --------------------------

def convert_heic_to_jpeg(src_path: Path, out_dir: Path | None = None, quality: int = 92) -> Path:
    """Convert a HEIC/HEIF image to JPEG (EXIF+ICC preserved when possible). Returns JPEG temp path."""
    if out_dir is None:
        import tempfile
        out_dir = Path(tempfile.gettempdir())

    with Image.open(src_path) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")

        try:
            exif_bytes = (im.getexif() or {}).tobytes()
        except Exception:
            exif_bytes = None
        icc = im.info.get("icc_profile")

        import tempfile, os
        tmp = tempfile.NamedTemporaryFile(prefix="heic2jpg_", suffix=".jpg", dir=str(out_dir), delete=False)
        tmp_path = Path(tmp.name)
        try:
            tmp.close()
            save_kwargs = dict(format="JPEG", quality=quality, optimize=True)
            if exif_bytes:
                save_kwargs["exif"] = exif_bytes
            if icc:
                save_kwargs["icc_profile"] = icc
            im.save(tmp_path, **save_kwargs)
        except Exception:
            try:
                os.remove(tmp_path)
            except Exception:
                pass
            raise

    return tmp_path


# --------------------------
# parsing helpers
# --------------------------

def parse_metadata_txt(path: Path) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    if not path.exists():
        return data
    lines = [ln.rstrip("\n") for ln in path.read_text(encoding="utf-8", errors="ignore").splitlines()]
    if not lines:
        return data

    # First non-empty line is the title
    title_line = next((ln.strip() for ln in lines if ln.strip()), None)
    if title_line:
        data["title"] = title_line

    files_mode = False
    files: List[str] = []
    for ln in lines[1:]:
        raw = ln.rstrip("\n")
        s = raw.strip()
        if not s:
            continue

        if re.match(r"^files\s*:\s*$", s, re.IGNORECASE):
            files_mode = True
            continue

        if files_mode:
            # accept any non-empty line as a file entry
            files.append(s)
            continue

        m = re.match(r"^([A-Za-z]+)\s*:\s*(.*)$", s)
        if m:
            key = m.group(1).lower()
            val = m.group(2).strip()
            if key == "tags":
                parts = [p.strip() for p in val.split(";")]
                data["tags"] = [p for p in parts if p]
            elif key == "user":
                data["user_fullname"] = val
            elif key == "device":
                data["device"] = val
            elif key == "location":
                data["location"] = val
            elif key == "place":
                data["place"] = val

    if files:
        data["files"] = files
    return data


def parse_dir_name(name: str) -> Dict[str, Any]:
    m = DIR_PATTERN.match(name)
    if not m:
        raise CommandError(
            f"Folder name must match yyyymmdd_day_camera_user or yyyymmdd_day_camera_user_category: {name}"
        )
    return {
        "date_raw": m.group("date"),
        "day": m.group("day"),
        "camera": m.group("camera"),
        "username": m.group("username"),
        "category": m.group("category"),  # may be None
    }


# --------------------------
# path mapping (Windows -> local)
# --------------------------

def _win_basename_any(s: str) -> str:
    try:
        return PureWindowsPath(s).name
    except Exception:
        part = s.rsplit("\\", 1)[-1]
        part = part.rsplit("/", 1)[-1]
        return part


def normalize_windows_to_local(
    win_path: str,
    folder: Path,
    win_prefix: Optional[str],
    local_prefix: Optional[str],
) -> Path:
    """
    Map a Windows absolute path to a local Linux path using --win-prefix/--local-prefix.
    If mapping fails, fall back to folder/basename without stat'ing the raw Windows string.
    """
    raw = (win_path or "").strip().strip('"').strip("'")

    if win_prefix and local_prefix:
        wp = win_prefix.replace("\\", "/").rstrip("/")
        lp = local_prefix.rstrip("/")
        p_norm = raw.replace("\\", "/")

        if p_norm.lower().startswith(wp.lower() + "/") or p_norm.lower() == wp.lower():
            mapped = lp + p_norm[len(wp):]
            candidate = Path(mapped)
            if candidate.exists():
                return candidate
            return candidate

    if raw.startswith("/"):
        cand_local = Path(raw)
        if cand_local.exists():
            return cand_local

    base = _win_basename_any(raw)
    return folder / base


def collect_media(
    folder: Path,
    files_hint: Optional[List[str]],
    ignore_list: bool,
    win_prefix: Optional[str],
    local_prefix: Optional[str],
) -> List[Path]:
    """
    Return sorted list of media files. Honors Files: list unless --ignore-files-list.
    """
    if not ignore_list and files_hint:
        out: List[Path] = []
        for f in files_hint:
            p = normalize_windows_to_local(f, folder, win_prefix, local_prefix)
            try:
                ok = p.exists() and p.is_file()
            except OSError:
                ok = False
            if ok and p.suffix.lower() in MEDIA_EXTS:
                out.append(p)
            else:
                print(f"WARNING: listed file not found or unsupported -> {f}")
        if out:
            return sorted(out)
        print("No listed files were found locally; falling back to folder discovery.")
    return sorted([p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in MEDIA_EXTS])


# --------------------------
# tag canonicalization
# --------------------------

def sanitize_tag(raw: str) -> str:
    if not raw:
        return ""
    s = re.sub(r"\s+", " ", raw).strip()
    s = re.sub(r"[^0-9A-Za-z]+", "", s)
    return s


# --------------------------
# user display name helpers (schema-aware)
# --------------------------

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


# --------------------------
# user & category helpers
# --------------------------

def ensure_owner_user(
    User,
    username: str,
    email: Optional[str],
    password: Optional[str],
    full_name: Optional[str],
    stdout,
) -> Any:
    username_field = getattr(User, "USERNAME_FIELD", "username")
    try:
        user = User.objects.get(**{username_field: username})
        if full_name:
            set_user_fullname(user, full_name)
        return user
    except User.DoesNotExist:
        pass

    created_pw = password or get_random_string(16)
    email_val = email or ""

    create_user = getattr(User.objects, "create_user", None)
    if callable(create_user):
        user = create_user(**{username_field: username}, email=email_val, password=created_pw)
    else:
        user = User(**{username_field: username, "email": email_val, "is_active": True})
        user.set_password(created_pw)
        user.save()

    if full_name:
        set_user_fullname(user, full_name)

    if hasattr(user, "is_active") and not user.is_active:
        user.is_active = True
        user.save(update_fields=["is_active"])

    masked_pw = created_pw[:2] + "..." + created_pw[-2:] if created_pw else "(unusable)"
    stdout.write(f"Created user '{username}' (email='{email_val}', password={masked_pw})")
    return user


def ensure_category(owner, raw_category: str, stdout) -> Optional[Any]:
    if not raw_category:
        return None

    CategoryModel = apps.get_model("files", "Category")
    if CategoryModel is None:
        stdout.write("WARNING: files.Category model not found; skipping category assignment.")
        return None

    title = re.sub(r"_+", " ", raw_category).strip()
    title = re.sub(r"\s+", " ", title)

    cat_fields = {f.name: f for f in CategoryModel._meta.get_fields()}
    has_slug = "slug" in cat_fields
    user_field = cat_fields.get("user")
    user_required = bool(user_field and hasattr(user_field, "null") and not user_field.null)

    obj = CategoryModel._base_manager.filter(title__iexact=title).first()
    if obj:
        return obj

    try:
        create_kwargs = {"title": title}
        if has_slug:
            create_kwargs["slug"] = slugify(title) or slugify(re.sub(r"\s+", "-", title))
        if user_required:
            create_kwargs["user"] = owner
        obj = CategoryModel._base_manager.create(**create_kwargs)
        return obj
    except IntegrityError:
        return CategoryModel._base_manager.filter(title__iexact=title).first()


# --------------------------
# management command
# --------------------------

class Command(BaseCommand):
    help = "Import a directory of media (videos & images) into MediaCMS from the local server (ORM-based)."

    def add_arguments(self, parser):
        parser.add_argument("path", help="Folder whose name matches yyyymmdd_day_cameratype_username[_category]")
        parser.add_argument("--dry-run", action="store_true", help="Parse only; do not import")
        parser.add_argument("--ignore-files-list", action="store_true", help="Ignore `Files:` in metadata.txt and scan folder")
        parser.add_argument("--win-prefix", default=None, help=r"Windows prefix to rewrite (e.g. L:\hub_archive)")
        parser.add_argument("--local-prefix", default=None, help="Local path that replaces --win-prefix")
        parser.add_argument("--owner", default=None, help="Override owner username (otherwise uses folder username)")
        parser.add_argument("--state", default="public", help="Media state (default: public)")
        parser.add_argument("--sleep", type=float, default=0.25, help="Sleep between imports (seconds)")
        parser.add_argument("--keep-heic", action="store_true", help="Keep original HEIC on disk; upload uses JPEG")
        parser.add_argument("--jpeg-quality", type=int, default=92, help="JPEG quality for HEIC conversions (default: 92)")
        parser.add_argument("--create-user", action="store_true",
                            help="Create the owner user automatically if not found")
        parser.add_argument("--user-email", default=None,
                            help="Email to assign when creating the owner user (optional)")
        parser.add_argument("--user-password", default=None,
                            help="Password to assign when creating the owner user (optional; random if omitted)")
        parser.add_argument("--heic-only", action="store_true",
                            help="Import only HEIC/HEIF files (skip everything else)")
        parser.add_argument(
            "--resume-log",
            default=None,
            help="Path to an import_job_<id>.log file; if provided, skip files already logged as Imported.",
        )

    def handle(self, *args, **opts):
        # ---- always-flushing output helper ----
        def _out(msg: str) -> None:
            self.stdout.write(msg)
            try:
                self.stdout.flush()
            except Exception:
                pass

        folder = Path(opts["path"]).resolve()
        if not folder.is_dir():
            raise CommandError(f"Not a directory: {folder}")

        resume_log = opts.get("resume_log")
        already_imported = _load_imported_names_from_log(resume_log)
        resume_enabled = bool(resume_log) and bool(already_imported)

        # Load schema: files.Media, files.Tag, users.Channel
        MediaModel = apps.get_model("files", "Media")
        if MediaModel is None:
            raise CommandError("Could not load files.Media model.")
        TagModel = apps.get_model("files", "Tag")
        if TagModel is None:
            raise CommandError("Could not load files.Tag model.")
        ChannelModel = apps.get_model("users", "Channel")
        if ChannelModel is None:
            raise CommandError("Could not load users.Channel model.")

        media_fields = {f.name for f in MediaModel._meta.get_fields()}
        file_field_name = (
            "media_file" if "media_file" in media_fields
            else ("file" if "file" in media_fields else ("video" if "video" in media_fields else None))
        )
        if not file_field_name:
            raise CommandError(
                f"Could not find a file field on files.Media (looked for media_file, file, video). "
                f"Fields: {sorted(media_fields)}"
            )

        # Work out category field shape if present
        category_field_info = None
        cat_is_fk = False
        cat_is_m2m = False
        if "category" in media_fields:
            try:
                cf = MediaModel._meta.get_field("category")
                category_field_info = cf
                cat_is_fk = getattr(cf, "many_to_one", False) and not getattr(cf, "many_to_many", False)
                cat_is_m2m = getattr(cf, "many_to_many", False)
            except Exception:
                category_field_info = None

        User = get_user_model()
        username_field = getattr(User, "USERNAME_FIELD", "username")

        parsed = parse_dir_name(folder.name)
        meta_txt = parse_metadata_txt(folder / "metadata.txt")

        # Merge metadata
        date_raw = parsed["date_raw"]
        date_iso = f"{date_raw[:4]}-{date_raw[4:6]}-{date_raw[6:8]}"
        date_friendly = f"DC {date_raw[:4]} {parsed['day']} {date_raw[4:6]}/{date_raw[6:8]}"
        year_tag = f"DC{date_raw[:4]}"
        username = opts["owner"] or parsed["username"]
        folder_category_raw = parsed.get("category")  # may be None
        user_fullname = meta_txt.get("user_fullname") or username
        title_prefix = meta_txt.get("title") or f"{date_iso} {parsed['camera']}"
        description = (
            f"Shot on {date_iso} ({parsed['day']}) with {parsed['camera']} "
            f"by {user_fullname} ({username})."
        )
        input_tags = [date_friendly, year_tag] + (meta_txt.get("tags", []) or [])

        # Canonical tags for DB
        tags: List[str] = []
        seen_lower = set()
        for t in input_tags:
            canon = sanitize_tag(t)
            if not canon:
                continue
            tl = canon.lower()
            if tl not in seen_lower:
                seen_lower.add(tl)
                tags.append(canon)

        location = meta_txt.get("location")
        place = meta_txt.get("place")
        device = meta_txt.get("device")

        media_files = collect_media(
            folder, meta_txt.get("files"), opts["ignore_files_list"],
            opts["win_prefix"], opts["local_prefix"]
        )

        # Apply --heic-only filter early
        if opts.get("heic_only"):
            filtered = []
            skipped = 0
            for p in media_files:
                ext = p.suffix.lower()
                if ext in (".heic", ".heif"):
                    filtered.append(p)
                else:
                    _out(f"[SKIP] heic-only {p.name}")
                    skipped += 1
            media_files = filtered
            if skipped:
                _out(self.style.NOTICE(f"HEIC-only: {skipped} non-HEIC file(s) skipped, {len(media_files)} kept."))

        _out(self.style.NOTICE(f"\n=== Import plan for {folder.name} ==="))
        _out(f"Owner: {username}")
        _out(f"Date: {date_iso}  Day: {parsed['day']}")
        _out(f"Camera: {parsed['camera']}")
        if folder_category_raw:
            _out(f"Folder category token: {folder_category_raw}")
        if device:
            _out(f"Device: {device}")
        _out(f"Tags (canonical): {tags}")
        if location or place:
            _out(f"Location: {location or ''}  Place: {place or ''}")
        _out(f"Media files discovered: {len(media_files)}")

        if resume_log:
            _out(f"Resume log: {resume_log}")
            _out(f"Resume enabled: {'yes' if resume_enabled else 'no'} (imported-lines found: {len(already_imported)})")

        if opts["dry_run"]:
            for p in media_files:
                display_name = p.name
                if p.suffix.lower() in HEIC_EXTS:
                    display_name = f"{p.stem}.jpg"
                if resume_enabled and (display_name in already_imported or p.name in already_imported):
                    _out(f"[DRY] [SKIP already imported] {display_name}")
                else:
                    _out(f"[DRY] {display_name}")
                    if p.suffix.lower() in HEIC_EXTS:
                        _out(f"[DRY] Would convert HEIC: {p.name} -> {p.stem}.jpg")
            return

        # Resolve owner & channel (with optional auto-create)
        try:
            owner = User.objects.get(**{username_field: username})
        except User.DoesNotExist:
            if not opts["create_user"]:
                raise CommandError(
                    f"Owner username '{username}' not found. "
                    f"Pass --create-user to create it automatically (and optional --user-email/--user-password)."
                )
            owner = ensure_owner_user(
                User, username, opts.get("user_email"),
                opts.get("user_password"), meta_txt.get("user_fullname"), self.stdout
            )

        channel = ChannelModel.objects.filter(user=owner).first()
        if channel is None:
            chan_title = meta_txt.get("user_fullname") or user_display_name(owner)
            channel = ChannelModel.objects.create(user=owner, title=chan_title)
            _out(f"Created channel for '{chan_title}'")

        # Optional: ensure/resolve category object from folder token
        category_obj = None
        if ("category" in media_fields) and folder_category_raw:
            category_obj = ensure_category(owner, folder_category_raw, self.stdout)
            if category_obj:
                _out(f"Using category: {getattr(category_obj, 'title', str(category_obj))}")

        # ---- tags — sanitized, existence-check, create-if-missing, race-safe ----
        def add_tags(media_obj, tag_list: List[str]):
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
                            _out(self.style.WARNING(f"Skipping tag due to race: {canon!r}"))
                            continue
                tag_objs.append(obj)

            if tag_objs:
                media_obj.tags.add(*tag_objs)

        def set_optional_fields(media_obj):
            updated = []
            for fname, value in (("location", location), ("place", place), ("device", device)):
                if value is not None and hasattr(media_obj, fname):
                    setattr(media_obj, fname, value)
                    updated.append(fname)
            if updated:
                media_obj.save(update_fields=updated)

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

        imported = 0
        skipped_already = 0

        for path in media_files:
            # Determine the display name that will be logged and used for resume checks
            display_name = path.name
            if path.suffix.lower() in HEIC_EXTS:
                display_name = f"{path.stem}.jpg"

            if resume_enabled and (display_name in already_imported or path.name in already_imported):
                skipped_already += 1
                _out(self.style.NOTICE(f"[SKIP] already imported: {display_name}"))
                continue

            # On-the-fly HEIC->JPEG conversion per file
            effective_path = path
            temp_jpeg: Optional[Path] = None

            ext = path.suffix.lower()
            if ext in HEIC_EXTS:
                _out(f"Converting HEIC: {path.name}")
                temp_jpeg = convert_heic_to_jpeg(path, out_dir=None, quality=opts.get("jpeg_quality", 92))
                effective_path = temp_jpeg

            media_kwargs = {
                "title": f"{title_prefix} - {path.stem}",
                "description": description,
                "user": owner,
            }
            if "channel" in media_fields:
                media_kwargs["channel"] = channel

            # Category handling: FK goes in kwargs; M2M is attached after create
            attach_category_after = False
            if category_obj and ("category" in media_fields):
                if cat_is_fk:
                    media_kwargs["category"] = category_obj
                elif cat_is_m2m:
                    attach_category_after = True

            # classify type if fields exist
            _is_video = path.suffix.lower() in VIDEO_EXTS
            if "type" in media_fields and "type" not in media_kwargs:
                media_kwargs["type"] = "video" if _is_video else "image"
            if "media_type" in media_fields and "media_type" not in media_kwargs:
                media_kwargs["media_type"] = "video" if _is_video else "image"

            set_visibility_defaults(media_kwargs)

            # Create WITH file attached inside a short atomic block.
            with transaction.atomic():
                # small fs latency guard
                for _try in range(10):
                    if effective_path.exists():
                        break
                    time.sleep(0.05)
                if not effective_path.exists():
                    raise CommandError(f"Upload source missing: {effective_path}")

                with effective_path.open("rb") as fh:
                    djf = DjFile(fh, name=effective_path.name)
                    create_kwargs = dict(media_kwargs)
                    create_kwargs[file_field_name] = djf
                    media = MediaModel.objects.create(**create_kwargs)

                mf = getattr(media, file_field_name, None)
                if not mf or not getattr(mf, "name", ""):
                    raise CommandError(f"Create-with-file failed: '{file_field_name}' is empty on id={media.pk}")

            # Cleanup temp JPEG if created (unless keep-heic; keep-heic controls ORIGINAL, temp is always safe to delete)
            try:
                if temp_jpeg is not None:
                    Path(temp_jpeg).unlink(missing_ok=True)
            except Exception:
                pass

            # Post-create attachments/updates
            if attach_category_after:
                try:
                    getattr(media, "category").set([category_obj])
                except Exception as e:
                    _out(self.style.WARNING(f"Could not set M2M category: {e}"))

            add_tags(media, tags)

            # Recalculate media_count + best-effort thumbnail for tags
            if hasattr(media, "tags"):
                for tag in media.tags.all():
                    try:
                        count = MediaModel.objects.filter(tags__pk=tag.pk).distinct().count()
                        if getattr(tag, "media_count", None) != count:
                            tag.media_count = count
                            tag.save(update_fields=["media_count"])
                    except Exception:
                        pass

                    # If tag has no thumbnail yet, try to generate one
                    try:
                        if not getattr(tag, "listings_thumbnail", None):
                            if hasattr(tag, "generate_listings_thumbnail"):
                                tag.generate_listings_thumbnail()
                    except Exception as e:
                        _out(f"[WARN] Failed to generate thumbnail for tag '{getattr(tag, 'title', '?')}': {e}")

            set_optional_fields(media)

            imported += 1

            # IMPORTANT: This is the canonical line your tail+resume expects
            _out(self.style.SUCCESS(f"Imported: {display_name} → id={media.pk}"))

            time.sleep(opts["sleep"])

        _out(self.style.SUCCESS(f"\nDone. Imported {imported} file(s)."))
        if resume_log:
            _out(self.style.NOTICE(f"Resume summary: skipped_already_imported={skipped_already}"))

