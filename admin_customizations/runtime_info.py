"""Runtime facts for the admin System page. Distinct from portal settings."""

import importlib
import os
import shutil
import subprocess
import sys
from urllib.parse import urlsplit, urlunsplit

from django.conf import settings

SAFE_ENV_KEYS = frozenset(
    {
        "PATH",
        "PYTHONPATH",
        "VIRTUAL_ENV",
        "DJANGO_SETTINGS_MODULE",
        "LANG",
        "TZ",
        "USER",
        "HOME",
        "HOSTNAME",
    }
)

_PACKAGE_MODULES = (
    ("Django", "django"),
    ("Celery", "celery"),
    ("psycopg", "psycopg"),
    ("redis", "redis"),
)

_binary_cache = {}


def strip_userinfo(raw):
    """Return a URL without username or password."""
    text = str(raw or "").strip()
    if not text:
        return ""
    parts = urlsplit(text)
    if not parts.scheme or not parts.hostname:
        return "(redacted)" if "@" in text else text
    host = parts.hostname
    if ":" in host and not host.startswith("["):
        host = f"[{host}]"
    port = f":{parts.port}" if parts.port else ""
    return urlunsplit((parts.scheme, f"{host}{port}", parts.path or "", "", ""))


def environment_rows(environ=None):
    """List environment variables. Only an allowlist keeps its value."""
    source = os.environ if environ is None else environ
    rows = []
    for key in sorted(source):
        value = source.get(key, "")
        if key in SAFE_ENV_KEYS:
            shown = value if value else "(empty)"
            translate = False
        elif value:
            shown = "(set)"
            translate = False
        else:
            shown = "(empty)"
            translate = False
        rows.append({"group": "Environment", "label": key, "value": shown, "translate": translate})
    return rows


def describe_binary(command):
    """Resolve a command and read its first version line."""
    cached = _binary_cache.get(command)
    if cached is not None:
        return cached
    resolved = shutil.which(command) or ""
    if not resolved:
        text = f"{command} (not found)"
    else:
        try:
            completed = subprocess.run(
                [resolved, "-version"],
                capture_output=True,
                text=True,
                timeout=1,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired):
            text = f"{resolved} (version unavailable)"
        else:
            output = (completed.stdout or completed.stderr or "").strip()
            first = output.splitlines()[0] if output else "version unavailable"
            text = f"{resolved} - {first}"
    _binary_cache[command] = text
    return text


def _package_version(module_name):
    try:
        module = importlib.import_module(module_name)
    except Exception:
        return "not installed"
    version = getattr(module, "__version__", None)
    if version is None and hasattr(module, "get_version"):
        version = module.get_version()
    if not version:
        return "installed"
    return str(version).splitlines()[0]


def _database_rows():
    engine = str(settings.DATABASES.get("default", {}).get("ENGINE", "")).rsplit(".", 1)[-1] or "unknown"
    server_version = "unavailable"
    try:
        from django.db import connection

        connection.ensure_connection()
        if connection.vendor == "postgresql":
            with connection.cursor() as cursor:
                cursor.execute("SHOW server_version")
                row = cursor.fetchone()
                server_version = row[0] if row else "unavailable"
        elif connection.vendor == "sqlite":
            server_version = connection.Database.sqlite_version
    except Exception:
        server_version = "unavailable"
    return [
        {"group": "Database", "label": "Engine", "value": engine, "translate": True},
        {"group": "Database", "label": "Server version", "value": str(server_version), "translate": True},
    ]


def _row(group, label, value, translate=True):
    return {"group": group, "label": label, "value": str(value), "translate": translate}


def get_system_runtime_rows():
    """Collect process, binary, path, and environment facts for troubleshooting."""
    settings_module = os.environ.get("DJANGO_SETTINGS_MODULE") or ""
    broker = strip_userinfo(getattr(settings, "BROKER_URL", "") or "")
    cache_backend = str(settings.CACHES.get("default", {}).get("BACKEND", ""))
    rows = [
        _row("Python", "Executable", sys.executable, translate=True),
        _row("Python", "Version", " ".join(sys.version.split()), translate=True),
        _row("Python", "Prefix", sys.prefix, translate=True),
    ]
    for label, module_name in _PACKAGE_MODULES:
        rows.append(_row("Packages", label, _package_version(module_name), translate=False))
    rows.extend(
        [
            _row("Process", "PID", os.getpid(), translate=True),
            _row("Process", "User", _current_user(), translate=True),
            _row("Process", "Working directory", os.getcwd(), translate=True),
            _row("Process", "Settings module", settings_module or "(empty)", translate=True),
            _row("Process", "Time zone", getattr(settings, "TIME_ZONE", ""), translate=True),
            _row("Process", "DEBUG", getattr(settings, "DEBUG", False), translate=False),
        ]
    )
    rows.extend(_database_rows())
    rows.append(_row("Cache", "Backend", cache_backend.rsplit(".", 1)[-1], translate=True))
    rows.append(_row("Celery", "Broker", broker or "(empty)", translate=True))
    rows.append(_row("Binaries", "ffmpeg", describe_binary(getattr(settings, "FFMPEG_COMMAND", "ffmpeg")), translate=False))
    rows.append(_row("Binaries", "ffprobe", describe_binary(getattr(settings, "FFPROBE_COMMAND", "ffprobe")), translate=False))
    rows.extend(
        [
            _row("Paths", "BASE_DIR", getattr(settings, "BASE_DIR", ""), translate=False),
            _row("Paths", "MEDIA_ROOT", getattr(settings, "MEDIA_ROOT", ""), translate=False),
            _row("Paths", "PATH", os.environ.get("PATH", ""), translate=False),
            _row("Paths", "sys.path", "\n".join(sys.path), translate=False),
        ]
    )
    rows.extend(environment_rows())
    return rows


def _current_user():
    try:
        import getpass

        return getpass.getuser()
    except Exception:
        return os.environ.get("USER") or "(unknown)"
