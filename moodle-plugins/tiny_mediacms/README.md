# TinyMCE MediaCMS Plugin

A TinyMCE 6 plugin for Moodle that integrates MediaCMS content into the text editor.

## Description

This plugin adds a MediaCMS button to the TinyMCE toolbar in Moodle. When clicked, it opens a dialog that allows users to browse and select MediaCMS content to embed directly in their course content.

## Features

- **Visual Media Selection**: Browse available MediaCMS content in a grid view
- **Permission-Aware**: Only shows media the user has permission to view
- **RBAC Integration**: Respects MediaCMS role-based access control
- **Multiple Selection**: Select and insert multiple media items at once
- **Pagination**: Navigate through large media libraries
- **Filter Options**: Filter by "My Media" or view all accessible content
- **Responsive Design**: Works on desktop and tablet devices

## Requirements

- Moodle 5.0 or later (with TinyMCE 6)
- MediaCMS instance with LTI integration
- Configured LTI 1.3 external tool in Moodle

## Installation

1. Copy this directory to `{moodle}/lib/editor/tiny/plugins/tiny_mediacms`
2. Visit Site administration → Notifications
3. Follow the upgrade prompts
4. Configure the plugin in TinyMCE settings

For detailed installation instructions, see [TINYMCE_PLUGIN_INSTALLATION.md](../../TINYMCE_PLUGIN_INSTALLATION.md) in the MediaCMS root directory.

## Usage

1. Open any text editor in Moodle
2. Click the MediaCMS button (video camera icon) in the toolbar
3. Select one or more media items
4. Click "Insert" to embed the content

## Configuration

The plugin can be configured at:
- Site administration → Plugins → Text editors → TinyMCE plugins → MediaCMS

Configuration options:
- MediaCMS URL (typically auto-configured from LTI settings)

## Technical Details

### Plugin Type
- Type: TinyMCE 6 plugin
- Category: Content insertion
- API: Moodle editor_tiny API

### Files
- `version.php` - Plugin metadata
- `classes/plugininfo.php` - Plugin registration and configuration
- `amd/src/plugin.js` - Main plugin functionality
- `amd/src/common.js` - Shared constants
- `amd/src/configuration.js` - Configuration handling
- `lang/en/tiny_mediacms.php` - Language strings
- `pix/icon.svg` - Plugin icon

### Backend Endpoints (MediaCMS)
- `/lti/tinymce-select/` - Media selection interface
- `/lti/tinymce-embed/<token>/` - Embed code API

## Security

- Requires active LTI session
- Respects MediaCMS permissions and RBAC
- Uses CSRF protection
- Validates user authentication

## Support

For issues, bugs, or feature requests:
1. Check the installation guide
2. Review Moodle and MediaCMS logs
3. Consult MediaCMS LTI documentation
4. Open an issue in the MediaCMS repository

## License

This plugin is part of MediaCMS and Moodle.

- Moodle components: GNU GPL v3 or later
- MediaCMS integration: Same as MediaCMS license

## Version

- Version: 1.0.0
- Release date: 2026-01-12
- Moodle requirement: 5.0+
- Maturity: Stable

## Credits

Developed for MediaCMS LTI integration with Moodle.

## Changelog

### 1.0.0 (2026-01-12)
- Initial release
- Media selection dialog
- Multiple media insertion
- RBAC and permission support
- Pagination support
- Filter options
