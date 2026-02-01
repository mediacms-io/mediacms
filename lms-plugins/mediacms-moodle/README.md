# MediaCMS for Moodle

This package provides the integration between MediaCMS and Moodle (versions 4.x and 5.x).
It consists of two separate plugins that work together to provide a seamless video experience:

1.  **Filter Plugin (filter_mediacms):**
    *   **Purpose:** Handles the display of videos using secure LTI 1.3 launches and provides "Auto-convert" to turn URLs into players.
    *   **Location:** `filter/mediacms`

2.  **Editor Plugin (tiny_mediacms):**
    *   **Purpose:** Adds a "Insert MediaCMS Media" button to the TinyMCE editor, allowing users to select videos from the MediaCMS library or paste URLs.
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

You must configure both plugins to fully enable the integration.

### Filter Configuration
1.  Go to **Site administration > Plugins > Filters > Manage filters**.
2.  Enable **MediaCMS** (set it to "On").
3.  Click **Settings** next to MediaCMS.
4.  **MediaCMS URL:** Enter the base URL of your MediaCMS instance (e.g., `https://lti.mediacms.io`).
5.  **LTI Tool:** Select the External Tool configuration that corresponds to MediaCMS.
    *   *Note:* You must first create an LTI 1.3 External Tool in *Site administration > Plugins > Activity modules > External tool > Manage tools*.
6.  **Auto-convert:** Check "Enable auto-convert" if you want plain text URLs (e.g., `https://video.example.com/view?m=xyz`) to automatically become video players.

### Editor Configuration (TinyMCE)
1.  Go to **Site administration > Plugins > Text editors > TinyMCE editor > MediaCMS settings**.
2.  **LTI Tool:** Select the same Tool configured for the Filter to enable the "Video Library" picker button.
3.  **Auto-convert:** (Implicitly enabled) Pasting MediaCMS URLs into the editor will automatically convert them to placeholders.

## Usage

### For Teachers (Editor)

1.  In any text editor (TinyMCE), click the **MediaCMS** icon (or "Insert MediaCMS Media" from the Insert menu).
2.  You can:
    *   **Paste a URL:** Paste a View or Embed URL.
    *   **Video Library:** Click the "Video Library" tab to browse and select videos (requires LTI Deep Linking configuration).
3.  The video will appear as a placeholder or iframe in the editor.

### For Students (Display)

When content is viewed, the Filter will ensure the video is loaded securely via LTI 1.3, authenticating the user with MediaCMS automatically.
