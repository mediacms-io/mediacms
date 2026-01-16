# Moodle Plugins for MediaCMS

This directory contains plugins for integrating MediaCMS with Moodle.

## Available Plugins

### tiny_mediacms - TinyMCE MediaCMS Plugin

A TinyMCE editor plugin that allows users to insert MediaCMS content directly from the Moodle text editor.

**Features:**
- Insert MediaCMS content with a single click
- Visual media selection interface
- Respects RBAC permissions
- Supports multiple media selection
- Works with LTI 1.3 authentication

**Installation:**
See [TINYMCE_PLUGIN_INSTALLATION.md](../TINYMCE_PLUGIN_INSTALLATION.md) for detailed installation instructions.

**Quick Install:**
```bash
cp -r tiny_mediacms /path/to/moodle/lib/editor/tiny/plugins/
```

Then visit Moodle's Site administration → Notifications to complete the installation.

## Requirements

- Moodle 5.0 or later
- MediaCMS with LTI integration configured
- Active LTI 1.3 connection between Moodle and MediaCMS

## Documentation

- [TinyMCE Plugin Installation Guide](../TINYMCE_PLUGIN_INSTALLATION.md)
- [LTI Setup Guide](../LTI_README.md)
- [LTI Configuration](../LTI_README2.md)

## Support

For issues or questions, please refer to the MediaCMS documentation or open an issue in the repository.

## License

These plugins are part of MediaCMS and are licensed under the GNU General Public License v3.0 or later.
