import re
from functools import reduce
from operator import or_
from urllib.parse import unquote

from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET

from ..methods import is_mediacms_editor
from ..models import Media, Subtitle

UID_RE = re.compile(r"^[0-9a-f]{32}$")
FILENAME_UID_RE = re.compile(r"^([0-9a-f]{32})(?:[._]|$)")

THUMBNAILS_PREFIX = "original/thumbnails/"
SUBTITLES_PREFIX = "original/subtitles/"

THUMBNAIL_FIELDS = ("uploaded_thumbnail", "uploaded_poster", "thumbnail", "poster", "sprites")


def _ttl():
    return getattr(settings, "X_ACCEL_AUTH_CACHE_SECONDS", 300)


def _decoded_path(uri):
    return unquote(uri.split("?", 1)[0])


def _has_traversal(path):
    return any(segment == ".." for segment in path.split("/"))


def _relpath(path):
    """The MEDIA_ROOT relative path a decoded request path refers to, or None"""
    media_url = settings.MEDIA_URL
    if path.startswith(media_url):
        return path[len(media_url) :] or None
    return None


def _uid_at_its_position(relpath):
    """The uid a path states outright, read only from where its family puts it"""
    parts = relpath.split("/")
    if parts[0] == "hls":
        return parts[1] if len(parts) > 1 and UID_RE.match(parts[1]) else None
    match = FILENAME_UID_RE.match(parts[-1])
    return match.group(1) if match else None


def _uid_by_stored_path(relpath):
    """The uid of the media that actually owns this exact file, or None.

    The authoritative resolution, for the families whose filenames are arbitrary
    and so state no uid: subtitles, and uploaded thumbnails and posters. The file
    is matched by the path stored on the row and scoped to the owner named in the
    path, so the answer is a property of the file being served and of nothing else.
    """
    path_key = f"xaccel:path:{relpath}"
    cached = cache.get(path_key)
    if cached is not None:
        return cached or None

    parts = relpath.split("/", 4)
    uid_hex = ""
    if len(parts) == 5 and parts[2] == "user":
        username = parts[3]
        if relpath.startswith(SUBTITLES_PREFIX):
            row = Subtitle.objects.filter(media__user__username=username, subtitle_file=relpath).values("media__uid").first()
            uid_hex = row["media__uid"].hex if row else ""
        elif relpath.startswith(THUMBNAILS_PREFIX):
            stored_on = reduce(or_, (Q(**{field: relpath}) for field in THUMBNAIL_FIELDS))
            row = Media.objects.filter(user__username=username).filter(stored_on).values("uid").first()
            uid_hex = row["uid"].hex if row else ""

    cache.set(path_key, uid_hex, _ttl())
    return uid_hex or None


def _resolve_uid(relpath):
    """The one media uid a protected path resolves to, or None.

    Subtitles carry no uid at all, so they are resolved by their stored path or
    not at all. Thumbnails may be either an upload with an arbitrary name or a
    generated file named after its own media, so the stored path is tried first
    and the name second - and since a generated name begins with the uid of the
    media it belongs to, neither route can name a different media than the file
    does. Everything else states its uid positionally.
    """
    if relpath.startswith(SUBTITLES_PREFIX):
        return _uid_by_stored_path(relpath)
    if relpath.startswith(THUMBNAILS_PREFIX):
        return _uid_by_stored_path(relpath) or _uid_at_its_position(relpath)
    return _uid_at_its_position(relpath)


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

    nginx passes the original request URI in the X-Original-URI header, query
    string included, but resolves the file it will serve from the path alone. So
    the decision is taken from the path alone as well: the query string is
    discarded before anything reads it, and the media is resolved from the one
    position in the path that names it. Anything unresolvable is denied.
    """
    if not getattr(settings, "USE_X_ACCEL_REDIRECT", True):
        return HttpResponse(status=204)

    uri = request.META.get("HTTP_X_ORIGINAL_URI", "")
    path = _decoded_path(uri)

    if _has_traversal(path):
        return HttpResponse(status=403)

    relpath = _relpath(path)
    if not relpath:
        return HttpResponse(status=403)

    uid = _resolve_uid(relpath)
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
