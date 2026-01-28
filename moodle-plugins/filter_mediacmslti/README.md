# MediaCMS LTI Filter for Moodle 5

A Moodle filter plugin that automatically converts MediaCMS video URLs into LTI-authenticated embedded video players. Users can simply paste MediaCMS URLs into any Moodle content area (course descriptions, page content, etc.) and the videos will be embedded with transparent LTI authentication.

## Features

- **Automatic URL Detection**: Detects MediaCMS video URLs and converts them to embedded iframes
- **Transparent LTI Authentication**: Automatically initiates LTI 1.3 authentication flow without user interaction
- **Seamless Integration**: Works in any Moodle text area (Pages, Activities, Descriptions, etc.)
- **Configurable**: Admin can set MediaCMS URL, LTI tool, and iframe dimensions
- **Moodle 5 Compatible**: Built specifically for Moodle 5.0+

## How It Works

1. User pastes a MediaCMS URL (e.g., `https://deic.mediacms.io/view?m=KmITliaUC`)
2. Filter detects the URL and extracts the video token
3. Generates an iframe with an auto-submitting form that initiates LTI authentication
4. Form includes:
   - Current user's Moodle ID as `login_hint`
   - LTI platform issuer (ISS)
   - LTI client ID
   - Target video via custom parameters
5. Video loads in iframe with proper LTI authentication

## Prerequisites

Before installing this filter, you must have:

1. **MediaCMS with LTI Support**: Your MediaCMS instance must have LTI 1.3 integration enabled
2. **LTI External Tool Configured**: An LTI External Tool must be configured in Moodle that connects to MediaCMS
3. **Moodle 5.0 or later**

## Installation

### Method 1: Via Moodle Plugin Directory (Recommended)

1. Download the plugin ZIP file
2. Log in as Moodle admin
3. Go to **Site administration → Plugins → Install plugins**
4. Upload the ZIP file
5. Click "Install plugin from the ZIP file"
6. Follow the on-screen prompts

### Method 2: Manual Installation

1. Copy the `filter_mediacmslti` directory to your Moodle installation:
   ```bash
   cp -r filter_mediacmslti /path/to/moodle/filter/
   ```

2. Set proper permissions:
   ```bash
   cd /path/to/moodle
   chown -R www-data:www-data filter/filter_mediacmslti
   ```

3. Log in as Moodle admin and go to **Site administration → Notifications**
4. Moodle will detect the new plugin and prompt you to upgrade
5. Click "Upgrade Moodle database now"

## Configuration

### Step 1: Configure LTI External Tool (if not already done)

1. Go to **Site administration → Plugins → Activity modules → External tool → Manage tools**
2. Click "Configure a tool manually"
3. Enter the following details:
   - **Tool name**: MediaCMS
   - **Tool URL**: `https://deic.mediacms.io/lti/launch/`
   - **LTI version**: LTI 1.3
   - **Public key type**: Keyset URL
   - **Public keyset**: `https://deic.mediacms.io/lti/jwks/`
   - **Initiate login URL**: `https://deic.mediacms.io/lti/oidc/login/`
   - **Redirection URI(s)**: `https://deic.mediacms.io/lti/launch/`
4. Enable:
   - Deep Linking (Content-Item Message)
   - Share launcher's name with tool
   - Share launcher's email with tool
5. Click "Save changes"
6. **Note the Tool ID** (you'll need this for the filter configuration)

### Step 2: Configure Filter Settings

1. Go to **Site administration → Plugins → Filters → MediaCMS LTI Filter**
2. Configure the following settings:

   - **MediaCMS URL**: Enter your MediaCMS instance URL
     - Example: `https://deic.mediacms.io`
     - Do NOT include trailing slash

   - **LTI External Tool**: Select the MediaCMS tool you configured in Step 1
     - Choose from the dropdown of available LTI tools

   - **Iframe Width**: Default width in pixels (default: 960)

   - **Iframe Height**: Default height in pixels (default: 540)

3. Click "Save changes"

### Step 3: Enable the Filter

1. Go to **Site administration → Plugins → Filters → Manage filters**
2. Find "MediaCMS LTI Embed" in the list
3. Change the setting from "Disabled" to **"On"**
   - Alternatively, use "Off, but available" to allow course-level control
4. Adjust the filter order if needed (higher = runs earlier)
5. Click "Save changes"

## Usage

### For Content Creators

Once the filter is enabled, simply paste MediaCMS URLs into any Moodle content area:

#### Example 1: In a Page Resource

1. Create or edit a Page resource
2. In the content editor, paste the MediaCMS URL:
   ```
   https://deic.mediacms.io/view?m=KmITliaUC
   ```
3. Save the page
4. The URL will automatically be replaced with an embedded video player

#### Example 2: In Course Description

1. Edit course settings
2. In the "Course description" field, paste:
   ```
   Watch this introduction video: https://deic.mediacms.io/view?m=KmITliaUC
   ```
3. Save
4. The video will be embedded directly in the course summary

#### Example 3: In Activity Description

1. Create any activity (Forum, Assignment, etc.)
2. In the description field, paste MediaCMS URLs
3. Students will see embedded videos when viewing the activity

### Supported URL Formats

The filter recognizes these URL patterns:
- `https://deic.mediacms.io/view?m=TOKEN`
- `https://deic.mediacms.io/embed?m=TOKEN`
- `http://` versions (if your MediaCMS uses HTTP)

### For End Users (Students/Teachers)

No action required! When viewing content with MediaCMS URLs:
1. Page loads normally
2. Video player appears in an iframe
3. LTI authentication happens transparently in the background
4. Video starts playing (if user has permission)

**Note**: Users must be logged into Moodle. Guest users will see the original URL without embedding.

## Troubleshooting

### URLs are not being converted

**Check**:
1. Filter is enabled: **Site admin → Plugins → Filters → Manage filters**
2. MediaCMS URL in settings matches the URLs you're pasting
3. LTI tool is selected in filter settings
4. User is logged in (not guest)

### Video shows "Access Denied" error

**Possible causes**:
1. LTI tool not configured correctly
2. MediaCMS not receiving proper authentication
3. User doesn't have permission to view the video in MediaCMS

**Debug**:
- Check Moodle logs: **Site admin → Reports → Logs**
- Check MediaCMS LTI logs on the MediaCMS admin panel
- Verify LTI tool configuration (client_id, issuer, etc.)

### Iframe shows blank or loading forever

**Check**:
1. MediaCMS URL is accessible from your network
2. Browser console for JavaScript errors
3. LTI tool ID is correct
4. MediaCMS OIDC login endpoint is working: `https://deic.mediacms.io/lti/oidc/login/`

### Multiple iframes from same URL

The filter replaces ALL occurrences of MediaCMS URLs. If you paste the same URL twice, you'll get two embedded players.

**Solution**: Paste the URL only once per page, or use HTML mode to add the URL as plain text (wrap in `<code>` tags).

## Technical Details

### How the Filter Works

1. **Text Processing**: Filter scans all text content using regex patterns
2. **URL Extraction**: Identifies MediaCMS URLs and extracts video tokens
3. **LTI Configuration**: Retrieves LTI settings (issuer, client_id) from configured tool
4. **HTML Generation**: Creates:
   - An `<iframe>` element with unique ID
   - A hidden `<form>` that posts to MediaCMS OIDC login endpoint
   - Form includes: `iss`, `client_id`, `login_hint`, `target_link_uri`
   - JavaScript to auto-submit the form on page load
5. **LTI Flow**: Form submission triggers LTI 1.3 authentication:
   - OIDC Login → Redirect to Moodle Auth → POST back with JWT → Session created
6. **Video Display**: MediaCMS redirects to video player inside iframe

### Security Considerations

- **Authentication Required**: Filter only works for logged-in users
- **LTI 1.3 Security**: Uses OAuth2/OIDC flow with JWT validation
- **User Context**: Each iframe uses the current user's Moodle ID as `login_hint`
- **No Credentials Stored**: Filter doesn't store user credentials or tokens
- **Content Security**: Iframes are scoped to MediaCMS domain

### Performance

- **Lightweight**: Regex-based URL detection is fast
- **No Database Queries**: Uses cached configuration from Moodle settings
- **Lazy Loading**: Videos load on-demand when iframe initiates LTI flow

## Uninstallation

1. Go to **Site administration → Plugins → Filters → Manage filters**
2. Disable the filter first
3. Go to **Site administration → Plugins → Plugins overview**
4. Find "MediaCMS LTI Filter"
5. Click "Uninstall"
6. Confirm uninstallation

**Note**: Existing MediaCMS URLs will revert to plain text URLs after uninstallation.

## Support

For issues or questions:
- Check MediaCMS documentation: https://docs.mediacms.io
- Report bugs on GitHub: https://github.com/mediacms-io/mediacms
- Moodle plugin directory: (link when published)

## License

This plugin is licensed under the GNU GPL v3 or later.

Copyright (C) 2026 MediaCMS

## Changelog

### Version 1.0.0 (2026-01-23)
- Initial release
- Support for Moodle 5.0+
- Automatic URL detection and embedding
- LTI 1.3 authentication integration
- Configurable iframe dimensions
- Multi-language support (English)

## Credits

Developed by the MediaCMS team.

---

**Enjoy seamless MediaCMS video embedding in Moodle!**
