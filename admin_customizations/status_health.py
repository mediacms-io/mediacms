"""Site health checks for model rows sitting in a failure status.

Media encoding failures are reported separately. These checks cover the other
models whose status choices include a failure value: trim requests, caption
requests, encode jobs, and migration services and records.
"""

from django.urls import reverse

from files.models import Encoding, TranscriptionRequest, VideoTrimRequest
from migrationservice.models import MigrationRecord, MigrationService

# warn, matching media encoding failures: the site is up, these jobs are not.
_FAILURE_STATUS = "warn"

_TARGETS = (
    {
        "check_id": "trim_request_failures",
        "label": "Trim request failures",
        "model": VideoTrimRequest,
        "lookup": {"status": "fail"},
        "admin_name": "admin:files_videotrimrequest_changelist",
        "query": "status__exact=fail",
        "problem": "{count} trim request(s) failed.",
        "ok": "No failed trim requests.",
    },
    {
        "check_id": "caption_request_failures",
        "label": "Caption request failures",
        "model": TranscriptionRequest,
        "lookup": {"status": "fail"},
        "admin_name": "admin:files_transcriptionrequest_changelist",
        "query": "status__exact=fail",
        "problem": "{count} caption request(s) failed.",
        "ok": "No failed caption requests.",
    },
    {
        "check_id": "encode_job_failures",
        "label": "Encode job failures",
        "model": Encoding,
        "lookup": {"status": "fail"},
        "admin_name": "admin:files_encoding_changelist",
        "query": "status__exact=fail",
        "problem": "{count} encode job(s) failed.",
        "ok": "No failed encode jobs.",
    },
    {
        "check_id": "migration_errors",
        "label": "Migration errors",
        "model": MigrationService,
        "lookup": {"status": "error"},
        "admin_name": "admin:migrationservice_migrationservice_changelist",
        "query": "status__exact=error",
        "problem": "{count} migration(s) ended in error.",
        "ok": "No migrations in error.",
    },
    {
        "check_id": "migration_record_failures",
        "label": "Migration record failures",
        "model": MigrationRecord,
        "lookup": {"status": "failed"},
        "admin_name": "admin:migrationservice_migrationrecord_changelist",
        "query": "status__exact=failed",
        "problem": "{count} migration record(s) failed.",
        "ok": "No failed migration records.",
    },
)


def iter_status_health_checks():
    """Yield health-check payloads for models with a failure status."""
    for target in _TARGETS:
        count = target["model"].objects.filter(**target["lookup"]).count()
        link = reverse(target["admin_name"]) + "?" + target["query"]
        if count:
            yield {
                "check_id": target["check_id"],
                "label": target["label"],
                "status": _FAILURE_STATUS,
                "detail": target["problem"].format(count=count),
                "link": link,
            }
        else:
            yield {
                "check_id": target["check_id"],
                "label": target["label"],
                "status": "ok",
                "detail": target["ok"],
                "link": link,
            }
