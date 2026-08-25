import hashlib
import logging
import re
import time
from urllib.parse import urlparse

import requests
from django.conf import settings

from .base import BaseProvider

logger = logging.getLogger(__name__)

SESSION_TYPE_USER = 0
SESSION_TYPE_ADMIN = 2

# An app token is exchanged for a session by hashing the widget session together with
# the token, using whichever algorithm the token was created with. Kaltura will not tell
# us which that is before we hold a session, so the usable ones are tried in turn,
# starting with the default the API console and KMC produce. A portal can pin it with
# app_token_hash_type in the connection and skip the search.
APP_TOKEN_HASH_TYPES = ("sha256", "sha1", "sha512", "md5")

ENTRY_STATUS_READY = 2

# Kaltura flavor asset status. Same value as ENTRY_STATUS_READY but a different enum.
FLAVOR_STATUS_READY = 2
# KalturaMediaType. images carry no flavor assets at all: the file lives on the
# entry itself, as downloadUrl
MEDIA_TYPE_IMAGE = 2

# Kaltura refuses pageIndex * pageSize beyond this
KALTURA_MAX_PAGE_SIZE = 10000

# KalturaPrivacyType
PRIVACY_ALL = 1
PRIVACY_AUTHENTICATED = 2
PRIVACY_MEMBERS_ONLY = 3

# KalturaAppearInListType and KalturaContributionPolicyType
APPEAR_IN_LIST_PARTNER = 1
APPEAR_IN_LIST_MEMBERS_ONLY = 3
CONTRIBUTION_ALL = 1
CONTRIBUTION_MEMBERS = 2

# What a KMS category type means, worked out from the three permission fields rather than
# from its name. Verified against a live portal: an Open channel reads (2, 1, 1) and a
# Private one (3, 3, 2), while a channel *named* Restricted read (1, 1, 1), which is to
# say it was configured as Public. Names cannot be trusted, the fields can.
CATEGORY_PUBLIC = "public"
CATEGORY_OPEN = "open"
CATEGORY_RESTRICTED = "restricted"
CATEGORY_PRIVATE = "private"

# KalturaCategoryUserPermissionLevel, and what each becomes in MediaCMS RBAC. Kaltura's
# moderator approves submissions and can add content but cannot manage the category, so it
# maps to contributor: that keeps the ability to contribute without granting management.
CATEGORY_PERMISSION_ROLES = {
    0: "manager",
    1: "contributor",
    2: "contributor",
    3: "member",
}
CATEGORY_USER_ACTIVE = 1

# KalturaCategoryEntryStatus: 1 PENDING, 2 ACTIVE, 3 DELETED, 4 REJECTED. An entry sitting
# in a category is not necessarily published through it: a category with moderation on
# holds submissions at PENDING until someone approves them, and a rejected one stays in the
# list too. Only ACTIVE counts as published, so only ACTIVE may lend an entry the
# category's state. Verified live: published entries on the test portal all read 2.
CATEGORY_ENTRY_ACTIVE = 2

# KalturaEntryModerationStatus. APPROVED and AUTO_APPROVED are published; PENDING,
# REJECTED and FLAGGED are not, whatever their categories say.
MODERATION_APPROVED = 2
MODERATION_AUTO_APPROVED = 6
MODERATION_PUBLISHED = (MODERATION_APPROVED, MODERATION_AUTO_APPROVED)

# KalturaEntryDisplayInSearchType: -2 RECYCLED, -1 SYSTEM, 0 NONE, 1 PARTNER_ONLY,
# 2 KALTURA_NETWORK. PARTNER_ONLY is the value an ordinary entry gets, so only the three
# at or below zero mean the entry was kept out of search. This read 1 for all 74 entries
# on the test portal, which is what a default looks like, not a deliberate choice.
DISPLAY_IN_SEARCH_RECYCLED = -2
DISPLAY_IN_SEARCH_SYSTEM = -1
DISPLAY_IN_SEARCH_NONE = 0
DISPLAY_IN_SEARCH_PARTNER_ONLY = 1
DISPLAY_IN_SEARCH_HIDDEN = (DISPLAY_IN_SEARCH_RECYCLED, DISPLAY_IN_SEARCH_SYSTEM, DISPLAY_IN_SEARCH_NONE)

# Kaltura role names differ between partners and their ids are stable only within one,
# so a mapping row carries both: the id is matched first when it is known, the name is
# the fallback. This ships as the default contents of the migration's role map option,
# editable per migration, rather than as a code path.
DEFAULT_ROLE_MAP = [
    {"id": "", "name": "Content Moderator", "role": "editor"},
    {"id": "", "name": "Content Uploader", "role": "manager"},
    {"id": "", "name": "Player Designer", "role": "manager"},
    {"id": "", "name": "Manager", "role": "admin"},
    {"id": "", "name": "Publisher Administrator", "role": "admin"},
]

# what set_role_from_mapping understands. "admin" grants Django superuser and staff
MEDIACMS_ROLES = ("", "advancedUser", "editor", "manager", "admin")

# KMS path segments that are structure rather than a real category
KMS_SCAFFOLDING = ("galleries", "channels")

# KMS publishes media into galleries and channels. Everything else under a root
# (private, unlisted, archive, playlists, the site container itself, nestedFilters)
# is housekeeping and must never become a MediaCMS category.
KMS_CONTENT_PATHS = (">site>galleries>", ">site>channels>")
KMS_HOUSEKEEPING = ("private", "unlisted", "archive", "playlists")

# How far a flavor may be filed from its real height. Kaltura heights rarely match
# MediaCMS profiles exactly (272 -> 240, 576 -> 480 are fine), but a source often
# carries two flavors at the same height, and without a bound the loser cascades
# down to a wildly wrong profile: a 360p file offered as 144p defeats the point of
# having a low bandwidth rendition at all.
PROFILE_MIN_RATIO = 0.6
PROFILE_MAX_RATIO = 1.4

CATEGORY_TITLE_MAX = 100
USERNAME_MAX = 150

USERNAME_INVALID = re.compile(r"[^\w.@-]", re.ASCII)

# codes that mean the session went stale mid migration and one retry is worth it.
# START_SESSION_ERROR is deliberately absent: get_ks() raises it directly as an
# exception, so it never reaches the dict inspection in call() that reads this.
RETRYABLE_KS_ERRORS = ("INVALID_KS", "EXPIRED_KS")

# Kaltura namespaces plugin services. Caption assets belong to the "caption"
# plugin, so the service is caption_captionasset and not captionAsset: the latter
# answers SERVICE_DOES_NOT_EXISTS. Core services (media, flavorAsset,
# categoryEntry, userRole) are not namespaced.
CAPTION_ASSET_SERVICE = "caption_captionasset"


class KalturaAPIError(Exception):
    """A Kaltura API level error. Not retried, it is a real answer."""

    def __init__(self, code, message):
        self.code = code
        self.message = message
        super().__init__(f"{code}: {message}")


class KalturaClient:
    """Thin client over the Kaltura api_v3 REST interface"""

    # re-issue the KS well before Kaltura's 24 hour default expires
    SESSION_TTL = 60 * 60 * 20
    SESSION_EXPIRY = 60 * 60 * 24

    def __init__(self, service_url, partner_id, app_token_id, app_token, hash_type="", timeout=None):
        self.service_url = (service_url or "").rstrip("/")
        self.partner_id = str(partner_id or "")
        self.app_token_id = app_token_id or ""
        self.app_token = app_token or ""
        self.hash_type = (hash_type or "").lower()
        self.timeout = timeout or getattr(settings, "MIGRATION_API_TIMEOUT", 60)
        self.ks = None
        self.ks_issued_at = 0
        self.session = requests.Session()

    def _url(self, service, action):
        return f"{self.service_url}/api_v3/service/{service}/action/{action}"

    def _flatten(self, params, prefix=""):
        """Kaltura expects nested objects as filter:orderBy=... form fields"""
        flat = {}
        for key, value in params.items():
            name = f"{prefix}{key}"
            if isinstance(value, dict):
                flat.update(self._flatten(value, prefix=f"{name}:"))
            elif value is not None:
                flat[name] = value
        return flat

    def _post(self, url, data):
        """The single HTTP seam. Tests patch this."""
        response = self.session.post(url, data=data, timeout=self.timeout)
        response.raise_for_status()
        return response.json()

    def _post_with_retries(self, url, data):
        attempts = getattr(settings, "MIGRATION_MAX_RETRIES", 3)
        delay = 2
        for attempt in range(1, attempts + 1):
            try:
                return self._post(url, data)
            except requests.RequestException:
                if attempt >= attempts:
                    raise
                time.sleep(delay)
                delay *= 2

    @staticmethod
    def _is_error(result):
        return isinstance(result, dict) and result.get("objectType") == "KalturaAPIException"

    def _hash_candidates(self):
        """Hash algorithms to try, the known one first if we have learned it"""
        if self.hash_type in APP_TOKEN_HASH_TYPES:
            return (self.hash_type,) + tuple(h for h in APP_TOKEN_HASH_TYPES if h != self.hash_type)
        return APP_TOKEN_HASH_TYPES

    def _start_widget_session(self):
        """An unprivileged session, which is all it takes to present an app token"""
        result = self.call("session", "startWidgetSession", use_session=False, widgetId=f"_{self.partner_id}")
        widget_ks = result.get("ks") if isinstance(result, dict) else None
        if not widget_ks:
            raise KalturaAPIError("START_SESSION_ERROR", "session.startWidgetSession returned no ks")
        return widget_ks

    def get_ks(self):
        """Current Kaltura Session, started or re-issued as needed.

        Sessions come from an app token rather than the administrator secret. The token
        can be revoked on its own and carries only the privileges it was created with,
        so a portal never has to hand over the secret for the whole account.
        """
        if self.ks and (time.time() - self.ks_issued_at) < self.SESSION_TTL:
            return self.ks

        widget_ks = self._start_widget_session()

        last_error = None
        for hash_type in self._hash_candidates():
            token_hash = hashlib.new(hash_type, f"{widget_ks}{self.app_token}".encode()).hexdigest()
            try:
                result = self.call(
                    "appToken",
                    "startSession",
                    use_session=False,
                    ks=widget_ks,
                    id=self.app_token_id,
                    tokenHash=token_hash,
                    expiry=self.SESSION_EXPIRY,
                )
            except KalturaAPIError as exc:
                # a wrong algorithm is indistinguishable from a wrong token, so the
                # remaining ones are tried before giving up
                last_error = exc
                continue

            ks = result.get("ks") if isinstance(result, dict) else None
            if ks:
                if self.hash_type != hash_type:
                    logger.info("kaltura app token %s uses %s", self.app_token_id, hash_type)
                    self.hash_type = hash_type
                self.ks = ks
                self.ks_issued_at = time.time()
                return self.ks
            last_error = KalturaAPIError("START_SESSION_ERROR", "appToken.startSession returned no ks")

        raise last_error or KalturaAPIError("START_SESSION_ERROR", "could not start a session from the app token")

    # parameters whose values are safe to put in a log and useful when reading it
    LOGGABLE_PARAMS = (
        "entryId",
        "id",
        "userId",
        "partnerId",
        "categoryIdEqual",
        "filter:entryIdEqual",
        "filter:idIn",
        "filter:orderBy",
        "filter:statusEqual",
        "filter:createdAtGreaterThanOrEqual",
        "filter:createdAtLessThanOrEqual",
        "filter:fullNameStartsWith",
        "pager:pageSize",
        "pager:pageIndex",
    )

    @classmethod
    def _loggable(cls, data):
        """A one line parameter summary that cannot leak the admin secret or the KS"""
        shown = {key: value for key, value in data.items() if key in cls.LOGGABLE_PARAMS}
        hidden = sorted(set(data) - set(shown) - {"format"})
        summary = " ".join(f"{key}={value}" for key, value in sorted(shown.items()))
        if hidden:
            summary = f"{summary} [+{','.join(hidden)}]".strip()
        return summary

    @staticmethod
    def _describe(result):
        """What came back, without dumping the payload"""
        if isinstance(result, dict):
            objects = result.get("objects")
            if isinstance(objects, list):
                total = result.get("totalCount")
                return f"{len(objects)} objects" + (f" of {total}" if total is not None else "")
            return "object"
        if isinstance(result, list):
            return f"{len(result)} objects"
        if isinstance(result, str):
            return "string"
        return type(result).__name__

    def call(self, service, action, use_session=True, **params):
        """Call one Kaltura service action and return the decoded result.

        Every call is logged on the way out and on the way back with its duration,
        so a slow Kaltura shows up as a slow line rather than an unexplained gap.
        Secrets are never logged: only the parameter names are, plus the values of
        the handful that are safe and useful for reading the log.
        """
        url = self._url(service, action)
        data = self._flatten(params)
        data["format"] = 1
        if use_session:
            data["ks"] = self.get_ks()

        logger.info("kaltura -> %s.%s %s", service, action, self._loggable(data))
        started = time.monotonic()
        try:
            result = self._post_with_retries(url, data)
        except Exception as exc:
            logger.warning("kaltura <- %s.%s FAILED after %.2fs: %s", service, action, time.monotonic() - started, exc)
            raise
        elapsed = time.monotonic() - started
        if self._is_error(result):
            # a Kaltura API error arrives as HTTP 200, so it has to be recognised
            # here or a failure would be logged as a successful call
            logger.warning(
                "kaltura <- %s.%s API ERROR after %.2fs: %s %s",
                service,
                action,
                elapsed,
                result.get("code") or "",
                result.get("message") or "",
            )
        else:
            logger.info("kaltura <- %s.%s %s in %.2fs", service, action, self._describe(result), elapsed)

        if self._is_error(result):
            code = result.get("code") or ""
            if use_session and code in RETRYABLE_KS_ERRORS:
                self.ks = None
                self.ks_issued_at = 0
                data["ks"] = self.get_ks()
                result = self._post_with_retries(url, data)
                if self._is_error(result):
                    raise KalturaAPIError(result.get("code") or "", result.get("message") or "")
                return result
            raise KalturaAPIError(code, result.get("message") or "")

        return result

    def count(self, service, kfilter=None):
        """Total number of objects a list service reports"""
        result = self.call(service, "list", filter=kfilter or {}, pager={"pageSize": 1, "pageIndex": 1})
        return result.get("totalCount", 0) if isinstance(result, dict) else 0

    def list_page_by_index(self, service, cursor, page_size, kfilter=None):
        """Plain pageIndex paging, for object types small enough to stay under
        Kaltura's 10000 result ceiling. Returns (objects, next_cursor).
        """
        cursor = dict(cursor or {})
        page_index = cursor.get("page_index") or 1
        result = self.call(
            service,
            "list",
            filter=kfilter or {},
            pager={"pageSize": page_size, "pageIndex": page_index},
        )
        objects = result.get("objects") or [] if isinstance(result, dict) else []
        if not objects:
            return [], cursor
        return objects, {"page_index": page_index + 1}

    def list_entries_page(self, cursor, page_size, kfilter=None):
        """One page of media entries, paged by createdAt.

        Kaltura rejects pageIndex * pageSize beyond 10000, so entries are walked
        forward in creation order. The cursor holds the last createdAt reached
        plus the ids already handled at exactly that timestamp, which is what
        keeps entries sharing a createdAt from being skipped or repeated.
        """
        cursor = dict(cursor or {})
        created_at = cursor.get("created_at") or 0
        seen = list(cursor.get("seen_ids") or [])

        # The caller's filter goes in FIRST. The cursor derived keys are applied
        # after it and must win: a static user option such as created_after would
        # otherwise overwrite the resume boundary on every page, making the query
        # restart from the same timestamp forever.
        entry_filter = dict(kfilter or {})
        floor = entry_filter.get("createdAtGreaterThanOrEqual") or 0
        entry_filter["orderBy"] = "+createdAt"
        entry_filter["statusEqual"] = ENTRY_STATUS_READY
        if created_at or floor:
            # keep honouring the user's created_after floor on the first page,
            # then let the advancing cursor take over
            entry_filter["createdAtGreaterThanOrEqual"] = max(created_at or 0, floor)

        # A pathological source can have more entries sharing one createdAt than
        # Kaltura will return in a single page. seen grows each round in that case,
        # and pageSize grows with it, back towards the 10000 row ceiling this whole
        # scheme exists to avoid. Fail with something an operator can act on rather
        # than letting Kaltura refuse the request.
        requested_page_size = page_size + len(seen)
        if requested_page_size > KALTURA_MAX_PAGE_SIZE:
            raise KalturaAPIError(
                "PAGINATION_LIMIT",
                f"More than {KALTURA_MAX_PAGE_SIZE} entries share createdAt={created_at}; "
                "this exceeds what Kaltura will return in one page. Narrow the migration "
                "with the created_after or created_before options to get past this block.",
            )

        # ask for enough rows that the already handled ids at the boundary
        # cannot fill the whole page
        result = self.call(
            "media",
            "list",
            filter=entry_filter,
            pager={"pageSize": requested_page_size, "pageIndex": 1},
        )
        objects = result.get("objects") or [] if isinstance(result, dict) else []

        seen_set = set(seen)
        entries = [entry for entry in objects if entry.get("id") not in seen_set][:page_size]
        if not entries:
            return [], cursor

        last_created_at = entries[-1].get("createdAt") or created_at
        boundary_ids = [entry.get("id") for entry in entries if entry.get("createdAt") == last_created_at]
        if last_created_at == created_at:
            boundary_ids = seen + boundary_ids

        return entries, {"created_at": last_created_at, "seen_ids": boundary_ids}

    def check_connection(self, entry_filter=None, user_ids=None):
        """Start a session and report the totals the dashboard needs.

        entry_filter narrows the entry count the same way the migration itself
        will be narrowed, so the dashboard denominator matches what will actually
        be imported. user_ids additionally reports a count per user: Kaltura
        answers an unknown user with zero rather than an error, so a mistyped id
        is only visible as its own zero.
        """
        try:
            self.get_ks()
            stats = {
                "entries": self.count("media", entry_filter),
                "users": self.count("user"),
                "categories": self.count("category"),
            }
            if user_ids:
                stats["entries_per_user"] = {user_id: self.count("media", {"userIdIn": user_id}) for user_id in user_ids}
            return {"ok": True, "error": "", "stats": stats}
        except KalturaAPIError as exc:
            return {"ok": False, "error": str(exc), "stats": {}}
        except requests.RequestException as exc:
            return {"ok": False, "error": f"Could not reach {self.service_url}: {exc}", "stats": {}}


# A role Kaltura's own modules open sessions with, rather than one an administrator
# assigns to a person. There is no flag on the object saying which is which, so this goes
# by the shape of the system name: the module roles use SCREAMING_SNAKE constants, the
# service roles an integration creates for itself carry no system name at all, and a
# couple of built ins are named like people roles without being assignable.
SYSTEM_ROLE_NAME = re.compile(r"^[A-Z0-9_]+$")
INTERNAL_ROLE_NAMES = ("basic user session role", "no session")


def is_selectable_category(full_name, all_paths):
    """Whether a category is one a person would pick to migrate.

    A KMS portal keeps its content one level below >site>galleries or >site>channels, and
    everything above that is scaffolding: the instance root, its site, and the two folders
    themselves. Those are excluded even though the root looks exactly like a top level
    category on a portal not using KMS, which is what tells them apart: a KMS root has a
    >site> child and a real category does not. Anything deeper is left out because
    choosing a category already brings its subtree.
    """
    if not full_name:
        return False

    for marker in KMS_CONTENT_PATHS:
        if marker in full_name + ">":
            below = full_name.split(marker, 1)[1] if marker in full_name else ""
            return bool(below) and ">" not in below

    # not a KMS path: the top level categories of an ordinary portal, minus the roots of
    # any KMS instance living alongside them
    if ">" in full_name:
        return False
    return not any(path.startswith(full_name + ">site>") for path in all_paths)


def is_internal_role(system_name):
    """Whether a Kaltura role belongs to the platform rather than to people"""
    system_name = (system_name or "").strip()
    if not system_name:
        return True
    if SYSTEM_ROLE_NAME.match(system_name):
        return True
    return system_name.lower() in INTERNAL_ROLE_NAMES


def parse_comma_list(raw):
    """The Kaltura user ids from a comma separated option value.

    Kaltura ignores a filter field it cannot use rather than rejecting it, so an
    empty userIdIn would widen a restricted run to the whole portal instead of
    narrowing it. Everything downstream therefore treats an empty result as "no
    restriction was usable" and refuses to run, rather than filtering on nothing.
    """
    seen = []
    for part in str(raw or "").replace("\n", ",").split(","):
        value = part.strip()
        if value and value not in seen:
            seen.append(value)
    return seen


def category_type(category):
    """Which KMS category type a Kaltura category is configured as.

    privacy is what decides who may *view*, and so it is what decides the type here.
    contributionPolicy decides who may *add* content, which is a publishing right rather
    than a visibility one, so it never makes a category less visible than its privacy says.
    KMS offers "Public, Restricted", meaning anyone including anonymous users may watch
    while only members may contribute, and reading contributionPolicy as a visibility field
    would hide that whole channel. appearInList can still narrow the authenticated tier,
    where the difference between listed and members-only is a real access difference.

    Shared Repository is a channel type whose viewing rule is members only, so it arrives
    here as MEMBERS_ONLY and lands on private like any other members-only channel. Its own
    distinguishing feature, that content may be published onward into other channels, is a
    publishing entitlement with no MediaCMS equivalent and is not carried over.

    An unrecognised privacy value is read as the most restrictive type, because guessing
    generously is how content leaks.
    """
    privacy = category.get("privacy")
    appear_in_list = category.get("appearInList")
    contribution = category.get("contributionPolicy")

    if privacy == PRIVACY_MEMBERS_ONLY:
        return CATEGORY_PRIVATE
    if privacy == PRIVACY_AUTHENTICATED:
        if contribution == CONTRIBUTION_MEMBERS or appear_in_list == APPEAR_IN_LIST_MEMBERS_ONLY:
            return CATEGORY_RESTRICTED
        return CATEGORY_OPEN
    if privacy == PRIVACY_ALL:
        return CATEGORY_PUBLIC
    return CATEGORY_RESTRICTED


# What each category type becomes. MediaCMS has three states and Kaltura's Open type,
# "any authenticated user may view", is not one of them, so it lands on unlisted and is a
# documented downgrade: on a portal that is not login only, unlisted is reachable by
# anyone holding the link. Restricted goes to private instead, since its membership is
# about publishing rather than viewing and there is nothing to gate viewing with.
CATEGORY_TYPE_STATE = {
    CATEGORY_PUBLIC: "public",
    CATEGORY_OPEN: "unlisted",
    CATEGORY_RESTRICTED: "private",
    CATEGORY_PRIVATE: "private",
}

# most permissive first: an entry in both a public and a private category is reachable
# through the public one, which is how Kaltura behaves too
STATE_PRECEDENCE = ("public", "unlisted", "private")


def media_state(categories, display_in_search=None, moderation_status=None):
    """MediaCMS state for a Kaltura entry.

    Kaltura entries carry no public or private flag of their own, so the state comes from
    the categories the entry belongs to, and the most permissive one wins. An entry in no
    category at all is private. An entry held out of search only ever downgrades: it turns
    public into unlisted and never promotes anything. An entry that has not cleared moderation is
    private regardless of where it sits, since it was not published on the source either.

    Accepts category dicts. A bare privacy integer is still accepted so that a caller with
    nothing but privacy to hand keeps working.
    """
    if moderation_status is not None and moderation_status not in MODERATION_PUBLISHED:
        return "private"

    states = []
    for category in categories or []:
        if isinstance(category, dict):
            states.append(CATEGORY_TYPE_STATE[category_type(category)])
        elif category is not None:
            states.append(CATEGORY_TYPE_STATE[category_type({"privacy": category})])

    state = "private"
    for candidate in STATE_PRECEDENCE:
        if candidate in states:
            state = candidate
            break

    if display_in_search in DISPLAY_IN_SEARCH_HIDDEN and state == "public":
        state = "unlisted"
    return state


def mediacms_role(role_id, role_name, role_map=None):
    """MediaCMS role for User.set_role_from_mapping, or "" for a plain user.

    Matched on the Kaltura role id when the mapping row carries one, since ids are exact
    within a partner, and on the name otherwise. Names are compared case insensitively
    because a portal's own roles report a display name rather than a system name.
    """
    rows = role_map if role_map is not None else DEFAULT_ROLE_MAP

    wanted_id = str(role_id or "").strip()
    if wanted_id:
        for row in rows:
            if str(row.get("id") or "").strip() == wanted_id:
                return row.get("role") or ""

    wanted_name = str(role_name or "").strip().lower()
    if wanted_name:
        for row in rows:
            if str(row.get("name") or "").strip().lower() == wanted_name:
                return row.get("role") or ""

    return ""


def is_importable_category(full_name):
    """Whether a Kaltura category should become a MediaCMS category.

    Root agnostic, so an installation hosting several KMS instances side by side
    needs no configuration. A portal not using KMS at all has no ">site>" paths
    and its categories are kept as they are.
    """
    name = str(full_name or "")
    if not name:
        # the source did not say where this category sits; dropping it would lose
        # a real one, so keep it
        return True
    if any(path in name for path in KMS_CONTENT_PATHS):
        return True
    if ">site" in name:
        return False
    parts = [part.strip().lower() for part in name.split(">") if part.strip()]
    if len(parts) > 1 and parts[1] in KMS_HOUSEKEEPING:
        return False
    return True


def category_title_and_description(full_name):
    """Split a Kaltura fullName into a MediaCMS title and a readable path.

    "MediaSpace>site>galleries>Engineering>1. Term>Electronics"
    becomes ("Electronics", "Engineering: 1. Term: Electronics").

    Everything up to and including the galleries or channels segment is KMS
    scaffolding and is dropped, whatever the root is called.
    """
    parts = [part.strip() for part in (full_name or "").split(">") if part.strip()]

    # only strip galleries/channels when they sit directly under a "site" segment,
    # so a real top level category named "Channels" is left alone
    for index in range(1, len(parts)):
        if parts[index - 1].lower() == "site" and parts[index].lower() in KMS_SCAFFOLDING:
            parts = parts[index + 1 :]
            break

    if not parts:
        return "", ""

    title = parts[-1][:CATEGORY_TITLE_MAX]
    description = ": ".join(parts)
    return title, description


def _fit_with_suffix(base, suffix):
    """base + suffix, trimmed to the model's limit without losing the suffix.

    Trimming the formatted string would discard the very part that makes the
    title unique, so the base is trimmed first to leave room.
    """
    suffix = suffix[: CATEGORY_TITLE_MAX // 2]
    room = max(1, CATEGORY_TITLE_MAX - len(suffix))
    return f"{base[:room]}{suffix}"


def unique_category_title(title, parent_name, taken):
    """A title not already in `taken`.

    Category titles act as identifiers in MediaCMS URLs, so flattening a tree
    has to resolve collisions. The parent name is tried first because it reads
    naturally, then a counter.

    Every candidate reserves room for its own suffix. Truncating after
    formatting would collapse long titles back onto the string that was already
    taken, and the loop would never terminate.
    """
    if title not in taken:
        return title

    if parent_name:
        candidate = _fit_with_suffix(title, f" ({parent_name})")
        if candidate not in taken:
            return candidate

    index = 2
    while True:
        candidate = _fit_with_suffix(title, f" ({index})")
        if candidate not in taken:
            return candidate
        index += 1


def match_flavors_to_profiles(flavors, profiles):
    """Pair Kaltura flavors with MediaCMS encode profiles.

    Each flavor takes the profile closest to its height, preferring a profile
    at or below that height on a tie. One flavor per profile: if two flavors
    want the same profile the closer match wins and the other is dropped.

    Returns a list of (flavor, profile) tuples.
    """
    # every viable (flavor, profile) pair is ranked, not just each flavor's
    # single favourite. Ranking only favourites means that when two flavors want
    # the same profile the loser is dropped outright, even with free profiles
    # left over, silently losing a rendition.
    usable = [profile for profile in profiles if profile.resolution and profile.active]

    candidates = []
    for flavor in flavors or []:
        extension = (flavor.get("fileExt") or "").lower()
        if extension not in ("mp4", "webm"):
            continue
        height = flavor.get("height") or 0

        for profile in usable:
            if profile.extension != extension:
                continue
            # a profile has to actually describe this file. Without the bound, a
            # duplicate resolution in the source ends up several tiers away from
            # the truth, and the player offers a rendition that is not what it says.
            if not height or not (height * PROFILE_MIN_RATIO <= profile.resolution <= height * PROFILE_MAX_RATIO):
                continue
            distance = abs(height - profile.resolution)
            above = 0 if profile.resolution <= height else 1
            candidates.append(((distance, above), flavor, profile))

    candidates.sort(key=lambda item: item[0])

    pairs = []
    used_profiles = set()
    used_flavors = set()
    for _key, flavor, profile in candidates:
        if profile.id in used_profiles or flavor.get("id") in used_flavors:
            continue
        used_profiles.add(profile.id)
        used_flavors.add(flavor.get("id"))
        pairs.append((flavor, profile))
    return pairs


def sanitize_username(value):
    """Turn a Kaltura user id into something the MediaCMS username validator accepts"""
    cleaned = USERNAME_INVALID.sub("-", (value or "").strip())
    cleaned = re.sub(r"-{2,}", "-", cleaned).strip("-")
    if not cleaned:
        return "migrated-user"
    # strip again after the cap: truncation can land exactly on a dash
    return cleaned[:USERNAME_MAX].strip("-") or "migrated-user"


class KalturaProvider(BaseProvider):
    name = "kaltura"
    label = "Kaltura"
    implemented = True

    secret_keys = ("app_token",)
    retired_options = ("create_categories", "map_permissions")
    retired_connection_keys = ("admin_secret", "user_id")
    required_connection_keys = ("service_url", "partner_id", "app_token_id", "app_token")
    default_options = {
        # on: every user in the portal is migrated. off: reveals create_users
        "migrate_all_users": True,
        # only consulted when migrate_all_users is off: create the owners of imported media
        "create_users": True,
        # only consulted when create_users is off: who owns everything instead
        "fallback_username": "admin",
        # on: every gallery and channel. off: only the categories that have media
        "migrate_all_categories": True,
        # ids of the categories to migrate. Empty means the whole portal. A selected
        # category brings its whole subtree with it
        "source_category_ids": "",
        "import_captions": True,
        "preserve_views": True,
        "preserve_publish_state": True,
        "skip_transcoding": True,
        "created_after": None,
        "created_before": None,
        "root_category": None,
        "max_items": None,
        "restrict_to_users": False,
        "source_user_ids": "",
        "role_map": DEFAULT_ROLE_MAP,
    }

    def __init__(self, connection, options):
        super().__init__(connection, options)
        self._client = None
        self._selected_paths = None

    @classmethod
    def source_system(cls, connection):
        url = (connection.get("service_url") or "").strip()
        if url and "://" not in url:
            # urlparse puts a scheme-less URL in the path, leaving netloc empty,
            # which would make every scheme-less installation collide
            url = f"https://{url}"
        host = urlparse(url).netloc.lower().rstrip("/")
        return f"kaltura:{connection.get('partner_id') or ''}@{host}"

    @property
    def client(self):
        if self._client is None:
            self._client = KalturaClient(
                service_url=self.connection.get("service_url"),
                partner_id=self.connection.get("partner_id"),
                app_token_id=self.connection.get("app_token_id"),
                app_token=self.connection.get("app_token"),
                # optional: pin the algorithm and skip trying the others
                hash_type=self.connection.get("app_token_hash_type") or "",
            )
        return self._client

    def check_connection(self):
        user_ids = self.restricted_user_ids()
        if self.options.get("restrict_to_users") and not user_ids:
            # never answer with portal wide numbers while a restriction is switched on:
            # an empty list produces no filter at all, which reads as "everything"
            return {"ok": False, "error": "Restricting to specific users needs at least one Kaltura user id.", "stats": {}}
        return self.client.check_connection(entry_filter=self._entry_filter(), user_ids=user_ids)

    def _entry_filter(self):
        """Optional user supplied narrowing of the media phase"""
        kfilter = {}
        if self.options.get("created_after"):
            kfilter["createdAtGreaterThanOrEqual"] = self.options["created_after"]
        if self.options.get("created_before"):
            kfilter["createdAtLessThanOrEqual"] = self.options["created_before"]
        if self.options.get("root_category"):
            kfilter["categoriesFullNameIn"] = self.options["root_category"]
        user_ids = self.restricted_user_ids()
        if user_ids:
            kfilter["userIdIn"] = ",".join(user_ids)
        category_ids = self.restricted_category_ids()
        if category_ids:
            # ancestor, not membership: a chosen category brings everything beneath it.
            # Verified against a live portal, since Kaltura answers a filter field it does
            # not support by ignoring it and returning the lot
            kfilter["categoryAncestorIdIn"] = ",".join(category_ids)
        return kfilter

    def restricted_category_ids(self):
        """The categories this migration is limited to, empty meaning the whole portal"""
        return parse_comma_list(self.options.get("source_category_ids"))

    def restricted_user_ids(self):
        """The Kaltura user ids this migration is restricted to, if any"""
        if not self.options.get("restrict_to_users"):
            return []
        return parse_comma_list(self.options.get("source_user_ids"))

    def list_page(self, phase, cursor, page_size):
        if phase == "media":
            entries, next_cursor = self.client.list_entries_page(cursor, page_size, self._entry_filter())
            return [str(entry["id"]) for entry in entries], next_cursor

        if phase == "users":
            users, next_cursor = self.client.list_page_by_index("user", cursor, page_size)
            return [str(user["id"]) for user in users if user.get("id")], next_cursor

        if phase == "categories":
            return self._list_importable_categories(cursor, page_size)

        raise ValueError(f"Unknown migration phase: {phase}")

    def _selected_category_paths(self):
        """fullName of each chosen category, resolved once and kept for the walk.

        The option stores ids, and a page of the category walk has to be filtered by
        subtree. Kaltura's category filter has no ancestor field we have verified, so the
        paths are compared directly rather than trusting a filter that might be ignored.
        """
        if self._selected_paths is None:
            wanted = set(self.restricted_category_ids())
            if not wanted:
                self._selected_paths = []
            else:
                self._selected_paths = [category.get("fullName") or "" for category in self._all_categories() if str(category.get("id") or "") in wanted]
        return self._selected_paths

    def _within_selection(self, full_name):
        """Whether a category is one of the chosen ones or sits beneath one"""
        selected = self._selected_category_paths()
        if not selected:
            return True
        return any(full_name == path or full_name.startswith(path + ">") for path in selected)

    def _list_importable_categories(self, cursor, page_size):
        """One page of categories worth importing.

        Housekeeping categories are filtered out, as is anything outside the chosen
        categories, and an empty page means the phase is over, so pages are pulled until
        something survives the filter or the source runs out. Returning an empty list
        while more pages remain would end the phase early.
        """
        while True:
            categories, next_cursor = self.client.list_page_by_index("category", cursor, page_size)
            if not categories:
                return [], cursor

            keep = [
                str(category["id"])
                for category in categories
                if category.get("id") and is_importable_category(category.get("fullName") or "") and self._within_selection(category.get("fullName") or "")
            ]
            if keep:
                return keep, next_cursor

            cursor = next_cursor

    def fetch_user(self, source_id):
        user = self.client.call("user", "get", userId=source_id)
        role_id = str(user.get("roleIds") or "").split(",")[0].strip()
        role_name = ""
        if role_id:
            roles = self.client.call("userRole", "list", filter={"idIn": role_id})
            objects = roles.get("objects") or []
            if objects:
                role_name = objects[0].get("systemName") or objects[0].get("name") or ""
        return {
            "id": str(user.get("id") or ""),
            "email": user.get("email") or "",
            "fullName": user.get("fullName") or "",
            "screenName": user.get("screenName") or "",
            "roleId": role_id,
            "roleName": role_name,
        }

    def _all_categories(self):
        result = self.client.call("category", "list", pager={"pageSize": 500, "pageIndex": 1})
        return (result.get("objects") or []) if isinstance(result, dict) else []

    def list_categories(self):
        """The categories a person can choose from, with what each one would bring.

        Only the roots of the importable forest are offered. On a KMS portal those are the
        galleries and channels themselves, since everything above them is scaffolding and
        everything below comes along with the parent anyway. On a portal not using KMS they
        are the top level categories. The count is for the whole subtree, which is what
        makes the choice meaningful: Kaltura's own entriesCount counts direct members only.
        """
        categories = self._all_categories()
        paths = {(category.get("fullName") or "") for category in categories}

        chosen = []
        for category in categories:
            full = category.get("fullName") or ""
            if not category.get("id") or not is_selectable_category(full, paths):
                continue
            identifier = str(category["id"])
            chosen.append(
                {
                    "id": identifier,
                    "name": category.get("name") or full.split(">")[-1],
                    "fullName": full,
                    "entries": self.client.count("media", {"categoryAncestorIdIn": identifier}),
                }
            )

        return sorted(chosen, key=lambda category: category["fullName"])

    def fetch_category_members(self, source_id):
        """Who belongs to a category and at what level.

        The owner shows up here as a manager in their own right, so no special case is
        needed for them. Only active memberships are returned: a pending request is not
        access yet.
        """
        members = []
        page_index = 1
        while True:
            result = self.client.call(
                "categoryUser",
                "list",
                filter={"categoryIdEqual": source_id},
                pager={"pageSize": 500, "pageIndex": page_index},
            )
            objects = (result.get("objects") or []) if isinstance(result, dict) else []
            if not objects:
                break
            for member in objects:
                if member.get("status") != CATEGORY_USER_ACTIVE:
                    continue
                role = CATEGORY_PERMISSION_ROLES.get(member.get("permissionLevel"))
                if not role:
                    continue
                members.append({"userId": str(member.get("userId") or ""), "role": role})
            if len(objects) < 500:
                break
            page_index += 1
        return [member for member in members if member["userId"]]

    def list_roles(self):
        """The roles a person can hold on this partner, for the role mapping form.

        A portal's roles are its own: the ids mean nothing on another partner and the
        names are whatever an administrator typed, which is why the form reads them from
        the portal rather than shipping a list. Kaltura's own module roles are filtered
        out, since userRole.list returns them mixed in with the assignable ones and they
        outnumber them several times over.
        """
        result = self.client.call("userRole", "list", pager={"pageSize": 500, "pageIndex": 1})
        roles = []
        for role in (result.get("objects") or []) if isinstance(result, dict) else []:
            name = role.get("name") or role.get("systemName") or ""
            system_name = role.get("systemName") or ""
            if is_internal_role(system_name):
                continue
            roles.append({"id": str(role.get("id") or ""), "name": name, "systemName": system_name})
        return roles

    def fetch_category(self, source_id):
        category = self.client.call("category", "get", id=source_id)
        parts = [part.strip() for part in (category.get("fullName") or "").split(">") if part.strip()]
        parent_name = parts[-2] if len(parts) > 1 else ""
        return {
            "id": str(category.get("id")),
            "name": category.get("name") or "",
            "fullName": category.get("fullName") or "",
            "parentName": parent_name,
            "privacy": category.get("privacy"),
            "appearInList": category.get("appearInList"),
            "contributionPolicy": category.get("contributionPolicy"),
            "owner": category.get("owner") or "",
            "membersCount": category.get("membersCount") or 0,
        }

    def fetch_media(self, source_id):
        entry = self.client.call("media", "get", entryId=source_id)

        flavors = self.client.call("flavorAsset", "getByEntryId", entryId=source_id) or []
        flavors = [flavor for flavor in flavors if flavor.get("status") == FLAVOR_STATUS_READY]

        captions = []
        if self.options.get("import_captions", True):
            try:
                result = self.client.call(CAPTION_ASSET_SERVICE, "list", filter={"entryIdEqual": source_id})
                captions = result.get("objects") or []
            except KalturaAPIError as exc:
                # the caption plugin is not enabled on every Kaltura partner.
                # Missing captions must not fail the media itself.
                if exc.code != "SERVICE_DOES_NOT_EXISTS":
                    raise
                logger.warning("captions unavailable on this Kaltura partner: %s", exc)

        categories = []
        result = self.client.call("categoryEntry", "list", filter={"entryIdEqual": source_id})
        # every category the entry is listed in, so it still gets attached to all of them,
        # and separately the ones it is actually published through, which are the only
        # ones allowed to lend it their state
        assignments = result.get("objects") or []
        category_ids = [str(obj.get("categoryId")) for obj in assignments]
        published_ids = {str(obj.get("categoryId")) for obj in assignments if obj.get("status") == CATEGORY_ENTRY_ACTIVE}
        if category_ids:
            result = self.client.call("category", "list", filter={"idIn": ",".join(category_ids)})
            categories = result.get("objects") or []

        return {
            "entry": entry,
            "flavors": flavors,
            "captions": captions,
            "categories": categories,
            "published_categories": [category for category in categories if str(category.get("id")) in published_ids],
        }

    def download(self, url, dest_path):
        """Stream a URL to dest_path and return the number of bytes written.

        Retried like the API calls are: a large file download is far more likely
        to meet a reset connection than a metadata call, and without a retry a
        single reset loses the whole media. Each attempt restarts from scratch,
        because Kaltura's serve endpoints do not reliably honour Range.
        """
        timeout = getattr(settings, "MIGRATION_DOWNLOAD_TIMEOUT", 60 * 30)
        attempts = getattr(settings, "MIGRATION_MAX_RETRIES", 3)
        delay = 2

        for attempt in range(1, attempts + 1):
            written = 0
            try:
                with requests.get(url, stream=True, timeout=timeout) as response:
                    response.raise_for_status()
                    with open(dest_path, "wb") as handle:
                        for chunk in response.iter_content(chunk_size=1024 * 1024):
                            if chunk:
                                handle.write(chunk)
                                written += len(chunk)
                return written
            except requests.RequestException as exc:
                if attempt >= attempts:
                    raise
                logger.warning("download failed after %s bytes (attempt %s/%s), retrying: %s", written, attempt, attempts, exc)
                time.sleep(delay)
                delay *= 2

    def download_flavor(self, flavor, dest_path):
        """Resolve a flavor's download URL and stream it to dest_path"""
        url = self.client.call("flavorAsset", "getUrl", id=flavor["id"])
        if not isinstance(url, str):
            raise KalturaAPIError("FLAVOR_URL_ERROR", f"No download URL for flavor {flavor['id']}")
        return self.download(url, dest_path)

    def download_entry(self, entry, dest_path):
        """Stream an entry's own file, for entries that have no flavor assets.

        Kaltura builds no flavors for an image, so there is nothing for
        flavorAsset.getUrl to resolve; the raw file is the entry's downloadUrl.
        """
        url = entry.get("downloadUrl")
        if not url:
            raise KalturaAPIError("ENTRY_URL_ERROR", f"No download URL for entry {entry.get('id')}")
        return self.download(url, dest_path)

    def download_caption(self, caption, dest_path):
        """Resolve a caption asset's download URL and stream it to dest_path"""
        url = self.client.call(CAPTION_ASSET_SERVICE, "getUrl", id=caption["id"])
        if not isinstance(url, str):
            raise KalturaAPIError("CAPTION_URL_ERROR", f"No download URL for caption {caption['id']}")
        return self.download(url, dest_path)
