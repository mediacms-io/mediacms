"""Starting a migration at a time somebody picked earlier.

The time lives in the migration's options and the run is a task queued with an eta, not
something a periodic sweep notices. An eta task cannot be recalled once it is out, so it
carries the time it was queued for: that is how a schedule since moved, switched off or
already used is recognised and ignored.
"""

from datetime import datetime

from django.utils import timezone
from django.utils.dateparse import parse_datetime

# recognised whatever the provider is, because when to start is not a provider's business
SCHEDULE_OPTIONS = ("schedule_enabled", "scheduled_at", "quiet_hours_enabled", "quiet_from", "quiet_to", "run_during_weekends")

SATURDAY = 5

SCHEDULE_FORMAT = "%Y-%m-%dT%H:%M"
CLOCK_FORMAT = "%H:%M"

# how long the orchestrator waits before looking again inside the quiet window. Short
# on purpose: it is all that holds the chain together, so a restart costs one cycle.
QUIET_RECHECK_SECONDS = 300


def scheduled_at_text(value):
    """A datetime as the wall clock string the form shows and the options store"""
    if not value:
        return ""
    return timezone.localtime(value).strftime(SCHEDULE_FORMAT)


def parse_scheduled_at(raw):
    """The moment a stored wall clock string refers to, or None if it says nothing.

    A string with no offset means the portal's timezone, the only clock the person picking
    a time and the worker acting on it can agree about.
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

    None whenever the window means nothing: switched off, either end unreadable, or both
    ends the same. An unreadable one lets the run proceed, since a typo that quietly halts
    a month long migration is worse than one that fails to hold it back.
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

    Wall clock in the portal's timezone, as the start schedule is. An end before its
    start runs over midnight.
    """
    window = quiet_window(options)
    if window is None:
        return False

    start, end = window
    current = timezone.localtime(now or timezone.now())
    if options.get("run_during_weekends") and current.weekday() >= SATURDAY:
        return False
    minute = current.hour * 60 + current.minute
    from_minute = start[0] * 60 + start[1]
    to_minute = end[0] * 60 + end[1]

    if from_minute < to_minute:
        return from_minute <= minute < to_minute
    return minute >= from_minute or minute < to_minute
