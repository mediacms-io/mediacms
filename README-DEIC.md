# MediaCMS: Document Changes for DEIC

## Configuration Changes
The following changes are required in `deploy/docker/local_settings.py`:

```python
# Authentication Settings
REGISTER_ALLOWED = False
USERS_CAN_SELF_REGISTER = True
USE_RBAC = True
USE_SAML = True

# Proxy and SSL Settings
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True

# SAML Configuration
SOCIALACCOUNT_ADAPTER = 'saml_auth.adapter.SAMLAccountAdapter'
ACCOUNT_USERNAME_VALIDATORS = "users.validators.less_restrictive_username_validators"
SOCIALACCOUNT_PROVIDERS = {
   "saml": {
       "provider_class": "saml_auth.custom.provider.CustomSAMLProvider",
   }
}
EXTRA_APPS = [
   "allauth.socialaccount.providers.saml",
   "saml_auth.apps.SamlAuthConfig",
]
