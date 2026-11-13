"""Status counts for the processing overview.

Caption requests, trim requests, and migration services and records. Media
encoding status is rendered separately from the media statistics.
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

_GROUPS = (
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


def get_processing_status_groups():
    """Return per-status counts and filtered changelist links for pipeline models."""
    groups = []
    for spec in _GROUPS:
        counts = spec["model"].objects.aggregate(**{status: Count("id", filter=Q(status=status)) for status in spec["statuses"]})
        base = reverse(spec["admin_name"])
        groups.append(
            {
                "key": spec["key"],
                "label": spec["label"],
                "statuses": [
                    {
                        "key": status,
                        "label": _STATUS[status]["label"],
                        "tone": _STATUS[status]["tone"],
                        "icon": _STATUS[status]["icon"],
                        "count": counts[status],
                        "url": f"{base}?status__exact={status}",
                    }
                    for status in spec["statuses"]
                ],
            }
        )
    return groups
