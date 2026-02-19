# MediaCMS for Moodle

**Version:** 1.0.0 | **Release Date:** 2026-02-12 | **Moodle:** 4.5+

This package provides complete MediaCMS integration for Moodle, consisting of two plugins that work together with **unified settings**:

1.  **Filter Plugin (filter_mediacms):**
    *   Handles LTI 1.3 authentication and secure video launches
    *   Auto-converts MediaCMS URLs to embedded players
    *   **Provides core settings** (MediaCMS URL, LTI Tool ID) used by both plugins
    *   **Location:** `filter/mediacms`

2.  **Editor Plugin (tiny_mediacms):**
    *   Adds MediaCMS button to TinyMCE editor
    *   Browse authenticated video library via LTI Deep Linking
    *   Configure embed options (dimensions, display, start time)
    *   **Reads core settings** from filter plugin
    *   **Location:** `lib/editor/tiny/plugins/mediacms`

## Installation

This package is distributed as a single repository but contains two distinct Moodle plugins that must be installed in their respective directories.

### 1. Copy Files

Copy the directories into your Moodle installation as follows (example assuming Moodle is at `/var/www/moodle/public`):

*   Copy `filter/mediacms` to `/var/www/moodle/public/filter/mediacms`.
*   Copy `tiny/mediacms` to `/var/www/moodle/public/lib/editor/tiny/plugins/mediacms`.

### 2. Set Permissions

Ensure the web server user (typically `www-data`) has ownership of the new directories:

```bash
# Example for Ubuntu/Debian systems
chown -R www-data:www-data /var/www/moodle/public/filter/mediacms
chown -R www-data:www-data /var/www/moodle/public/lib/editor/tiny/plugins/mediacms
chmod -R 755 /var/www/moodle/public/filter/mediacms
chmod -R 755 /var/www/moodle/public/lib/editor/tiny/plugins/mediacms
```

### 3. Install Plugins

1.  Log in to Moodle as an Administrator.
2.  Go to **Site administration > Notifications**.
3.  Follow the prompts to upgrade the database and install the new plugins.

## Configuration

### Step 1: Core Settings (Required) - Configure Once

Go to **Site administration > Plugins > Filters > MediaCMS** (Settings)

*   **MediaCMS URL:** Enter your MediaCMS instance URL (e.g., `https://lti.mediacms.io`)
*   **LTI Tool:** Select the External Tool configuration for MediaCMS
    *   *First create an LTI 1.3 tool at: Site administration > Plugins > Activity modules > External tool > Manage tools*

> **✨ Note:** These core settings are automatically used by **both** the filter and TinyMCE editor plugin.

### Step 2: Enable Filter

1.  Go to **Site administration > Plugins > Filters > Manage filters**
2.  Set **MediaCMS** to "On"

### Step 3: Configure Auto-convert Defaults (Optional)

Go to **Site administration > Plugins > Text editors > TinyMCE editor > MediaCMS settings**

Configure default display options for auto-converted URLs:
*   Show video title
*   Link video title
*   Show related videos
*   Show user avatar

> **Note:** The core settings (URL, LTI Tool) are managed in the filter plugin settings.

## Usage

### For Teachers (Editor)

1.  In any text editor (TinyMCE), click the **MediaCMS** icon (or "Insert MediaCMS Media" from the Insert menu).
2.  You can:
    *   **Paste a URL:** Paste a View or Embed URL.
    *   **Video Library:** Click the "Video Library" tab to browse and select videos (requires LTI Deep Linking configuration).
3.  The video will appear as a placeholder or iframe in the editor.

### For Students (Display)

When content is viewed, the Filter will ensure the video is loaded securely via LTI 1.3, authenticating the user with MediaCMS automatically.
