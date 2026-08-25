from .base import BaseProvider

PLACEHOLDER = "Panopto migration is not implemented yet."


class PanoptoProvider(BaseProvider):
    name = "panopto"
    label = "Panopto"
    implemented = False

    secret_keys = ("client_secret",)
    required_connection_keys = ("service_url", "client_id", "client_secret")
    default_options = {}

    def check_connection(self):
        raise NotImplementedError(PLACEHOLDER)

    def list_page(self, phase, cursor, page_size):
        raise NotImplementedError(PLACEHOLDER)

    def fetch_media(self, source_id):
        raise NotImplementedError(PLACEHOLDER)
