# uploader/tasks_import_from_metadata.py
from __future__ import annotations

import logging
import os
import socket
import threading
from pathlib import Path
from typing import Optional, Tuple

from celery import shared_task
from django.core.management import call_command
from django.utils import timezone

from .models import ImportJob

logger = logging.getLogger(__name__)

IMPORT_JOB_LOG_DIR = Path("/home/mediacms.io/mediacms/logs/import_jobs").resolve()
HEARTBEAT_SECS = 30


def _ensure_log_dir() -> None:
    IMPORT_JOB_LOG_DIR.mkdir(parents=True, exist_ok=True)


def _job_log_path(job_id: int) -> Path:
    return (IMPORT_JOB_LOG_DIR / f"import_job_{job_id}.log").resolve()


def _safe_log_path(p: Path) -> Path:
    """
    Enforce that log file is under IMPORT_JOB_LOG_DIR.
    """
    rp = p.resolve()
    rp.relative_to(IMPORT_JOB_LOG_DIR)  # raises if not under dir
    return rp


class FlushStream:
    """
    File-like stream that flushes on every write so tailing shows live progress.
    """

    def __init__(self, fh):
        self.fh = fh

    def write(self, s: str) -> int:
        if s is None:
            return 0
        self.fh.write(s)
        self.fh.flush()
        return len(s)

    def flush(self) -> None:
        self.fh.flush()

    @property
    def encoding(self):
        return getattr(self.fh, "encoding", "utf-8")

    def isatty(self) -> bool:
        return False


def _write_line(fh, msg: str = "") -> None:
    fh.write(msg.rstrip("\n") + "\n")
    fh.flush()


def _start_heartbeat(
    fh,
    stop_evt: threading.Event,
    *,
    job_id: int,
    folder: str,
    task_id: str,
    started_at_iso: str,
) -> threading.Thread:
    def _run():
        while not stop_evt.wait(HEARTBEAT_SECS):
            now = timezone.now()
            _write_line(
                fh,
                f"[HB] t={now.isoformat()} job={job_id} task_id={task_id} folder={folder} started_at={started_at_iso}",
            )

    t = threading.Thread(target=_run, name=f"import_job_{job_id}_heartbeat", daemon=True)
    t.start()
    return t


def _resume_check(log_path: Path) -> Tuple[bool, str]:
    """
    Decide whether we *should* try resume behavior based on existing log contents.

    We deliberately use a cheap heuristic:
      - log exists
      - size > 0
      - contains 'Imported:' at least once

    Returns: (resume_bool, human_reason)
    """
    try:
        if not log_path.exists():
            return False, "log_missing"
        if not log_path.is_file():
            return False, "log_not_file"
        size = log_path.stat().st_size
        if size <= 0:
            return False, "log_empty"
        # Read a bounded amount from end to avoid huge logs
        # (still enough to capture recent "Imported:" lines)
        data = ""
        try:
            with log_path.open("rb") as f:
                f.seek(0, 2)
                end = f.tell()
                back = min(end, 512 * 1024)  # last 512KB
                f.seek(end - back)
                data = f.read(back).decode("utf-8", errors="replace")
        except Exception:
            data = log_path.read_text(encoding="utf-8", errors="replace")

        if "Imported:" in data:
            return True, "found_imported_marker"
        return False, "no_imported_marker"
    except Exception as e:
        return False, f"resume_check_error:{type(e).__name__}"


def _call_command_with_optional_resume(
    *,
    command_name: str,
    folder: str,
    resume: bool,
    log_path: Path,
    stdout,
    stderr,
    fh_for_log,
) -> None:
    """
    Try to call a management command.
    If resume=True, try passing '--resume-log <path>' first.
    If the command doesn't support it, log and retry without resume args.
    """
    if not resume:
        call_command(command_name, folder, stdout=stdout, stderr=stderr)
        return

    # Attempt resume args first
    try:
        call_command(
            command_name,
            folder,
            "--resume-log",
            str(log_path),
            stdout=stdout,
            stderr=stderr,
        )
        return
    except Exception as e:
        msg = str(e) or ""
        # Common signatures when argparse rejects unknown option
        unsupported = (
            "--resume-log" in msg
            and ("unrecognized arguments" in msg.lower() or "unknown option" in msg.lower())
        )
        if unsupported:
            _write_line(
                fh_for_log,
                f"[WARN] Command '{command_name}' does not support --resume-log; retrying without resume args.",
            )
            call_command(command_name, folder, stdout=stdout, stderr=stderr)
            return
        # Otherwise, real error: propagate
        raise


@shared_task(bind=True)
def run_import_job(self, job_id: int, folder: str, command_name: str):
    """
    Generic job runner that writes logs + heartbeat and calls a management command.

    Supported commands (by convention):
      - import_media_from_metadata
      - import_media_batch
    """
    job = ImportJob.objects.get(id=job_id)

    _ensure_log_dir()

    # Keep using existing log file if already set (critical for resume).
    existing_log = Path((job.output_file or "").strip()) if (job.output_file or "").strip() else None
    if existing_log:
        log_path = _safe_log_path(existing_log)
    else:
        log_path = _safe_log_path(_job_log_path(job.id))
        job.output_file = str(log_path)

    resume, resume_reason = _resume_check(log_path)

    job.status = "in_progress"
    job.started_at = timezone.now()
    job.save(update_fields=["output_file", "status", "started_at"])

    hostname = socket.gethostname()
    pid = os.getpid()
    task_id = getattr(getattr(self, "request", None), "id", None) or "unknown"

    with open(log_path, "a", encoding="utf-8", buffering=1) as fh:
        _write_line(fh, "=" * 72)
        _write_line(fh, f"[START] ImportJob {job.id} started_at={job.started_at.isoformat()} folder={folder}")
        _write_line(
            fh,
            f"[CTX] hostname={hostname} pid={pid} celery_task_id={task_id} "
            f"command={command_name} resume={'true' if resume else 'false'}",
        )
        _write_line(fh, f"[RESUMECHK] reason={resume_reason} log={str(log_path)}")
        if resume:
            _write_line(fh, f"[RESUME] Using resume_log={str(log_path)}")
        _write_line(fh, "=" * 72)

        stop_evt = threading.Event()
        hb_thread = _start_heartbeat(
            fh,
            stop_evt,
            job_id=job.id,
            folder=folder,
            task_id=str(task_id),
            started_at_iso=job.started_at.isoformat(),
        )

        out = FlushStream(fh)
        err = FlushStream(fh)

        try:
            _call_command_with_optional_resume(
                command_name=command_name,
                folder=folder,
                resume=resume,
                log_path=log_path,
                stdout=out,
                stderr=err,
                fh_for_log=fh,
            )

            stop_evt.set()

            job.status = "finished"
            job.finished_at = timezone.now()
            job.save(update_fields=["status", "finished_at"])

            _write_line(fh, "")
            _write_line(fh, f"[OK] ImportJob {job.id} completed at {job.finished_at.isoformat()}")
        except Exception as e:
            stop_evt.set()
            logger.exception("Import failed job_id=%s command=%s", job_id, command_name)

            job.status = "failed"
            job.finished_at = timezone.now()
            job.error = str(e)
            job.save(update_fields=["status", "finished_at", "error"])

            _write_line(fh, "")
            _write_line(fh, f"[FAIL] ImportJob {job.id} failed at {job.finished_at.isoformat()}")
            _write_line(fh, f"[FAIL] {type(e).__name__}: {e}")
            raise
        finally:
            try:
                hb_thread.join(timeout=1.0)
            except Exception:
                pass


# --------------------------------------------------------------------
# Wrapper tasks that your views_import_ui.py expects to import & call
# --------------------------------------------------------------------

@shared_task(bind=True)
def run_import_media_from_metadata(self, job_id: int, folder: str):
    """
    Wrapper for the legacy metadata importer.
    """
    return run_import_job(self, job_id, folder, "import_media_from_metadata")


@shared_task(bind=True)
def run_import_media_batch(self, job_id: int, folder: str):
    """
    Wrapper for the batch importer (folder pattern + new metadata format).
    """
    return run_import_job(self, job_id, folder, "import_media_batch")

