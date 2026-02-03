# TinyMCE MediaCMS Plugin for Moodle

A TinyMCE editor plugin for Moodle that provides media embedding capabilities with MediaCMS/LTI integration.

## Plugin Information

- **Component:** `tiny_mediacms`
- **Version:** See `version.php`
- **Requires:** Moodle 4.5+ (2024100100)

## Directory Structure

```
mediacms/
├── amd/
│   ├── src/           # JavaScript source files (ES6 modules)
│   │   ├── plugin.js          # Main plugin entry point
│   │   ├── commands.js        # Editor commands
│   │   ├── configuration.js   # Plugin configuration
│   │   ├── iframeembed.js     # Iframe embedding logic
│   │   ├── iframemodal.js     # Iframe modal UI
│   │   ├── autoconvert.js     # URL auto-conversion
│   │   ├── embed.js           # Media embedding
│   │   ├── embedmodal.js      # Embed modal UI
│   │   ├── image.js           # Image handling
│   │   ├── imagemodal.js      # Image modal UI
│   │   ├── imageinsert.js     # Image insertion
│   │   ├── imagedetails.js    # Image details panel
│   │   ├── imagehelpers.js    # Image utility functions
│   │   ├── manager.js         # File manager
│   │   ├── options.js         # Plugin options
│   │   ├── selectors.js       # DOM selectors
│   │   ├── common.js          # Shared utilities
│   │   └── usedfiles.js       # Track used files
│   └── build/         # Compiled/minified files (generated)
├── classes/           # PHP classes
├── lang/              # Language strings
│   └── en/
│       └── tiny_mediacms.php
├── templates/         # Mustache templates
├── styles.css         # Plugin styles
├── settings.php       # Admin settings
└── version.php        # Plugin version
```

## Building JavaScript (AMD Modules)

When you modify JavaScript files in `amd/src/`, you must rebuild the minified files in `amd/build/`.

### Prerequisites

Make sure you have Node.js installed and have run `npm install` in the Moodle root directory:

```bash
cd /path/to/moodle/public
npm install
```

### Build Commands

#### Build all AMD modules (entire Moodle):

```bash
cd /path/to/moodle/public
npx grunt amd
```

#### Build only this plugin's AMD modules:

```bash
cd /path/to/moodle/public
npx grunt amd --root=lib/editor/tiny/plugins/mediacms
```

#### Watch for changes (auto-rebuild):

```bash
cd /path/to/moodle/public
npx grunt watch --root=lib/editor/tiny/plugins/mediacms
```

#### Force build (ignore warnings):

```bash
cd /path/to/moodle/public
npx grunt amd --force --root=lib/editor/tiny/plugins/mediacms
```

### Build Output

After running grunt, the following files are generated in `amd/build/`:

- `*.min.js` - Minified JavaScript files
- `*.min.js.map` - Source maps for debugging

## Development Mode (Skip Building)

For faster development, you can skip building by enabling developer mode in Moodle's `config.php`:

```php
// Add these lines to config.php
$CFG->debugdeveloper = true;
$CFG->cachejs = false;
```

This tells Moodle to load the unminified source files directly from `amd/src/` instead of `amd/build/`.

**Note:** Always build before committing or deploying to production!

## Purging Caches

After making changes, you may need to purge Moodle caches:

### Via CLI (Docker):

```bash
docker compose exec moodle php /var/www/html/public/admin/cli/purge_caches.php
```

### Via CLI (Local):

```bash
php admin/cli/purge_caches.php
```

### Via Web:

Visit: `http://your-moodle-site/admin/purgecaches.php`

## What Needs Cache Purging?

| File Type | Cache Purge Needed? |
|-----------|---------------------|
| `amd/src/*.js` | No (if `$CFG->cachejs = false`) |
| `amd/build/*.min.js` | Yes |
| `lang/en/*.php` | Yes |
| `templates/*.mustache` | Yes |
| `styles.css` | Yes |
| `classes/*.php` | Usually no |
| `settings.php` | Yes |

## Troubleshooting

### Changes not appearing?

1. **JavaScript changes:** 
   - Rebuild AMD modules: `npx grunt amd --root=lib/editor/tiny/plugins/mediacms`
   - Hard refresh browser: `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Windows/Linux)
   - Check browser console for errors

2. **Language strings:** 
   - Purge Moodle caches

3. **Templates:**
   - Purge Moodle caches

4. **Styles:**
   - Purge Moodle caches
   - Hard refresh browser

### Grunt errors?

```bash
# Make sure dependencies are installed
cd /path/to/moodle/public
npm install

# Try with force flag
npx grunt amd --force --root=lib/editor/tiny/plugins/mediacms
```

### ESLint errors?

Fix linting issues or use:

```bash
npx grunt amd --force --root=lib/editor/tiny/plugins/mediacms
```

## Related Documentation

- [AUTOCONVERT.md](./AUTOCONVERT.md) - URL auto-conversion feature documentation
- [LTI_INTEGRATION.md](./LTI_INTEGRATION.md) - LTI integration documentation

## License

GNU GPL v3 or later - http://www.gnu.org/copyleft/gpl.html
