from .kaltura import KalturaProvider
from .panopto import PanoptoProvider
from .youtube import YouTubeProvider


def get_provider_class(name):
    """Provider class for a provider name"""
    providers = {
        KalturaProvider.name: KalturaProvider,
        PanoptoProvider.name: PanoptoProvider,
        YouTubeProvider.name: YouTubeProvider,
    }
    if name not in providers:
        raise ValueError(f"Unknown migration provider: {name}")
    return providers[name]


def get_provider(service):
    """Instantiated provider for a MigrationService, with decrypted credentials"""
    klass = get_provider_class(service.provider)
    return klass(service.get_connection(), service.get_options())
