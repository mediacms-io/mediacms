"""
PyLTI1p3 Django adapters for MediaCMS

Provides Django-specific implementations for PyLTI1p3 interfaces
"""

import json
from typing import Any, Dict, Optional

from django.core.cache import cache
from jwcrypto import jwk
from pylti1p3.message_launch import MessageLaunch
from pylti1p3.oidc_login import OIDCLogin
from pylti1p3.registration import Registration
from pylti1p3.request import Request
from pylti1p3.tool_config import ToolConfAbstract

from .models import LTIPlatform, LTIToolKeys


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

    def check_state_is_valid(self, state, nonce):
        """Check if state is valid - state is for CSRF protection, nonce is validated separately by JWT"""
        state_key = f'state-{state}'

        state_data = self.get_launch_data(state_key)

        if not state_data:
            return False

        # State exists - that's sufficient for CSRF protection
        # Nonce validation is handled by PyLTI1p3 through JWT signature and claims validation
        return True

    def check_nonce(self, nonce):
        """Check if nonce is valid (not used before) and mark it as used"""
        nonce_key = f'nonce-{nonce}'

        # Check if nonce was already used
        if self.check_launch_data_storage_exists(nonce_key):
            return False

        # Mark nonce as used
        self.save_launch_data(nonce_key, {'used': True})
        return True

    def set_state_valid(self, state, id_token_hash):
        """Mark state as valid and associate it with the id_token_hash"""
        state_key = f'state-{state}'
        self.save_launch_data(state_key, {'valid': True, 'id_token_hash': id_token_hash})
        return True

    def get_cookie(self, key):
        """Get cookie value (for cookie service compatibility)"""
        return self.request.COOKIES.get(key)

    def set_cookie(self, key, value, exp=3600):
        """Set cookie value (for cookie service compatibility)"""
        # Note: Actual cookie setting happens in the response, not here
        # This is just for interface compatibility
        return True


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
        if iss not in self._config:
            return None
        config = self._config[iss]

        # Create Registration object from config dict
        registration = Registration()
        registration.set_issuer(iss)
        registration.set_client_id(config.get('client_id'))
        registration.set_auth_login_url(config.get('auth_login_url'))
        registration.set_auth_token_url(config.get('auth_token_url'))
        if config.get('auth_audience'):
            registration.set_auth_audience(config.get('auth_audience'))
        registration.set_key_set_url(config.get('key_set_url'))

        # Set tool's private key for signing (e.g., Deep Linking responses)
        key_obj = LTIToolKeys.get_or_create_keys()
        jwk_obj = jwk.JWK(**key_obj.private_key_jwk)
        pem_bytes = jwk_obj.export_to_pem(private_key=True, password=None)

        # Set both the key and kid directly on Registration internal attributes
        registration._tool_private_key = pem_bytes.decode('utf-8')
        registration._tool_private_key_kid = key_obj.private_key_jwk['kid']

        return registration

    def find_registration_by_params(self, iss, client_id, *args, **kwargs):
        """Find registration by issuer and client ID"""
        if iss not in self._config:
            return None

        config = self._config[iss]
        if config.get('client_id') != client_id:
            return None

        # Create Registration object from config dict
        registration = Registration()
        registration.set_issuer(iss)
        registration.set_client_id(config.get('client_id'))
        registration.set_auth_login_url(config.get('auth_login_url'))
        registration.set_auth_token_url(config.get('auth_token_url'))
        if config.get('auth_audience'):
            registration.set_auth_audience(config.get('auth_audience'))
        registration.set_key_set_url(config.get('key_set_url'))

        # Set tool's private key for signing (e.g., Deep Linking responses)
        key_obj = LTIToolKeys.get_or_create_keys()
        jwk_obj = jwk.JWK(**key_obj.private_key_jwk)
        pem_bytes = jwk_obj.export_to_pem(private_key=True, password=None)

        # Set both the key and kid directly on Registration internal attributes
        registration._tool_private_key = pem_bytes.decode('utf-8')
        registration._tool_private_key_kid = key_obj.private_key_jwk['kid']

        return registration

    def find_deployment(self, iss, deployment_id):
        """Find deployment by issuer and deployment ID"""
        if iss not in self._config:
            return None

        config_dict = self._config[iss]
        deployment_ids = config_dict.get('deployment_ids', [])
        if deployment_id not in deployment_ids:
            return None

        return self.find_registration_by_issuer(iss)

    def find_deployment_by_params(self, iss, deployment_id, client_id, *args, **kwargs):
        """Find deployment by parameters"""
        if iss not in self._config:
            return None

        config_dict = self._config[iss]
        if config_dict.get('client_id') != client_id:
            return None

        deployment_ids = config_dict.get('deployment_ids', [])
        if deployment_id not in deployment_ids:
            return None

        return self.find_registration_by_params(iss, client_id)

    def get_jwks(self, iss, client_id=None):
        """Get JWKS from configuration - returns None to fetch from URL"""
        # No caching - PyLTI1p3 will fetch from key_set_url
        return None

    def get_iss(self):
        """Get all issuers"""
        return list(self._config.keys())

    def get_jwk(self, iss=None, client_id=None):
        """
        Get private JWK for signing Deep Linking responses

        PyLTI1p3 calls this to get the tool's private key for signing
        """
        # Load JWK and convert to PEM string
        key_obj = LTIToolKeys.get_or_create_keys()
        jwk_obj = jwk.JWK(**key_obj.private_key_jwk)

        # Export to PEM string (PyJWT accepts PEM strings)
        pem_bytes = jwk_obj.export_to_pem(private_key=True, password=None)

        return pem_bytes.decode('utf-8')

    @classmethod
    def from_platform(cls, platform):
        """Create ToolConfig from LTIPlatform model instance"""
        if isinstance(platform, LTIPlatform):
            config = {platform.platform_id: platform.get_lti_config()}
            return cls(config)

        raise ValueError("Must provide LTIPlatform instance")

    @classmethod
    def from_all_platforms(cls):
        """Create ToolConfig with all platforms"""
        platforms = LTIPlatform.objects.filter()
        config = {}

        for platform in platforms:
            config[platform.platform_id] = platform.get_lti_config()

        return cls(config)
