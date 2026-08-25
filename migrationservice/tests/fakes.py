import shutil

from migrationservice.providers.base import BaseProvider
from migrationservice.providers.kaltura import (
    CATEGORY_PERMISSION_ROLES,
    CATEGORY_USER_ACTIVE,
)


class FakeProvider(BaseProvider):
    """In memory provider used by the importer and orchestrator tests.

    Source data is handed in as plain dicts keyed by source id, so tests can
    describe exactly what the source system returns without any HTTP.
    """

    name = "fake"
    label = "Fake"
    implemented = True

    secret_keys = ()
    required_connection_keys = ()
    default_options = {}

    def __init__(self, connection=None, options=None):
        super().__init__(connection or {}, options or {})
        self.users = {}
        self.categories = {}
        self.media = {}
        self.downloads = {}
        self.calls = []

    @classmethod
    def source_system(cls, connection):
        return "fake:test"

    def check_connection(self):
        return {"ok": True, "error": "", "stats": {"entries": len(self.media)}}

    def list_page(self, phase, cursor, page_size):
        source = {"users": self.users, "categories": self.categories, "media": self.media}[phase]
        ids = sorted(source.keys())
        offset = (cursor or {}).get("offset", 0)
        page = ids[offset : offset + page_size]
        if not page:
            return [], cursor or {}
        return page, {"offset": offset + len(page)}

    def fetch_user(self, source_id):
        self.calls.append(("fetch_user", source_id))
        return self.users[source_id]

    def fetch_category(self, source_id):
        self.calls.append(("fetch_category", source_id))
        return self.categories[source_id]

    def fetch_category_members(self, source_id):
        self.calls.append(("fetch_category_members", source_id))
        members = []
        for member in self.categories[source_id].get("members") or []:
            if member.get("status", CATEGORY_USER_ACTIVE) != CATEGORY_USER_ACTIVE:
                continue
            role = CATEGORY_PERMISSION_ROLES.get(member.get("permissionLevel"))
            if role:
                members.append({"userId": str(member.get("userId")), "role": role})
        return members

    def fetch_media(self, source_id):
        self.calls.append(("fetch_media", source_id))
        return self.media[source_id]

    def download(self, url, dest_path):
        shutil.copyfile(self.downloads[url], dest_path)
        return 1

    def download_flavor(self, flavor, dest_path):
        self.calls.append(("download_flavor", flavor["id"]))
        shutil.copyfile(self.downloads[flavor["id"]], dest_path)
        return 1

    def download_entry(self, entry, dest_path):
        self.calls.append(("download_entry", entry["id"]))
        shutil.copyfile(self.downloads[entry["id"]], dest_path)
        return 1

    def download_caption(self, caption, dest_path):
        self.calls.append(("download_caption", caption["id"]))
        shutil.copyfile(self.downloads[caption["id"]], dest_path)
        return 1
