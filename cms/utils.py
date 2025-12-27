"""
Utility functions for MediaCMS, including proxy-aware IP address extraction.
"""
import ipaddress
import logging
from typing import Optional

from django.conf import settings
from django.http import HttpRequest

logger = logging.getLogger(__name__)


def _is_ip_in_trusted_proxies(ip_str: str, trusted_proxies: list) -> bool:
    """
    Check if an IP address is in the list of trusted proxies.

    Args:
        ip_str: IP address as string (IPv4 or IPv6)
        trusted_proxies: List of trusted proxy IPs/networks (CIDR notation supported)

    Returns:
        True if IP is in trusted proxies, False otherwise
    """
    if not trusted_proxies:
        return False

    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        # Invalid IP address
        return False

    for trusted in trusted_proxies:
        try:
            # Check if it's a network (CIDR notation) or single IP
            if '/' in trusted:
                network = ipaddress.ip_network(trusted, strict=False)
                if ip in network:
                    return True
            else:
                # Single IP address
                trusted_ip = ipaddress.ip_address(trusted)
                if ip == trusted_ip:
                    return True
        except (ValueError, ipaddress.AddressValueError):
            # Invalid trusted proxy entry, skip it
            logger.warning(f"Invalid trusted proxy entry: {trusted}")
            continue

    return False


def get_client_ip(request: HttpRequest) -> Optional[str]:
    """
    Extract the real client IP address from a request, handling reverse proxies.

    This function respects the TRUSTED_PROXIES setting and only trusts proxy
    headers (X-Forwarded-For, X-Real-IP) when the direct connection IP is in
    the trusted proxies list. This prevents IP spoofing attacks.

    Args:
        request: Django HttpRequest object

    Returns:
        Client IP address as string, or None if extraction fails.
        Falls back to REMOTE_ADDR if no trusted proxies configured.
    """
    # Get the direct connection IP
    remote_addr = request.META.get('REMOTE_ADDR')
    if not remote_addr:
        return None

    # Get trusted proxies from settings
    trusted_proxies = getattr(settings, 'TRUSTED_PROXIES', [])

    # If no trusted proxies configured, return REMOTE_ADDR as-is (backward compatible)
    if not trusted_proxies:
        return remote_addr

    # Check if the direct connection IP is a trusted proxy
    if not _is_ip_in_trusted_proxies(remote_addr, trusted_proxies):
        # Not a trusted proxy, return REMOTE_ADDR directly
        # This prevents untrusted sources from spoofing IP addresses
        return remote_addr

    # The direct connection is from a trusted proxy, so we can trust proxy headers
    # Try X-Forwarded-For first (most common)
    forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded_for:
        # X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2
        # We need to parse from right to left and find the first IP that's not
        # from a trusted proxy (or use the leftmost if all are trusted)
        ips = [ip.strip() for ip in forwarded_for.split(',')]

        # Process from right to left (most recent proxy first)
        for ip_str in reversed(ips):
            if not ip_str:
                continue

            # Remove port if present (e.g., "192.168.1.1:12345")
            ip_str = ip_str.split(':')[0].strip()

            # If this IP is not from a trusted proxy, it's likely the real client
            if not _is_ip_in_trusted_proxies(ip_str, trusted_proxies):
                return ip_str

        # All IPs in chain are trusted proxies, use the leftmost (original client)
        if ips:
            return ips[0].split(':')[0].strip()

    # Try X-Real-IP as fallback (single IP header)
    real_ip = request.META.get('HTTP_X_REAL_IP')
    if real_ip:
        ip_str = real_ip.strip().split(':')[0]
        # Validate it's a real IP (could still be spoofed, but proxy validated remote_addr)
        try:
            ipaddress.ip_address(ip_str)
            return ip_str
        except ValueError:
            pass

    # Fall back to REMOTE_ADDR if no valid proxy headers
    return remote_addr


def get_client_ip_for_logging(request: HttpRequest) -> str:
    """
    Get client IP address for logging purposes, handling reverse proxy scenarios.

    This function provides a consistent way to extract client IP addresses for
    logging across the application. It uses the following fallback chain:
    1. request.client_ip (set by ProxyAwareMiddleware if available)
    2. get_client_ip(request) (proxy-aware IP extraction utility)
    3. request.META.get('REMOTE_ADDR') (direct connection IP)
    4. 'unknown' (final fallback if all else fails)

    This ensures that logged IP addresses are correct in both reverse proxy
    and non-reverse proxy scenarios.

    Args:
        request: Django HttpRequest object

    Returns:
        Client IP address as string, or 'unknown' if extraction fails
    """
    # First check if ProxyAwareMiddleware has set client_ip
    client_ip = getattr(request, 'client_ip', None)

    # Fall back to get_client_ip utility function
    if client_ip is None:
        client_ip = get_client_ip(request)

    # Fall back to REMOTE_ADDR if still None
    if client_ip is None:
        client_ip = request.META.get('REMOTE_ADDR')

    # Return 'unknown' as final fallback for logging
    return client_ip if client_ip else 'unknown'
