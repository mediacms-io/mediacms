class BaseProvider:
    """Interface every migration source implements.

    Cursors are opaque JSON serialisable dicts owned by the provider: the orchestrator
    stores what it is handed and passes it back on the next page, uninterpreted.
    """

    name = ""
    label = ""
    implemented = False

    # whether a migration from this source can actually be run. A provider that can be
    # configured and tested but not yet swept says False, and is refused a start rather
    # than failing somewhere in the middle of its first phase
    can_import = True

    secret_keys = ()
    required_connection_keys = ()
    # option defaults, also the allowed option key set
    default_options = {}

    # options this provider used to have. A migration saved before one was removed still
    # carries it, so these are dropped on save rather than rejected. Anything else
    # unrecognised is still an error, which catches a typo in an API call.
    retired_options = ()

    # connection fields this provider used to have, dropped on save and never returned
    retired_connection_keys = ()

    def __init__(self, connection, options):
        self.connection = connection or {}
        self.options = options or {}

    @classmethod
    def source_system(cls, connection):
        """Normalised identity of the source installation.

        Two migrations pointing at the same installation must return the same
        string; two pointing at different installations must not.
        """
        return f"{cls.name}:"

    def within_selection(self, full_name):
        """Whether a path is one of the chosen roots or sits beneath one"""
        return True

    def worth_importing(self, category):
        """Whether a source category becomes a MediaCMS category of its own"""
        return True

    def list_categories(self):
        """Categories a migration can be limited to, for the category picker"""
        raise NotImplementedError(f"{self.label} migration is not implemented yet")

    def list_roles(self):
        """Roles defined on the source, for the role mapping form"""
        raise NotImplementedError(f"{self.label} migration is not implemented yet")

    def check_connection(self):
        """{"ok": bool, "error": str, "stats": {...}}"""
        raise NotImplementedError

    def list_page(self, phase, cursor, page_size):
        """One page of source ids for a phase.

        Returns (source_ids, next_cursor). An empty list means the phase is done.
        """
        raise NotImplementedError

    def fetch_media(self, source_id):
        """Everything needed to import one media entry"""
        raise NotImplementedError

    def child_entries(self, source_id):
        """The other streams of a multi stream recording. Most sources have none."""
        return []

    def fetch_user(self, source_id):
        """One source user record"""
        raise NotImplementedError

    def fetch_category(self, source_id):
        """One source category record"""
        raise NotImplementedError

    def fetch_group(self, source_id):
        """One source group: {"id", "name", "description", "members"}"""
        raise NotImplementedError

    def fetch_group_members(self, source_id):
        """[{"userId", "role"}] for one group. Empty for a source with no notion of groups."""
        return []

    def group_ids(self):
        """Every group id on the source, for telling a group apart from a person"""
        return set()

    def fetch_category_members(self, source_id):
        """[{"userId": str, "role": "member"|"contributor"|"manager"}] for one category.

        Empty by default: a source with no notion of category membership has nothing to
        transfer, and the importer treats that as a category with no group behind it.
        """
        return []

    def download(self, url, dest_path):
        """Stream a URL to dest_path, return bytes written"""
        raise NotImplementedError
