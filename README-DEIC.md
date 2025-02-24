deploy/docker/local_settings.py changes

# this is for the top right link
REGISTER_ALLOWED = False
USERS_CAN_SELF_REGISTER = True

USE_RBAC = True
USE_SAML = True
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True

SOCIALACCOUNT_ADAPTER = 'saml_auth.adapter.SAMLAccountAdapter'

SOCIALACCOUNT_PROVIDERS = {
    "saml": {
        "provider_class": "custom_saml.provider.CustomSAMLProvider"
    }
}

ACCOUNT_USERNAME_VALIDATORS = "users.validators.less_restrictive_username_validators"

In Saml configurations:
 role_mapping has to be 
{'staff': 'contributor', 'student': 'member'} . Valid roles are member, contributor, manager

