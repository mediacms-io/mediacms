# MediaCMS URL Auto-Convert Feature

This feature automatically converts pasted MediaCMS video URLs into embedded video players within the TinyMCE editor.

## Overview

When a user pastes a MediaCMS video URL like:
```
https://deic.mediacms.io/view?m=JpBd1Zvdl
```

It is automatically converted to an embedded video player:
```html
<div class="tiny-iframe-responsive" contenteditable="false">
  <iframe 
    style="width: 100%; max-width: calc(100vh * 16 / 9); aspect-ratio: 16 / 9; display: block; margin: auto; border: 0;" 
    src="https://deic.mediacms.io/embed?m=JpBd1Zvdl&showTitle=1&showRelated=1&showUserAvatar=1&linkTitle=1" 
    allowfullscreen="allowfullscreen">
  </iframe>
</div>
```

## Supported URL Formats

The auto-convert feature recognizes MediaCMS view URLs in this format:
- `https://[domain]/view?m=[VIDEO_ID]`

Examples:
- `https://deic.mediacms.io/view?m=JpBd1Zvdl`
- `https://your-mediacms-instance.com/view?m=abc123`

## Configuration

### Accessing Settings

1. Log in to Moodle as an administrator
2. Navigate to: **Site administration** → **Plugins** → **Text editors** → **TinyMCE editor** → **MediaCMS**
3. Scroll to the **Auto-convert MediaCMS URLs** section

### Available Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Enable auto-convert** | Turn the auto-convert feature on or off | Enabled |
| **MediaCMS base URL** | Restrict auto-conversion to a specific MediaCMS domain | Empty (allow all) |
| **Show video title** | Display the video title in the embedded player | Enabled |
| **Link video title** | Make the video title clickable, linking to the original video page | Enabled |
| **Show related videos** | Display related videos after the current video ends | Enabled |
| **Show user avatar** | Display the uploader's avatar in the embedded player | Enabled |

### Settings Location in Moodle

The settings are stored in the Moodle database under the `tiny_mediacms` plugin configuration:

- `tiny_mediacms/autoconvertenabled` - Enable/disable auto-convert
- `tiny_mediacms/autoconvert_baseurl` - MediaCMS base URL (e.g., https://deic.mediacms.io)
- `tiny_mediacms/autoconvert_showtitle` - Show title option
- `tiny_mediacms/autoconvert_linktitle` - Link title option
- `tiny_mediacms/autoconvert_showrelated` - Show related option
- `tiny_mediacms/autoconvert_showuseravatar` - Show user avatar option

### Base URL Configuration

The **MediaCMS base URL** setting controls which MediaCMS instances are recognized for auto-conversion:

- **Empty (default)**: Any MediaCMS URL will be auto-converted (e.g., URLs from any `*/view?m=*` pattern)
- **Specific URL**: Only URLs from the specified domain will be auto-converted

Example configurations:
- `https://deic.mediacms.io` - Only convert URLs from deic.mediacms.io
- `https://media.myuniversity.edu` - Only convert URLs from your institution's MediaCMS

## Technical Details

### File Structure

```
amd/src/
├── autoconvert.js      # Main auto-convert module
├── plugin.js           # Plugin initialization (imports autoconvert)
└── options.js          # Configuration options definition

classes/
└── plugininfo.php      # Passes PHP settings to JavaScript

settings.php            # Admin settings page definition

lang/en/
└── tiny_mediacms.php   # Language strings for settings
```

### How It Works

1. **Paste Detection**: The `autoconvert.js` module listens for `paste` events on the TinyMCE editor
2. **URL Validation**: When text is pasted, it checks if it matches the MediaCMS URL pattern
3. **HTML Generation**: If valid, it generates the responsive iframe HTML with configured options
4. **Content Insertion**: The original URL is replaced with the embedded video

### JavaScript Configuration

The settings are passed from PHP to JavaScript via the `plugininfo.php` class:

```php
protected static function get_autoconvert_configuration(): array {
    $baseurl = get_config('tiny_mediacms', 'autoconvert_baseurl');

    return [
        'data' => [
            'autoConvertEnabled' => (bool) get_config('tiny_mediacms', 'autoconvertenabled'),
            'autoConvertBaseUrl' => !empty($baseurl) ? $baseurl : '',
            'autoConvertOptions' => [
                'showTitle' => (bool) get_config('tiny_mediacms', 'autoconvert_showtitle'),
                'linkTitle' => (bool) get_config('tiny_mediacms', 'autoconvert_linktitle'),
                'showRelated' => (bool) get_config('tiny_mediacms', 'autoconvert_showrelated'),
                'showUserAvatar' => (bool) get_config('tiny_mediacms', 'autoconvert_showuseravatar'),
            ],
        ],
    ];
}
```

### Default Values (in options.js)

If PHP settings are not configured, the JavaScript uses these defaults:

```javascript
registerOption(dataName, {
    processor: 'object',
    "default": {
        autoConvertEnabled: true,
        autoConvertBaseUrl: '', // Empty = allow all MediaCMS domains
        autoConvertOptions: {
            showTitle: true,
            linkTitle: true,
            showRelated: true,
            showUserAvatar: true,
        },
    },
});
```

## Customization

### Disabling Auto-Convert

To disable the feature entirely:
1. Go to the plugin settings (see "Accessing Settings" above)
2. Uncheck **Enable auto-convert**
3. Save changes

### Programmatic Configuration

You can also set these values directly in the database using Moodle's `set_config()` function:

```php
// Disable auto-convert
set_config('autoconvertenabled', 0, 'tiny_mediacms');

// Set the MediaCMS base URL (restrict to specific domain)
set_config('autoconvert_baseurl', 'https://deic.mediacms.io', 'tiny_mediacms');

// Customize embed options
set_config('autoconvert_showtitle', 1, 'tiny_mediacms');
set_config('autoconvert_linktitle', 0, 'tiny_mediacms');
set_config('autoconvert_showrelated', 0, 'tiny_mediacms');
set_config('autoconvert_showuseravatar', 1, 'tiny_mediacms');
```

### CLI Configuration

Using Moodle CLI:

```bash
# Enable auto-convert
php admin/cli/cfg.php --component=tiny_mediacms --name=autoconvertenabled --set=1

# Set the MediaCMS base URL
php admin/cli/cfg.php --component=tiny_mediacms --name=autoconvert_baseurl --set=https://deic.mediacms.io

# Disable showing related videos
php admin/cli/cfg.php --component=tiny_mediacms --name=autoconvert_showrelated --set=0
```

## Troubleshooting

### Auto-convert not working

1. **Check if enabled**: Verify the setting is enabled in plugin settings
2. **Clear caches**: Purge all caches (Site administration → Development → Purge all caches)
3. **Check URL format**: Ensure the URL matches the pattern `https://[domain]/view?m=[VIDEO_ID]`
4. **Browser console**: Check for JavaScript errors in the browser developer console

### Rebuilding JavaScript

If you modify the source files, rebuild using:

```bash
cd /path/to/moodle
npx grunt amd --root=public/lib/editor/tiny/plugins/mediacms
```

Note: Requires Node.js 22.x or compatible version as specified in Moodle's requirements.

## Version History

- **1.0.0** - Initial implementation of auto-convert feature
