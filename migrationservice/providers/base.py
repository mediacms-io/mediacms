class BaseProvider:
    """Interface every migration source implements.

    Cursors are opaque JSON serialisable dicts owned by the provider. The
    orchestrator stores whatever a provider hands back and passes it in again
    on the next page, without interpreting it.
    """

    name = ""
    label = ""
    implemented = False

    secret_keys = ()
    required_connection_keys = ()
    # option defaults, also the allowed option key set
    default_options = {}

    # options this provider used to have. A migration saved before one was removed still
    # carries it, and the form posts back what it loaded, so these are dropped on save
    # instead of rejected. Anything else unrecognised is still an error, which is what
    # catches a typo in an API call.
    retired_options = ()

    # connection fields this provider used to have. Dropped on save and never returned,
    # so a credential the provider no longer uses cannot linger on an old record
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

    def fetch_user(self, source_id):
        """One source user record"""
        raise NotImplementedError

    def fetch_category(self, source_id):
        """One source category record"""
        raise NotImplementedError

    def fetch_category_members(self, source_id):
        """[{"userId": str, "role": "member"|"contributor"|"manager"}] for one category.

        Empty by default: a source with no notion of category membership has nothing to
        transfer, and the importer treats that as a category with no group behind it.
        """
        return []

    def download(self, url, dest_path):
        """Stream a URL to dest_path, return bytes written"""
        raise NotImplementedError
