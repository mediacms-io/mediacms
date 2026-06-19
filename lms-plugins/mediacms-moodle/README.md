# MediaCMS for Moodle

Version: 1.0.0, tested on Moodle 5

> **Moodle plugins directory**
> - Filter plugin: https://moodle.org/plugins/filter_mediacms
> - TinyMCE editor plugin: https://moodle.org/plugins/tiny_mediacms

This plugin provides complete MediaCMS integration for Moodle, consisting of two plugins that work together with unified settings:

1.  **Filter Plugin (filter_mediacms):**
    *   Handles LTI 1.3 authentication and secure video launches
    *   Auto-converts MediaCMS URLs to embedded players
    *   **Provides core settings** (MediaCMS URL, LTI Tool ID) used by both plugins
    *   **Location:** Admin, Plugins, Manage filters, MediaCMS

2.  **Editor Plugin (tiny_mediacms):**
    *   Adds MediaCMS button to TinyMCE editor
    *   Browse authenticated video library via LTI Deep Linking
    *   Configure embed options (dimensions, display, start time)
    *   **Reads core settings** from filter plugin
    *   **Location:** Admin, Plugins, TinyMCE, MediaCMS

## Installation

The suite ships as **two separate ZIP packages**, one per plugin:

| Order | Package | Plugin | Notes |
|-------|---------|--------|-------|
| 1 | `filter_mediacms-v1.0.0.zip` | `filter_mediacms` | Install **first** — provides the shared core settings |
| 2 | `tiny_mediacms-v1.0.0.zip` | `tiny_mediacms` | Depends on `filter_mediacms`; Moodle will block install until the filter is present |

`tiny_mediacms` declares a hard dependency on `filter_mediacms` in its `version.php`, so the two are always installed together — the editor plugin cannot be installed on its own.

Build both packages with:

```bash
./build.sh   # produces dist/filter_mediacms-v1.0.0.zip and dist/tiny_mediacms-v1.0.0.zip
```

### Option A — Upload through Moodle (recommended)

1.  Log in to Moodle as an Administrator.
2.  Go to **Site administration > Plugins > Install plugins**.
3.  Upload `filter_mediacms-v1.0.0.zip` and complete the install.
4.  Upload `tiny_mediacms-v1.0.0.zip` and complete the install.

### Option B — Extract manually

Upload both packages to Moodle's public directory and unzip each to its plugin type folder:

```bash
cd /var/www/moodle/public
unzip filter_mediacms-v1.0.0.zip -d filter/
unzip tiny_mediacms-v1.0.0.zip   -d lib/editor/tiny/plugins/
```

Ensure the web server user (typically `www-data`) has ownership of the new directories:

```bash
# Example for Ubuntu/Debian systems
chown -R www-data:www-data /var/www/moodle/public/filter/mediacms
chown -R www-data:www-data /var/www/moodle/public/lib/editor/tiny/plugins/mediacms
chmod -R 755 /var/www/moodle/public/filter/mediacms
chmod -R 755 /var/www/moodle/public/lib/editor/tiny/plugins/mediacms
```

Then log in as an Administrator, go to **Site administration > Notifications**, and follow the prompts to upgrade the database and install both plugins.

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



## Build instructions / Developing with the plugin

two types of changes: php (no build), js (build with npx grunt amd)

needs moodle/
npx version, dependencies etc

1. make changes here in lms-plugins/mediacms-moodle
2. copy to moodle
3. run `npx grunt amd` in moodle to build the JS files
4. from moodle copy back
sudo cp -r ~/mediacms/lms-plugins/mediacms-moodle/tiny/mediacms/ -r ~/mediacms/moodle/public/lib/editor/tiny/plugins/

5. cd ~/mediacms/moodle/public/lib/editor/tiny/plugins/mediacms/

npx grunt amd
6.
cp files back...
sudo cp -r /home/user/mediacms/moodle/public/lib/editor/tiny/plugins/mediacms /home/user/mediacms/lms-plugins/mediacms-moodle/tiny/

php admin/cli/purge_caches.php after


### Troubleshooting
Admin, advanced theme settings, add `My Media|/filter/mediacms/my_media.php` in case the position is not workin