import shutil
import socket
import tempfile
from urllib.parse import urlparse

import pytest
from django.conf import settings
from django.core.cache import cache

_real_getaddrinfo = socket.getaddrinfo


def _allowed_hosts():
    hosts = {"localhost", "127.0.0.1", "::1", "0.0.0.0", None, ""}
    for database in settings.DATABASES.values():
        hosts.add(database.get("HOST"))
    for location in (getattr(settings, "REDIS_LOCATION", ""), getattr(settings, "BROKER_URL", "")):
        hosts.add(urlparse(location or "").hostname)
    return hosts


def pytest_configure(config):
    allowed = _allowed_hosts()

    def guarded_getaddrinfo(host, *args, **kwargs):
        if isinstance(host, bytes):
            host = host.decode()
        if host not in allowed:
            raise socket.gaierror(socket.EAI_NONAME, f"network access to {host!r} is blocked in tests")
        return _real_getaddrinfo(host, *args, **kwargs)

    socket.getaddrinfo = guarded_getaddrinfo


def pytest_unconfigure(config):
    socket.getaddrinfo = _real_getaddrinfo
    media_root = str(getattr(settings, "MEDIA_ROOT", ""))
    if media_root.startswith(tempfile.gettempdir()) and "mediacms-tests-" in media_root:
        shutil.rmtree(media_root, ignore_errors=True)


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
