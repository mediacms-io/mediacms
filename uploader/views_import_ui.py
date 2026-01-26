# uploader/views_import_ui.py
from __future__ import annotations

import logging
import re
import shutil
from functools import wraps
from pathlib import Path
from typing import List, Optional, Dict, Any

from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.http import JsonResponse, Http404
from django.shortcuts import render
from django.views.decorators.http import require_GET, require_POST

# Format A parser (Username/Full name/Year/Tags)
from uploader.management.commands.import_media_from_metadata import parse_metadata_txt as parse_metadata_a

# Format B parser (title line, Device/Location/Place/User/Tags, Files:)
from uploader.management.commands.import_media_batch import parse_metadata_txt as parse_metadata_b

from .models import ImportJob
from .tasks_import_from_metadata import run_import_job

logger = logging.getLogger(__name__)

IMPORT_JOB_LOG_DIR = Path("/home/mediacms.io/mediacms/logs/import_jobs").resolve()

# Format B folder name patterns:
#   yyyymmdd_day_cameratype_username
#   yyyymmdd_day_cameratype_username_category  (category optional)
FORMAT_B_DIR_PATTERN = re.compile(
    r"^(?P<date>\d{8})_(?P<day>[a-z]{3})_(?P<camera>[^_]+)_(?P<username>[^_]+)(?:_(?P<category>.+))?$",
    re.IGNORECASE,
)


def superuser_required_403(view_func):
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        logger.warning(
            "IMPORT_UI GUARD HIT: path=%s user=%s auth=%s superuser=%s staff=%s active=%s",
            request.path,
            getattr(request.user, "username", "<anon>"),
            getattr(request.user, "is_authenticated", False),
            getattr(request.user, "is_superuser", False),
            getattr(request.user, "is_staff", False),
            getattr(request.user, "is_active", False),
        )
        if not getattr(request.user, "is_authenticated", False) or not getattr(request.user, "is_superuser", False):
            raise PermissionDenied("Superuser required")
        return view_func(request, *args, **kwargs)

    return _wrapped


def _source_root() -> Path:
    root = getattr(settings, "MEDIA_INGEST_SOURCE_ROOT", None)
    if root is None:
        raise RuntimeError("MEDIA_INGEST_SOURCE_ROOT is not configured")
    return Path(root).resolve()


def _safe_join(rel_path: str) -> Path:
    root = _source_root()
    rel = (rel_path or "").lstrip("/")
    candidate = (root / rel).resolve()
    try:
        candidate.relative_to(root)
    except Exception:
        raise Http404("Invalid path")
    return candidate


def _is_browsable_dir(p: Path) -> bool:
    if p.is_symlink():
        return False
    return p.exists() and p.is_dir()


def _ensure_log_dir() -> None:
    IMPORT_JOB_LOG_DIR.mkdir(parents=True, exist_ok=True)


def _tail_file_bytes(path: Path, max_lines: int = 200) -> List[str]:
    max_lines = max(10, min(max_lines, 5000))
    try:
        with path.open("rb") as f:
            f.seek(0, 2)
            end = f.tell()
            block = 8192
            data = b""
            pos = end

            while pos > 0 and data.count(b"\n") <= (max_lines + 5):
                read_size = block if pos >= block else pos
                pos -= read_size
                f.seek(pos)
                data = f.read(read_size) + data

            text = data.decode("utf-8", errors="replace")
            lines = text.splitlines()
            return lines[-max_lines:]
    except Exception:
        text = path.read_text(encoding="utf-8", errors="replace")
        return text.splitlines()[-max_lines:]


def _find_metadata_file(folder: Path) -> Optional[Path]:
    for child in folder.iterdir():
        if child.is_file() and child.name.lower() == "metadata.txt":
            return child
    return None


def _folder_matches_format_b(folder: Path) -> Optional[Dict[str, str]]:
    m = FORMAT_B_DIR_PATTERN.match(folder.name or "")
    if not m:
        return None
    d = m.groupdict()
    # normalize keys to strings (None stays None)
    return {k: (v if v is not None else "") for k, v in d.items()}


def _looks_like_format_a(text: str, parsed_a: Dict[str, Any]) -> bool:
    """
    Heuristic: if metadata contains any of the Format A keys/fields,
    treat it as Format A (even if incomplete).
    """
    t = (text or "").lower()
    if "year:" in t or "full name:" in t or "username:" in t:
        return True

    # Parsed A values also count as "looks like A"
    if (parsed_a.get("year") or "").strip():
        return True
    if (parsed_a.get("full_name") or "").strip():
        return True
    if (parsed_a.get("username") or "").strip():
        return True

    return False


def _validate_format_a(meta_path: Path) -> dict:
    data = parse_metadata_a(meta_path)
    errors = []

    username = (data.get("username") or "").strip()
    full_name = (data.get("full_name") or "").strip()
    year = (data.get("year") or "").strip()
    tags = data.get("tags") or []

    if not username:
        errors.append("Missing 'Username:' in metadata.txt.")
    if not full_name:
        errors.append("Missing 'Full name:' in metadata.txt.")
    if not year:
        errors.append("Missing 'Year:' in metadata.txt.")
    elif not (len(year) == 4 and year.isdigit()):
        errors.append("Year must be a 4-digit number (e.g., 2003).")
    if not tags:
        errors.append("Missing 'Tags:' (must contain at least one tag; use ';' separators).")

    if errors:
        return {"ok": False, "format": "A", "errors": errors}

    return {
        "ok": True,
        "format": "A",
        "metadata": {
            "username": username,
            "full_name": full_name,
            "year": year,
            "tags": tags,
        },
        "metadata_file": str(meta_path),
    }


def _validate_format_b(folder: Path, meta_path: Path) -> dict:
    # folder must match pattern
    folder_parts = _folder_matches_format_b(folder)
    if not folder_parts:
        return {
            "ok": False,
            "format": "B",
            "errors": [
                "Folder name does not match Format B patterns:",
                "  - yyyymmdd_day_cameratype_username",
                "  - yyyymmdd_day_cameratype_username_category",
            ],
        }

    data = parse_metadata_b(meta_path)
    errors = []

    title = (data.get("title") or "").strip()
    user_fullname = (data.get("user_fullname") or "").strip()
    tags = data.get("tags") or []
    files = data.get("files") or []

    # Basic sanity checks for Format B
    if not title:
        errors.append("Format B metadata.txt missing a title line (first non-empty line).")
    if not user_fullname:
        errors.append("Format B metadata.txt missing 'User: Full Name'.")
    if not tags:
        errors.append("Format B metadata.txt missing 'Tags:' (use ';' separators).")
    if not files:
        errors.append("Format B metadata.txt missing 'Files:' list (at least one file).")

    if errors:
        return {"ok": False, "format": "B", "errors": errors}

    return {
        "ok": True,
        "format": "B",
        "folder": {
            "name": folder.name,
            "date": folder_parts.get("date", ""),
            "day": folder_parts.get("day", ""),
            "camera": folder_parts.get("camera", ""),
            "username": folder_parts.get("username", ""),
            "category": folder_parts.get("category", ""),
        },
        "metadata": {
            "title": title,
            "user_fullname": user_fullname,
            "tags": tags,
            "device": data.get("device", ""),
            "location": data.get("location", ""),
            "place": data.get("place", ""),
            "files_count": len(files),
        },
        "metadata_file": str(meta_path),
    }


def _validate_metadata(folder: Path) -> dict:
    meta_path = _find_metadata_file(folder)
    if meta_path is None:
        return {"ok": False, "errors": ["metadata.txt not found in selected folder."]}

    # Read for format detection heuristics
    try:
        raw_text = meta_path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        raw_text = ""

    parsed_a = parse_metadata_a(meta_path)
    folder_is_b = _folder_matches_format_b(folder) is not None
    looks_a = _looks_like_format_a(raw_text, parsed_a)

    # --- Your requested rule ---
    # If folder name doesn't match AND metadata is missing Full name and Year -> fail.
    # Otherwise, if missing Full name/Year but folder matches -> go Format B.    
    full_name_present = bool((parsed_a.get("full_name") or "").strip())
    year_present = bool((parsed_a.get("year") or "").strip())

    if looks_a:
        # Treat as Format A (even if incomplete); return A errors if missing.
        # This preserves expected behavior if someone is trying to use Format A.
        # BUT: If it's incomplete (missing full_name/year) and folder matches B,
        # your rule says: accept missing full_name/year if folder matches -> go B.
        if folder_is_b and (not full_name_present or not year_present):
            report = _validate_format_b(folder, meta_path)
        else:
            report = _validate_format_a(meta_path)
    else:
        # Not A-looking:
        if folder_is_b:
            report = _validate_format_b(folder, meta_path)
        else:
            if (not full_name_present) or (not year_present):
                errs = []
                if not full_name_present:
                    errs.append("Missing 'Full name:' in metadata.txt (required unless folder name matches Format B).")
                if not year_present:
                    errs.append("Missing 'Year:' in metadata.txt (required unless folder name matches Format B).")
                report = {"ok": False, "errors": errs}
            else:
                report = _validate_format_a(meta_path)

    # Always include the preview so the UI can display what we actually parsed
    report["metadata_file"] = str(meta_path)
    report["metadata_preview"] = _read_text_preview(meta_path)

    return report


def _read_text_preview(path: Path, max_bytes: int = 200_000, max_lines: int = 5000) -> Dict[str, Any]:
    """
    Returns a safe preview of a text file for UI display.
    - Hard limit on bytes (default ~200KB)
    - Hard limit on lines
    - UTF-8 decode with replacement
    """
    max_bytes = max(10_000, min(max_bytes, 1_000_000))
    max_lines = max(10, min(max_lines, 20_000))

    raw = b""
    try:
        raw = path.read_bytes()
    except Exception as e:
        return {"ok": False, "error": f"Unable to read file: {e}"}

    truncated = False
    if len(raw) > max_bytes:
        raw = raw[:max_bytes]
        truncated = True

    text = raw.decode("utf-8", errors="replace")
    lines = text.splitlines()

    if len(lines) > max_lines:
        lines = lines[:max_lines]
        truncated = True

    # Optional: add line numbers for UI rendering convenience
    numbered = [{"n": i + 1, "t": line} for i, line in enumerate(lines)]

    return {
        "ok": True,
        "truncated": truncated,
        "max_bytes": max_bytes,
        "max_lines": max_lines,
        "text": "\n".join(lines),
        "lines": numbered,
    }


# ---------------- Pages ----------------

@superuser_required_403
def import_from_metadata_page(request):
    return render(
        request,
        "uploader/import_from_metadata.html",
        {"source_root": str(_source_root())},
    )


@superuser_required_403
def import_jobs_page(request):
    return render(request, "uploader/import_jobs.html", {})


# ---------------- APIs ----------------

@superuser_required_403
@require_GET
def import_ui_list_dirs(request):
    rel = request.GET.get("path", "")
    folder = _safe_join(rel)
    if not _is_browsable_dir(folder):
        raise Http404("Folder not found")

    dirs = []
    files = []

    for p in sorted(folder.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
        if p.is_symlink():
            continue

        try:
            relpath = str(p.relative_to(_source_root()))
        except Exception:
            continue

        if p.is_dir():
            if _is_browsable_dir(p):
                dirs.append({"name": p.name, "path": relpath})
        elif p.is_file():
            try:
                stat = p.stat()
                files.append({"name": p.name, "path": relpath, "size": stat.st_size, "mtime": int(stat.st_mtime)})
            except Exception:
                files.append({"name": p.name, "path": relpath, "size": None, "mtime": None})

    return JsonResponse(
        {
            "ok": True,
            "current": str(folder.relative_to(_source_root())),
            "dirs": sorted(dirs, key=lambda x: x["name"].lower()),
            "files": sorted(files, key=lambda x: x["name"].lower()),
        }
    )


@superuser_required_403
@require_GET
def import_ui_validate(request):
    rel = request.GET.get("path", "")
    folder = _safe_join(rel)
    if not _is_browsable_dir(folder):
        raise Http404("Folder not found")
    return JsonResponse(_validate_metadata(folder))


@superuser_required_403
@require_POST
def import_ui_create_metadata_a(request):
    rel = request.POST.get("path", "")
    folder = _safe_join(rel)
    if not _is_browsable_dir(folder):
        raise Http404("Folder not found")

    # Do not overwrite existing metadata.txt
    existing = _find_metadata_file(folder)
    if existing is not None:
        return JsonResponse(
            {"ok": False, "errors": ["metadata.txt already exists in this folder."]},
            status=400,
        )

    username = (request.POST.get("username") or "").strip()
    full_name = (request.POST.get("full_name") or "").strip()
    year = (request.POST.get("year") or "").strip()
    tags_raw = (request.POST.get("tags") or "").strip()

    # Server-side validation mirrors Format A expectations
    errors = []
    if not username:
        errors.append("Username is required.")
    if not full_name:
        errors.append("Full name is required.")
    if not year:
        errors.append("Year is required.")
    elif not (len(year) == 4 and year.isdigit()):
        errors.append("Year must be a 4-digit number (e.g., 2003).")

    # Normalize tags: allow comma OR semicolon input; write semicolons
    tags = [t.strip() for t in re.split(r"[;,]", tags_raw) if t.strip()]
    if not tags:
        errors.append("Tags are required (at least one).")

    if errors:
        return JsonResponse({"ok": False, "errors": errors}, status=400)

    meta_path = (folder / "metadata.txt").resolve()
    try:
        meta_path.relative_to(folder.resolve())
    except Exception:
        raise PermissionDenied("Invalid metadata path")

    content = (
        f"Username: {username}\n"
        f"Full name: {full_name}\n"
        f"Year: {year}\n"
        f"Tags: {'; '.join(tags)}\n"
    )

    try:
        meta_path.write_text(content, encoding="utf-8")
    except Exception as e:
        return JsonResponse({"ok": False, "errors": [f"Failed to write metadata.txt: {e}"]}, status=500)

    # Return a fresh validation report so the UI can “auto-validate”
    report = _validate_metadata(folder)  # includes preview when file exists :contentReference[oaicite:2]{index=2}
    report["created"] = True
    return JsonResponse(report)


@superuser_required_403
@require_POST
def import_ui_update_tags(request):
    rel = (request.POST.get("path") or "").strip()
    folder = _safe_join(rel)
    if not _is_browsable_dir(folder):
        raise Http404("Folder not found")

    meta_path = _find_metadata_file(folder)
    if meta_path is None or not meta_path.exists():
        return JsonResponse({"ok": False, "errors": ["metadata.txt not found in selected folder."]}, status=400)

    # Must not overwrite an existing ORIGINAL file
    original_path = (folder / "metadata.ORIGINAL").resolve()
    try:
        original_path.relative_to(folder.resolve())
    except Exception:
        raise PermissionDenied("Invalid ORIGINAL path")

    # Read new tags from request
    tags_raw = (request.POST.get("tags") or "").strip()

    # Normalize tags: allow comma OR semicolon input; write semicolons
    tags = [t.strip() for t in re.split(r"[;,]", tags_raw) if t.strip()]
    if not tags:
        return JsonResponse({"ok": False, "errors": ["Tags are required (at least one)."]}, status=400)

    # Copy metadata.txt -> metadata.ORIGINAL (first!)
    try:
        shutil.copyfile(str(meta_path), str(original_path))
    except Exception as e:
        return JsonResponse({"ok": False, "errors": [f"Failed to create metadata.ORIGINAL: {e}"]}, status=500)

    # Replace the "Tags:" line (case-insensitive, first match)
    try:
        text = meta_path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        return JsonResponse({"ok": False, "errors": [f"Failed to read metadata.txt: {e}"]}, status=500)

    new_line = f"Tags: {'; '.join(tags)}"
    tag_line_re = re.compile(r"^(?P<prefix>\s*Tags\s*:\s*).*$", re.IGNORECASE | re.MULTILINE)

    if not tag_line_re.search(text):
        return JsonResponse(
            {"ok": False, "errors": ["metadata.txt does not contain a 'Tags:' line to update."]},
            status=400,
        )

    updated_text = tag_line_re.sub(new_line, text, count=1)

    try:
        meta_path.write_text(updated_text, encoding="utf-8")
    except Exception as e:
        return JsonResponse({"ok": False, "errors": [f"Failed to write metadata.txt: {e}"]}, status=500)

    # Return a fresh validation report so the UI can re-render preview + state
    report = _validate_metadata(folder)
    report["updated_tags"] = True
    report["original_saved_as"] = str(original_path)
    return JsonResponse(report)


@superuser_required_403
@require_POST
def import_ui_run(request):
    rel = request.POST.get("path", "")
    folder = _safe_join(rel)
    if not _is_browsable_dir(folder):
        raise Http404("Folder not found")

    report = _validate_metadata(folder)
    if not report.get("ok"):
        return JsonResponse(report, status=400)

    _ensure_log_dir()

    job = ImportJob.objects.create(
        created_by=request.user,
        source_folder=str(folder),
        status="queued",
    )

    # set output_file deterministically (requires ImportJob.output_file)
    log_path = (IMPORT_JOB_LOG_DIR / f"import_job_{job.id}.log").resolve()
    try:
        log_path.relative_to(IMPORT_JOB_LOG_DIR)
    except Exception:
        raise PermissionDenied("Invalid log path")

    job.output_file = str(log_path)
    job.save(update_fields=["output_file"])

    # Route to the correct command
    fmt = (report.get("format") or "A").upper()
    if fmt == "B":
        command_name = "import_media_batch"
    else:
        command_name = "import_media_from_metadata"

    run_import_job.delay(job.id, str(folder), command_name)
    return JsonResponse({"ok": True, "job_id": job.id, "format": fmt, "command": command_name})


@superuser_required_403
@require_GET
def import_ui_job_status(request, job_id: int):
    try:
        job = ImportJob.objects.get(id=job_id)
    except ImportJob.DoesNotExist:
        raise Http404("Job not found")

    return JsonResponse(
        {
            "ok": True,
            "job": {
                "id": job.id,
                "status": job.status,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "finished_at": job.finished_at.isoformat() if job.finished_at else None,
                "source_folder": job.source_folder,
                "created_by": getattr(job.created_by, "username", None)
                if getattr(job, "created_by_id", None)
                else None,
                "error": job.error or "",
                "output_file": getattr(job, "output_file", "") or "",
            },
        }
    )


@superuser_required_403
@require_GET
def import_ui_list_jobs(request):
    def job_to_dict(j: ImportJob):
        return {
            "id": j.id,
            "status": j.status,
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "started_at": j.started_at.isoformat() if j.started_at else None,
            "finished_at": j.finished_at.isoformat() if j.finished_at else None,
            "source_folder": j.source_folder,
            "created_by": getattr(j.created_by, "username", None) if getattr(j, "created_by_id", None) else None,
            "error": j.error or "",
        }

    queued = list(ImportJob.objects.filter(status="queued").order_by("created_at"))
    running = list(ImportJob.objects.filter(status__in=["in_progress", "running"]).order_by("created_at"))
    failed = list(ImportJob.objects.filter(status="failed").order_by("created_at"))
    finished = list(ImportJob.objects.filter(status__in=["finished", "success"]).order_by("-created_at"))

    return JsonResponse(
        {
            "ok": True,
            "queued": [job_to_dict(j) for j in queued],
            "in_progress": [job_to_dict(j) for j in running],
            "failed": [job_to_dict(j) for j in failed],
            "finished": [job_to_dict(j) for j in finished],
        }
    )


@superuser_required_403
@require_POST
def import_ui_requeue(request, job_id: int):
    try:
        job = ImportJob.objects.get(id=job_id)
    except ImportJob.DoesNotExist:
        raise Http404("Job not found")

    if job.status not in ("failed", "queued"):
        return JsonResponse({"ok": False, "error": "Job is not eligible for requeue."}, status=400)

    job.status = "queued"
    job.error = ""
    job.started_at = None
    job.finished_at = None
    job.output = ""
    job.save(update_fields=["status", "error", "started_at", "finished_at", "output"])

    # NOTE: requeue does not know which format it was.
    # Safer default: infer again from folder at time of requeue.
    folder = Path(job.source_folder)
    report = _validate_metadata(folder)
    fmt = (report.get("format") or "A").upper() if report.get("ok") else "A"
    command_name = "import_media_batch" if fmt == "B" else "import_media_from_metadata"

    run_import_job.delay(job.id, job.source_folder, command_name)
    return JsonResponse({"ok": True, "job_id": job.id, "format": fmt, "command": command_name})


@superuser_required_403
@require_GET
def import_ui_job_log(request, job_id: int):
    try:
        job = ImportJob.objects.get(id=job_id)
    except ImportJob.DoesNotExist:
        raise Http404("Job not found")

    tail = int(request.GET.get("tail", "200") or "200")
    tail = max(10, min(tail, 5000))

    log_path_str = (getattr(job, "output_file", "") or "").strip()
    if not log_path_str:
        return JsonResponse({"ok": True, "job_id": job.id, "log_file": "", "lines": []})

    log_path = Path(log_path_str).resolve()

    try:
        log_path.relative_to(IMPORT_JOB_LOG_DIR)
    except Exception:
        raise PermissionDenied("Invalid log path")

    if not log_path.exists() or not log_path.is_file():
        return JsonResponse({"ok": True, "job_id": job.id, "log_file": str(log_path), "lines": []})

    lines = _tail_file_bytes(log_path, max_lines=tail)
    return JsonResponse({"ok": True, "job_id": job.id, "log_file": str(log_path), "lines": lines})

