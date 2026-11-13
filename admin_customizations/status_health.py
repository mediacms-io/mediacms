"""Site health checks for model rows sitting in a failure status.

Media encoding failures are reported separately. These checks cover trim
requests, caption requests, and encode jobs. Migration services and records
are reported with the other integration checks.
"""

from django.urls import reverse

from files.models import Encoding, TranscriptionRequest, VideoTrimRequest

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
                "detail_template": target["problem"],
                "detail_kwargs": {"count": count},
                "link": link,
            }
        else:
            yield {
                "check_id": target["check_id"],
                "label": target["label"],
                "status": "ok",
                "detail": target["ok"],
                "detail_template": target["ok"],
                "detail_kwargs": {},
                "link": link,
            }
