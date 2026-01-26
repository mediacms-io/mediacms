# files/management/commands/repair_thumbnails.py
import io
import os
import tempfile
import traceback
import subprocess
import errno
import glob
from datetime import datetime
from typing import Optional, Iterable, List, Tuple

from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from files.models import Media  # adjust app label if yours differs

# -----------------------------
# Tunables / heuristics
# -----------------------------
THUMB_FIELD_CANDIDATES   = ["thumbnail", "listing_thumbnail", "thumb"]
POSTER_FIELD_CANDIDATES  = ["poster", "poster_image", "preview_image"]
SPRITES_FIELD_CANDIDATES = ["sprites", "sprite_image", "sprite"]
MEDIA_FILE_CANDIDATES    = ["media_file", "file", "source_file"]

def fallback_thumb_path(media_id: int)   -> str: return f"thumbnails/{media_id}/thumb.jpg"
def fallback_poster_path(media_id: int)  -> str: return f"thumbnails/{media_id}/poster.jpg"
def fallback_sprites_path(media_id: int) -> str: return f"thumbnails/{media_id}/sprites.jpg"

IMAGE_THUMB_MAX_SIZE   = (640, 640)             # listing thumb size for images
VIDEO_THUMB_MAX_WIDTH  = 480                    # small video thumb derived from poster
POSTER_TIME_SECONDS    = getattr(settings, "POSTER_FRAME_TIME", 2)
FFMPEG_TIMEOUT_SECONDS = 25

# Sprite defaults (auto tuned by duration; these are fallbacks)
SPRITES_TILE_COLS = 10
SPRITES_TILE_ROWS = 10
SPRITES_FRAME_INTERVAL_S = 6                    # aim ~1 frame every N seconds
SPRITES_SCALE_WIDTH = 320                       # width of each tile frame

AUDIO_EXTS = {".wav",".mp3",".aac",".m4a",".flac",".ogg",".oga",".alac",".wma",".opus",".aiff",".aif"}

# -----------------------------
# Logging
# -----------------------------
class Logger:
    def __init__(self, stdout, verbose: bool=False, log_path: Optional[str]=None):
        self.stdout = stdout; self.verbose = verbose; self.log_path = log_path; self._fh = None
        if log_path:
            os.makedirs(os.path.dirname(log_path), exist_ok=True)
            self._fh = open(log_path, "a", encoding="utf-8")
    def _write(self, level, msg, force_console=False):
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{ts}] {level}: {msg}"
        if self.verbose or force_console: self.stdout.write(line)
        if self._fh: self._fh.write(line+"\n"); self._fh.flush()
    def info(self, m, force_console=False): self._write("INFO", m, force_console)
    def warn(self, m, force_console=False): self._write("WARN", m, force_console)
    def error(self, m, force_console=True):  self._write("ERROR", m, force_console)
    def close(self):
        if self._fh:
            try: self._fh.close()
            except Exception: pass

# -----------------------------
# Helpers
# -----------------------------
def get_first_existing_attr(obj_or_cls, candidates: List[str]) -> Optional[str]:
    for name in candidates:
        if hasattr(obj_or_cls, name): return name
    return None

def as_storage_path(value) -> Optional[str]:
    if value is None: return None
    name = getattr(value, "name", None)
    if isinstance(name, str) and name: return name
    if isinstance(value, str) and value: return value
    return None

def storage_exists(path_like) -> bool:
    p = as_storage_path(path_like)
    if not p: return False
    try: return default_storage.exists(p)
    except Exception: return False

def ensure_parent_dirs(path_like) -> None:
    p = as_storage_path(path_like)
    if not p: return
    base = getattr(default_storage, "location", None)
    if base:
        full = os.path.join(base, p)
        try: os.makedirs(os.path.dirname(full), exist_ok=True)
        except Exception: pass

def save_bytes_to_storage(path_like, data: bytes) -> str:
    p = as_storage_path(path_like)
    if not p: raise ValueError("save_bytes_to_storage: invalid target path")
    ensure_parent_dirs(p)
    try:
        if default_storage.exists(p): default_storage.delete(p)
    except Exception: pass
    default_storage.save(p, ContentFile(data))
    return p

def resolve_target_path(existing_field_value, fallback_fn, media_id: int) -> str:
    existing = as_storage_path(existing_field_value)
    return existing or fallback_fn(media_id)

def get_media_source(m: Media) -> Optional[str]:
    name = get_first_existing_attr(m, MEDIA_FILE_CANDIDATES)
    if not name: return None
    return as_storage_path(getattr(m, name))

def get_media_type(m: Media) -> str:
    t = (getattr(m, "type", "") or "").lower()
    if "image" in t: return "image"
    if "video" in t or "movie" in t: return "video"
    src = get_media_source(m) or ""; ext = os.path.splitext(src)[1].lower()
    if ext in {".jpg",".jpeg",".png",".webp",".tif",".tiff"}: return "image"
    if ext in AUDIO_EXTS: return "audio"
    return "video"

def local_fs_abspath(storage_rel_path: Optional[str]) -> Optional[str]:
    if not storage_rel_path: return None
    base = getattr(default_storage, "location", None)
    if not base: return None
    abs_path = os.path.join(base, storage_rel_path)
    return abs_path if os.path.exists(abs_path) else None

# -----------------------------
# Tmpdir management
# -----------------------------
def resolve_tmpdir(cmd_tmpdir: Optional[str]) -> str:
    return (
        cmd_tmpdir
        or getattr(settings, "MC_REPAIR_TMPDIR", None)
        or os.environ.get("MC_REPAIR_TMPDIR")
        or os.environ.get("TMPDIR")
        or "/tmp"
    )

def fetch_to_temp(storage_name_like, tmpdir: str, logger: Optional[Logger]=None) -> str:
    storage_name = as_storage_path(storage_name_like)
    if not storage_name: raise ValueError("fetch_to_temp: invalid storage path")
    os.makedirs(tmpdir, exist_ok=True)
    suffix = os.path.splitext(storage_name)[1]
    fd, tmppath = tempfile.mkstemp(prefix="mcrepair_", suffix=suffix, dir=tmpdir)
    try:
        with os.fdopen(fd, "wb") as fdst, default_storage.open(storage_name, "rb") as fsrc:
            for chunk in iter(lambda: fsrc.read(1024*1024), b""):
                try: fdst.write(chunk)
                except OSError as e:
                    if e.errno == errno.ENOSPC:
                        if logger: logger.error(
                            f"NO SPACE LEFT in tmpdir '{tmpdir}'. Use --tmpdir /bigger/disk or set MC_REPAIR_TMPDIR."
                        )
                    raise
        return tmppath
    except Exception:
        try:
            if os.path.exists(tmppath): os.remove(tmppath)
        except Exception: pass
        raise

def cleanup_tmpdir(tmpdir: str, pattern: str="mcrepair_*", logger: Optional[Logger]=None) -> int:
    count = 0
    for path in glob.glob(os.path.join(tmpdir, pattern)):
        try: os.remove(path); count += 1
        except Exception as e:
            if logger: logger.warn(f"Could not remove temp file '{path}': {e}")
    if count > 0:
        if logger: logger.info(f"Cleaned {count} temp file(s) in '{tmpdir}'")
    return count

# -----------------------------
# ffprobe helpers
# -----------------------------
def probe_has_video_stream(source_path_like, tmpdir: str, logger: Optional[Logger]) -> bool:
    storage_rel = as_storage_path(source_path_like)
    if not storage_rel: return False
    abs_src = local_fs_abspath(storage_rel)
    src_path = abs_src or fetch_to_temp(storage_rel, tmpdir, logger)
    own_tmp = abs_src is None
    try:
        cmd = ["ffprobe","-v","error","-select_streams","v","-show_entries","stream=codec_type","-of","csv=p=0",src_path]
        res = subprocess.run(cmd, capture_output=True, text=True, check=False)
        out = (res.stdout or "").strip().lower()
        return "video" in out
    finally:
        if own_tmp:
            try: os.remove(src_path)
            except Exception: pass

def probe_duration_seconds(source_path_like, tmpdir: str, logger: Optional[Logger]) -> Optional[float]:
    storage_rel = as_storage_path(source_path_like)
    if not storage_rel: return None
    abs_src = local_fs_abspath(storage_rel)
    src_path = abs_src or fetch_to_temp(storage_rel, tmpdir, logger)
    own_tmp = abs_src is None
    try:
        cmd = ["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",src_path]
        res = subprocess.run(cmd, capture_output=True, text=True, check=False, timeout=FFMPEG_TIMEOUT_SECONDS)
        try: return float((res.stdout or "").strip())
        except Exception: return None
    finally:
        if own_tmp:
            try: os.remove(src_path)
            except Exception: pass

# -----------------------------
# Generators
# -----------------------------
def generate_image_thumbnail(source_path_like, max_size=IMAGE_THUMB_MAX_SIZE) -> bytes:
    from PIL import Image, ImageOps
    p = as_storage_path(source_path_like)
    if not p: raise ValueError("generate_image_thumbnail: invalid source path")
    with default_storage.open(p, "rb") as f:
        with Image.open(f) as im:
            im = ImageOps.exif_transpose(im)
            im.thumbnail(max_size)
            if im.mode not in ("RGB","L"): im = im.convert("RGB")
            out = io.BytesIO(); im.save(out, format="JPEG", optimize=True, quality=85)
            return out.getvalue()

def generate_audio_poster(source_path_like, width=1280, height=360, fg="black",
                          timeout_sec=FFMPEG_TIMEOUT_SECONDS, tmpdir: Optional[str]=None,
                          logger: Optional[Logger]=None) -> bytes:
    storage_rel = as_storage_path(source_path_like)
    if not storage_rel: raise ValueError("generate_audio_poster: invalid source path")
    abs_src = local_fs_abspath(storage_rel)
    src_path = abs_src or fetch_to_temp(storage_rel, tmpdir or "/tmp", logger); own_tmp = abs_src is None
    try:
        fd, out_path = tempfile.mkstemp(prefix="mcrepair_wave_", suffix=".jpg", dir=tmpdir or "/tmp"); os.close(fd)
        filter_expr = f"showwavespic=s={width}x{height}:colors={fg}|{fg},format=rgb24"
        cmd = ["ffmpeg","-hide_banner","-nostdin","-loglevel","error","-i",src_path,"-frames:v","1","-filter_complex",filter_expr,"-y",out_path]
        subprocess.run(cmd, check=True, timeout=timeout_sec)
        with open(out_path,"rb") as f: data = f.read()
        os.remove(out_path); return data
    finally:
        if own_tmp:
            try: os.remove(src_path)
            except Exception: pass

def generate_video_poster(source_path_like, seek_sec=POSTER_TIME_SECONDS,
                          timeout_sec=FFMPEG_TIMEOUT_SECONDS, tmpdir: Optional[str]=None,
                          logger: Optional[Logger]=None) -> bytes:
    storage_rel = as_storage_path(source_path_like)
    if not storage_rel: raise ValueError("generate_video_poster: invalid source path")
    if not probe_has_video_stream(storage_rel, tmpdir or "/tmp", logger):
        return generate_audio_poster(storage_rel, timeout_sec=timeout_sec, tmpdir=tmpdir, logger=logger)
    abs_src = local_fs_abspath(storage_rel)
    src_path = abs_src or fetch_to_temp(storage_rel, tmpdir or "/tmp", logger); own_tmp = abs_src is None
    try:
        fd, out_path = tempfile.mkstemp(prefix="mcrepair_frame_", suffix=".jpg", dir=tmpdir or "/tmp"); os.close(fd)
        cmd = ["ffmpeg","-hide_banner","-nostdin","-loglevel","error","-ss",str(seek_sec),"-i",src_path,"-frames:v","1","-y",out_path]
        subprocess.run(cmd, check=True, timeout=timeout_sec)
        with open(out_path,"rb") as f: data = f.read()
        os.remove(out_path); return data
    finally:
        if own_tmp:
            try: os.remove(src_path)
            except Exception: pass

def downscale_jpeg_bytes(data: bytes, max_width: int) -> bytes:
    from PIL import Image
    im = Image.open(io.BytesIO(data))
    w, h = im.size
    if w <= max_width: return data
    new_h = int(h * (max_width / float(w)))
    im = im.convert("RGB").resize((max_width, new_h))
    out = io.BytesIO(); im.save(out, format="JPEG", optimize=True, quality=85)
    return out.getvalue()

def generate_video_sprites(source_path_like, tmpdir: Optional[str], logger: Optional[Logger]) -> bytes:
    """
    Build a contact-sheet sprite JPG. Auto-compute fps/tile based on duration.
    """
    storage_rel = as_storage_path(source_path_like)
    if not storage_rel: raise ValueError("generate_video_sprites: invalid source path")

    # Determine duration and tile geometry
    dur = probe_duration_seconds(storage_rel, tmpdir or "/tmp", logger) or 0
    # Aim ~100 frames total, min 12, max 200
    target_frames = max(12, min(200, int((dur / SPRITES_FRAME_INTERVAL_S) or 12)))
    cols = SPRITES_TILE_COLS
    rows = max(1, (target_frames + cols - 1) // cols)

    abs_src = local_fs_abspath(storage_rel)
    src_path = abs_src or fetch_to_temp(storage_rel, tmpdir or "/tmp", logger); own_tmp = abs_src is None

    try:
        fd, out_path = tempfile.mkstemp(prefix="mcrepair_sprites_", suffix=".jpg", dir=tmpdir or "/tmp"); os.close(fd)
        # Use fps to pick frames evenly across the duration
        fps = target_frames / max(1.0, dur) if dur > 0 else 0.5
        filter_chain = (
            f"fps={fps},scale={SPRITES_SCALE_WIDTH}:-1:flags=lanczos,"
            f"tile={cols}x{rows}"
        )
        cmd = ["ffmpeg","-hide_banner","-nostdin","-loglevel","error",
               "-i",src_path,"-frames:v","1","-filter_complex",filter_chain,"-y",out_path]
        subprocess.run(cmd, check=True, timeout=FFMPEG_TIMEOUT_SECONDS)
        with open(out_path,"rb") as f: data = f.read()
        os.remove(out_path); return data
    finally:
        if own_tmp:
            try: os.remove(src_path)
            except Exception: pass

# -----------------------------
# Management command
# -----------------------------
class Command(BaseCommand):
    help = "Reconcile thumbnails/posters/sprites: verify on storage and regenerate any missing files."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", default=False,
                            help="Do not write anything; just report what would happen.")
        parser.add_argument("--limit", type=int, default=None,
                            help="Process at most N media items.")
        parser.add_argument("--ids", type=str, default=None,
                            help="Comma-separated list of media IDs to process (overrides limit).")
        parser.add_argument("--only", type=str, choices=["images","videos","audio","all"],
                            default="all", help="Restrict to images, videos, audio, or all.")
        parser.add_argument("--force", action="store_true", default=False,
                            help="Recreate assets even if files exist.")
        parser.add_argument("--verbose", action="store_true", default=False,
                            help="Print a line for every item (FIXED/SKIPPED with reason).")
        parser.add_argument("--log-file", type=str, default=None,
                            help="Also write detailed logs to this file path.")
        parser.add_argument("--tmpdir", type=str, default=None,
                            help="Directory for temp files (defaults: settings.MC_REPAIR_TMPDIR or /tmp).")
        parser.add_argument("--cleanup-tmp", action="store_true", default=False,
                            help="Remove leftover mcrepair_* temp files in tmpdir before running.")
        parser.add_argument("--ffmpeg-timeout", type=int, default=FFMPEG_TIMEOUT_SECONDS,
                            help="Set ffmpeg timeout in seconds (default: 25).")

    def handle(self, *args, **opts):
        dry_run  = opts["dry_run"];  limit = opts["limit"]; ids_csv = opts["ids"]
        only_raw     = opts["only"];     force = opts["force"]
        verbose  = opts["verbose"];  log_file = opts["log_file"]
        tmpdir   = resolve_tmpdir(opts["tmpdir"]); cleanup = opts["cleanup_tmp"]
        timeout_override = opts["ffmpeg_timeout"]
        global FFMPEG_TIMEOUT_SECONDS
        FFMPEG_TIMEOUT_SECONDS = timeout_override

        # Normalize only/images/videos -> image/video
        if only_raw in ("images", "videos"):
            only = only_raw[:-1]   # "images" -> "image", "videos" -> "video"
        else:
            only = only_raw

        logger = Logger(self.stdout, verbose=verbose, log_path=log_file)
        if cleanup: cleanup_tmpdir(tmpdir, logger=logger)

        thumb_field  = get_first_existing_attr(Media, THUMB_FIELD_CANDIDATES)
        poster_field = get_first_existing_attr(Media, POSTER_FIELD_CANDIDATES)
        sprites_field= get_first_existing_attr(Media, SPRITES_FIELD_CANDIDATES)

        if not any([thumb_field, poster_field, sprites_field]):
            logger.error("Could not locate any of: thumbnail/poster/sprites fields on Media.")
            logger.close(); raise CommandError("Missing fields on Media model.")

        qs = Media.objects.all().order_by("id")
        if ids_csv:
            ids = [int(x.strip()) for x in ids_csv.split(",") if x.strip().isdigit()]
            qs = qs.filter(id__in=ids)
        elif limit:
            qs = qs[:limit]

        base_iter: Iterable[Media] = qs.iterator()
        def type_ok(m: Media) -> bool:
            if only == "all": return True
            t = get_media_type(m); return (only == t)
        iterator = (m for m in base_iter if type_ok(m))

        processed=fixed=skipped=errors=0
        self.stdout.write(self.style.MIGRATE_HEADING(
            f"Scanning media item(s) (dry_run={dry_run}, force={force}, only={only}, tmpdir={tmpdir})"
        ))

        try:
            for m in iterator:
                processed += 1
                mtype = get_media_type(m)
                src   = get_media_source(m)

                if not src:
                    skipped += 1; logger.warn(f"[{m.id}] SKIPPED: no media_file path present"); continue

                try:
                    thumb_val   = getattr(m, thumb_field)   if thumb_field   else None
                    poster_val  = getattr(m, poster_field)  if poster_field  else None
                    sprites_val = getattr(m, sprites_field) if sprites_field else None

                    if mtype == "image":
                        # IMAGE: ensure listing thumbnail AND poster
                        t_path = resolve_target_path(thumb_val, fallback_thumb_path, m.id)
                        need_thumb = force or (not storage_exists(t_path))

                        p_path = resolve_target_path(poster_val, fallback_poster_path, m.id) if poster_field else None
                        need_poster = poster_field and (force or (not storage_exists(p_path)))

                        # If neither thumb nor poster needs work, skip
                        if not (need_thumb or need_poster):
                            skipped += 1
                            logger.info(
                                f"[{m.id}] SKIPPED: image thumb/poster already exist "
                                f"(thumb='{as_storage_path(t_path)}', poster='{as_storage_path(p_path) if p_path else None}')"
                            )
                        else:
                            if dry_run:
                                skipped += 1
                                logger.info(
                                    f"[{m.id}] DRY-RUN: would gen image "
                                    f"{'thumb ' if need_thumb else ''}"
                                    f"{'and ' if need_thumb and need_poster else ''}"
                                    f"{'poster' if need_poster else ''} "
                                    f"(thumb='{as_storage_path(t_path)}', poster='{as_storage_path(p_path) if p_path else None}')"
                                )
                            else:
                                # Generate bytes once from source
                                data = generate_image_thumbnail(src)

                                # 1) save thumbnail
                                if need_thumb and thumb_field:
                                    saved_thumb = save_bytes_to_storage(t_path, data)
                                    setattr(m, thumb_field, saved_thumb)
                                    m.save(update_fields=[thumb_field])
                                    fixed += 1
                                    logger.info(
                                        f"[{m.id}] FIXED: image thumbnail -> '{saved_thumb}'"
                                    )

                                # 2) save poster (reuse same JPEG)
                                if need_poster and poster_field:
                                    saved_poster = save_bytes_to_storage(p_path, data)
                                    setattr(m, poster_field, saved_poster)
                                    m.save(update_fields=[poster_field])
                                    fixed += 1
                                    logger.info(
                                        f"[{m.id}] FIXED: image poster -> '{saved_poster}'"
                                    )

                    elif mtype in ("video","audio"):
                        # 1) POSTER
                        p_path = resolve_target_path(poster_val, fallback_poster_path, m.id)
                        need_p = force or (not storage_exists(p_path))
                        if need_p and not dry_run:
                            data_p = generate_video_poster(src, tmpdir=tmpdir, logger=logger)
                            saved_p = save_bytes_to_storage(p_path, data_p)
                            if poster_field: setattr(m, poster_field, saved_p); m.save(update_fields=[poster_field])
                            fixed += 1; logger.info(f"[{m.id}] FIXED: {mtype} poster -> '{saved_p}'")
                        else:
                            skipped += 1; logger.info(f"[{m.id}] SKIPPED: {mtype} poster exists '{as_storage_path(p_path)}'")

                        # 2) VIDEO THUMB (small) — derive from poster if we just made it or if poster exists
                        if mtype == "video" and thumb_field:
                            t_path = resolve_target_path(thumb_val, fallback_thumb_path, m.id)
                            need_t = force or (not storage_exists(t_path))
                            if need_t:
                                if dry_run:
                                    skipped += 1; logger.info(f"[{m.id}] DRY-RUN: would gen video thumb -> '{as_storage_path(t_path)}'")
                                else:
                                    # Source for small thumb: poster if available, else direct frame
                                    poster_ready = storage_exists(p_path)
                                    poster_bytes = None
                                    if poster_ready:
                                        with default_storage.open(as_storage_path(p_path), "rb") as f: poster_bytes = f.read()
                                    if not poster_bytes:
                                        poster_bytes = generate_video_poster(src, tmpdir=tmpdir, logger=logger)
                                    small = downscale_jpeg_bytes(poster_bytes, VIDEO_THUMB_MAX_WIDTH)
                                    saved_t = save_bytes_to_storage(t_path, small)
                                    setattr(m, thumb_field, saved_t); m.save(update_fields=[thumb_field])
                                    fixed += 1; logger.info(f"[{m.id}] FIXED: video thumbnail -> '{saved_t}'")
                            else:
                                skipped += 1; logger.info(f"[{m.id}] SKIPPED: video thumbnail exists '{as_storage_path(t_path)}'")

                        # 3) SPRITES (video only)
                        if mtype == "video" and sprites_field:
                            s_path = resolve_target_path(sprites_val, fallback_sprites_path, m.id)
                            need_s = force or (not storage_exists(s_path))
                            if need_s:
                                if dry_run:
                                    skipped += 1; logger.info(f"[{m.id}] DRY-RUN: would gen sprites -> '{as_storage_path(s_path)}'")
                                else:
                                    data_s = generate_video_sprites(src, tmpdir=tmpdir, logger=logger)
                                    saved_s = save_bytes_to_storage(s_path, data_s)
                                    setattr(m, sprites_field, saved_s); m.save(update_fields=[sprites_field])
                                    fixed += 1; logger.info(f"[{m.id}] FIXED: sprites -> '{saved_s}'")
                            else:
                                skipped += 1; logger.info(f"[{m.id}] SKIPPED: sprites exist '{as_storage_path(s_path)}'")

                    else:
                        skipped += 1; logger.warn(f"[{m.id}] SKIPPED: unknown type '{mtype}'")

                except OSError as e:
                    errors += 1
                    if e.errno == errno.ENOSPC:
                        logger.error(f"[{m.id}] NO SPACE LEFT (errno 28). tmpdir='{tmpdir}'. Use --tmpdir or MC_REPAIR_TMPDIR.")
                    else:
                        logger.error(f"[{m.id}] error: {e}\n{traceback.format_exc()}")
                except subprocess.TimeoutExpired:
                    errors += 1; logger.error(f"[{m.id}] ffmpeg timeout after {FFMPEG_TIMEOUT_SECONDS}s")
                except subprocess.CalledProcessError as e:
                    errors += 1; logger.error(f"[{m.id}] ffmpeg error: {e}")
                except Exception as e:
                    errors += 1; logger.error(f"[{m.id}] error: {e}\n{traceback.format_exc()}")

                # Per-media cleanup: remove any stray .gif temp files (e.g. from ffmpeg)
                try:
                    cleanup_tmpdir(tmpdir, pattern="mcrepair_*.gif", logger=logger)
                except Exception as e:
                    logger.warn(f"Could not clean up .gif temp files in '{tmpdir}': {e}")


        finally:
            logger.close()

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            f"Processed: {processed} | Fixed: {fixed} | Skipped: {skipped} | Errors: {errors}"
        ))
        if errors:
            raise CommandError("One or more items failed; see errors above.")

