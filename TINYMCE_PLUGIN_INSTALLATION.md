# TinyMCE MediaCMS Plugin Installation Guide

This guide explains how to install and configure the MediaCMS plugin for Moodle's TinyMCE editor. This plugin allows users to insert MediaCMS content directly from the TinyMCE editor using LTI Deep Linking.

## Overview

The TinyMCE MediaCMS plugin adds a button to the TinyMCE toolbar that:
- Opens a dialog showing available MediaCMS content
- Respects RBAC permissions and course context
- Allows users to select media items
- Inserts embed codes directly into the editor

## Prerequisites

- Moodle 5.0 or later
- MediaCMS with LTI integration configured
- LTI 1.3 external tool configured in Moodle (see LTI_README.md)
- Admin access to both Moodle and MediaCMS

## Installation Steps

### Step 1: Copy Plugin Files to Moodle

1. Copy the plugin directory from MediaCMS to your Moodle installation:

```bash
cp -r /path/to/mediacms/moodle-plugins/tiny_mediacms /path/to/moodle/lib/editor/tiny/plugins/
```

2. Set proper permissions:

```bash
cd /path/to/moodle/lib/editor/tiny/plugins/tiny_mediacms
chown -R www-data:www-data .  # Adjust user/group as needed
chmod -R 755 .
```

### Step 2: Install the Plugin in Moodle

1. Log in to Moodle as an administrator

2. Navigate to **Site administration → Notifications**

3. Moodle will detect the new plugin and prompt you to upgrade

4. Click **Upgrade Moodle database now**

5. Confirm the installation of the **tiny_mediacms** plugin

6. Click **Continue**

### Step 3: Configure MediaCMS Backend

The backend endpoints are already configured in MediaCMS if you're using the latest version. Verify that the following files exist:

- `lti/tinymce_views.py` - Backend views
- `templates/lti/tinymce_select_media.html` - Media selection template

The routes should be automatically available at:
- `/lti/tinymce-select/` - Media selection interface
- `/lti/tinymce-embed/<token>/` - Embed code API

### Step 4: Enable the Plugin in TinyMCE

1. In Moodle, navigate to **Site administration → Plugins → Text editors → TinyMCE editor → General settings**

2. Find the **Editor toolbar** configuration

3. Add `tiny_mediacms/button` to the toolbar. For example, modify the toolbar configuration to include:

```
insert tiny_mediacms/button | ...
```

Or add it to a specific toolbar row:

```
style1 = title, bold, italic, tiny_mediacms/button
```

4. Save the changes

### Step 5: Configure Plugin Settings (Optional)

The plugin needs to know your MediaCMS URL. This is typically configured automatically from Moodle's external tool configuration, but you can verify:

1. Navigate to **Site administration → Plugins → Text editors → TinyMCE plugins → MediaCMS**

2. Verify the MediaCMS URL is set correctly

3. If not automatically configured, you can set it in `config.php`:

```php
$CFG->forced_plugin_settings['tiny_mediacms']['mediacmsUrl'] = 'https://your-mediacms-instance.com';
```

## Usage

### For Teachers/Content Creators

1. Open any text editor field in Moodle (e.g., page content, assignment description)

2. Click the **MediaCMS** button in the TinyMCE toolbar (looks like a video camera icon with a red dot)

3. A dialog will open showing available MediaCMS content:
   - Only media you have permission to view will be shown
   - Use the "Show only my media" filter to see your uploads
   - Navigate through pages if you have many media items

4. Select one or more media items by clicking on them (they'll be highlighted in blue)

5. Click the **Insert** button

6. The media will be embedded as an iframe in your content

7. Save your changes in Moodle

### For Students/Users

- Embedded MediaCMS content will appear as video players in the content
- Click play to watch the content
- All MediaCMS player features are available (quality selection, subtitles, etc.)

## Troubleshooting

### Plugin Button Doesn't Appear

**Problem**: The MediaCMS button is not visible in the TinyMCE toolbar

**Solutions**:
1. Clear Moodle cache: **Site administration → Development → Purge all caches**
2. Verify the plugin is enabled in TinyMCE settings
3. Check browser console for JavaScript errors
4. Ensure the plugin was installed correctly (check file permissions)

### "Loading MediaCMS content..." Never Finishes

**Problem**: The dialog opens but shows loading message indefinitely

**Solutions**:
1. Verify MediaCMS is accessible from your Moodle server
2. Check that the LTI session is active (user must be in an LTI-launched context)
3. Verify the MediaCMS URL is configured correctly
4. Check browser console for CORS or network errors
5. Ensure user is logged in to MediaCMS via LTI

### No Media Appears in Selection Dialog

**Problem**: Dialog loads but shows "No media found"

**Solutions**:
1. Verify media exists in MediaCMS
2. Check RBAC permissions - user may not have access to any media
3. Try unchecking "Show only my media" filter
4. Verify the course context is properly mapped to a MediaCMS category
5. Check that media is marked as "listable" or user has explicit permissions

### Embed Code Doesn't Insert

**Problem**: Selected media but clicking Insert does nothing

**Solutions**:
1. Check browser console for JavaScript errors
2. Verify the `/lti/tinymce-embed/<token>/` endpoint is accessible
3. Check that the media token is valid
4. Ensure pop-up blockers aren't interfering

### CORS Errors

**Problem**: Browser console shows CORS-related errors

**Solutions**:
1. MediaCMS and Moodle must be on the same domain OR CORS must be configured
2. If using different domains, add CORS headers in MediaCMS settings:

```python
# In MediaCMS settings.py
CORS_ALLOWED_ORIGINS = [
    "https://your-moodle-instance.com",
]
```

3. Install and configure `django-cors-headers` if needed

## Advanced Configuration

### Customizing the Embed Size

To change the default iframe dimensions, edit `lti/tinymce_views.py` in MediaCMS:

```python
# In TinyMCEGetEmbedView.get() method
embed_code = (
    f'<iframe src="{embed_url}" '
    f'width="1280" height="720" '  # Change these values
    f'frameborder="0" '
    f'allowfullscreen '
    f'title="{media.title}">'
    f'</iframe>'
)
```

### Customizing the Selection UI

To modify the appearance of the media selection dialog, edit:
- `templates/lti/tinymce_select_media.html` - Main template
- Modify the `<style>` section for visual changes
- Adjust grid layout, card sizes, colors, etc.

### Restricting Plugin Access

To restrict which users can use the plugin:

1. In Moodle, create a capability for the plugin
2. Assign the capability to specific roles (e.g., only teachers)
3. Or use Moodle's course-level permissions

### Adding Additional Filters

To add more filtering options (e.g., by category, date), modify:
1. `lti/tinymce_views.py` - Add query parameter handling
2. `templates/lti/tinymce_select_media.html` - Add filter UI elements

## Security Considerations

1. **Authentication**: The plugin requires active LTI session. Users must access Moodle content via LTI-launched context.

2. **Permissions**: The plugin respects MediaCMS RBAC and permissions. Users only see media they're authorized to view.

3. **CSRF Protection**: All POST endpoints use Django's CSRF protection.

4. **XSS Protection**: Embed codes are sanitized and use iframe sandboxing.

5. **Origin Validation**: Consider adding origin validation to postMessage handlers for production use.

## Uninstallation

To remove the plugin:

1. Navigate to **Site administration → Plugins → Plugins overview**

2. Find **tiny_mediacms** in the list

3. Click **Uninstall**

4. Confirm the uninstallation

5. Delete the plugin directory:

```bash
rm -rf /path/to/moodle/lib/editor/tiny/plugins/tiny_mediacms
```

## Support and Feedback

For issues, questions, or feature requests:

1. Check the MediaCMS LTI documentation (LTI_README.md, LTI_README2.md)
2. Review Moodle logs: **Site administration → Reports → Logs**
3. Check MediaCMS logs for backend errors
4. Open an issue in the MediaCMS repository

## Version History

- **1.0.0** (2026-01-12): Initial release
  - Basic media selection from TinyMCE
  - RBAC and permission support
  - Multiple media selection
  - Pagination support

## Future Enhancements

Potential features for future versions:

- Direct search functionality in the dialog
- Preview before inserting
- Custom embed options (autoplay, start time, etc.)
- Media upload directly from TinyMCE
- Thumbnail/title editing after insertion
- Drag-and-drop media organization

## Technical Details

### Plugin Structure

```
tiny_mediacms/
├── version.php                 # Plugin version info
├── classes/
│   └── plugininfo.php         # Plugin registration
├── amd/
│   └── src/
│       ├── plugin.js          # Main plugin logic
│       ├── common.js          # Constants
│       └── configuration.js   # Configuration
├── lang/
│   └── en/
│       └── tiny_mediacms.php  # English strings
└── pix/
    └── icon.svg               # Plugin icon
```

### Data Flow

1. User clicks MediaCMS button in TinyMCE
2. Plugin opens dialog with iframe to `/lti/tinymce-select/`
3. MediaCMS shows media selection UI (respecting permissions)
4. User selects media and clicks Insert
5. JavaScript fetches embed code from `/lti/tinymce-embed/<token>/`
6. Embed code sent via postMessage to parent window
7. TinyMCE plugin receives message and inserts embed code
8. User saves content in Moodle

### API Endpoints

**GET /lti/tinymce-select/**
- Shows media selection interface
- Requires: Active LTI session (login_required)
- Query params: `page`, `my_media_only`
- Returns: HTML template with media grid

**GET /lti/tinymce-embed/<friendly_token>/**
- Returns embed code for specific media
- Requires: Active LTI session (login_required)
- Returns: JSON with `embedCode`, `title`, `thumbnail`

## License

This plugin is part of MediaCMS and is licensed under the same terms as MediaCMS and Moodle (GNU GPL v3 or later).
