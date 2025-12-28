"""
PyLTI1p3 Django adapters for MediaCMS

Provides Django-specific implementations for PyLTI1p3 interfaces
"""

import json
from typing import Any, Dict, Optional

from django.core.cache import cache
from pylti1p3.request import Request
from pylti1p3.tool_config import ToolConfAbstract


class DjangoRequest(Request):
    """Django request adapter for PyLTI1p3"""

    def __init__(self, request):
        super().__init__()
        self._request = request
        self._cookies = request.COOKIES
        self._session = request.session

    def get_param(self, key):
        """Get parameter from GET or POST"""
        # Check both POST and GET, POST takes priority
        value = self._request.POST.get(key) or self._request.GET.get(key)
        print(f"DjangoRequest.get_param('{key}') = {value}", flush=True)
        return value

    def get_cookie(self, key):
        """Get cookie value"""
        return self._cookies.get(key)

    def is_secure(self):
        """Check if request is secure (HTTPS)"""
        return self._request.is_secure()

    @property
    def session(self):
        """Get session"""
        return self._session

    def _get_request_param(self, key):
        """Internal method for PyLTI1p3 compatibility"""
        return self.get_param(key)


class DjangoOIDCLogin:
    """Handles OIDC login initiation"""

    def __init__(self, request, tool_config, launch_data_storage=None):
        self.request = request
        self.lti_request = DjangoRequest(request)
        self.tool_config = tool_config
        self.launch_data_storage = launch_data_storage or DjangoSessionService(request)

    def get_redirect(self, redirect_url):
        """Get the redirect object for OIDC login"""
        from pylti1p3.oidc_login import OIDCLogin

        oidc_login = OIDCLogin(self.lti_request, self.tool_config, session_service=self.launch_data_storage, cookie_service=self.launch_data_storage)

        return oidc_login.enable_check_cookies().redirect(redirect_url)


class DjangoMessageLaunch:
    """Handles LTI message launch validation"""

    def __init__(self, request, tool_config, launch_data_storage=None):
        self.request = request
        self.lti_request = DjangoRequest(request)
        self.tool_config = tool_config
        self.launch_data_storage = launch_data_storage or DjangoSessionService(request)

    def validate(self):
        """Validate the LTI launch message"""
        from pylti1p3.message_launch import MessageLaunch

        # Create custom MessageLaunch that properly implements _get_request_param
        class CustomMessageLaunch(MessageLaunch):
            def _get_request_param(self, key):
                """Override to properly get request parameters"""
                return self._request.get_param(key)

        message_launch = CustomMessageLaunch(self.lti_request, self.tool_config, session_service=self.launch_data_storage, cookie_service=self.launch_data_storage)

        return message_launch


class DjangoSessionService:
    """Launch data storage using Django sessions"""

    def __init__(self, request):
        self.request = request
        self._session_key_prefix = 'lti1p3_'

    def get_launch_data(self, key):
        """Get launch data from session"""
        session_key = self._session_key_prefix + key
        data = self.request.session.get(session_key)
        return json.loads(data) if data else None

    def save_launch_data(self, key, data):
        """Save launch data to session"""
        session_key = self._session_key_prefix + key
        self.request.session[session_key] = json.dumps(data)
        self.request.session.modified = True
        return True

    def check_launch_data_storage_exists(self, key):
        """Check if launch data exists in session"""
        session_key = self._session_key_prefix + key
        return session_key in self.request.session


class DjangoCacheDataStorage:
    """Key/value storage using Django cache"""

    def __init__(self, cache_name='default', **kwargs):
        self._cache = cache
        self._prefix = 'lti1p3_cache_'

    def get_value(self, key):
        """Get value from cache"""
        cache_key = self._prefix + key
        return self._cache.get(cache_key)

    def set_value(self, key, value, exp=3600):
        """Set value in cache with expiration"""
        cache_key = self._prefix + key
        return self._cache.set(cache_key, value, timeout=exp)

    def check_value(self, key):
        """Check if value exists in cache"""
        cache_key = self._prefix + key
        return cache_key in self._cache


class DjangoToolConfig(ToolConfAbstract):
    """Tool configuration from Django models"""

    def __init__(self, platforms_dict: Optional[Dict[str, Any]] = None):
        """
        Initialize with platforms configuration

        Args:
            platforms_dict: Dictionary mapping platform_id to config
                {
                    'https://moodle.example.com': {
                        'client_id': '...',
                        'auth_login_url': '...',
                        'auth_token_url': '...',
                        'key_set_url': '...',
                        'deployment_ids': [...],
                    }
                }
        """
        super().__init__()
        self._config = platforms_dict or {}

    def check_iss_has_one_client(self, iss):
        """Check if issuer has exactly one client"""
        return iss in self._config and len([self._config[iss]]) == 1

    def check_iss_has_many_clients(self, iss):
        """Check if issuer has multiple clients"""
        # For now, we support one client per issuer
        return False

    def find_registration_by_issuer(self, iss, *args, **kwargs):
        """Find registration by issuer"""
        print(f"DjangoToolConfig.find_registration_by_issuer('{iss}')", flush=True)
        if iss not in self._config:
            print("  -> Not found in config", flush=True)
            return None
        result = self._config[iss]
        print(f"  -> Found: {result.get('client_id')}", flush=True)
        return result

    def find_registration_by_params(self, iss, client_id, *args, **kwargs):
        """Find registration by issuer and client ID"""
        print(f"DjangoToolConfig.find_registration_by_params('{iss}', '{client_id}')", flush=True)
        if iss not in self._config:
            print("  -> Issuer not found", flush=True)
            return None

        config = self._config[iss]
        if config.get('client_id') == client_id:
            print("  -> Match found", flush=True)
            return config

        print(f"  -> Client ID mismatch: expected {client_id}, got {config.get('client_id')}", flush=True)
        return None

    def find_deployment(self, iss, deployment_id):
        """Find deployment by issuer and deployment ID"""
        config = self.find_registration_by_issuer(iss)
        if not config:
            return None

        deployment_ids = config.get('deployment_ids', [])
        if deployment_id in deployment_ids:
            return config

        return None

    def find_deployment_by_params(self, iss, deployment_id, client_id, *args, **kwargs):
        """Find deployment by parameters"""
        config = self.find_registration_by_params(iss, client_id)
        if not config:
            return None

        deployment_ids = config.get('deployment_ids', [])
        if deployment_id in deployment_ids:
            return config

        return None

    def get_jwks(self, iss, client_id=None):
        """Get JWKS from configuration"""
        config = self.find_registration_by_params(iss, client_id) if client_id else self.find_registration_by_issuer(iss)
        if not config:
            return None

        return config.get('key_set')

    def get_iss(self):
        """Get all issuers"""
        return list(self._config.keys())

    @classmethod
    def from_platform(cls, platform):
        """Create ToolConfig from LTIPlatform model instance"""
        from .models import LTIPlatform

        if isinstance(platform, LTIPlatform):
            config = {platform.platform_id: platform.get_lti_config()}
            return cls(config)

        raise ValueError("Must provide LTIPlatform instance")

    @classmethod
    def from_all_platforms(cls):
        """Create ToolConfig with all active platforms"""
        from .models import LTIPlatform

        platforms = LTIPlatform.objects.filter(active=True)
        config = {}

        for platform in platforms:
            config[platform.platform_id] = platform.get_lti_config()

        return cls(config)
