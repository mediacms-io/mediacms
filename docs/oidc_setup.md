# Configuring OpenID Connect (OIDC) Authentication in MediaCMS

This guide provides step-by-step instructions for enabling OpenID Connect (OIDC) single sign-on in MediaCMS. It covers both the MediaCMS side and the generic steps required on your identity provider, regardless of which OIDC-compliant IdP you are using (Keycloak, Auth0, Google, Okta, etc.).

## Table of Contents

- [Configuring OpenID Connect (OIDC) Authentication in MediaCMS](#configuring-openid-connect-oidc-authentication-in-mediacms)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Prerequisites](#prerequisites)
  - [Step 1: Configure MediaCMS Settings](#step-1-configure-mediacms-settings)
  - [Step 2: Register MediaCMS as an OIDC Client](#step-2-register-mediacms-as-an-oidc-client)
    - [Callback (Redirect) URL](#callback-redirect-url)
    - [Application type and flow](#application-type-and-flow)
    - [Requested scopes](#requested-scopes)
  - [Step 3: Configure the Provider in MediaCMS](#step-3-configure-the-provider-in-mediacms)
    - [Alternative: Manual configuration via admin](#alternative-manual-configuration-via-admin)
  - [Step 4: Add a Login Option](#step-4-add-a-login-option)
  - [Step 5: Test and Validate Login Flow](#step-5-test-and-validate-login-flow)
  - [Troubleshooting](#troubleshooting)
    - [`redirect_uri_mismatch` error from the IdP](#redirect_uri_mismatch-error-from-the-idp)
    - [`No SocialApp found matching the provider` error](#no-socialapp-found-matching-the-provider-error)
    - [User is created but claims are not synced (wrong name, no avatar)](#user-is-created-but-claims-are-not-synced-wrong-name-no-avatar)
    - [Inspecting raw claims](#inspecting-raw-claims)
    - [Infinite redirect loop](#infinite-redirect-loop)
  - [Resources](#resources)

---

## Overview

MediaCMS supports OIDC authentication via `django-allauth`'s built-in `openid_connect` provider. Once configured, users can log in through any OIDC-compliant identity provider using the Authorization Code flow.

MediaCMS acts as the **Relying Party** (client). The identity provider authenticates the user and returns an ID token containing claims (subject, email, name, etc.) that MediaCMS uses to create or update the local user account.

On each login, MediaCMS can optionally sync the user's profile picture, role, and group memberships from the claims provided by the IdP.

---

## Prerequisites

Before beginning, ensure the following:

* You have administrator access to MediaCMS and to your identity provider's management console.
* MediaCMS is accessible via HTTPS (required by most OIDC providers).
* Your identity provider supports the **Authorization Code flow** and exposes a discovery document at a well-known URL ending in `/.well-known/openid-configuration`.
* You have credentials (client ID and client secret) for a new OIDC client application that you will register on the IdP side.

---

## Step 1: Configure MediaCMS Settings

Edit `local_settings.py` (for Docker deployments: `./deploy/docker/local_settings.py`) and add the following settings:

```python
USE_IDENTITY_PROVIDERS = True
USE_OIDC = True

OIDC_PROVIDERS = [
    {
        "provider_id": "myprovider",           # unique slug; appears in the callback URL
        "name": "My Identity Provider",        # display name shown on the login page
        "client_id": os.getenv("OIDC_CLIENT_ID"),
        "secret": os.getenv("OIDC_CLIENT_SECRET"),
        "server_url": os.getenv("OIDC_SERVER_URL"),  # base URL; must expose /.well-known/openid-configuration
        "oidc_config": {
            "verified_email": True,
        },
        "scopes": ["openid", "email", "profile"],
        "claim_handlers": [
            {
                "claim": "picture",
                "parser": "oidc_auth.parsers.profile_picture.sync_profile_picture",
            },
        ],
    },
]
```

`scopes` is a list of OAuth2 scope names to request from the IdP. `claim_handlers` associates individual JWT claims with a parser function that processes them at login time. Handlers with `parser_options` pass extra keyword arguments to the parser:

```python
"claim_handlers": [
    {
        "claim": "roles",
        "parser": "oidc_auth.parsers.ietf_role_mapping.handle_ietf_role_mapping",
        "parser_options": {
            "role_matcher": {
                "chair:ietf": {"map_to": "manager", "groups": ["IETF Chairs"]},
            },
        },
    },
],
```

Set the corresponding environment variables:

| Variable | Value |
|---|---|
| `OIDC_CLIENT_ID` | Client ID obtained from your IdP |
| `OIDC_CLIENT_SECRET` | Client secret obtained from your IdP |
| `OIDC_SERVER_URL` | Base URL of the IdP (e.g. `https://accounts.example.com`) |

> ⚠️ **Important**: Never hardcode credentials directly in `local_settings.py`. Always read them from environment variables or a secrets manager.

If you are running MediaCMS alongside an existing SAML deployment, also add:

```python
SOCIALACCOUNT_ADAPTER = "identity_providers.adapter.UnifiedSocialAccountAdapter"
```

This adapter handles both SAML and OIDC logins from a single configuration. If you are deploying OIDC only, you can use the more specific adapter instead:

```python
SOCIALACCOUNT_ADAPTER = "oidc_auth.adapter.OIDCAccountAdapter"
```

> ⚠️ **Important**: After updating `local_settings.py`, restart your MediaCMS service for the changes to take effect before continuing.

---

## Step 2: Register MediaCMS as an OIDC Client

On your identity provider's management console, create a new OIDC client application and configure it with the following values.

### Callback (Redirect) URL

This is the URL that the IdP will redirect the user back to after successful authentication. Register the following URI:

```
https://<your-mediacms-host>/accounts/oidc/<provider-id>/login/callback/
```

Replace `<your-mediacms-host>` with your domain and `<provider-id>` with the value you chose for `provider_id` in `local_settings.py` (e.g. `myprovider`).

### Application type and flow

| Setting | Value |
|---|---|
| Application type | Web application (confidential client) |
| Grant type | Authorization Code |
| Token endpoint authentication | Client Secret (basic or post) |

### Requested scopes

At minimum, request the following scopes on the IdP side:

| Scope | Purpose |
|---|---|
| `openid` | Required for OIDC |
| `email` | User email address |
| `profile` | Full name, given name, family name |

Once saved, the IdP will provide you with a **Client ID** and a **Client Secret**. Store these as the environment variables defined in Step 1.

---

## Step 3: Configure the Provider in MediaCMS

The recommended way to apply the configuration from `local_settings.py` to the database is through the `sync_oidc_providers` management command. This is idempotent and safe to run on every deploy.

```bash
# Docker:
docker compose exec web python manage.py sync_oidc_providers

# Preview changes without applying:
docker compose exec web python manage.py sync_oidc_providers --dry-run
```

The command creates or updates the following records automatically:

* **Social Application** — the allauth `SocialApp` entry for the provider, with `scope` set from `scopes`
* **OIDC Configuration** — claim mapping and behavioural flags
* **OIDC Scope Configs** — one entry per `claim_handlers` entry
* **Login Option** — the button that appears on the MediaCMS login page

### Alternative: Manual configuration via admin

If you prefer to configure the provider through the admin interface:

1. Log in to the MediaCMS admin at `https://<your-host>/admin/`.
2. Navigate to **Social Accounts → Social Applications** and click **Add Social Application**.
3. Fill in the form:

    | Field | Value |
    |---|---|
    | Provider | `OpenID Connect` |
    | Provider ID | The slug you chose (e.g. `myprovider`) |
    | Name | Display name (e.g. `My Identity Provider`) |
    | Client ID | Client ID from the IdP |
    | Secret key | Client secret from the IdP |
    | Server URL | Base URL of the IdP |
    | Sites | Select the current site |

4. Scroll down to the **OIDC Configuration** inline section and configure the claim mapping:

    | Field | Default | Notes |
    |---|---|---|
    | UID claim | `sub` | Unique user identifier from the IdP |
    | Email claim | `email` | User email address |
    | Name claim | `name` | Full display name |
    | First name claim | `given_name` | |
    | Last name claim | `family_name` | |
    | Verified email | ✓ | Trust the IdP email as already verified |
    | Email authentication | ☐ | Match existing users by email (useful for migration) |
    | Remove from groups | ☐ | Remove user from groups not present in OIDC claims |
    | Save OIDC response logs | ☐ | Store raw claims for debugging — contains personal data |

5. Click **Save**.

6. Navigate to **Identity Providers → Login Options** and click **Add Login Option**. Set the login URL to:

    ```
    https://<your-host>/accounts/oidc/<provider-id>/login/
    ```

    Make sure **Active** is checked, then click **Save**.

---

## Step 4: Add a Login Option

If you used `sync_oidc_providers`, the Login Option is created automatically. If you configured the provider manually and have not yet added a Login Option:

1. In the admin, navigate to **Identity Providers → Login Options**.
2. Click **Add Login Option**.
3. Fill in the fields:

    | Field | Value |
    |---|---|
    | Title | Name shown to the user (e.g. `Sign in with My Provider`) |
    | Login URL | `https://<your-host>/accounts/oidc/<provider-id>/login/` |
    | Ordering | `0` if this is the only or primary option |
    | Active | ✓ |

4. Click **Save**.

---

## Step 5: Test and Validate Login Flow

1. Open a private browser window and navigate to your MediaCMS login page.
2. The login page should now show the button or link for your OIDC provider (with the title set in Step 4).
3. Click the link. You should be redirected to your identity provider's login page.
4. Authenticate with valid credentials.
5. After successful authentication, you should be redirected back to MediaCMS and logged in.
6. Verify that the user account was created in the MediaCMS admin under **Users** with the correct email address and display name.

---

## Troubleshooting

### `redirect_uri_mismatch` error from the IdP

The callback URL registered on the IdP does not match what MediaCMS is sending. Double-check that the URL registered with the IdP exactly matches:

```
https://<host>[:<port>]/accounts/oidc/<provider-id>/login/callback/
```

Note that the `provider-id` in the URL must match the `provider_id` value in `OIDC_PROVIDERS` (and in the `SocialApp.provider_id` field in the admin). This value is case-sensitive.

### `No SocialApp found matching the provider` error

The `SocialApp` record in the database has not been created yet, or the `provider_id` does not match. Run `sync_oidc_providers` again or verify the provider ID in the admin.

### User is created but claims are not synced (wrong name, no avatar)

Check that:
* The `OIDC_PROVIDERS` scopes list includes `profile` and `email`.
* The claim names in the OIDC Configuration match what your IdP actually returns. You can enable **Save OIDC response logs** temporarily to inspect the raw claims.
* The Celery worker is running (required for asynchronous profile picture download).

### Inspecting raw claims

Enable `save_oidc_response_logs` on the `OIDCConfiguration` (via admin or `oidc_config` key in settings). Raw claim data will be stored under **Identity Providers → Identity Provider User Logs** after the next login. Remember to disable this setting after debugging, as the logs contain personal data.

### Infinite redirect loop

If you have configured `LOGIN_REQUIRED = True` and local login is disabled, users may get stuck in a redirect loop. Fix this by pointing Django to the OIDC login URL:

```python
# local_settings.py
LOGIN_URL = "/accounts/oidc/myprovider/login/"
```

Replace `myprovider` with your actual `provider_id`.

---

## Resources

* [MediaCMS OIDC technical reference](./oidc/deployment.md)
* [MediaCMS Identity Providers documentation](./admins_docs.md#24-identity-providers-setup)
* [django-allauth OIDC provider](https://docs.allauth.org/en/latest/socialaccount/providers/openid_connect.html)
* [OpenID Connect specification](https://openid.net/specs/openid-connect-core-1_0.html)

---

*This guide covers generic OIDC provider setup. For provider-specific details (claim names, scopes, application registration steps), refer to your identity provider's documentation.*
