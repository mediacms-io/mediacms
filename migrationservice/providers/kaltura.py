import hashlib
import logging
import re
import time
from urllib.parse import urlparse
from xml.etree import ElementTree

import requests
from django.conf import settings

from .base import BaseProvider

logger = logging.getLogger(__name__)

SESSION_TYPE_USER = 0
SESSION_TYPE_ADMIN = 2

# Kaltura will not say which algorithm a token was created with until we hold a session,
# so the usable ones are tried in turn. app_token_hash_type pins it and skips the search.
APP_TOKEN_HASH_TYPES = ("sha256", "sha1", "sha512", "md5")

ENTRY_STATUS_READY = 2

# same value as ENTRY_STATUS_READY, different enum
FLAVOR_STATUS_READY = 2
# KalturaMediaType. An image carries no flavors: the file is the entry's downloadUrl
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

# What a KMS category type means, read from the permission fields rather than the name:
# a channel *named* Restricted read (1, 1, 1) live, which is to say Public.
CATEGORY_PUBLIC = "public"
CATEGORY_OPEN = "open"
CATEGORY_RESTRICTED = "restricted"
CATEGORY_PRIVATE = "private"

# KalturaCategoryUserPermissionLevel -> MediaCMS RBAC. Kaltura's moderator can contribute
# but not manage the category, so it maps to contributor rather than manager.
CATEGORY_PERMISSION_ROLES = {
    0: "manager",
    1: "contributor",
    2: "contributor",
    3: "member",
}
CATEGORY_USER_ACTIVE = 1

# KalturaCategoryEntryStatus. An entry in a category is not necessarily published through
# it: moderation holds submissions at PENDING and rejected ones stay listed. So only
# ACTIVE may lend an entry the category's state.
CATEGORY_ENTRY_ACTIVE = 2

# KalturaEntryModerationStatus. Anything else is unpublished, whatever its categories say
MODERATION_APPROVED = 2
MODERATION_AUTO_APPROVED = 6
MODERATION_PUBLISHED = (MODERATION_APPROVED, MODERATION_AUTO_APPROVED)

# KalturaPlaylistType. A dynamic playlist is a stored query with no MediaCMS equivalent:
# snapshotting one would freeze "Most recent videos" on whatever today happened to be.
PLAYLIST_TYPE_STATIC = 3

# KalturaUserType. A GROUP is a named set of people, not a person: in the users phase it
# would produce an account nobody can log into.
USER_TYPE_USER = 0
USER_TYPE_GROUP = 1

# KalturaGroupUserStatus, the opposite way round to KalturaCategoryUserStatus
GROUP_USER_ACTIVE = 0

# KalturaGroupUserRole: 1 MEMBER, 2 MANAGER, and what each becomes in MediaCMS RBAC
GROUP_USER_ROLES = {1: "member", 2: "manager"}

# Accounts Kaltura and KMS create for themselves, matched on the id: double underscores are
# Kaltura's convention for an internal account, the rest are fixed names KMS always uses.
SYSTEM_USER_IDS = ("0", "guest", "kmsadminserviceuser")
SYSTEM_USER_PREFIXES = ("kmssaasadmin", "kmsinternal")

# KalturaEntryDisplayInSearchType. PARTNER_ONLY is what an ordinary entry gets, so only the
# values at or below zero mean the entry was deliberately kept out of search.
DISPLAY_IN_SEARCH_RECYCLED = -2
DISPLAY_IN_SEARCH_SYSTEM = -1
DISPLAY_IN_SEARCH_NONE = 0
DISPLAY_IN_SEARCH_PARTNER_ONLY = 1
DISPLAY_IN_SEARCH_HIDDEN = (DISPLAY_IN_SEARCH_RECYCLED, DISPLAY_IN_SEARCH_SYSTEM, DISPLAY_IN_SEARCH_NONE)

# Role names differ between partners and ids are stable only within one, so a row carries
# both: id first, name as the fallback. Ships as the default of an editable option.
DEFAULT_ROLE_MAP = [
    {"id": "", "name": "Content Moderator (KMC)", "role": "editor"},
    {"id": "", "name": "Content Uploader (KMC)", "role": "manager"},
    {"id": "", "name": "Player Designer (KMC)", "role": "manager"},
    {"id": "", "name": "Manager (KMC)", "role": "admin"},
    {"id": "", "name": "Publisher Administrator (KMC)", "role": "admin"},
    {"id": "", "name": "viewerRole", "role": ""},
    {"id": "", "name": "privateOnlyRole", "role": ""},
    {"id": "", "name": "adminRole", "role": "advancedUser"},
    {"id": "", "name": "unmoderatedAdminRole", "role": "editor"},
    {"id": "", "name": "unconfirmedViewerRole", "role": ""},
]

# MediaSpace's own roles, listed rather than fetched: userRole.list never holds them
KMS_APPLICATION_ROLES = ("viewerRole", "privateOnlyRole", "adminRole", "unmoderatedAdminRole", "unconfirmedViewerRole")


# "(KMC)" tells console roles apart from the system roles below them in the form. A portal
# reports the bare name, so the label is dropped before comparing.
ROLE_NAME_QUALIFIER = re.compile(r"\s*\([^()]*\)\s*$")

# what set_role_from_mapping understands. "admin" grants Django superuser and staff
MEDIACMS_ROLES = ("", "advancedUser", "editor", "manager", "admin")

# An LTI integration parks a course's media in a child of this name. It is plumbing: never
# a category, and its media is rolled up to the course above it.
INCONTEXT_CATEGORY_NAME = "InContext"

METADATA_SERVICE = "metadata_metadata"
METADATA_OBJECT_CATEGORY = "2"
METADATA_OBJECT_USER = "3"
COURSE_NAME_KEY = "CourseName"

# KMS categories carry permissions, an LMS integration's do not
KMS_TREE = "kms"
LMS_TREE = "lms"

# KMS path segments that are structure rather than a real category
KMS_SCAFFOLDING = ("galleries", "channels")

# KMS publishes media into galleries and channels. Everything else under a root is
# housekeeping and must never become a MediaCMS category.
KMS_CONTENT_PATHS = (">site>galleries>", ">site>channels>")
KMS_HOUSEKEEPING = ("private", "unlisted", "archive", "playlists")

# How far a flavor may be filed from its real height. 272 -> 240 is fine; without a bound
# the loser of a tie cascades down to a wildly wrong profile, 360p offered as 144p.
PROFILE_MIN_RATIO = 0.6
PROFILE_MAX_RATIO = 1.4

CATEGORY_TITLE_MAX = 100
USERNAME_MAX = 150

USERNAME_INVALID = re.compile(r"[^\w.@-]", re.ASCII)

# a stale session mid migration, worth one retry. START_SESSION_ERROR is absent because
# get_ks() raises it directly, so it never reaches the dict inspection in call().
RETRYABLE_KS_ERRORS = ("INVALID_KS", "EXPIRED_KS")

# Plugin services are namespaced: caption_captionasset, not captionAsset, which answers
# SERVICE_DOES_NOT_EXISTS. Core services are not.
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

        Sessions come from an app token, not the administrator secret: it can be revoked
        on its own and carries only the privileges it was created with.
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
                # a wrong algorithm looks exactly like a wrong token, so try the rest
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

        Logged out and back with its duration, so a slow Kaltura shows up as a slow line.
        Secrets are never logged: only parameter names, plus a few safe values.
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
            # a Kaltura API error arrives as HTTP 200
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

        Kaltura rejects pageIndex * pageSize beyond 10000, so entries are walked forward
        in creation order. The cursor holds the last createdAt plus the ids already handled
        at exactly that timestamp, which keeps entries sharing one from being skipped.
        """
        cursor = dict(cursor or {})
        created_at = cursor.get("created_at") or 0
        seen = list(cursor.get("seen_ids") or [])

        # the caller's filter goes in first: the cursor keys must win, or a static option
        # like created_after would overwrite the resume boundary on every page
        entry_filter = dict(kfilter or {})
        floor = entry_filter.get("createdAtGreaterThanOrEqual") or 0
        entry_filter["orderBy"] = "+createdAt"
        entry_filter["statusEqual"] = ENTRY_STATUS_READY
        if created_at or floor:
            # honour the user's floor on the first page, then let the cursor take over
            entry_filter["createdAtGreaterThanOrEqual"] = max(created_at or 0, floor)

        # more entries sharing one createdAt than a page can hold: pageSize then grows
        # back towards the ceiling this scheme exists to avoid, so fail readably instead
        requested_page_size = page_size + len(seen)
        if requested_page_size > KALTURA_MAX_PAGE_SIZE:
            raise KalturaAPIError(
                "PAGINATION_LIMIT",
                f"More than {KALTURA_MAX_PAGE_SIZE} entries share createdAt={created_at}; "
                "this exceeds what Kaltura will return in one page. Narrow the migration "
                "with the created_after or created_before options to get past this block.",
            )

        # enough rows that the handled ids at the boundary cannot fill the page
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

        entry_filter narrows the count the way the migration will be, so the dashboard
        denominator matches. user_ids also reports a count per user: Kaltura answers an
        unknown user with zero rather than an error, so a typo only shows as a zero.
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


# A role Kaltura's own modules open sessions with, rather than one assigned to a person.
# Nothing on the object says which, so this goes by the shape of the system name.
SYSTEM_ROLE_NAME = re.compile(r"^[A-Z0-9_]+$")
INTERNAL_ROLE_NAMES = ("basic user session role", "no session")
# Kaltura tags the roles its consoles hand out. A tagged role is offered whatever its system
# name looks like, since the name heuristic below is only a guess about untagged ones
APPLICATION_ROLE_TAGS = ("kmc", "kms")


def is_selectable_category(full_name):
    """Whether a category is one a person picks to scope a migration.

    Top level only: a top level category is a whole instance, and choosing one brings
    everything underneath, so offering the levels below asks the same question again.
    """
    return bool(full_name) and ">" not in full_name


def parse_playlist_content(raw):
    """The entry ids a static playlist names, in order.

    A dynamic playlist stores XML here, which yields nothing to split; its type filters
    it out anyway.
    """
    text = str(raw or "").strip()
    if not text or text == "None" or text.startswith("<"):
        return []
    return [entry_id.strip() for entry_id in text.split(",") if entry_id.strip()]


def is_system_user(user_id):
    """Whether a Kaltura user id belongs to the platform rather than to a person.

    Only consulted when sweeping every user: an account that owns media is still created
    when that media arrives.
    """
    identifier = str(user_id or "").strip().lower()
    if not identifier:
        return True
    if identifier.startswith("__") and identifier.endswith("__"):
        return True
    if identifier in SYSTEM_USER_IDS:
        return True
    return any(identifier.startswith(prefix) for prefix in SYSTEM_USER_PREFIXES)


def is_application_role(tags):
    """Whether Kaltura itself marks this role as one of its consoles' roles"""
    holds = {tag.strip().lower() for tag in str(tags or "").split(",")}
    return any(tag in holds for tag in APPLICATION_ROLE_TAGS)


def is_internal_role(system_name, tags=""):
    """Whether a Kaltura role belongs to the platform rather than to people"""
    if is_application_role(tags):
        return False
    system_name = (system_name or "").strip()
    if not system_name:
        return True
    if SYSTEM_ROLE_NAME.match(system_name):
        return True
    return system_name.lower() in INTERNAL_ROLE_NAMES


def parse_comma_list(raw):
    """The Kaltura user ids from a comma separated option value.

    Kaltura ignores a filter field it cannot use, so an empty userIdIn would widen a
    restricted run to the whole portal. Downstream refuses to run on an empty result.
    """
    seen = []
    for part in str(raw or "").replace("\n", ",").split(","):
        value = part.strip()
        if value and value not in seen:
            seen.append(value)
    return seen


def category_tree_kind(category):
    """Whether a category belongs to a KMS site or to an LMS integration's tree.

    Read from privacyContexts: permission fields only take effect inside a privacy context
    and LTI integrations create their categories without one. A payload missing the field
    is read as KMS, since guessing LMS would publish what the source keeps restricted.
    """
    if "privacyContexts" not in category:
        return KMS_TREE
    return KMS_TREE if str(category.get("privacyContexts") or "").strip() else LMS_TREE


def is_lms_course(payload):
    """Whether a fetch_category payload is an LMS course, not the tree around it.

    Every category in an integration's tree reads as LMS, its root and its scaffolding
    included, and a shared channel somebody added reads that way too. Only a course
    carries a CourseName, and a launch arrives holding the course it came from, so only a
    course is a thing to wire to a platform.
    """
    if category_tree_kind(payload) != LMS_TREE:
        return False
    return bool(str(payload.get("courseName") or "").strip())


def is_instance_root(full_name, all_paths):
    """Whether a top level category is the root of a KMS site or an LMS integration.

    Those roots hold nothing of their own and are often named ltigeneric_8yrU6, so making
    one a category just boxes everything. The tell is the >site> child only a root has.
    """
    if not full_name or ">" in full_name:
        return False
    return any(path.startswith(full_name + ">site>") for path in all_paths)


def is_ignored_category(category):
    """Categories that exist only as an integration's plumbing.

    Only in an LMS tree: a KMS gallery with this name is a real category somebody made.
    """
    if category_tree_kind(category) != LMS_TREE:
        return False
    name = category.get("name") or (category.get("fullName") or "").rsplit(">", 1)[-1]
    return name.strip().lower() == INCONTEXT_CATEGORY_NAME.lower()


def category_type(category):
    """Which KMS category type a Kaltura category is configured as.

    privacy decides who may *view*, so it decides the type. contributionPolicy decides who
    may *add*: "Public, Restricted" lets anyone watch, and reading it as visibility would
    hide the whole channel. appearInList still narrows the authenticated tier. An
    unrecognised privacy value is read as the most restrictive: guessing generously leaks.
    """
    if category_tree_kind(category) == LMS_TREE:
        # outside a privacy context these fields are inert: reading them would hide media
        # the source shows, and gate what nobody was gating
        return CATEGORY_PUBLIC

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


def needs_rbac_group(category):
    """Whether Kaltura restricts this category to named people, in either sense.

    Two different fields can restrict it: privacy says who may view the content, and
    appearInList says who may even see the category. KMS describes the second as "visible
    only to users with specific permissions", which is what an RBAC category is here, so a
    category with a public library but a private listing still gets a group.

    "Requires authentication" has no MediaCMS equivalent, and lands here rather than being
    dropped: a group holding the people Kaltura named, the owner among them, is a place
    they can widen access from, where a plain category would be a decision already made.
    Only "no restriction" on both fields means nobody needs naming, so an unrecognised
    privacy value gets a group too.
    """
    if category_tree_kind(category) == LMS_TREE:
        return False
    if category.get("privacy") != PRIVACY_ALL:
        return True
    return category.get("appearInList") == APPEAR_IN_LIST_MEMBERS_ONLY


# What each category type becomes. Kaltura's Open, "any authenticated user may view", has
# no MediaCMS equivalent, so it lands on unlisted: a documented downgrade. Restricted's
# membership is about publishing, not viewing, so there is nothing to gate viewing with.
CATEGORY_TYPE_STATE = {
    CATEGORY_PUBLIC: "public",
    CATEGORY_OPEN: "unlisted",
    CATEGORY_RESTRICTED: "private",
    CATEGORY_PRIVATE: "private",
}

# most permissive first: an entry in a public and a private category is reachable through
# the public one, as it is in Kaltura
STATE_PRECEDENCE = ("public", "unlisted", "private")


def media_state(categories, display_in_search=None, moderation_status=None):
    """MediaCMS state for a Kaltura entry.

    Kaltura entries carry no state of their own, so it comes from their categories and the
    most permissive one wins; in no category at all means private. Being held out of search
    only ever downgrades, and an entry that has not cleared moderation is private wherever
    it sits. A bare privacy integer is still accepted alongside category dicts.
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


def normalised_role_name(name):
    """A role name with any trailing qualifier removed, ready to compare.

    "Content Moderator (KMC)" and "Content Moderator" are the same role: the first is how
    the shipped map labels it, the second is what the portal calls it.
    """
    return ROLE_NAME_QUALIFIER.sub("", str(name or "")).strip().lower()


def mediacms_role(role_id, role_name, role_map=None):
    """MediaCMS role for User.set_role_from_mapping, or "" for a plain user.

    Matched on the role id when the mapping row carries one, and on the name otherwise,
    case insensitively: a portal's own roles report a display name, not a system name.
    """
    rows = role_map if role_map is not None else DEFAULT_ROLE_MAP

    wanted_id = str(role_id or "").strip()
    if wanted_id:
        for row in rows:
            if str(row.get("id") or "").strip() == wanted_id:
                return row.get("role") or ""

    wanted_name = normalised_role_name(role_name)
    if wanted_name:
        for row in rows:
            if normalised_role_name(row.get("name")) == wanted_name:
                return row.get("role") or ""

    return ""


def is_importable_category(full_name):
    """Whether a Kaltura category should become a MediaCMS category.

    Root agnostic, so several KMS instances side by side need no configuration. A portal
    not using KMS has no ">site>" paths and keeps its categories as they are.
    """
    name = str(full_name or "")
    if not name:
        # no path given: dropping it would lose a real category
        return True
    if any(path in name for path in KMS_CONTENT_PATHS):
        return True
    if ">site" in name:
        return False
    parts = [part.strip().lower() for part in name.split(">") if part.strip()]
    if len(parts) > 1 and parts[1] in KMS_HOUSEKEEPING:
        return False
    return True


def course_name_from_metadata(xmls):
    """The course name an LTI integration stored on a category, or ""

    The metadata profile differs between portals, so the key is looked up, not the profile.
    """
    for xml in xmls or []:
        try:
            root = ElementTree.fromstring(str(xml or ""))
        except ElementTree.ParseError:
            continue
        for detail in root.iter("Detail"):
            if (detail.findtext("Key") or "").strip().lower() != COURSE_NAME_KEY.lower():
                continue
            value = (detail.findtext("Value") or "").strip()
            if value:
                return value
    return ""


def ancestor_categories(full_name, full_ids):
    """[(id, fullName)] for every category this one hangs under, outermost first.

    The scaffolding a KMS path starts with is skipped, by the same rule the title uses, so
    an instance root and its site/galleries segments are never anybody's parent.
    """
    names = [part.strip() for part in (full_name or "").split(">")]
    ids = [part.strip() for part in (full_ids or "").split(">")]
    if len(names) < 2 or len(names) != len(ids):
        return []

    start = 0
    for index in range(1, len(names)):
        if names[index - 1].lower() == "site" and names[index].lower() in KMS_SCAFFOLDING:
            start = index + 1
            break

    ancestors = []
    for index in range(start, len(names) - 1):
        path = ">".join(names[: index + 1])
        if not ids[index] or not names[index]:
            continue
        if names[index].lower() == INCONTEXT_CATEGORY_NAME.lower():
            continue
        ancestors.append((ids[index], path))
    return ancestors


def category_title_and_description(full_name, leaf_name=""):
    """Split a Kaltura fullName into a MediaCMS title and a readable path.

    "MediaSpace>site>galleries>Engineering>1. Term>Electronics"
    becomes ("Electronics", "Engineering: 1. Term: Electronics").

    leaf_name replaces the last segment.
    """
    parts = [part.strip() for part in (full_name or "").split(">") if part.strip()]

    # only under a "site" segment, so a real top level "Channels" is left alone
    for index in range(1, len(parts)):
        if parts[index - 1].lower() == "site" and parts[index].lower() in KMS_SCAFFOLDING:
            parts = parts[index + 1 :]
            break

    if not parts:
        return "", ""

    if leaf_name:
        parts[-1] = leaf_name

    title = parts[-1][:CATEGORY_TITLE_MAX]
    description = ": ".join(parts)
    return title, description


def _fit_with_suffix(base, suffix):
    """base + suffix, trimmed to the model's limit without losing the suffix.

    Trimming the formatted string would discard the part that makes the title unique.
    """
    suffix = suffix[: CATEGORY_TITLE_MAX // 2]
    room = max(1, CATEGORY_TITLE_MAX - len(suffix))
    return f"{base[:room]}{suffix}"


def unique_category_title(title, parent_name, taken):
    """A title not already in `taken`.

    Titles act as identifiers in MediaCMS URLs, so flattening a tree has to resolve
    collisions: the parent name first because it reads naturally, then a counter. Every
    candidate reserves room for its own suffix, or the loop would never terminate.
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
    """Pair Kaltura flavors with MediaCMS encode profiles, one flavor per profile.

    Each flavor takes the profile closest to its height, preferring one at or below on a
    tie. Returns a list of (flavor, profile) tuples.
    """
    # every viable (flavor, profile) pair is ranked, not just each flavor's favourite:
    # otherwise the loser of a tie is dropped outright with free profiles left over
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
            # a profile has to describe the file: without the bound a duplicate
            # resolution lands tiers away and the player lies about what it offers
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

    # options the form used to have, dropped on save rather than refused
    retired_options = ("create_categories", "map_permissions", "migrate_all_categories", "import_playlist_media", "fallback_username")
    retired_connection_keys = ("admin_secret", "user_id")
    required_connection_keys = ("service_url", "partner_id", "app_token_id", "app_token")
    default_options = {
        "migrate_all_users": True,
        "create_users": False,
        # top level categories to migrate, at least one; each brings its whole subtree
        "source_category_ids": "",
        # needs USE_RBAC, and says so in the log when it is off
        "migrate_groups": False,
        "migrate_playlists": False,
        "rollup_subcategories": True,
        "lti_platform_id": "",
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
        self._category_paths = None
        self._group_ids = None

    @classmethod
    def source_system(cls, connection):
        url = (connection.get("service_url") or "").strip()
        if url and "://" not in url:
            # urlparse leaves netloc empty for a scheme-less URL, colliding installations
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
            # an empty list would produce no filter at all, reading as "everything"
            return {"ok": False, "error": "Restricting to specific users needs at least one Kaltura user id.", "stats": {}}

        result = self.client.check_connection(entry_filter=self._entry_filter(), user_ids=user_ids)
        if result.get("ok"):
            result["stats"].update(self.migration_totals())
        return result

    def migration_totals(self):
        """What this migration would bring, counted the way the run will count it.

        Captions are the one thing absent: caption_captionasset.list refuses a filter
        without an entry id, so counting them means fetching every entry id first. They
        are counted as the run discovers them instead.
        """
        people = [user for user in self._all_people() if not is_system_user(user.get("id"))]
        categories = [category for category in self._all_categories() if self.worth_importing(category)]

        return {
            "users": len(self.restricted_user_ids()) or len(people),
            "groups": self.client.count("user", {"typeIn": str(USER_TYPE_GROUP)}) if self.options.get("migrate_groups") else 0,
            "playlists": len(self._migratable_playlists()) if self.options.get("migrate_playlists") else 0,
            "categories": len([c for c in categories if ">site>channels>" not in (c.get("fullName") or "")]),
            "channels": len([c for c in categories if ">site>channels>" in (c.get("fullName") or "")]),
        }

    def _migratable_playlists(self):
        """The playlists a run would bring. Counted from the objects, not from totalCount,
        because most of what playlist.list returns is not migratable: a dynamic playlist is a
        stored query and KMS keeps one per channel under an internal account.
        """
        found = []
        page_index = 1
        while True:
            result = self.client.call("playlist", "list", filter={}, pager={"pageSize": 500, "pageIndex": page_index})
            objects = (result.get("objects") or []) if isinstance(result, dict) else []
            if not objects:
                break
            found.extend(playlist for playlist in objects if playlist.get("id") and self.playlist_is_migratable(playlist))
            if len(objects) < 500:
                break
            page_index += 1
        return found

    def _all_people(self):
        """Every real user on the partner, groups excluded"""
        people = []
        page_index = 1
        while True:
            result = self.client.call("user", "list", filter={"typeIn": str(USER_TYPE_USER)}, pager={"pageSize": 500, "pageIndex": page_index})
            objects = (result.get("objects") or []) if isinstance(result, dict) else []
            if not objects:
                break
            people.extend(objects)
            if len(objects) < 500:
                break
            page_index += 1
        return people

    def _entry_filter(self):
        """The narrowing every media sweep shares. The sweeps add their own on top."""
        kfilter = {}
        if self.options.get("created_after"):
            kfilter["createdAtGreaterThanOrEqual"] = self.options["created_after"]
        if self.options.get("created_before"):
            kfilter["createdAtLessThanOrEqual"] = self.options["created_before"]
        if self.options.get("root_category"):
            kfilter["categoriesFullNameIn"] = self.options["root_category"]
        # media follows the owners, not the categories: every entry has exactly one owner,
        # and many belong to no category at all
        user_ids = self.restricted_user_ids()
        if user_ids:
            kfilter["userIdIn"] = ",".join(user_ids)
        return kfilter

    def restricted_category_ids(self):
        """The categories this migration is limited to"""
        return parse_comma_list(self.options.get("source_category_ids"))

    def restricts_to_categories(self):
        """Every migration is limited to chosen categories. There is no "all" any more.

        A method because the walk and the filter both ask, and a provider without the
        notion can answer False.
        """
        return True

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
            # typeIn keeps groups out of the people sweep. Verified live, since Kaltura
            # answers a filter field it does not support by ignoring it.
            users, next_cursor = self.client.list_page_by_index("user", cursor, page_size, {"typeIn": str(USER_TYPE_USER)})
            return [str(user["id"]) for user in users if user.get("id") and not is_system_user(user.get("id"))], next_cursor

        if phase == "playlists":
            playlists, next_cursor = self.client.list_page_by_index("playlist", cursor, page_size)
            return [str(p["id"]) for p in playlists if p.get("id") and self.playlist_is_migratable(p)], next_cursor

        if phase == "groups":
            groups, next_cursor = self.client.list_page_by_index("user", cursor, page_size, {"typeIn": str(USER_TYPE_GROUP)})
            return [str(group["id"]) for group in groups if group.get("id")], next_cursor

        if phase == "categories":
            return self._list_importable_categories(cursor, page_size)

        raise ValueError(f"Unknown migration phase: {phase}")

    def _selected_category_paths(self):
        """fullName of each chosen category, resolved once and kept for the walk.

        The option stores ids and the walk filters by subtree. Kaltura has no ancestor
        filter field we have verified, so the paths are compared here instead.
        """
        if self._selected_paths is None:
            wanted = self.restricted_category_ids()
            if not wanted:
                self._selected_paths = []
            else:
                # by id rather than filtered out of every category on the portal: this is
                # asked once per imported item, and a full sweep each time is thousands of
                # calls on a large source
                result = self.client.call("category", "list", filter={"idIn": ",".join(wanted)})
                self._selected_paths = [category.get("fullName") or "" for category in (result.get("objects") or [])]
        return self._selected_paths

    def within_selection(self, full_name):
        """Whether a path is one of the chosen roots or sits beneath one"""
        return self._within_selection(full_name)

    def _within_selection(self, full_name):
        """Whether a category is one of the chosen ones or sits beneath one"""
        selected = self._selected_category_paths()
        if not selected:
            # with the switch off and nothing chosen, nothing is within the selection
            return not self.restricts_to_categories()
        return any(full_name == path or full_name.startswith(path + ">") for path in selected)

    def _all_category_paths(self):
        """Every category path on the source, read once per provider instance"""
        if self._category_paths is None:
            self._category_paths = {(category.get("fullName") or "") for category in self._all_categories()}
        return self._category_paths

    def worth_importing(self, category):
        """Whether a source category becomes a MediaCMS category of its own"""
        full_name = category.get("fullName") or ""
        if not category.get("id"):
            return False
        if is_ignored_category(category):
            return False
        if ">" not in full_name and is_instance_root(full_name, self._all_category_paths()):
            return False
        return is_importable_category(full_name) and self._within_selection(full_name)

    def _list_importable_categories(self, cursor, page_size):
        """One page of categories worth importing.

        An empty page means the phase is over, so pages are pulled until something
        survives the filter or the source runs out.
        """
        while True:
            categories, next_cursor = self.client.list_page_by_index("category", cursor, page_size)
            if not categories:
                return [], cursor

            keep = [str(category["id"]) for category in categories if self.worth_importing(category)]
            if keep:
                return keep, next_cursor

            cursor = next_cursor

    def child_entries(self, entry_id):
        """The other streams of a multi stream recording, or [].

        Kaltura Capture stores the camera and the screen as two entries joined by
        parentEntryId, and a listing never returns the child: it has to be asked for by
        name. parentEntryIdIn is accepted and ignored, so this is one call per entry.
        """
        try:
            result = self.client.call("baseEntry", "list", filter={"parentEntryIdEqual": str(entry_id)}, pager={"pageSize": 20, "pageIndex": 1})
        except KalturaAPIError as exc:
            logger.info("kaltura: could not look for child streams of %s: %s", entry_id, exc)
            return []

        return [child for child in (result.get("objects") or []) if child.get("id")]

    def kms_role(self, user_id):
        """The MediaSpace role for one user, or "".

        Kaltura keeps it in the KMS user schema metadata, keyed on the puser id. Only the
        object type is pinned: adding metadataProfileIdEqual returns nothing, and the
        profile differs per KMS instance anyway.
        """
        try:
            result = self.client.call(
                METADATA_SERVICE,
                "list",
                filter={"metadataObjectTypeEqual": METADATA_OBJECT_USER, "objectIdEqual": str(user_id)},
                pager={"pageSize": 5, "pageIndex": 1},
            )
        except KalturaAPIError as exc:
            logger.info("kaltura: could not read the MediaSpace role of %s: %s", user_id, exc)
            return ""

        for row in result.get("objects") or []:
            found = re.search(r"<role>(.*?)</role>", row.get("xml") or "")
            if found and found.group(1).strip():
                return found.group(1).strip()
        return ""

    def fetch_user(self, source_id):
        user = self.client.call("user", "get", userId=source_id)
        role_id = str(user.get("roleIds") or "").split(",")[0].strip()
        role_name = ""
        if role_id:
            roles = self.client.call("userRole", "list", filter={"idIn": role_id})
            objects = roles.get("objects") or []
            if objects:
                role_name = objects[0].get("systemName") or objects[0].get("name") or ""
        else:
            # no console role, so the MediaSpace one is the only role this person holds
            role_name = self.kms_role(user.get("id") or source_id)
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
        """The top level categories a person can choose from, with what each one holds.

        The count is for the whole subtree: Kaltura's own entriesCount on a root counts
        direct members only, and a root has none. Each carries its kind of tree, so the
        form can say whether picking it brings permissions along.
        """
        chosen = []
        for category in self._all_categories():
            full = category.get("fullName") or ""
            if not category.get("id") or not is_selectable_category(full):
                continue
            identifier = str(category["id"])
            chosen.append(
                {
                    "id": identifier,
                    "name": category.get("name") or full,
                    "fullName": full,
                    "kind": category_tree_kind(category),
                    "entries": self.client.count("media", {"categoryAncestorIdIn": identifier}),
                }
            )

        return sorted(chosen, key=lambda category: category["fullName"])

    def playlist_is_migratable(self, playlist):
        """Whether one playlist is worth bringing over.

        A dynamic playlist is a query rather than a list. KMS also keeps a playlist per
        channel under an internal account, which is plumbing nobody would recognise.
        """
        if playlist.get("playlistType") != PLAYLIST_TYPE_STATIC:
            return False
        if is_system_user(playlist.get("userId")):
            return False
        return bool(parse_playlist_content(playlist.get("playlistContent")))

    def fetch_playlist(self, source_id):
        """One playlist, with its members in the order they are listed.

        The order comes from playlistContent, not playlist.execute, which applies access
        filtering and silently returns a shorter list. Entries it names may no longer
        exist: the caller's problem to log, not a reason to distrust the order.
        """
        playlist = self.client.call("playlist", "get", id=source_id)
        return {
            "id": str(playlist.get("id") or source_id),
            "name": playlist.get("name") or str(source_id),
            "description": playlist.get("description") or "",
            "owner": str(playlist.get("userId") or playlist.get("creatorId") or ""),
            "entry_ids": parse_playlist_content(playlist.get("playlistContent")),
        }

    def fetch_group(self, source_id):
        """One Kaltura group, with the people in it.

        A group is a user of type GROUP, so it is read through the user service. Its
        screenName is the readable name, the id being a slug like Retired_Employees.
        """
        group = self.client.call("user", "get", userId=source_id)
        return {
            "id": str(group.get("id") or source_id),
            "name": group.get("screenName") or group.get("fullName") or str(source_id),
            "description": group.get("description") or "",
            "members": self.fetch_group_members(source_id),
        }

    def fetch_group_members(self, source_id):
        """[{"userId", "role"}] for one group.

        groupUser.list refuses to answer without a group or user to look up, so there is no
        way to sweep every membership at once: each group is asked for its own.
        """
        members = []
        page_index = 1
        while True:
            result = self.client.call(
                "groupUser",
                "list",
                filter={"groupIdEqual": source_id},
                pager={"pageSize": 500, "pageIndex": page_index},
            )
            objects = (result.get("objects") or []) if isinstance(result, dict) else []
            if not objects:
                break
            for member in objects:
                if member.get("status") != GROUP_USER_ACTIVE:
                    continue
                role = GROUP_USER_ROLES.get(member.get("userRole"))
                user_id = str(member.get("userId") or "")
                if role and user_id:
                    members.append({"userId": user_id, "role": role})
            if len(objects) < 500:
                break
            page_index += 1
        return members

    def group_ids(self):
        """Every group id on the partner, for telling a group apart from a person"""
        if self._group_ids is None:
            found = set()
            page_index = 1
            while True:
                result = self.client.call("user", "list", filter={"typeIn": str(USER_TYPE_GROUP)}, pager={"pageSize": 500, "pageIndex": page_index})
                objects = (result.get("objects") or []) if isinstance(result, dict) else []
                if not objects:
                    break
                found.update(str(group.get("id")) for group in objects if group.get("id"))
                if len(objects) < 500:
                    break
                page_index += 1
            self._group_ids = found
        return self._group_ids

    def fetch_category_members(self, source_id):
        """Who belongs to a category and at what level.

        The owner shows up as a manager in their own right, so needs no special case.
        Only active memberships count: a pending request is not access yet.
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
                user_id = str(member.get("userId") or "")
                if user_id in self.group_ids():
                    # a group holding a category membership is expanded into its people,
                    # each taking the permission level the group was given
                    for grouped in self.fetch_group_members(user_id):
                        members.append({"userId": grouped["userId"], "role": role})
                    continue
                members.append({"userId": user_id, "role": role})
            if len(objects) < 500:
                break
            page_index += 1
        return [member for member in members if member["userId"]]

    def list_roles(self):
        """The roles a person can hold on this partner, for the role mapping form.

        A portal's roles are its own, which is why the form reads them from the portal
        rather than shipping a list. Kaltura's own module roles are filtered out:
        userRole.list returns them mixed in, outnumbering the assignable ones.

        MediaSpace application roles are not among them: KMS and KAF hold those themselves.
        """
        result = self.client.call("userRole", "list", pager={"pageSize": 500, "pageIndex": 1})
        roles = []
        for role in (result.get("objects") or []) if isinstance(result, dict) else []:
            name = role.get("name") or role.get("systemName") or ""
            system_name = role.get("systemName") or ""
            if is_internal_role(system_name, role.get("tags")):
                continue
            roles.append({"id": str(role.get("id") or ""), "name": name, "systemName": system_name})
        return roles

    def course_names(self, category_ids):
        """{category id: course name} for those of these categories that have one"""
        ids = [str(category_id) for category_id in category_ids if str(category_id or "").strip()]
        if not ids:
            return {}

        try:
            result = self.client.call(METADATA_SERVICE, "list", filter={"metadataObjectTypeEqual": METADATA_OBJECT_CATEGORY, "objectIdIn": ",".join(ids)})
        except KalturaAPIError as exc:
            logger.info("kaltura: could not read category metadata: %s", exc)
            return {}

        documents = {}
        for row in result.get("objects") or []:
            documents.setdefault(str(row.get("objectId")), []).append(row.get("xml") or "")

        names = {}
        for category_id, xmls in documents.items():
            name = course_name_from_metadata(xmls)
            if name:
                names[category_id] = name
        return names

    def course_name(self, category):
        """The readable name of an LMS course channel, or "" for anything else"""
        if category_tree_kind(category) != LMS_TREE:
            return ""
        category_id = str(category.get("id") or "")
        return self.course_names([category_id]).get(category_id, "")

    def fetch_category(self, source_id):
        category = self.client.call("category", "get", id=source_id)
        parts = [part.strip() for part in (category.get("fullName") or "").split(">") if part.strip()]
        parent_name = parts[-2] if len(parts) > 1 else ""
        return {
            "id": str(category.get("id")),
            "courseName": self.course_name(category),
            "name": category.get("name") or "",
            "fullName": category.get("fullName") or "",
            "parentName": parent_name,
            "privacy": category.get("privacy"),
            "privacyContexts": category.get("privacyContexts") or "",
            "parentId": category.get("parentId"),
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
                # the caption plugin is not enabled on every partner
                if exc.code != "SERVICE_DOES_NOT_EXISTS":
                    raise
                logger.warning("captions unavailable on this Kaltura partner: %s", exc)

        categories = []
        result = self.client.call("categoryEntry", "list", filter={"entryIdEqual": source_id})
        # every category it is listed in, and separately the ones it is published through,
        # which are the only ones allowed to lend it their state
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

        Retried like the API calls: without it one reset connection loses the whole media.
        A retry resumes with Range, which the download urls do honour, so a reset 400MB
        into a 470MB file costs the rest of the file rather than all of it. A server that
        answers 200 to a ranged request is starting over, so the file is truncated to match.
        """
        timeout = getattr(settings, "MIGRATION_DOWNLOAD_TIMEOUT", 60 * 30)
        attempts = getattr(settings, "MIGRATION_MAX_RETRIES", 3)
        delay = 2
        written = 0

        for attempt in range(1, attempts + 1):
            headers = {"Range": f"bytes={written}-"} if written else {}
            try:
                with requests.get(url, stream=True, timeout=timeout, headers=headers) as response:
                    response.raise_for_status()
                    resuming = written and response.status_code == 206
                    if written and not resuming:
                        logger.info("download resumed from the start: the source ignored Range")
                        written = 0
                    with open(dest_path, "ab" if resuming else "wb") as handle:
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

        Kaltura builds no flavors for an image, so the file is the entry's downloadUrl.
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
