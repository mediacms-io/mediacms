"""Starting a migration at a time somebody picked earlier.

The time lives in the migration's own options rather than in a column of its own, and the
run is a task queued with an eta rather than something a periodic sweep notices. That task
carries the time it was queued for as an argument, which is what makes the arrangement
workable: an eta task cannot be recalled once it is out, so the argument is how a schedule
that has since been moved, switched off, or already used gets recognised and ignored.
"""

from datetime import datetime

from django.utils import timezone
from django.utils.dateparse import parse_datetime

# recognised whatever the provider is, because when to start is not a provider's business
SCHEDULE_OPTIONS = ("schedule_enabled", "scheduled_at", "quiet_hours_enabled", "quiet_from", "quiet_to")

SCHEDULE_FORMAT = "%Y-%m-%dT%H:%M"
CLOCK_FORMAT = "%H:%M"

# how long the orchestrator waits before looking again while it is inside the quiet window.
# Short on purpose: it is the only thing holding the chain together, and a worker restart
# costs one cycle rather than the rest of the run
QUIET_RECHECK_SECONDS = 300


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


def parse_clock(raw):
    """A stored "HH:MM" as (hour, minute), or None if it does not say a time"""
    text = str(raw or "").strip()
    if not text:
        return None
    try:
        parsed = datetime.strptime(text, CLOCK_FORMAT)
    except ValueError:
        return None
    return parsed.hour, parsed.minute


def quiet_window(options):
    """The (from, to) the migration must not run between, or None.

    None whenever the window would not mean anything: switched off, either end unreadable,
    or both ends the same. An unreadable window lets the migration run rather than stopping
    it, because a typo that quietly halts a month long run is far worse than one that fails
    to hold it back.
    """
    if not options.get("quiet_hours_enabled"):
        return None

    start = parse_clock(options.get("quiet_from"))
    end = parse_clock(options.get("quiet_to"))
    if start is None or end is None or start == end:
        return None
    return start, end


def in_quiet_window(options, now=None):
    """Whether the portal clock is inside the window right now.

    The window is wall clock time in the portal's own timezone, the same convention the
    start schedule uses. A window whose end is before its start runs over midnight.
    """
    window = quiet_window(options)
    if window is None:
        return False

    start, end = window
    current = timezone.localtime(now or timezone.now())
    minute = current.hour * 60 + current.minute
    from_minute = start[0] * 60 + start[1]
    to_minute = end[0] * 60 + end[1]

    if from_minute < to_minute:
        return from_minute <= minute < to_minute
    return minute >= from_minute or minute < to_minute
