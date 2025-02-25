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


## Add Social Application for SAML
Provider: has to see SAML, select
Provider id: wayf.wayf.dk
Name: Deic, whatever
Client id: wayf_dk , important, will define the URL, eg  https://deic.mediacms.io/accounts/saml/wayf_dk
Secret Key / Key empty
Settings: empty, default {}

### Add Social Configuration
Can be set as inline from Social Application, but it's nicer to do through it's own place in admin
Social App: link to existing app
IDP id: the Provider id of the SAML, has to be URL, eg https://wayf.wayf.dk
IDP cert: x509cert
SSO url / SLO url : the urls, https://wayf.wayf.dk/saml2/idp/SSOService2.php / https://wayf.wayf.dk/saml2/idp/SingleLogoutService.php
SP metadata url: the metadata url set for the SP, eg  https://deic.mediacms.io/saml/metadata
Group management options
email settings: verified email means the email found will be marked as verified in the system
email authentication means upon SAML response the system will consider email as identifier and if it finds a user with this email it will return that user. First it looks for username, which is the SAML uid response. Currently WIP to make it working, as setting email_authentication to False will enforce the user to provide an email (WIP)
Attribute Mapping: maps the attributes from the saml response
Role configuration: at the very least {"staff": "contributor"}
Valid roles are member, contributor, manager
