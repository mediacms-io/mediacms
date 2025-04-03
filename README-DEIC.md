# MediaCMS: Document Changes for DEIC

## Configuration Changes
The following changes are required in `deploy/docker/local_settings.py`:

```python
# Authentication Settings
# these two are necessary so that users cannot register through system accounts. They can only register through identity providers
REGISTER_ALLOWED = False
USERS_CAN_SELF_REGISTER = False



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
SOCIALACCOUNT_AUTO_SIGNUP = True
SOCIALACCOUNT_EMAIL_REQUIRED = False

```

# if set to strict, user is created with the email from the saml provider without
# checking if the email is already on the system
# however if this is ommited, and user tries to login with an email that already exists on
# the system, then they get to the ugly form where it suggests they add a username/email/name

ACCOUNT_PREVENT_ENUMERATION = 'strict'


## SAML Configuration Steps

### Step 1: Add SAML Identity Provider
1. Navigate to Admin panel
2. Select "Identity Provider"
3. Configure as follows:
   - **Provider**: saml # ensure this is set with lower case!
   - **Provider ID**: `wayf.wayf.dk`
   - **IDP Config Name**: `Deic` (or preferred name)
   - **Client ID**: `wayf_dk` (important: defines the URL, e.g., `https://deic.mediacms.io/accounts/saml/wayf_dk`)
   - **Settings**: Leave empty (default `{}`)

### Step 2: Add SAML Configuration
Can be set through the SAML Configurations section:

1. **IDP Config Name**: Link to the existing app created above
2. **IDP ID**: Must be a URL, e.g., `https://wayf.wayf.dk`
3. **IDP Certificate**: x509cert from your SAML provider
4. **SSO URL**: `https://wayf.wayf.dk/saml2/idp/SSOService2.php`
5. **SLO URL**: `https://wayf.wayf.dk/saml2/idp/SingleLogoutService.php`
6. **SP Metadata URL**: The metadata URL set for the SP, e.g., `https://deic.mediacms.io/saml/metadata`

### Step 3: Group Management Options
1. **Email Settings**:
   - `verified_email`: When enabled, emails from SAML responses will be marked as verified
   - `email_authentication`: When enabled, the system will use the email as an identifier. False by default, since we want username to be the identifier

2. **Attribute Mapping**: Maps attributes from the SAML response


These settings have the following behavior as far as user authentication:
SOCIALACCOUNT_AUTO_SIGNUP = True, along with Email authentication  off: if SAML user response has associated email x@y.com and system finds this email already on the system (eg an admin has registered in with this address), then the registration form prompts the user to enter another email. They cannot set this email, as it says it's already taken by someone else. But most important, we don't allow users o be authenticated using their email.
