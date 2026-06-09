# Integrating Microsoft Entra ID (formerly Azure AD) with MediaCMS via SAML Authentication

This guide provides step-by-step instructions on how to configure Microsoft Entra ID as a SAML Identity Provider (IdP) for MediaCMS, an open-source content management system. The goal is to enable single sign-on (SSO) authentication for users in a secure and scalable way.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Configure MediaCMS for SAML](#step-1-configure-mediacms-for-saml)
4. [Step 2: Register MediaCMS as an Enterprise App in Entra ID](#step-2-register-mediacms-as-an-enterprise-app-in-entra-id)
5. [Step 3: Configure SAML Settings in Entra ID](#step-3-configure-saml-settings-in-entra-id)
6. [Step 4: Configure SAML Settings in MediaCMS](#step-4-configure-saml-settings-in-mediacms)
7. [Step 5: Allow Users or Groups to Log Into the Application](#step-5-allow-users-or-groups-to-log-into-the-application)
8. [Step 6: Test and Validate Login Flow](#step-6-test-and-validate-login-flow)
9. [Troubleshooting](#troubleshooting)
10. [Resources](#resources)

---

## Overview

MediaCMS supports SAML 2.0 authentication by acting as a Service Provider (SP). By integrating with Microsoft Entra ID, organizations can allow users to authenticate using their existing enterprise credentials.

In our particular deployment of MediaCMS, the application is hosted internally with no direct inbound access from the public Internet. As an internal company application, it was essential to integrate it with our existing authentication systems and provide a seamless single sign-on experience. This is where the SAML protocol shines.

One of the major advantages of SAML authentication is that all communication between the Identity Provider (IdP) — in this case, Microsoft Entra ID — and the Service Provider (SP) — MediaCMS — is brokered entirely by the end user's browser. The browser initiates the authentication flow, communicates securely with Microsoft’s login portal, receives the identity assertion, and then passes it back to the internal MediaCMS server.

This architecture enables the MediaCMS server to remain isolated from the Internet while still participating in a modern and seamless federated login experience.

Even though the deployment method outlined in this tutorial is for EntraID on an isolated MediaCMS server, the same steps and general information could be applied to another authentication SAML provider/identity provider on a non-isolated system.

> **Note**: This guide assumes you are running MediaCMS with Django backend and that the `django-allauth` library is enabled and configured.

---

## Prerequisites

Before beginning, ensure the following:

* You have administrator access to both MediaCMS and Microsoft Entra ID (Azure portal).
* MediaCMS is installed and accessible via HTTPS, with a valid SSL certificate.
* Your MediaCMS installation has SAML support enabled (via `django-allauth`).
* You have a dedicated domain or subdomain for MediaCMS (e.g., `https://<MyMediaCMS.MyDomain.com>`).

---

## Step 1: Configure MediaCMS for SAML

The first step in enabling SAML authentication is to modify the `local_settings.py` (for Docker: `./deploy/docker/local_settings.py`) file of your MediaCMS deployment. Add the following configuration block to enable SAML support, role-based access control (RBAC), and enforce secure communication settings:

```python
USE_RBAC = True
USE_SAML = True
USE_IDENTITY_PROVIDERS = True

USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True

SOCIALACCOUNT_ADAPTER = 'saml_auth.adapter.SAMLAccountAdapter'
SOCIALACCOUNT_PROVIDERS = {
    "saml": {
        "provider_class": "saml_auth.custom.provider.CustomSAMLProvider",
    }
}
```

These settings enable SAML authentication, configure MediaCMS to respect role-based access, and apply important headers and cookie policies for secure browser handling — all of which are necessary for the SAML flow to function properly.

> ⚠️ **Important**: After updating the `local_settings.py` file, you must restart your MediaCMS service (e.g., by rebooting the Docker container) in order for the changes to take effect. This step must be completed before proceeding to the next configuration stage.

---

## Step 2: Register MediaCMS as an Enterprise App in Entra ID

To begin the integration process on the Microsoft Entra ID (formerly Azure AD) side, follow the steps below to register MediaCMS as a new Enterprise Application.

### 1. Navigate to Enterprise Applications

* Log in to your [Azure Portal](https://portal.azure.com).
* Navigate to **Enterprise Applications**.

> *Note: This guide assumes you already have an existing Azure tenant and Entra ID configured with users and groups.*

### 2. Create a New Application

* Click the **+ New Application** button.
* On the next screen, choose **Create your own application**.
* Enter a name for the application (e.g., `MediaCMS`).
* Under "What are you looking to do with your application?", select **Integrate any other application you don't find in the gallery (Non-gallery)**.
* Click **Create**.

After a few moments, Azure will create the new application and redirect you to its configuration page.

---

## Step 3: Configure SAML Settings in Entra ID

### 1. Configure SAML-Based Single Sign-On

* From the application overview page, in the left-hand menu under **Manage**, click **Single sign-on**.
* You will be prompted to choose a sign-on method. Select **SAML**.

### 2. Choose a Client ID Name

Before filling out the SAML configuration, you must decide on a client ID name. This name will uniquely identify your SAML integration and appear in your login URL.

* Choose a name that is descriptive and easy to remember (e.g., `mediacms_entraid`).
* You will use this name in both MediaCMS and Entra ID configuration settings.

### 3. Fill Out Basic SAML Configuration

Now input the following values under the **Basic SAML Configuration** section:

| Field                      | Value                                                                 |
| -------------------------- | --------------------------------------------------------------------- |
| **Identifier (Entity ID)** | `https://<MyMediaCMS.MyDomain.com>/saml/metadata/`                    |
| **Reply URL (ACS URL)**    | `https://<MyMediaCMS.MyDomain.com>/accounts/saml/<MyClientID>/acs/`   |
| **Sign-on URL**            | `https://<MyMediaCMS.MyDomain.com>/accounts/saml/<MyClientID>/login/` |
| **Relay State (Optional)** | `https://<MyMediaCMS.MyDomain.com>/`                                  |
| **Logout URL (Optional)**  | `https://<MyMediaCMS.MyDomain.com>/accounts/saml/<MyClientID>/sls/`   |

> 🔐 Replace `<MyClientID>` with your own chosen client ID if different.

Once these fields are filled in, save your configuration.

Keep the Azure Enterprise single sign-on configuration window up, as we are now going to configure some of the details from this Azure page into our MediaCMS system.

---

## Step 4: Configure SAML Settings in MediaCMS

In MediaCMS, start by logging into the back-end administrative web page. You will now have new options under the left-hand menu bar.

### 1. Add Login Option

* Navigate to **Identity Providers → Login Options**.

* Click **Add Login Option**.

* Give the login option a title. This title can be anything you like but it will appear to the end-user when they select a method of logging in, so ensure the name is clear. (e.g., `EntraID-SSO`).

* Set the **Login URL** to the same Sign-on URL:

  ```
  https://<MyMediaCMS.MyDomain.com>/accounts/saml/<MyClientID>/login/
  ```

* Leave the ordering at `0` if you have no other authentication methods.

* Ensure the **Active** box is checked to make this an active login method.

* Click **Save** to continue.

### 2. Add ID Provider

* Navigate to **Identity Providers → ID Providers**.
* Click **Add ID Provider**.

Back in your Azure Enterprise application configuration window (at the bottom of the Single Sign-On configuration menu), find your application-specific details. They will look like the following example:

```
Example unique AppID: 123456ab-1234-12ab-ab12-abc123abc123
The unique AppID is automatically generated when you create the application.

-- Example URLs --
Login URL: https://login.microsoftonline.com/123456ab-1234-12ab-ab12-abc123abc123/saml2
Microsoft Entra Identifier: https://sts.windows.net/123456ab-1234-12ab-ab12-abc123abc123/
Logout URL: https://login.microsoftonline.com/123456ab-1234-12ab-ab12-abc123abc123/saml2
```

Back in MediaCMS's new ID Provider window, under the **General** tab:

* **Protocol**: `saml` (all lowercase)
* **Provider ID**: The Microsoft Entra Identifier (as shown above), the whole URL.
* **IDP Configuration Name**: Any unique name (e.g., `EntraID`)
* **Client ID**: The exact same client ID you used earlier when configuring EntraID (e.g., `mediacms_entraid`).
* **Sites**: Add all the sites you want this login to appear on (e.g., all of them)

Click **Save and Continue**, then go to the **SAML Configuration** tab.

On the **SAML Configuration** tab:

* **SSO URL**: Use the same Logon URL from EntraID example listed above.

* **SLO URL**: Use the Logout URL from EntraID example listed above.

* **SP Metadata URL**:

  ```
  https://<MyMediaCMS.MyDomain.com>/saml/metadata/
  ```

* **IdP ID**: Use the same Microsoft Entra Identifier URL as listed above.

#### LDP Certificate

Back in Azure's Enterprise Application page (SAML certificates section), download the **Base64 Certificate**, open it in a text editor, and copy the contents into the **LDP Certificate** setting inside of MediaCMS.

### 3. Configure Identity Mappings

Map the identity attributes that Entra ID will provide to MediaCMS. Even though only UID is specified as mandatory, Entra ID will not work unless all of these details are filled in(YES, you must type NA in the fields; you cannot leave anything blank. You will get 500 errors if this is not done). You can use the exact settings below:

| Field          | Value                                                                |
| -------------- | -------------------------------------------------------------------- |
| **Uid**        | `http://schemas.microsoft.com/identity/claims/objectidentifier`      |
| **Name**       | `http://schemas.microsoft.com/identity/claims/displayname`           |
| **Email**      | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress` |
| **Groups**     | `NA`                                                                 |
| **First name** | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname`    |
| **Last name**  | `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname`      |
| **User logo**  | `NA`                                                                 |
| **Role**       | `NA`                                                                 |

> ℹ️ Groups and Role can be changed or remapped inside the Azure Enterprise Application under **Attributes and Claims**.

Check the **Verified Email** box (since EntraID will verify the user for you). While setting up, you can enable **Save SAML Response Log** for troubleshooting purposes.

Finally, click **Save** to finish adding the new ID provider.

---

## Step 5: Allow Users or Groups to Log Into the Application

Back inside Azure AD, within your MediaCMS Enterprise Application, you must assign users or groups that are allowed to use the MediaCMS authentication sign-on.

### 1. Navigate to Users and Groups

* Open the Azure Portal and go to your **MediaCMS Enterprise Application**.
* In the left-hand **Manage** menu, click **Users and Groups**.

### 2. Assign Users or Groups

* Add individual users or groups of users who are allowed to use the EntraID authentication method with MediaCMS.
* In this example, the application was provided to all registered users inside of EntraID by using the special group **All Users**, which grants any registered user in the tenant access to MediaCMS.

> ⚠️ **Important**: Nested groups will not work. All users must be directly assigned to the group you are giving permission to. If a group contains another group, the users of the nested group will not inherit the permissions to use this application from the parent group.

---

## Step 6: Test and Validate Login Flow

At this point, you should go to your MediaCMS webpage and attempt to log in using the authentication method that you have just set up.

---

## Troubleshooting

If you're experiencing logon issues, it is helpful to first review the SAML authentication data directly.

1. Go to MediaCMS's login page. It should redirect you to Microsoft's login page.
2. Before completing the Microsoft authentication, open Firefox or Chrome Developer Tools (press **F12**) and navigate to the **Network** tab.
3. Enable **Persistent Logging**.
4. Complete the Microsoft authentication steps on your page (including two-factor authentication if enabled).

On the final step of the authentication (usually after entering a code and confirming "Stay signed in?"), you will see several POST requests going back to your MediaCMS server URL. Find the POST request that is going to your MediaCMS server's Assertion Consumer Service (ACS) URL, which will look like this:

```
https://<MyMediaCMS.MyDomain.com>/accounts/saml/<MyClientID>/acs/
```

Inside the request section of the Network tab, you will see a **Form Data** field labeled **SAMLResponse**, which contains a Base64-encoded XML string of your authenticated assertion from EntraID.

* Click into the data field of the SAML response so you can highlight and copy all of the Base64-encoded text.
* You can then take this Base64-encoded text to a tool like [CyberChef](https://gchq.github.io/CyberChef/) and use the **From Base64** decoder and **XML Beautify** to reveal the XML-formatted SAML response.

This decoded XML contains all the assertion and token details passed back to MediaCMS. You can use this information to troubleshoot any issues or misconfigurations that arise.

You can also confirm your MediaCMS server has the SAML authentication settings correct by opening a private browsing window and navigating to the following URL, which will output the current XML data that your MediaCMS server is configured with:

```
https://<MyMediaCMS.MyDomain.com>/saml/metadata/
```

You can use the returned XML data from this URL to confirm that MediaCMS is configured appropriately as expected and is providing the correct information to the identity provider.

### Infinite Redirect Loop

Another issue you might encounter is an **infinite redirect loop**. This can happen when global login is enforced and local user login is disabled.

**Symptoms:** The system continuously redirects between the homepage and the login URL.

**Root Cause:** With global login required and local login disabled, Django attempts to redirect users to the default local login page. Since that login method is unavailable, users are bounced back to the homepage, triggering the same redirect logic again — resulting in a loop.

**Solution:** Specify the correct SAML authentication URL in your local settings. For example:

* "Login Option" URL configured for EntraID in MediaCMS:

  ```
  https://<MyDomainName>/accounts/saml/mediacms_entraid/login/
  ```

* Add the following line to `./deploy/docker/local_settings.py`:

  ```python
  LOGIN_URL = "/accounts/saml/mediacms_entraid/login/"
  ```

This change ensures Django uses the proper SAML login route, breaking the redirect loop and allowing authentication via EntraID as intended.

> **Note:** The `LOGIN_URL` setting works because we are using the Django AllAuth module to perform the SAML authentication. If you review the AllAuth Django configuration settings, you will find that this is a setting, among other settings, that you can set inside of your local settings file that Django will pick up when using the AllAuth module. You can review the module documentation at the following URL for more details and additional settings that can be set through AllAuth via `local_settings.py`: [https://django-allauth.readthedocs.io/en/latest/account/configuration.html](https://django-allauth.readthedocs.io/en/latest/account/configuration.html)

---

## Resources

* [MediaCMS SAML Docs](https://github.com/mediacms-io/mediacms/blob/main/docs/admins_docs.md#24-identity-providers-setup)
* [Enable SAML single sign-on for an enterprise application](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/add-application-portal-setup-sso)
* [Django AllAuth](https://django-allauth.readthedocs.io/en/latest/index.html)

---

*This documentation is a work-in-progress and will be updated as further steps are dictated or completed.*
