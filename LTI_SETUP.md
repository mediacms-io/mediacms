# MediaCMS LTI 1.3 Integration Setup Guide

This guide walks you through integrating MediaCMS with a Learning Management System (LMS) like Moodle using LTI 1.3.

## 1. Configure MediaCMS Settings

Add these settings to `cms/local_settings.py`:

```python
# Enable LTI integration
USE_LTI = True

# Enable RBAC for course-based access control
USE_RBAC = True

# Your production domain
FRONTEND_HOST = 'https://your-mediacms-domain.com'
ALLOWED_HOSTS = ['your-mediacms-domain.com', 'localhost']
```

**Note:** LTI-specific cookie settings (SESSION_COOKIE_SAMESITE='None', etc.) are automatically applied when `USE_LTI=True`.

## 2. MediaCMS Configuration

### A. Verify HTTPS Setup

Ensure your MediaCMS server is running on HTTPS. LTI 1.3 requires HTTPS for security and iframe embedding.

### B. Register Your LMS Platform

1. Access Django Admin: `https://your-mediacms-domain.com/admin/lti/ltiplatform/`
2. Add new LTI Platform with these settings:

**Basic Info:**
- **Name:** My LMS (or any descriptive name)
- **Platform ID (Issuer):** Get this from your LMS (e.g., `https://mylms.example.com`)
- **Client ID:** You'll get this from your LMS after registering MediaCMS as an external tool

**OIDC Endpoints (get from your LMS):**
- **Auth Login URL:** `https://mylms.example.com/mod/lti/auth.php`
- **Auth Token URL:** `https://mylms.example.com/mod/lti/token.php`
- **Key Set URL:** `https://mylms.example.com/mod/lti/certs.php`

**Deployment IDs:** Add the deployment ID(s) provided by your LMS as a JSON list, e.g., `["1"]`

**Features:**
- ✓ Enable NRPS (Names and Role Provisioning)
- ✓ Enable Deep Linking
- ✓ Auto-create categories
- ✓ Auto-create users
- ✓ Auto-sync roles

### C. Note MediaCMS URLs for LMS Configuration

You'll need these URLs when configuring your LMS:

- **Tool URL:** `https://your-mediacms-domain.com/lti/launch/`
- **OIDC Login URL:** `https://your-mediacms-domain.com/lti/oidc/login/`
- **JWK Set URL:** `https://your-mediacms-domain.com/lti/jwks/`
- **Redirection URI:** `https://your-mediacms-domain.com/lti/launch/`
- **Deep Linking URL:** `https://your-mediacms-domain.com/lti/select-media/`

## 3. LMS Configuration (Moodle Example)

### A. Register MediaCMS as External Tool

1. Navigate to: **Site administration → Plugins → Activity modules → External tool → Manage tools**
2. Click **Configure a tool manually** or add new tool

**Basic Settings:**
- **Tool name:** MediaCMS
- **Tool URL:** `https://your-mediacms-domain.com/lti/launch/`
- **LTI version:** LTI 1.3
- **Tool configuration usage:** Show in activity chooser

**URLs:**
- **Public keyset URL:** `https://your-mediacms-domain.com/lti/jwks/`
- **Initiate login URL:** `https://your-mediacms-domain.com/lti/oidc/login/`
- **Redirection URI(s):** `https://your-mediacms-domain.com/lti/launch/`

**Launch Settings:**
- **Default launch container:** Embed (without blocks) or New window
- **Accept grades from tool:** Optional
- **Share launcher's name:** Always ⚠️ **REQUIRED for user names**
- **Share launcher's email:** Always ⚠️ **REQUIRED for user emails**

> **Important:** MediaCMS creates user accounts automatically on first LTI launch. To ensure users have proper names and email addresses in MediaCMS, you **must** set both "Share launcher's name with tool" and "Share launcher's email with tool" to **Always** in the Privacy settings. Without these settings, users will be created with only a username based on their LTI user ID.

**Services:**
- ✓ IMS LTI Names and Role Provisioning (for roster sync)
- ✓ IMS LTI Deep Linking (for media selection)

3. Save the tool configuration

### B. Copy Platform Details to MediaCMS

After saving, your LMS will provide:
- Platform ID (Issuer URL)
- Client ID
- Deployment ID

Copy these values back to the LTIPlatform configuration in MediaCMS admin (step 2B above).

### C. Using MediaCMS in Courses

**Option 1: Embed "My Media" view**
- In a course, add activity → External tool → MediaCMS
- Leave the custom URL blank (uses default launch URL)
- Students/teachers will see their MediaCMS profile in an iframe

**Option 2: Embed specific media via Deep Linking**
- Add activity → External tool → MediaCMS
- Click "Select content" (if Deep Linking is enabled)
- Browse and select media from MediaCMS
- Selected media will be embedded in the course

**Option 3: Direct media link**
- Manually create external tool activity with custom URL:
  `https://your-mediacms-domain.com/lti/embed/{media_friendly_token}/`

## 4. Testing Checklist

- [ ] HTTPS is working on MediaCMS
- [ ] `USE_LTI = True` in local_settings.py
- [ ] LTIPlatform configured in Django admin
- [ ] External tool registered in LMS
- [ ] Launch from LMS creates new user in MediaCMS
- [ ] Course is mapped to MediaCMS category
- [ ] Users are added to RBAC group with correct roles
- [ ] Media from course category is visible to course members
- [ ] Public media is accessible
- [ ] Private media from other courses is not accessible

## 5. Default Role Mappings

The system automatically maps LMS roles to MediaCMS:

- **Instructor/Teacher** → advancedUser (global) + manager (course group)
- **Student/Learner** → user (global) + member (course group)
- **Teaching Assistant** → user (global) + contributor (course group)
- **Administrator** → manager (global) + manager (course group)

You can customize these in Django admin under **LTI Role Mappings**.

## 6. User Creation and Authentication

### User Creation via LTI

When a user launches MediaCMS from your LMS for the first time, a MediaCMS account is automatically created with:
- **Username:** Generated from email (preferred) or name, or a unique ID if neither is available
- **Email:** From LTI claim (if shared by LMS)
- **Name:** From LTI given_name/family_name claims (if shared by LMS)
- **Roles:** Mapped from LTI roles to MediaCMS permissions
- **Course membership:** Automatically added to the RBAC group for the course

### Privacy Settings Are Critical

⚠️ **For proper user accounts, you must configure the LTI tool's privacy settings in Moodle:**

1. Edit the External Tool configuration in Moodle
2. Go to the **Privacy** section
3. Set **"Share launcher's name with tool"** to **Always**
4. Set **"Share launcher's email with tool"** to **Always**

Without these settings:
- Users will not have proper names in MediaCMS
- Users will not have email addresses
- Usernames will be generic hashes (e.g., `lti_user_abc123def`)

### Authentication

Users created through LTI integration do **not** have a password set. They can only access MediaCMS through LTI launches from your LMS. This is intentional for security.

If you need a user to have both LTI access and direct login capability, manually set a password using:
```bash
python manage.py changepassword <username>
```

## Need Help?

If you encounter issues, check:
- `/admin/lti/ltilaunchlog/` for launch attempt logs
- Django logs for detailed error messages
- Ensure HTTPS is properly configured (required for iframe cookies)
- Verify all URLs are correct and accessible
- Check that the Client ID and Deployment ID match between MediaCMS and your LMS
