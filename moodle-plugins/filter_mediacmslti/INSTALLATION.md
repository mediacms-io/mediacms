# Quick Installation Guide - MediaCMS LTI Filter

## Prerequisites

- Moodle 5.0 or later
- MediaCMS instance with LTI 1.3 support
- LTI External Tool already configured in Moodle for MediaCMS

## Installation Steps

### 1. Install the Plugin

**Option A: Upload via Moodle UI**
```
1. Log in as Moodle admin
2. Site administration → Plugins → Install plugins
3. Upload the filter_mediacmslti.zip file
4. Click "Install plugin from the ZIP file"
5. Complete the installation wizard
```

**Option B: Manual Installation**
```bash
# Copy plugin to Moodle filter directory
cp -r filter_mediacmslti /path/to/moodle/filter/

# Set permissions
chown -R www-data:www-data /path/to/moodle/filter/filter_mediacmslti

# Visit Moodle notifications page to complete installation
```

### 2. Configure the Filter

```
1. Site administration → Plugins → Filters → MediaCMS LTI Filter
2. Set "MediaCMS URL" to your MediaCMS instance (e.g., https://deic.mediacms.io)
3. Select your LTI tool from the "LTI External Tool" dropdown
4. Optionally adjust iframe width/height (defaults: 960x540)
5. Click "Save changes"
```

### 3. Enable the Filter

```
1. Site administration → Plugins → Filters → Manage filters
2. Find "MediaCMS LTI Embed" in the list
3. Change from "Disabled" to "On"
4. Click "Save changes"
```

### 4. Test It!

```
1. Create a Page resource in any course
2. Paste a MediaCMS URL: https://deic.mediacms.io/view?m=KmITliaUC
3. Save the page
4. View the page - video should embed automatically!
```

## Configuration Quick Reference

| Setting | Example Value | Description |
|---------|---------------|-------------|
| MediaCMS URL | `https://deic.mediacms.io` | Your MediaCMS instance (no trailing slash) |
| LTI External Tool | MediaCMS | Select from dropdown |
| Iframe Width | 960 | Width in pixels |
| Iframe Height | 540 | Height in pixels |

## Troubleshooting Quick Fixes

**URLs not converting?**
- Check filter is "On" in Filters → Manage filters
- Verify MediaCMS URL matches the URLs you're pasting
- Ensure user is logged in (not guest)

**Video not loading?**
- Check LTI tool is configured correctly
- Verify client_id and issuer match between Moodle and MediaCMS
- Check browser console for errors

**Need more help?**
See full README.md for detailed troubleshooting and technical documentation.

## What URLs Are Supported?

The filter automatically detects these patterns:
- `https://deic.mediacms.io/view?m=TOKEN`
- `https://deic.mediacms.io/embed?m=TOKEN`

Replace `deic.mediacms.io` with your configured MediaCMS URL.

## Quick Test Checklist

- [ ] Plugin installed successfully
- [ ] Filter settings configured
- [ ] Filter enabled in Manage filters
- [ ] LTI tool configured and working
- [ ] Test URL pasted in Page resource
- [ ] Video embeds and plays correctly

## Support

Full documentation: See README.md
MediaCMS docs: https://docs.mediacms.io
