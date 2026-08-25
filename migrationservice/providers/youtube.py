from .base import BaseProvider

PLACEHOLDER = "YouTube migration is not implemented yet."


class YouTubeProvider(BaseProvider):
    name = "youtube"
    label = "YouTube"
    implemented = False

    secret_keys = ("api_key",)
    required_connection_keys = ("channel_id", "api_key")
    default_options = {}

    def check_connection(self):
        raise NotImplementedError(PLACEHOLDER)

    def list_page(self, phase, cursor, page_size):
        raise NotImplementedError(PLACEHOLDER)

    def fetch_media(self, source_id):
        raise NotImplementedError(PLACEHOLDER)
