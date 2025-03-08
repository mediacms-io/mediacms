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
```

## SAML Configuration Steps

### Step 1: Add SAML Identity Provider
1. Navigate to Admin panel
2. Select "Identity Provider" 
3. Configure as follows:
   - **Provider**: SAML
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
   - `email_authentication`: When enabled, the system will use the email as an identifier
     - Note: This is currently WIP - setting to `False` will require users to provide an email

2. **Attribute Mapping**: Maps attributes from the SAML response

