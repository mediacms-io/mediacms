import ipaddress
import logging
from typing import Optional

from django.conf import settings
from django.http import HttpRequest

logger = logging.getLogger(__name__)


def _strip_port(value: str) -> Optional[str]:
    value = value.strip()
    if value.startswith("["):
        value = value[1:].split("]", 1)[0]
    elif value.count(":") == 1:
        value = value.split(":", 1)[0]
    try:
        return str(ipaddress.ip_address(value))
    except ValueError:
        return None


def _is_trusted_proxy(ip_str: str, trusted_proxies) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return False

    for trusted in trusted_proxies:
        try:
            if ip in ipaddress.ip_network(trusted, strict=False):
                return True
        except ValueError:
            logger.warning("Invalid TRUSTED_PROXIES entry: %s", trusted)
    return False


def get_client_ip(request: HttpRequest) -> Optional[str]:
    remote_addr = request.META.get("REMOTE_ADDR")
    if not remote_addr:
        return None

    trusted_proxies = getattr(settings, "TRUSTED_PROXIES", [])
    if not trusted_proxies or not _is_trusted_proxy(remote_addr, trusted_proxies):
        return remote_addr

    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        hops = [ip for ip in (_strip_port(entry) for entry in forwarded_for.split(",")) if ip]
        for ip in reversed(hops):
            if not _is_trusted_proxy(ip, trusted_proxies):
                return ip
        if hops:
            return hops[0]

    real_ip = request.META.get("HTTP_X_REAL_IP")
    if real_ip:
        ip = _strip_port(real_ip)
        if ip:
            return ip

    return remote_addr


def get_client_ip_for_logging(request: HttpRequest) -> str:
    client_ip = getattr(request, "client_ip", None) or get_client_ip(request)
    return client_ip or "unknown"
