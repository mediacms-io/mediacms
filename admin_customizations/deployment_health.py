"""Site Health checks for reverse-proxy, SSL, CORS, and media storage paths.

Probes are cheap: settings reads plus a tiny write/delete in each directory.
Directories are never created.
"""

from __future__ import annotations

import os
from typing import Iterable, Optional
from urllib.parse import urlparse

from django.conf import settings

EXPECTED_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")


def frontend_host_parts():
    """Return (scheme, hostname, origin) for FRONTEND_HOST."""
    raw = (getattr(settings, "FRONTEND_HOST", "") or "").strip()
    if not raw:
        return "", "", ""
    parsed = urlparse(raw if "://" in raw else f"http://{raw}")
    scheme = (parsed.scheme or "").lower()
    host = (parsed.hostname or parsed.path.split("/")[0] or "").rstrip(".").lower()
    if not scheme or not host:
        return scheme, host, ""
    port = parsed.port
    default_port = (scheme == "https" and port == 443) or (scheme == "http" and port == 80)
    if port and not default_port:
        origin = f"{scheme}://{host}:{port}"
    else:
        origin = f"{scheme}://{host}"
    return scheme, host, origin


def _is_production() -> bool:
    return not getattr(settings, "DEBUG", False) and not getattr(settings, "LOCAL_INSTALL", False)


def _gap_status() -> str:
    """Warn in production; info for local/debug installs."""
    return "warn" if _is_production() else "info"


def _payload(check_id: str, label: str, status: str, detail: str) -> dict:
    return {"check_id": check_id, "label": label, "status": status, "detail": detail, "link": None}


def _cors_installed() -> bool:
    apps = {str(app) for app in getattr(settings, "INSTALLED_APPS", [])}
    return "corsheaders" in apps or any(app.endswith(".corsheaders") or app.startswith("corsheaders.") for app in apps)


def _cors_allow_all() -> bool:
    return bool(getattr(settings, "CORS_ORIGIN_ALLOW_ALL", False) or getattr(settings, "CORS_ALLOW_ALL_ORIGINS", False))


def _origin_in_trusted(origin: str) -> bool:
    trusted = getattr(settings, "CSRF_TRUSTED_ORIGINS", None) or []
    normalized = {str(item).strip().rstrip("/").lower() for item in trusted}
    return origin.lower() in normalized


def iter_deployment_health_checks() -> Iterable[dict]:
    """Reverse-proxy, cookie, CSRF, and CORS configuration checks."""
    scheme, _host, origin = frontend_host_parts()
    https = scheme == "https"

    forwarded = bool(getattr(settings, "USE_X_FORWARDED_HOST", False))
    if not https:
        yield _payload(
            "proxy_forwarded_host",
            "Reverse proxy USE_X_FORWARDED_HOST",
            "ok",
            "USE_X_FORWARDED_HOST is only required when FRONTEND_HOST is HTTPS.",
        )
    elif forwarded:
        yield _payload(
            "proxy_forwarded_host",
            "Reverse proxy USE_X_FORWARDED_HOST",
            "ok",
            "USE_X_FORWARDED_HOST is True.",
        )
    else:
        yield _payload(
            "proxy_forwarded_host",
            "Reverse proxy USE_X_FORWARDED_HOST",
            _gap_status(),
            "FRONTEND_HOST is HTTPS but USE_X_FORWARDED_HOST is False. Set it True behind a reverse proxy.",
        )

    header = getattr(settings, "SECURE_PROXY_SSL_HEADER", None)
    header_tuple = tuple(header) if header else None
    if not https:
        yield _payload(
            "proxy_ssl_header",
            "SECURE_PROXY_SSL_HEADER configured",
            "ok",
            "SECURE_PROXY_SSL_HEADER is only required when FRONTEND_HOST is HTTPS.",
        )
    elif header_tuple == EXPECTED_PROXY_SSL_HEADER:
        yield _payload(
            "proxy_ssl_header",
            "SECURE_PROXY_SSL_HEADER configured",
            "ok",
            "SECURE_PROXY_SSL_HEADER is ('HTTP_X_FORWARDED_PROTO', 'https').",
        )
    else:
        yield _payload(
            "proxy_ssl_header",
            "SECURE_PROXY_SSL_HEADER configured",
            _gap_status(),
            f"SECURE_PROXY_SSL_HEADER is {header_tuple!r}; expected {EXPECTED_PROXY_SSL_HEADER!r}.",
        )

    if not https:
        yield _payload(
            "csrf_trusted_origins",
            "CSRF_TRUSTED_ORIGINS includes FRONTEND_HOST",
            "ok",
            "CSRF_TRUSTED_ORIGINS is only required when FRONTEND_HOST is HTTPS.",
        )
    elif origin and _origin_in_trusted(origin):
        yield _payload(
            "csrf_trusted_origins",
            "CSRF_TRUSTED_ORIGINS includes FRONTEND_HOST",
            "ok",
            f'CSRF_TRUSTED_ORIGINS includes "{origin}".',
        )
    else:
        yield _payload(
            "csrf_trusted_origins",
            "CSRF_TRUSTED_ORIGINS includes FRONTEND_HOST",
            _gap_status(),
            f'CSRF_TRUSTED_ORIGINS does not include "{origin or "(empty FRONTEND_HOST)"}".',
        )

    csrf_secure = bool(getattr(settings, "CSRF_COOKIE_SECURE", False))
    session_secure = bool(getattr(settings, "SESSION_COOKIE_SECURE", False))
    if not https:
        yield _payload(
            "secure_cookies",
            "Secure cookies enabled",
            "ok",
            "Secure cookies are only required when FRONTEND_HOST is HTTPS.",
        )
    elif csrf_secure and session_secure:
        yield _payload(
            "secure_cookies",
            "Secure cookies enabled",
            "ok",
            "CSRF_COOKIE_SECURE and SESSION_COOKIE_SECURE are both True.",
        )
    else:
        yield _payload(
            "secure_cookies",
            "Secure cookies enabled",
            _gap_status(),
            f"CSRF_COOKIE_SECURE={csrf_secure}, SESSION_COOKIE_SECURE={session_secure}. Both should be True for HTTPS.",
        )

    ssl_redirect = bool(getattr(settings, "SECURE_SSL_REDIRECT", False))
    if not https:
        yield _payload(
            "secure_ssl_redirect",
            "SECURE_SSL_REDIRECT enabled",
            "ok",
            "SECURE_SSL_REDIRECT is only expected when FRONTEND_HOST is HTTPS.",
        )
    elif ssl_redirect:
        yield _payload(
            "secure_ssl_redirect",
            "SECURE_SSL_REDIRECT enabled",
            "ok",
            "SECURE_SSL_REDIRECT is True.",
        )
    else:
        yield _payload(
            "secure_ssl_redirect",
            "SECURE_SSL_REDIRECT enabled",
            _gap_status(),
            "FRONTEND_HOST is HTTPS but SECURE_SSL_REDIRECT is False.",
        )

    if not _cors_installed():
        yield _payload(
            "cors_allow_all",
            "CORS allow-all disabled in production",
            "ok",
            "corsheaders is not installed.",
        )
    elif _cors_allow_all() and _is_production():
        yield _payload(
            "cors_allow_all",
            "CORS allow-all disabled in production",
            "warn",
            "CORS allow-all is enabled in production. Restrict CORS_ORIGIN_ALLOW_ALL / CORS_ALLOW_ALL_ORIGINS.",
        )
    elif _cors_allow_all():
        yield _payload(
            "cors_allow_all",
            "CORS allow-all disabled in production",
            "info",
            "CORS allow-all is enabled (acceptable for local/debug).",
        )
    else:
        yield _payload(
            "cors_allow_all",
            "CORS allow-all disabled in production",
            "ok",
            "corsheaders is installed and allow-all is disabled.",
        )


def _probe_directory(path: Optional[str]) -> Optional[str]:
    """Return a short failure reason, or None when the directory is readable and writable."""
    if not path:
        return "missing (empty path)"
    if not os.path.isdir(path):
        if os.path.exists(path):
            return "not a directory"
        return "missing"
    if not os.access(path, os.R_OK):
        return "not readable"
    probe = os.path.join(path, f".mediacms_health_probe_{os.getpid()}")
    try:
        with open(probe, "w", encoding="utf-8") as handle:
            handle.write("ok")
    except OSError as exc:
        return f"not writable: {exc.__class__.__name__}"
    try:
        os.remove(probe)
    except OSError:
        pass
    return None


def _storage_check(check_id: str, label: str, path: str, fail: bool) -> dict:
    reason = _probe_directory(path)
    if reason is None:
        return _payload(check_id, label, "ok", f"{path} is readable and writable.")
    status = "fail" if fail else "warn"
    return _payload(check_id, label, status, f"{path} {reason}.")


def _media_subdir(name: str) -> str:
    root = getattr(settings, "MEDIA_ROOT", "") or ""
    relative = (getattr(settings, name, "") or "").strip("/")
    if not root or not relative:
        return ""
    return os.path.join(root, relative)


def iter_media_storage_health_checks() -> Iterable[dict]:
    """Existence plus read/write probes for media and temp directories."""
    yield _storage_check("media_root_access", "MEDIA_ROOT readable/writable", getattr(settings, "MEDIA_ROOT", "") or "", fail=True)
    yield _storage_check("hls_dir_access", "HLS_DIR readable/writable", getattr(settings, "HLS_DIR", "") or "", fail=False)
    yield _storage_check("temp_dir_access", "TEMP_DIRECTORY readable/writable", getattr(settings, "TEMP_DIRECTORY", "") or "", fail=True)

    subdir_settings = (
        ("MEDIA_UPLOAD_DIR", "original"),
        ("MEDIA_ENCODING_DIR", "encoded"),
        ("UPLOAD_DIR", "uploads"),
        ("CHUNKS_DIR", "chunks"),
    )
    failures = []
    for setting_name, label in subdir_settings:
        path = _media_subdir(setting_name)
        reason = _probe_directory(path)
        if reason:
            failures.append(f"{label} ({path or setting_name}): {reason}")
    if failures:
        yield _payload(
            "media_subdirs_access",
            "Media subdirs accessible",
            "warn",
            "; ".join(failures),
        )
    else:
        yield _payload(
            "media_subdirs_access",
            "Media subdirs accessible",
            "ok",
            "original, encoded, uploads, and chunks are readable and writable.",
        )


def deployment_configuration_rows() -> list[dict]:
    """Informational configuration rows for the Site dashboard."""
    header = getattr(settings, "SECURE_PROXY_SSL_HEADER", None)
    trusted = getattr(settings, "CSRF_TRUSTED_ORIGINS", None) or []
    rows = [
        {"label": "USE_X_FORWARDED_HOST", "value": str(bool(getattr(settings, "USE_X_FORWARDED_HOST", False)))},
        {"label": "SECURE_PROXY_SSL_HEADER", "value": str(tuple(header) if header else "")},
        {"label": "SECURE_SSL_REDIRECT", "value": str(bool(getattr(settings, "SECURE_SSL_REDIRECT", False)))},
        {"label": "CSRF_COOKIE_SECURE", "value": str(bool(getattr(settings, "CSRF_COOKIE_SECURE", False)))},
        {"label": "SESSION_COOKIE_SECURE", "value": str(bool(getattr(settings, "SESSION_COOKIE_SECURE", False)))},
        {"label": "CSRF_TRUSTED_ORIGINS", "value": ", ".join(str(item) for item in trusted) or "(empty)"},
        {"label": "MEDIA_ROOT", "value": str(getattr(settings, "MEDIA_ROOT", ""))},
        {"label": "HLS_DIR", "value": str(getattr(settings, "HLS_DIR", ""))},
        {"label": "TEMP_DIRECTORY", "value": str(getattr(settings, "TEMP_DIRECTORY", ""))},
    ]
    if _cors_installed():
        rows.append({"label": "CORS_ORIGIN_ALLOW_ALL", "value": str(bool(getattr(settings, "CORS_ORIGIN_ALLOW_ALL", False)))})
        rows.append({"label": "CORS_ALLOW_ALL_ORIGINS", "value": str(bool(getattr(settings, "CORS_ALLOW_ALL_ORIGINS", False)))})
    return rows
