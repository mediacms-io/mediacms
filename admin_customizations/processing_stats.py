"""Status counts for the processing and integrations overviews.

Caption requests and trim requests belong to Processing. Migration services
and records belong to Integrations. Media encoding status is rendered
separately from the media statistics.
"""

from django.db.models import Count, Q
from django.urls import reverse

from files.models import TranscriptionRequest, VideoTrimRequest
from migrationservice.models import MigrationRecord, MigrationService

_STATUS = {
    "pending": {"label": "Pending", "tone": "info", "icon": "fas fa-clock"},
    "initial": {"label": "Initial", "tone": "info", "icon": "fas fa-hourglass-start"},
    "running": {"label": "Running", "tone": "warning", "icon": "fas fa-spinner"},
    "paused": {"label": "Paused", "tone": "secondary", "icon": "fas fa-pause"},
    "success": {"label": "Success", "tone": "success", "icon": "fas fa-check-circle"},
    "fail": {"label": "Failed", "tone": "danger", "icon": "fas fa-times-circle"},
    "failed": {"label": "Failed", "tone": "danger", "icon": "fas fa-times-circle"},
    "error": {"label": "Error", "tone": "danger", "icon": "fas fa-times-circle"},
    "aborted": {"label": "Aborted", "tone": "secondary", "icon": "fas fa-ban"},
    "skipped": {"label": "Skipped", "tone": "warning", "icon": "fas fa-forward"},
}

_PROCESSING_GROUPS = (
    {
        "key": "caption_requests",
        "label": "Caption Requests",
        "model": TranscriptionRequest,
        "admin_name": "admin:files_transcriptionrequest_changelist",
        "statuses": ("pending", "running", "success", "fail"),
    },
    {
        "key": "trim_requests",
        "label": "Trim Requests",
        "model": VideoTrimRequest,
        "admin_name": "admin:files_videotrimrequest_changelist",
        "statuses": ("initial", "running", "success", "fail"),
    },
)

_MIGRATION_GROUPS = (
    {
        "key": "migrations",
        "label": "Migrations",
        "model": MigrationService,
        "admin_name": "admin:migrationservice_migrationservice_changelist",
        "statuses": ("pending", "running", "paused", "success", "error", "aborted"),
    },
    {
        "key": "migration_records",
        "label": "Migration records",
        "model": MigrationRecord,
        "admin_name": "admin:migrationservice_migrationrecord_changelist",
        "statuses": ("success", "failed", "skipped"),
    },
)


def _status_groups(specs):
    """Return per-status counts, totals, and filtered changelist links."""
    groups = []
    for spec in specs:
        counts = spec["model"].objects.aggregate(**{status: Count("id", filter=Q(status=status)) for status in spec["statuses"]})
        base = reverse(spec["admin_name"])
        statuses = [
            {
                "key": status,
                "label": _STATUS[status]["label"],
                "tone": _STATUS[status]["tone"],
                "icon": _STATUS[status]["icon"],
                "count": counts[status],
                "url": f"{base}?status__exact={status}",
            }
            for status in spec["statuses"]
        ]
        groups.append(
            {
                "key": spec["key"],
                "label": spec["label"],
                "total": sum(item["count"] for item in statuses),
                "statuses": statuses,
            }
        )
    return groups


def get_processing_status_groups():
    """Return caption and trim request status counts."""
    return _status_groups(_PROCESSING_GROUPS)


def get_migration_status_groups():
    """Return migration service and record status counts."""
    return _status_groups(_MIGRATION_GROUPS)
