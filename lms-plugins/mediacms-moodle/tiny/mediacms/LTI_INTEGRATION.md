# MediaCMS LTI Integration Guide

This document explains how the TinyMCE MediaCMS plugin integrates with Moodle's LTI (Learning Tools Interoperability) system to provide authenticated access to the MediaCMS video library.

## Overview

The plugin uses **LTI 1.3 Deep Linking** to authenticate users with MediaCMS. Instead of implementing LTI authentication directly, the plugin leverages Moodle's built-in LTI module (`/mod/lti/`) to handle the complex OIDC/JWT authentication flow.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MOODLE (Your Instance)                               │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────┐  │
│  │  TinyMCE Editor     │    │  /mod/lti/          │    │  External Tool  │  │
│  │  MediaCMS Plugin    │───▶│  contentitem.php    │───▶│  Configuration  │  │
│  │  (this plugin)      │    │  auth.php           │    │  (Tool ID: X)   │  │
│  └─────────────────────┘    └─────────────────────┘    └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ LTI 1.3 OIDC Flow
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MEDIACMS (External Service)                          │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────┐  │
│  │  OIDC Login         │    │  LTI Launch         │    │  Video Library  │  │
│  │  /lti/oidc/login/   │───▶│  /lti/launch/       │───▶│  /lti/select/   │  │
│  └─────────────────────┘    └─────────────────────┘    └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
tiny/plugins/mediacms/
├── classes/
│   └── plugininfo.php      # Backend: Passes LTI config to JavaScript
├── amd/src/
│   ├── options.js          # Frontend: Registers LTI options
│   └── iframeembed.js      # Frontend: Implements LTI form submission
├── settings.php            # Admin settings (LTI Tool ID)
├── lang/en/
│   └── tiny_mediacms.php   # Language strings
└── LTI_INTEGRATION.md      # This file
```

## How It Works

### Step 1: Admin Configuration

An administrator must configure the LTI Tool ID in:
**Site Administration → Plugins → Text editors → TinyMCE → MediaCMS settings**

The Tool ID corresponds to an External Tool configured in Moodle that points to MediaCMS.

### Step 2: Backend Preparation (plugininfo.php)

When the editor loads, `get_lti_configuration()` retrieves:
- **toolId**: The External Tool ID from plugin settings
- **courseId**: The current course context
- **contentItemUrl**: URL to Moodle's `/mod/lti/contentitem.php`

```php
protected static function get_lti_configuration(context $context): array {
    $ltitoolid = get_config('tiny_mediacms', 'ltitoolid');
    // ... determine courseId from context ...
    return [
        'lti' => [
            'toolId' => (int) $ltitoolid,
            'courseId' => $courseid,
            'contentItemUrl' => '/mod/lti/contentitem.php',
        ],
    ];
}
```

### Step 3: Frontend LTI Launch (iframeembed.js)

When the user clicks "Video Library from Iframe" tab:

1. **Check LTI config**: If `toolId`, `courseId`, and `contentItemUrl` are set, use LTI flow
2. **Create hidden form**: Dynamically create an HTML form targeting the iframe
3. **Submit to Moodle LTI**: POST to `/mod/lti/contentitem.php` with tool parameters

```javascript
loadIframeLibraryViaLti(root, ltiConfig) {
    // Create form targeting the iframe
    const ltiForm = document.createElement('form');
    ltiForm.target = iframeName;
    ltiForm.action = ltiConfig.contentItemUrl;
    ltiForm.method = 'post';
    
    // Add LTI parameters
    const fields = {
        'id': ltiConfig.toolId,
        'course': ltiConfig.courseId,
        'title': '',
        'text': '',
    };
    // ... create hidden inputs and submit ...
}
```

### Step 4: LTI Authentication Flow

Moodle's LTI module handles the authentication:

1. **OIDC Initiate Login**: Moodle POSTs to MediaCMS's OIDC login endpoint
2. **Authorization Request**: MediaCMS redirects back to Moodle's `/mod/lti/auth.php`
3. **JWT Token Generation**: Moodle creates a signed JWT with user info
4. **LTI Launch**: Moodle POSTs the JWT to MediaCMS's launch endpoint
5. **Content Selection**: MediaCMS displays the authenticated video library

### Step 5: Video Selection (postMessage)

When the user selects a video in MediaCMS, it sends a `postMessage` to the parent window:

```javascript
// MediaCMS sends:
window.parent.postMessage({
    type: 'videoSelected',
    embedUrl: 'https://mediacms.io/embed/xyz123',
    videoId: 'xyz123'
}, '*');

// Plugin receives in handleIframeLibraryMessage():
if (data.type === 'videoSelected' && data.embedUrl) {
    this.selectIframeLibraryVideo(root, data.embedUrl, data.videoId);
}
```

## Setup Instructions

### For Administrators

#### 1. Create External Tool in Moodle

1. Go to **Site Administration → Plugins → Activity modules → External tool → Manage tools**
2. Click **"Configure a tool manually"**
3. Fill in the following:

| Field | Value |
|-------|-------|
| Tool name | MediaCMS Video Library |
| Tool URL | `https://lti.mediacms.io/lti/launch/` |
| LTI version | LTI 1.3 |
| Public keyset URL | `https://lti.mediacms.io/.well-known/jwks.json` |
| Initiate login URL | `https://lti.mediacms.io/lti/oidc/login/` |
| Redirection URI(s) | `https://lti.mediacms.io/lti/launch/` |
| Content Selection URL | `https://lti.mediacms.io/lti/select-media/` |
| Supports Deep Linking | ✓ Yes |

4. Save and note the **Tool ID** (visible in URL when editing: `id=X`)

#### 2. Register Moodle with MediaCMS

Contact MediaCMS administrator with:
- **Platform ID (Issuer)**: Your Moodle URL (e.g., `https://moodle.example.com`)
- **Client ID**: Generated by Moodle after creating the tool
- **Public Keyset URL**: `https://moodle.example.com/mod/lti/certs.php`
- **Access Token URL**: `https://moodle.example.com/mod/lti/token.php`
- **Authentication Request URL**: `https://moodle.example.com/mod/lti/auth.php`

#### 3. Configure Plugin Settings

1. Go to **Site Administration → Plugins → Text editors → TinyMCE → MediaCMS settings**
2. Enter the **Tool ID** from step 1
3. Save changes

### For Developers

#### Adding Debug Logging

The code includes console.log statements (guarded by eslint-disable):

```javascript
// eslint-disable-next-line no-console
console.log('loadIframeLibrary called, LTI config:', ltiConfig);
```

Check browser console for:
- `loadIframeLibrary called, LTI config: {...}` - Shows if LTI config is received
- `Submitting LTI form to: ...` - Shows form submission
- `LTI iframe loaded` - Shows iframe load event

#### Testing Without LTI

If LTI is not configured (toolId = 0), the plugin falls back to static URL loading:

```javascript
if (ltiConfig?.toolId && ltiConfig?.courseId && ltiConfig?.contentItemUrl) {
    this.loadIframeLibraryViaLti(root, ltiConfig);
} else {
    this.loadIframeLibraryStatic(root);  // Fallback
}
```

#### Rebuilding JavaScript

After modifying AMD modules, rebuild with:

```bash
# Ensure Node.js 22.x is active
nvm use 22

# Run grunt from Moodle root
cd /path/to/moodle
grunt amd
```

## Troubleshooting

### "Nothing happens when clicking Video Library tab"

1. **Check LTI Tool ID**: Go to plugin settings and verify Tool ID is set
2. **Check browser console**: Look for `loadIframeLibrary` logs
3. **Verify External Tool exists**: Ensure the Tool ID corresponds to a valid tool
4. **Check course context**: LTI requires a valid course ID (not site level)

### "LTI authentication fails"

1. **Verify MediaCMS registration**: Moodle must be registered as a platform in MediaCMS
2. **Check URLs**: Ensure all LTI URLs are correct and accessible
3. **Check HTTPS**: LTI 1.3 requires HTTPS on both ends
4. **Review Moodle logs**: Check `Site Administration → Reports → Logs` for LTI errors

### "Video selection doesn't work"

1. **Check postMessage handling**: Verify MediaCMS sends expected message format
2. **Check browser console**: Look for `handleIframeLibraryMessage` logs
3. **Verify origin**: Some browsers block cross-origin postMessages

## Message Formats Supported

The plugin handles multiple postMessage formats:

```javascript
// Custom format
{ type: 'videoSelected', embedUrl: '...', videoId: '...' }

// LTI Deep Linking format
{ type: 'ltiDeepLinkingResponse', content_items: [...] }

// MediaCMS specific
{ action: 'selectMedia', embedUrl: '...', mediaId: '...' }
```

## Security Considerations

1. **LTI 1.3 Security**: All authentication uses signed JWTs and OIDC
2. **No credentials in plugin**: The plugin never handles user credentials
3. **Moodle handles auth**: All sensitive operations go through Moodle's LTI module
4. **postMessage validation**: Consider adding origin checks for production

## References

- [LTI 1.3 Specification](https://www.imsglobal.org/spec/lti/v1p3)
- [Moodle LTI Documentation](https://docs.moodle.org/en/LTI_and_Moodle)
- [Moodle External Tool](https://docs.moodle.org/en/External_tool)

## Contributing

When modifying LTI-related code:

1. Test with a real LTI tool (not just mocks)
2. Test in multiple browsers (postMessage behavior varies)
3. Test both with and without LTI configured (fallback path)
4. Update this documentation if behavior changes
