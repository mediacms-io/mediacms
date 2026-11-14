# Reverse Proxy Configuration Guide

This guide explains how to configure MediaCMS to work correctly behind reverse proxies, load balancers, and other HTTP proxies.

## Table of Contents

- [Overview](#overview)
- [Why Proxy Configuration is Needed](#why-proxy-configuration-is-needed)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Common Scenarios](#common-scenarios)
- [Configuration Examples](#configuration-examples)
- [Middleware Configuration](#middleware-configuration)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

## Overview

When MediaCMS is deployed behind a reverse proxy (nginx, Apache, cloud load balancers, etc.), the application receives requests directly from the proxy, not from the original client. This causes several issues:

1. **IP Address Logging**: All requests appear to come from the proxy IP address
2. **Session Issues**: Login sessions may be incorrectly shared between users
3. **SSL/HTTPS Detection**: Django may not detect HTTPS connections correctly
4. **Host Header Issues**: Incorrect host information in URLs and redirects

MediaCMS includes proxy-aware middleware and utilities to handle these issues securely.

## Why Proxy Configuration is Needed

### The Problem

When a client connects through a reverse proxy, the connection flow looks like this:

```
Client (IP: 203.0.113.42) → Reverse Proxy (IP: 192.168.1.10) → MediaCMS (sees IP: 192.168.1.10)
```

Without proper configuration, MediaCMS sees all requests as coming from `192.168.1.10` (the proxy), not from the actual client IP `203.0.113.42`.

### Common Issues

1. **All users appear to share the same IP address**
   - Makes IP-based logging and analytics useless
   - Breaks IP-based rate limiting
   - Can cause session confusion

2. **Login sessions shared between users**
   - When session cookies aren't properly scoped
   - All users appear to be logged in as the same user

3. **HTTPS detection fails**
   - Django thinks connections are HTTP even when client uses HTTPS
   - Causes insecure cookie warnings
   - Breaks redirects and URL generation

## Architecture

### How It Works

MediaCMS uses a multi-layered approach to handle reverse proxies:

1. **Proxy-Aware Middleware** (`ProxyAwareMiddleware`):
   - Runs early in the request processing chain
   - Extracts real client IP from proxy headers
   - Validates that proxy headers come from trusted sources
   - Sets `request.client_ip` attribute for application use

2. **IP Extraction Utility** (`cms.utils.get_client_ip()`):
   - Handles parsing of `X-Forwarded-For` and `X-Real-IP` headers
   - Validates IPs against trusted proxy list
   - Processes multiple proxy hops correctly

3. **Trusted Proxy Validation**:
   - Only trusts proxy headers from IPs in `TRUSTED_PROXIES` setting
   - Prevents IP spoofing attacks
   - Ignores headers from untrusted sources

### Request Flow

```
1. Client request arrives at reverse proxy
2. Proxy adds headers: X-Forwarded-For, X-Real-IP, X-Forwarded-Proto
3. Request forwarded to MediaCMS
4. ProxyAwareMiddleware intercepts request
5. Middleware checks if REMOTE_ADDR is in TRUSTED_PROXIES
6. If trusted, extracts real IP from headers
7. Sets request.client_ip attribute
8. Optionally modifies request.META['REMOTE_ADDR'] (if configured)
9. Request continues to Django views
```

## Quick Start

### Step 1: Configure Your Reverse Proxy

Ensure your reverse proxy forwards the necessary headers. For nginx:

```nginx
location / {
    proxy_pass http://mediacms:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Step 2: Configure MediaCMS

Edit `local_settings.py` (or `deploy/docker/local_settings.py` for Docker):

```python
# Add your proxy IP to trusted proxies
TRUSTED_PROXIES = [
    '127.0.0.1',      # localhost
    '192.168.1.10',   # Your reverse proxy IP
    '10.0.0.0/8',     # Private network range
    '192.168.0.0/16', # Private network range
]

# Enable proxy-aware middleware
PROXY_AWARE_MIDDLEWARE_ENABLED = True

# If using HTTPS, configure SSL detection
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
```

### Step 3: Restart MediaCMS

Restart your MediaCMS application to apply the changes.

### Step 4: Verify Configuration

Check that client IPs are being logged correctly:
- View media action logs (likes, views, etc.)
- IP addresses should show actual client IPs, not the proxy IP

## Common Scenarios

### Scenario 1: Single nginx Reverse Proxy

**Setup**: MediaCMS behind a single nginx server

**nginx Configuration**:
```nginx
upstream mediacms {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name mediacms.example.com;

    location / {
        proxy_pass http://mediacms;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Port $server_port;
    }
}
```

**MediaCMS Configuration** (`local_settings.py`):
```python
TRUSTED_PROXIES = ['127.0.0.1', '::1']
PROXY_AWARE_MIDDLEWARE_ENABLED = True
```

### Scenario 2: HTTPS Terminated at Proxy

**Setup**: Client → HTTPS → nginx (SSL termination) → HTTP → MediaCMS

**nginx Configuration**:
```nginx
server {
    listen 443 ssl;
    server_name mediacms.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;  # Important!
        proxy_set_header X-Forwarded-Port 443;
    }
}
```

**MediaCMS Configuration**:
```python
TRUSTED_PROXIES = ['127.0.0.1']
PROXY_AWARE_MIDDLEWARE_ENABLED = True
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
```

### Scenario 3: Cloud Load Balancer (AWS ALB, GCP LB, Azure LB)

**Setup**: Client → Cloud Load Balancer → MediaCMS

**MediaCMS Configuration**:
```python
# Cloud load balancers typically use private IP ranges
# Check your cloud provider's documentation for exact IP ranges
TRUSTED_PROXIES = [
    '10.0.0.0/8',      # Common private network
    '172.16.0.0/12',   # Common private network
]

PROXY_AWARE_MIDDLEWARE_ENABLED = True
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# For AWS ALB, you may need to check X-Forwarded-Proto
# GCP and Azure typically use the same header
```

**Note**: Most cloud load balancers automatically set `X-Forwarded-For`, `X-Real-IP`, and `X-Forwarded-Proto` headers.

### Scenario 4: Multiple Proxy Layers

**Setup**: Client → CDN → Load Balancer → nginx → MediaCMS

**Configuration**:
```python
# Trust all proxy layers in your infrastructure
TRUSTED_PROXIES = [
    '10.0.0.0/8',           # Load balancer network
    '172.16.0.0/12',        # nginx network
    '203.0.113.0/24',       # CDN IP range (if known)
]

PROXY_AWARE_MIDDLEWARE_ENABLED = True
# The middleware will correctly parse X-Forwarded-For with multiple IPs
```

**X-Forwarded-For Header Example**:
```
X-Forwarded-For: 203.0.113.42, 10.0.0.5, 172.16.1.10
                 ^client        ^CDN      ^nginx
```

The middleware processes this right-to-left and extracts the client IP.

### Scenario 5: Docker/Container Deployment

**Setup**: Client → Docker Host nginx → Docker Container (MediaCMS)

**docker-compose.yml**:
```yaml
services:
  mediacms:
    # ... other config ...
    networks:
      - mediacms_net

  nginx:
    # ... other config ...
    networks:
      - mediacms_net
    depends_on:
      - mediacms
```

**nginx Configuration**:
```nginx
location / {
    proxy_pass http://mediacms:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**MediaCMS Configuration**:
```python
# Trust the Docker network
TRUSTED_PROXIES = [
    '172.17.0.0/16',    # Default Docker bridge network
    '10.0.0.0/8',       # Custom Docker networks
]
PROXY_AWARE_MIDDLEWARE_ENABLED = True
```

## Configuration Examples

### Apache mod_proxy

**Apache Configuration**:
```apache
<VirtualHost *:80>
    ServerName mediacms.example.com

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:8000/
    ProxyPassReverse / http://127.0.0.1:8000/

    # Forward proxy headers
    RequestHeader set X-Forwarded-Proto "http"
    RequestHeader set X-Real-IP "%{REMOTE_ADDR}s"
</VirtualHost>
```

**For HTTPS**:
```apache
<VirtualHost *:443>
    ServerName mediacms.example.com
    SSLEngine on
    # ... SSL config ...

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:8000/
    ProxyPassReverse / http://127.0.0.1:8000/

    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Real-IP "%{REMOTE_ADDR}s"
</VirtualHost>
```

### Traefik (Docker)

**docker-compose.yml**:
```yaml
services:
  mediacms:
    # ... other config ...
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.mediacms.rule=Host(`mediacms.example.com`)"
      - "traefik.http.routers.mediacms.entrypoints=websecure"
      - "traefik.http.routers.mediacms.tls.certresolver=letsencrypt"
      - "traefik.http.services.mediacms.loadbalancer.server.port=8000"
```

Traefik automatically sets proxy headers, no additional configuration needed.

## Middleware Configuration

### Settings Overview

| Setting | Default | Description |
|---------|---------|-------------|
| `TRUSTED_PROXIES` | `[]` (empty list) | List of trusted proxy IPs/networks |
| `PROXY_AWARE_MIDDLEWARE_ENABLED` | `True` if `TRUSTED_PROXIES` set | Enable proxy-aware middleware |
| `SET_REAL_IP_IN_META` | `False` | Modify `REMOTE_ADDR` in request.META |
| `USE_X_FORWARDED_HOST` | `False` | Use X-Forwarded-Host header |
| `SECURE_PROXY_SSL_HEADER` | `None` | Tuple for SSL detection |

### SET_REAL_IP_IN_META Setting

**Default: `False`** (Recommended)

When `False`:
- Middleware sets `request.client_ip` attribute
- `request.META['REMOTE_ADDR']` remains unchanged (proxy IP)
- Safer default, prevents issues with Django's built-in middleware

When `True`:
- Middleware sets `request.client_ip` attribute
- `request.META['REMOTE_ADDR']` is modified to real client IP
- Original value saved in `request.META['ORIGINAL_REMOTE_ADDR']`
- Allows Django's built-in IP-based features to work

**When to Enable**:
- If you need Django's `SecurityMiddleware` to see real client IPs
- If third-party packages rely on `REMOTE_ADDR`
- After thorough testing in your environment

**Security Note**: Only enable if you trust your proxy infrastructure completely.

### TRUSTED_PROXIES Format

Supports single IPs and CIDR networks:

```python
TRUSTED_PROXIES = [
    '127.0.0.1',           # Single IPv4 address
    '::1',                 # Single IPv6 address
    '192.168.1.10',        # Specific proxy IP
    '10.0.0.0/8',          # IPv4 network (CIDR)
    '2001:db8::/32',       # IPv6 network (CIDR)
]
```

**Default Value**: Empty list `[]` (no proxies trusted by default)

**Common Example Values** (RFC 1918 private networks):
- `127.0.0.1/32` or `127.0.0.1` - IPv4 localhost
- `::1/128` or `::1` - IPv6 localhost
- `10.0.0.0/8` - Private network
- `172.16.0.0/12` - Private network
- `192.168.0.0/16` - Private network
- `fc00::/7` - IPv6 private networks

## Troubleshooting

### Issue: IP Address Still Shows Proxy IP

**Symptoms**: Logged IP addresses show the proxy IP, not client IP

**Solutions**:
1. **Check TRUSTED_PROXIES**: Ensure proxy IP is in the list
   ```python
   # Check what IP MediaCMS sees as REMOTE_ADDR
   # Add that IP to TRUSTED_PROXIES
   TRUSTED_PROXIES = ['192.168.1.10']  # Your proxy IP
   ```

2. **Verify Proxy Headers**: Check that proxy sends headers
   ```bash
   # Test from command line
   curl -H "X-Forwarded-For: 1.2.3.4" http://mediacms.example.com
   ```

3. **Check Middleware**: Ensure middleware is enabled
   ```python
   PROXY_AWARE_MIDDLEWARE_ENABLED = True
   ```

4. **Review Logs**: Check Django logs for middleware errors

### Issue: Login Sessions Shared Between Users

**Symptoms**: When one user logs in, all users appear logged in

**Solutions**:
1. **Check Session Cookie Domain**: Should be `None` or match your domain
   ```python
   SESSION_COOKIE_DOMAIN = None  # Let Django auto-detect
   ```

2. **Verify Host Header**: Ensure proxy forwards correct Host
   ```nginx
   proxy_set_header Host $host;
   ```

3. **Check Cookie SameSite**: Ensure compatible setting
   ```python
   SESSION_COOKIE_SAMESITE = 'Lax'  # Default, should work
   ```

4. **Review X-Forwarded-Host**: May need to enable
   ```python
   USE_X_FORWARDED_HOST = True
   ```

### Issue: HTTPS/SSL Errors

**Symptoms**: Browser warnings about insecure cookies, redirects to HTTP

**Solutions**:
1. **Enable SSL Detection**:
   ```python
   SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
   ```

2. **Verify Proxy Sends Header**:
   ```nginx
   proxy_set_header X-Forwarded-Proto $scheme;
   ```

3. **Enable Secure Cookies**:
   ```python
   CSRF_COOKIE_SECURE = True
   SESSION_COOKIE_SECURE = True
   ```

4. **Check Redirects**:
   ```python
   SECURE_SSL_REDIRECT = True  # Redirect HTTP to HTTPS
   ```

### Issue: Middleware Not Working

**Symptoms**: `request.client_ip` is None or incorrect

**Solutions**:
1. **Check Middleware Order**: Ensure it's in MIDDLEWARE list
   ```python
   # Should be after SecurityMiddleware
   ```

2. **Verify Enable Setting**:
   ```python
   PROXY_AWARE_MIDDLEWARE_ENABLED = True
   ```

3. **Check TRUSTED_PROXIES**: Must not be empty
   ```python
   TRUSTED_PROXIES = ['127.0.0.1']  # At minimum
   ```

4. **Test Direct Access**: Try accessing MediaCMS directly (bypass proxy)
   - Should still work (falls back to REMOTE_ADDR)

### Issue: Headers Not Being Forwarded

**Symptoms**: X-Forwarded-For header missing or incorrect

**Solutions**:
1. **Check nginx Configuration**:
   ```nginx
   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   ```

2. **Verify Apache Configuration**:
   ```apache
   RequestHeader set X-Forwarded-For "%{REMOTE_ADDR}s"
   ```

3. **Test with curl**:
   ```bash
   curl -v -H "X-Forwarded-For: 1.2.3.4" http://mediacms.example.com
   ```

### Debugging Tips

1. **Enable Logging**: Add to `local_settings.py`
   ```python
   LOGGING = {
       'version': 1,
       'disable_existing_loggers': False,
       'handlers': {
           'console': {
               'class': 'logging.StreamHandler',
           },
       },
       'loggers': {
           'cms.middleware': {
               'handlers': ['console'],
               'level': 'DEBUG',
           },
       },
   }
   ```

2. **Check request.META**: Add debug view
   ```python
   def debug_proxy(request):
       return JsonResponse({
           'REMOTE_ADDR': request.META.get('REMOTE_ADDR'),
           'client_ip': getattr(request, 'client_ip', None),
           'X-Forwarded-For': request.META.get('HTTP_X_FORWARDED_FOR'),
           'X-Real-IP': request.META.get('HTTP_X_REAL_IP'),
       })
   ```

3. **Test IP Extraction**: Use Django shell
   ```python
   python manage.py shell
   >>> from django.test import RequestFactory
   >>> from cms.utils import get_client_ip
   >>> factory = RequestFactory()
   >>> request = factory.get('/', HTTP_X_FORWARDED_FOR='1.2.3.4', REMOTE_ADDR='127.0.0.1')
   >>> get_client_ip(request)
   '1.2.3.4'
   ```

## Security Considerations

### Why Trusted Proxies Matter

**The Problem**: Without validation, anyone can send fake `X-Forwarded-For` headers:

```bash
curl -H "X-Forwarded-For: 1.2.3.4" http://mediacms.example.com
```

Without `TRUSTED_PROXIES`, MediaCMS would believe the request came from `1.2.3.4`, even if it actually came from a different IP.

**The Solution**: MediaCMS only trusts proxy headers when `REMOTE_ADDR` (the direct connection IP) is in the `TRUSTED_PROXIES` list.

### Security Best Practices

1. **Minimize TRUSTED_PROXIES**: Only include IPs you actually trust
   ```python
   # Good: Specific IPs
   TRUSTED_PROXIES = ['192.168.1.10']

   # Acceptable: Known network range
   TRUSTED_PROXIES = ['10.0.0.0/8']

   # Bad: Too broad
   TRUSTED_PROXIES = ['0.0.0.0/0']  # DON'T DO THIS
   ```

2. **Use SET_REAL_IP_IN_META Carefully**: Only enable if necessary
   - Default `False` is safer
   - Only enable after thorough testing

3. **Monitor for Spoofing**: Watch logs for suspicious activity
   - Unexpected IP addresses
   - Patterns suggesting header manipulation

4. **Network Isolation**: Keep proxies on private networks
   - Use firewall rules to prevent direct access
   - Only allow proxy → MediaCMS communication

5. **Regular Audits**: Review TRUSTED_PROXIES periodically
   - Remove unused entries
   - Update when infrastructure changes

### What Happens If Proxy Not Trusted?

**Behavior**: MediaCMS ignores proxy headers and uses `REMOTE_ADDR` directly

**Result**:
- All requests appear to come from proxy IP
- IP-based features may not work correctly
- No security risk (fails safe)

**Solution**: Add proxy IP to `TRUSTED_PROXIES`

### IP Spoofing Prevention

MediaCMS prevents IP spoofing through:

1. **Validation**: Only trusts headers from trusted IPs
2. **Fail-Safe Defaults**: Defaults to not modifying REMOTE_ADDR
3. **Single Source of Truth**: All IP extraction uses same validation
4. **Audit Trail**: Original REMOTE_ADDR preserved when modified

### Production Recommendations

1. **Use Specific IPs**: Avoid wildcards in TRUSTED_PROXIES
2. **Enable Logging**: Monitor for proxy-related issues
3. **Test Changes**: Test proxy configuration in staging first
4. **Document Your Setup**: Keep track of proxy IPs and networks
5. **Regular Updates**: Review configuration when infrastructure changes

## Additional Resources

- [Django Proxy Settings Documentation](https://docs.djangoproject.com/en/stable/ref/settings/#std-setting-USE_X_FORWARDED_HOST)
- [nginx proxy_pass Documentation](http://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [RFC 7239: Forwarded HTTP Extension](https://tools.ietf.org/html/rfc7239)
- [RFC 1918: Private Address Space](https://tools.ietf.org/html/rfc1918)

## Getting Help

If you encounter issues not covered in this guide:

1. Check the [MediaCMS GitHub Issues](https://github.com/mediacms-io/mediacms/issues)
2. Review Django's proxy configuration documentation
3. Check your reverse proxy's documentation for header configuration
4. Enable debug logging and review logs for errors

## Summary

Proper reverse proxy configuration is essential for MediaCMS deployments behind proxies. Key points:

- ✅ Always configure `TRUSTED_PROXIES` with your proxy IPs
- ✅ Enable `PROXY_AWARE_MIDDLEWARE_ENABLED` when using proxies
- ✅ Configure proxy to send required headers (X-Forwarded-For, X-Forwarded-Proto)
- ✅ Use `SECURE_PROXY_SSL_HEADER` when terminating SSL at proxy
- ✅ Test thoroughly in staging before production
- ✅ Keep `TRUSTED_PROXIES` minimal and specific
- ✅ Only enable `SET_REAL_IP_IN_META` if necessary

Following this guide will ensure MediaCMS works correctly and securely behind reverse proxies.

