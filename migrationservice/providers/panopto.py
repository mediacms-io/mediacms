"""Importing from Panopto, through its REST API.

Panopto authenticates an API client against a user, not against itself: the client is
created as a "User-Based Server Application" and exchanges a service account's password
for a token, which is why the connection asks for both. Everything the migration reads
goes through /Panopto/api/v1 with that token.

The media file is the exception. The REST API describes a session but will not hand over
its video, so the file comes from the same podcast URL the viewer's download button uses,
which needs a browser style session rather than a bearer token. /api/v1/auth/legacyLogin
trades the token for exactly that cookie, and the download rides on it.
"""

import hashlib
import logging
import time
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.core.cache import cache

from .base import BaseProvider

logger = logging.getLogger(__name__)

TOKEN_PATH = "/Panopto/oauth2/connect/token"
API_PREFIX = "/Panopto/api/v1"
LEGACY_LOGIN_PATH = f"{API_PREFIX}/auth/legacyLogin"
PODCAST_PATH = "/Panopto/Podcast/Download/{session_id}.mp4"
PODCAST_PARAMS = {"mediaTargetType": "videoPodcast"}

# a listing is paged by index and ends with an empty page. The cap is a guard against a
# page that never empties, not a real limit: at Panopto's page size it is far more media
# than any one migration
MAX_PAGES = 400

# how much of the tree Test connection is willing to walk. A folder is one call and a
# Panopto instance can hold tens of thousands, so the button reports what it reached
# rather than holding somebody there while it counts the whole estate
WALK_LIMIT = 400

# Panopto offers one caption file per recording and does not say what language it is in
CAPTION_LANGUAGE = "en"

# Panopto has no "list everything" call, and refuses an empty query
SEARCH_EVERYTHING = "*"

# re-issue the token well before Panopto's hour is up
TOKEN_TTL_MARGIN = 120

# how long the download cookie is kept where every worker can find it. Panopto rate limits
# legacyLogin, and a provider is built per imported item, so without sharing it a parallel
# run asks for a new cookie per recording and is refused with a 429
LEGACY_COOKIE_TTL = 1800

# a rate limited call is retried rather than failed, honouring Retry-After when Panopto
# sends one. Short and few: this is politeness, not persistence
RATE_LIMIT_ATTEMPTS = 3
RATE_LIMIT_WAIT = 5

# what a search result must have before it is worth calling a recording. Status is
# deliberately not part of it: a live instance returns 0 for an uploaded recording and 4
# for a recorded one, both finished and both downloadable, so filtering on it drops real
# media. A recording that genuinely has no file fails at its download instead.


class PanoptoAPIError(Exception):
    """An error Panopto itself reported. Not retried, it is a real answer."""


def folder_path(folder):
    """The readable path of a folder, from the chain its own record carries.

    Panopto nests ParentFolder inside a folder, so a single fetch already knows where it
    sits; there is no separate call and no fullName field to parse.
    """
    names = []
    node = folder
    while isinstance(node, dict) and node.get("Name"):
        names.append(str(node["Name"]).strip())
        node = node.get("ParentFolder")
        if len(names) > 12:
            break
    return ">".join(reversed(names))


def session_is_importable(session):
    """Whether a search result is a recording, rather than a webcast still being made"""
    if not isinstance(session, dict) or not session.get("Id"):
        return False
    if session.get("IsWebcast") and not session.get("Duration"):
        return False
    return True


class PanoptoClient:
    """Thin client over Panopto's REST API and its podcast download URL"""

    def __init__(self, service_url, client_id, client_secret, username, password, timeout=None):
        self.service_url = (service_url or "").rstrip("/")
        self.client_id = client_id or ""
        self.client_secret = client_secret or ""
        self.username = username or ""
        self.password = password or ""
        self.timeout = timeout or getattr(settings, "MIGRATION_API_TIMEOUT", 60)
        self.session = requests.Session()
        self._token = ""
        self._token_expires_at = 0
        self._refresh_token = ""
        self._legacy = None

    def token(self):
        """A bearer token, re-issued as needed.

        The refresh token is used when Panopto gave one, so a long run does not resend the
        service account's password every hour.
        """
        if self._token and time.time() < self._token_expires_at:
            return self._token

        if self._refresh_token:
            granted = self._request_token({"grant_type": "refresh_token", "refresh_token": self._refresh_token})
            if granted is None:
                self._refresh_token = ""
        else:
            granted = None

        if granted is None:
            granted = self._request_token(
                {
                    "grant_type": "password",
                    "username": self.username,
                    "password": self.password,
                    "scope": "api offline_access",
                }
            )
        if granted is None:
            raise PanoptoAPIError("Panopto refused the service account. Check the username, the password and that the API client allows the password grant.")

        self._token = granted.get("access_token") or ""
        self._refresh_token = granted.get("refresh_token") or self._refresh_token
        self._token_expires_at = time.time() + max(60, int(granted.get("expires_in") or 3600) - TOKEN_TTL_MARGIN)
        return self._token

    def _request_token(self, payload):
        """The token endpoint's answer, or None when it refused this grant"""
        url = f"{self.service_url}{TOKEN_PATH}"
        started = time.monotonic()
        try:
            response = self.session.post(url, data=payload, auth=(self.client_id, self.client_secret), timeout=self.timeout)
        except requests.RequestException as exc:
            raise PanoptoAPIError(f"Could not reach {self.service_url}: {exc}") from exc

        logger.info("panopto -> token %s in %.2fs -> %s", payload.get("grant_type"), time.monotonic() - started, response.status_code)
        if response.status_code == 200:
            return response.json()

        try:
            reported = response.json()
        except ValueError:
            reported = {}
        error = reported.get("error") or ""
        if error in ("invalid_grant", "unauthorized_client", "invalid_client"):
            # a bad password, a client that may not use this grant, and a wrong secret are
            # the three answers worth naming, since each is fixed somewhere different
            if payload.get("grant_type") == "refresh_token":
                return None
            description = reported.get("error_description") or error
            raise PanoptoAPIError(f"{error}: {description}")
        return None

    def call(self, path, attempt=1, **params):
        """One GET against the REST API, decoded"""
        url = f"{self.service_url}{API_PREFIX}{path}"
        started = time.monotonic()
        try:
            response = self.session.get(url, params=params or None, headers={"Authorization": f"Bearer {self.token()}"}, timeout=self.timeout)
        except requests.RequestException as exc:
            raise PanoptoAPIError(f"Could not reach {url}: {exc}") from exc

        logger.info("panopto <- %s in %.2fs -> %s", path, time.monotonic() - started, response.status_code)
        if response.status_code == 429 and attempt < RATE_LIMIT_ATTEMPTS:
            self._wait_out_rate_limit(response, path, attempt)
            return self.call(path, attempt=attempt + 1, **params)
        if response.status_code == 404:
            raise PanoptoAPIError(f"{path} does not exist on this Panopto")
        if response.status_code >= 400:
            raise PanoptoAPIError(f"{path} answered {response.status_code}: {self._message(response)}")
        if not response.content:
            return None
        try:
            return response.json()
        except ValueError as exc:
            raise PanoptoAPIError(f"{path} answered with something that is not JSON") from exc

    def _wait_out_rate_limit(self, response, what, attempt):
        """Sleep as long as Panopto asked, or a short while if it did not say"""
        header = (response.headers.get("Retry-After") or "").strip()
        try:
            wait = min(60, max(1, int(float(header))))
        except ValueError:
            wait = RATE_LIMIT_WAIT * attempt
        logger.info("panopto: rate limited on %s, waiting %ss (attempt %d)", what, wait, attempt)
        time.sleep(wait)

    @staticmethod
    def _message(response):
        """Panopto's own error text, which it nests in a couple of different shapes"""
        try:
            reported = response.json()
        except ValueError:
            return response.text[:160]
        if isinstance(reported, dict):
            error = reported.get("Error")
            if isinstance(error, dict):
                return error.get("Message") or error.get("Code") or str(error)[:160]
            return reported.get("Message") or str(reported)[:160]
        return str(reported)[:160]

    def results(self, path, **params):
        """Every page of a listing endpoint, flattened.

        Panopto reports no total and no next page, only a Results array, and it ignores
        maxNumberResults and pageSize: the page size is its own business. So the end of a
        listing is an empty page and nothing else, which costs one extra call and cannot
        stop early on a page that happened to be the size we guessed.
        """
        page = 0
        while page <= MAX_PAGES:
            answered = self.call(path, pageNumber=page, **params) or {}
            rows = answered.get("Results") or []
            if not rows:
                return
            for row in rows:
                yield row
            page += 1
        logger.warning("panopto: stopped paging %s after %d pages", path, MAX_PAGES)

    def _cookie_cache_key(self):
        """One key per instance and service account, so two migrations never share a cookie"""
        identity = f"{self.service_url}|{self.username}".encode()
        return f"panopto:legacy:{hashlib.sha256(identity).hexdigest()[:16]}"

    def legacy_session(self):
        """A requests session holding the cookie the download URL needs.

        The podcast URL is part of the web application rather than the API and ignores a
        bearer token, so legacyLogin turns the token into a cookie. That cookie is kept in
        the shared cache: a provider is built per imported item, and asking Panopto for a
        new one per recording gets a parallel run rate limited within seconds.
        """
        if self._legacy is not None:
            return self._legacy

        cached = cache.get(self._cookie_cache_key())
        if cached:
            legacy = requests.Session()
            for name, value in cached.items():
                legacy.cookies.set(name, value)
            self._legacy = legacy
            return legacy

        self._legacy = self._legacy_login()
        return self._legacy

    def _legacy_login(self):
        """A fresh cookie from legacyLogin, remembered for every worker"""
        url = f"{self.service_url}{LEGACY_LOGIN_PATH}"
        for attempt in range(1, RATE_LIMIT_ATTEMPTS + 1):
            legacy = requests.Session()
            try:
                response = legacy.get(url, headers={"Authorization": f"Bearer {self.token()}"}, timeout=self.timeout)
            except requests.RequestException as exc:
                raise PanoptoAPIError(f"Could not reach {url}: {exc}") from exc

            if response.status_code == 429:
                if attempt == RATE_LIMIT_ATTEMPTS:
                    raise PanoptoAPIError("Panopto is rate limiting the download login. It will be retried on the next attempt at this recording.")
                self._wait_out_rate_limit(response, "legacyLogin", attempt)
                continue

            if response.status_code >= 400:
                raise PanoptoAPIError(f"legacyLogin answered {response.status_code}, so media cannot be downloaded")
            if not legacy.cookies:
                raise PanoptoAPIError("legacyLogin set no cookie, so media cannot be downloaded")

            cache.set(self._cookie_cache_key(), {cookie.name: cookie.value for cookie in legacy.cookies}, LEGACY_COOKIE_TTL)
            return legacy

        raise PanoptoAPIError("Panopto refused the download login")

    def forget_legacy_session(self):
        """Drop the cookie here and for every other worker, so the next call logs in again"""
        self._legacy = None
        cache.delete(self._cookie_cache_key())

    def podcast_url(self, session_id):
        return f"{self.service_url}{PODCAST_PATH.format(session_id=session_id)}"

    def media_is_reachable(self, session_id):
        """Whether this session's file can actually be fetched, without fetching it.

        Asked by Test connection because it is the one thing that decides whether a
        Panopto migration is possible at all: an instance with downloads switched off
        answers every metadata call happily and then has nothing to give.
        """
        legacy = self.legacy_session()
        try:
            response = legacy.head(self.podcast_url(session_id), params=PODCAST_PARAMS, timeout=self.timeout, allow_redirects=True)
        except requests.RequestException as exc:
            return False, str(exc)[:160]

        content_type = (response.headers.get("Content-Type") or "").lower()
        if response.status_code == 200 and "video" in content_type:
            return True, response.headers.get("Content-Length") or ""
        if response.status_code in (401, 403):
            return False, "Panopto refused the download. Downloads are probably switched off for this folder or this instance."
        return False, f"the download URL answered {response.status_code} as {content_type or 'nothing'}"


class PanoptoProvider(BaseProvider):
    name = "panopto"
    label = "Panopto"
    implemented = True

    secret_keys = ("client_secret", "password")
    required_connection_keys = ("service_url", "client_id", "client_secret", "username", "password")

    default_options = {
        # folders to migrate, at least one; each brings its whole subtree. Named as the
        # other providers name it, since the picker and its endpoints are category shaped
        "source_category_ids": "",
        "create_users": True,
        "fallback_username": "admin",
        "rollup_subfolders": True,
        "import_captions": True,
        "max_items": None,
    }

    def __init__(self, connection, options):
        super().__init__(connection, options)
        self._client = None
        self._folders = {}

    @classmethod
    def source_system(cls, connection):
        url = (connection.get("service_url") or "").strip()
        if url and "://" not in url:
            url = f"https://{url}"
        host = urlparse(url).netloc.lower().rstrip("/")
        return f"panopto:{host}"

    @property
    def client(self):
        if self._client is None:
            self._client = PanoptoClient(
                service_url=self.connection.get("service_url"),
                client_id=self.connection.get("client_id"),
                client_secret=self.connection.get("client_secret"),
                username=self.connection.get("username"),
                password=self.connection.get("password"),
            )
        return self._client

    def selected_folder_ids(self):
        raw = str(self.options.get("source_category_ids") or "")
        return [part.strip() for part in raw.replace("\n", ",").split(",") if part.strip()]

    def _search_folders(self):
        """Every folder search will name"""
        return self._search("/folders/search")

    def _search_sessions(self):
        """Every recording search will name, keyed by id"""
        return {row["Id"]: row for row in self._search("/sessions/search") if session_is_importable(row)}

    def _search(self, path):
        """A whole search, paged.

        The query is a bare wildcard because Panopto refuses an empty searchQuery and
        matches word *prefixes* otherwise: asking for "a" finds only what has a word
        starting with a, which silently misses a recording named 20260803_150318.
        """
        found = {}
        try:
            for row in self.client.results(path, searchQuery=SEARCH_EVERYTHING):
                if row.get("Id"):
                    found[row["Id"]] = row
        except PanoptoAPIError as exc:
            logger.info("panopto: %s unreadable: %s", path, exc)
        return list(found.values())

    def folder(self, folder_id):
        """One folder, remembered, since a walk and a climb ask for the same ones"""
        if folder_id not in self._folders:
            try:
                self._folders[folder_id] = self.client.call(f"/folders/{folder_id}") or {}
            except PanoptoAPIError as exc:
                logger.info("panopto: folder %s unreadable: %s", folder_id, exc)
                self._folders[folder_id] = {}
        return self._folders[folder_id]

    def chain(self, folder_id):
        """A folder and everything it sits under, innermost first.

        Panopto nests only the immediate parent in a folder record, so the rest of the
        line has to be fetched one at a time; they are remembered, and a tree is shallow.
        """
        line, node, guard = [], self.folder(folder_id), 0
        while node and node.get("Id") and guard < 12:
            line.append(node)
            parent = node.get("ParentFolder") or {}
            if not parent.get("Id"):
                break
            node = self.folder(parent["Id"])
            guard += 1
        return line

    def discover(self, folder_ids=None):
        """(roots, folders, sessions) this account can actually reach.

        Two sources, because neither is enough on its own: walking the tree finds what the
        account may enumerate, and search finds recordings in folders it may read but not
        list. An ordinary account sees the second and not the first.
        """
        searched = self._search_sessions()
        folders, sessions = {}, {}

        for session_id, session in searched.items():
            folder_id = session.get("Folder") or (session.get("FolderDetails") or {}).get("Id")
            if folder_ids and not self.within_folders(folder_id, folder_ids):
                continue
            sessions[session_id] = session
            for node in self.chain(folder_id) if folder_id else []:
                folders.setdefault(node["Id"], node)

        for found in self._search_folders():
            for node in self.chain(found["Id"]):
                folders.setdefault(node["Id"], node)

        # a walk adds whatever the account may enumerate, which on some instances is
        # nothing at all: children comes back empty even for an administrator
        walked_folders, walked_sessions = self.walk(folder_ids or list(folders))
        for folder_id, folder in walked_folders.items():
            folders.setdefault(folder_id, folder)
        for session_id, session in walked_sessions.items():
            sessions.setdefault(session_id, session)

        roots = [folder for folder in folders.values() if not (folder.get("ParentFolder") or {}).get("Id")]
        return roots, folders, sessions

    def within_folders(self, folder_id, selected):
        """Whether a folder is one of the chosen ones or sits under one"""
        if not folder_id:
            return False
        wanted = set(selected or [])
        return any(node.get("Id") in wanted for node in self.chain(folder_id))

    def walk(self, folder_ids, limit=WALK_LIMIT):
        """(folders, sessions) reachable under these folders, up to a bounded number.

        Yields the folder records and their sessions together, since one pass over the
        tree is what both the counting and the picker need.
        """
        folders, sessions, queue = {}, {}, list(folder_ids)
        while queue and len(folders) < limit:
            folder_id = queue.pop(0)
            if folder_id in folders:
                continue
            try:
                folder = self.client.call(f"/folders/{folder_id}")
            except PanoptoAPIError as exc:
                logger.info("panopto: folder %s unreadable: %s", folder_id, exc)
                continue
            if not folder:
                continue
            folders[folder_id] = folder

            for session in self.client.results(f"/folders/{folder_id}/sessions"):
                if session.get("Id") and session_is_importable(session):
                    sessions[session["Id"]] = session

            for child in self.client.results(f"/folders/{folder_id}/children"):
                if child.get("Id") and child["Id"] not in folders:
                    queue.append(child["Id"])

        return folders, sessions

    def check_connection(self):
        """Exchange the credentials, then report what the account can actually see and take"""
        try:
            self.client.token()
        except PanoptoAPIError as exc:
            return {"ok": False, "error": str(exc), "stats": {}}

        try:
            roots, folders, sessions = self.discover(self.selected_folder_ids())
        except PanoptoAPIError as exc:
            return {"ok": False, "error": str(exc), "stats": {}}

        stats = {
            "folders": len(folders),
            "entries": len(sessions),
            "roots": len(roots),
            "walk_limit_reached": len(folders) >= WALK_LIMIT,
        }

        if not sessions:
            stats["downloads"] = "no recording to try"
            return {"ok": True, "error": "", "stats": stats}

        reachable, detail = self.client.media_is_reachable(next(iter(sessions)))
        stats["downloads"] = "yes" if reachable else f"no: {detail}"
        return {"ok": True, "error": "", "stats": stats}

    def list_categories(self):
        """The folders a person can choose from, with what each subtree holds"""
        roots, folders, sessions = self.discover()
        counts = {root["Id"]: {"entries": 0, "folders": 0} for root in roots}

        for folder_id in folders:
            line = self.chain(folder_id)
            root_id = line[-1].get("Id") if line else None
            if root_id in counts:
                counts[root_id]["folders"] += 1

        for session in sessions.values():
            folder_id = session.get("Folder") or (session.get("FolderDetails") or {}).get("Id")
            line = self.chain(folder_id) if folder_id else []
            root_id = line[-1].get("Id") if line else None
            if root_id in counts:
                counts[root_id]["entries"] += 1

        listed = [
            {
                "id": root["Id"],
                "name": root.get("Name") or root["Id"],
                "path": folder_path(root),
                "entries": counts[root["Id"]]["entries"],
                "folders": counts[root["Id"]]["folders"],
                "kind": "panopto",
            }
            for root in roots
        ]
        return sorted(listed, key=lambda folder: folder["name"].lower())

    def fetch_category(self, source_id):
        folder = self.client.call(f"/folders/{source_id}") or {}
        parent = folder.get("ParentFolder") or {}
        return {
            "id": str(folder.get("Id") or source_id),
            "name": folder.get("Name") or "",
            "fullName": folder_path(folder),
            "parentName": parent.get("Name") or "",
            "parentId": parent.get("Id") or "",
            "description": folder.get("Description") or "",
        }

    # ---------------------------------------------------------------- the sweep

    def list_page(self, phase, cursor, page_size):
        """One page of recording ids inside the chosen folders.

        page_size is not honoured because Panopto does not honour it either: it decides
        its own page size and ignores maxNumberResults. The selection filter can empty a
        page, so pages are pulled until one survives it, since an empty answer is what
        ends a phase and a filtered out page is not the end of anything.
        """
        if phase != "media":
            return [], dict(cursor or {})

        selected = self.selected_folder_ids()
        page = int((cursor or {}).get("page") or 0)

        while page <= MAX_PAGES:
            answered = self.client.call("/sessions/search", searchQuery=SEARCH_EVERYTHING, pageNumber=page) or {}
            rows = answered.get("Results") or []
            if not rows:
                return [], {"page": page}

            page += 1
            found = []
            for row in rows:
                if not session_is_importable(row):
                    continue
                folder_id = row.get("Folder") or (row.get("FolderDetails") or {}).get("Id")
                if selected and not self.within_folders(folder_id, selected):
                    continue
                found.append(str(row["Id"]))

            if found:
                return found, {"page": page}

        logger.warning("panopto: stopped sweeping after %d pages", MAX_PAGES)
        return [], {"page": page}

    def fetch_media(self, source_id):
        """Everything needed to import one recording.

        The detail call is what carries the owner and the download URL; both are null in a
        search result, so this is asked per recording rather than read off the sweep.
        """
        session = self.client.call(f"/sessions/{source_id}") or {}
        urls = session.get("Urls") or {}
        creator = session.get("CreatedBy") or {}
        folder_id = session.get("Folder") or (session.get("FolderDetails") or {}).get("Id") or ""
        folder = self.folder(folder_id) if folder_id else {}

        captions = []
        if urls.get("CaptionDownloadUrl"):
            # Panopto does not say which language the file is in, and offers exactly one
            captions.append({"language": CAPTION_LANGUAGE, "url": urls["CaptionDownloadUrl"]})

        return {
            "id": str(session.get("Id") or source_id),
            "title": session.get("Name") or "",
            "description": session.get("Description") or "",
            "duration": session.get("Duration") or 0,
            "created_at": session.get("StartTime") or "",
            "owner": {"id": str(creator.get("Id") or ""), "username": creator.get("Username") or ""},
            "folder": {
                "id": str(folder.get("Id") or folder_id),
                "name": folder.get("Name") or (session.get("FolderDetails") or {}).get("Name") or "",
                "fullName": folder_path(folder) if folder else "",
                "parentId": str((folder.get("ParentFolder") or {}).get("Id") or ""),
                "parentName": (folder.get("ParentFolder") or {}).get("Name") or "",
            },
            "download_url": urls.get("DownloadUrl") or self.client.podcast_url(source_id),
            "captions": captions,
        }

    def fetch_user(self, source_id):
        """One Panopto account.

        /users is not available on this API version but /users/{id} is, and a recording
        names its creator by id, which is the only way an account can be reached at all.
        """
        user = self.client.call(f"/users/{source_id}") or {}
        first = (user.get("FirstName") or "").strip()
        last = (user.get("LastName") or "").strip()
        return {
            "id": str(user.get("Id") or source_id),
            "username": user.get("Username") or "",
            "email": (user.get("Email") or "").strip(),
            "fullName": " ".join(part for part in (first, last) if part),
        }

    def folder_ancestors(self, folder_id):
        """[(id, name)] for the folders above this one, outermost first"""
        line = self.chain(folder_id)[1:]
        return [(node["Id"], node.get("Name") or node["Id"]) for node in reversed(line) if node.get("Id")]

    def download(self, url, dest_path):
        """Stream a recording to dest_path and return the bytes written.

        The podcast URL answers to the legacy cookie rather than to the token, and that
        cookie outlives neither a long run nor a worker restart, so a refusal is retried
        once against a fresh one before it counts as a failure.
        """
        written = self._stream(url, dest_path, self.client.legacy_session())
        if written is not None:
            return written

        # the cookie was refused: it is stale for every worker holding it, not just here
        self.client.forget_legacy_session()
        written = self._stream(url, dest_path, self.client.legacy_session())
        if written is None:
            raise PanoptoAPIError(f"Panopto refused {url} even with a fresh session. Downloads may be switched off for this folder.")
        return written

    def _stream(self, url, dest_path, legacy):
        """Bytes written, or None when Panopto refused the session"""
        try:
            with legacy.get(url, params=PODCAST_PARAMS, stream=True, timeout=self.client.timeout) as response:
                if response.status_code in (401, 403):
                    return None
                if response.status_code == 429:
                    self.client._wait_out_rate_limit(response, "the download", 1)
                    return None
                if response.status_code >= 400:
                    raise PanoptoAPIError(f"{url} answered {response.status_code}")
                written = 0
                with open(dest_path, "wb") as out:
                    for chunk in response.iter_content(chunk_size=1024 * 1024):
                        if chunk:
                            out.write(chunk)
                            written += len(chunk)
        except requests.RequestException as exc:
            raise PanoptoAPIError(f"Could not fetch {url}: {exc}") from exc
        return written
