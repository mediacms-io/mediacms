import re
from urllib.parse import unquote

from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET

from ..methods import is_mediacms_editor
from ..models import Media

UID_RE = re.compile(r"[0-9a-f]{32}")
THUMBNAILS_PREFIX = "original/thumbnails/"


def _ttl():
    return getattr(settings, "X_ACCEL_AUTH_CACHE_SECONDS", 300)


def _extract_uid(uri):
    if not uri:
        return None
    match = UID_RE.search(uri)
    return match.group(0) if match else None


def _relpath_from_uri(uri):
    path = unquote(uri.split("?", 1)[0])
    media_url = settings.MEDIA_URL
    if path.startswith(media_url):
        return path[len(media_url) :]
    return None


def _lookup_uid_by_path(relpath):
    path_key = f"xaccel:path:{relpath}"
    cached = cache.get(path_key)
    if cached is not None:
        return cached or None

    parts = relpath.split("/", 4)
    if len(parts) < 5 or parts[2] != "user":
        cache.set(path_key, "", _ttl())
        return None
    username = parts[3]

    row = Media.objects.filter(user__username=username).filter(Q(uploaded_thumbnail=relpath) | Q(uploaded_poster=relpath)).values("uid").first()
    uid_hex = row["uid"].hex if row else ""
    cache.set(path_key, uid_hex, _ttl())
    return uid_hex or None


def _lookup_state(uid):
    """Return (state, owner_id) for a uid, or (None, None) if missing.

    Cached on uid alone since state/ownership do not depend on the requester.
    Uses .values() rather than .only() because Media.__init__ touches deferred
    file fields, which would otherwise recurse via refresh_from_db.
    """
    state_key = f"xaccel:state:{uid}"
    cached = cache.get(state_key)
    if cached is not None:
        return cached
    row = Media.objects.filter(uid=uid).values("state", "user_id").first()
    value = (row["state"], row["user_id"]) if row else (None, None)
    cache.set(state_key, value, _ttl())
    return value


def _decide(uid, user):
    state, owner_id = _lookup_state(uid)
    if state is None:
        return False
    if state in ("public", "unlisted"):
        return True
    # private
    if not user.is_authenticated:
        return False
    if owner_id == user.id:
        return True
    if is_mediacms_editor(user):
        return True
    # RBAC / MediaPermission path needs a full Media instance.
    try:
        media = Media.objects.get(uid=uid)
    except Media.DoesNotExist:
        return False
    return user.has_member_access_to_media(media)


@csrf_exempt
@require_GET
def media_auth(request):
    """Authorize a protected media request from nginx auth_request.

    nginx passes the original request URI in the X-Original-URI header. The
    Media.uid (32 hex chars, no dashes) is embedded somewhere in that URI for
    every protected path. No uid => deny. Unknown uid => deny.
    """
    if not getattr(settings, "USE_X_ACCEL_REDIRECT", True):
        return HttpResponse(status=204)

    uri = request.META.get("HTTP_X_ORIGINAL_URI", "")
    uid = _extract_uid(uri)
    if not uid:
        # User-uploaded thumbnails/posters don't have the uid in the filename.
        # Fall back to a per-path lookup, scoped to /original/thumbnails/.
        relpath = _relpath_from_uri(uri)
        if relpath and relpath.startswith(THUMBNAILS_PREFIX):
            uid = _lookup_uid_by_path(relpath)
        if not uid:
            return HttpResponse(status=403)

    user = request.user
    cache_key = f"xaccel:auth:{uid}:{user.id if user.is_authenticated else 'anon'}"
    cached = cache.get(cache_key)
    if cached is None:
        allowed = _decide(uid, user)
        cache.set(cache_key, allowed, _ttl())
    else:
        allowed = cached

    return HttpResponse(status=204 if allowed else 403)
