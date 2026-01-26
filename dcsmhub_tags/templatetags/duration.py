from django import template

register = template.Library()

@register.filter
def format_duration(seconds):
    """
    Convert integer seconds to H:MM:SS (if hours) or M:SS.
    """
    if seconds is None:
        return ""

    try:
        seconds = int(seconds)
    except (TypeError, ValueError):
        return ""

    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60

    if h > 0:
        # H:MM:SS
        return f"{h}:{m:02d}:{s:02d}"
    else:
        # M:SS
        return f"{m}:{s:02d}"

