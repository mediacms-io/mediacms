"""Starting a migration at a time somebody picked earlier.

The time lives in the migration's own options rather than in a column of its own, and the
run is a task queued with an eta rather than something a periodic sweep notices. That task
carries the time it was queued for as an argument, which is what makes the arrangement
workable: an eta task cannot be recalled once it is out, so the argument is how a schedule
that has since been moved, switched off, or already used gets recognised and ignored.
"""

from django.utils import timezone
from django.utils.dateparse import parse_datetime

# recognised whatever the provider is, because when to start is not a provider's business
SCHEDULE_OPTIONS = ("schedule_enabled", "scheduled_at")

SCHEDULE_FORMAT = "%Y-%m-%dT%H:%M"


def scheduled_at_text(value):
    """A datetime as the wall clock string the form shows and the options store"""
    if not value:
        return ""
    return timezone.localtime(value).strftime(SCHEDULE_FORMAT)


def parse_scheduled_at(raw):
    """The moment a stored wall clock string refers to, or None if it says nothing.

    A string with no offset means the portal's own timezone, which is the only clock the
    person picking a time and the worker acting on it can both agree about. A browser knows
    its own timezone and nothing about the portal's, so it is not consulted.
    """
    text = str(raw or "").strip()
    if not text:
        return None

    parsed = parse_datetime(text)
    if parsed is None:
        return None
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed
