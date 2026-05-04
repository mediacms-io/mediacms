export function inEmbeddedApp() {
    try {
        const params = new URL(globalThis.location.href).searchParams;
        const mode = params.get('mode');

        if (mode === 'lms_embed_mode') {
            sessionStorage.setItem('lms_embed_mode', 'true');
            return true;
        }

        if (mode === 'standard') {
            sessionStorage.removeItem('lms_embed_mode');
            return false;
        }

        return sessionStorage.getItem('lms_embed_mode') === 'true';
    } catch (e) {
        return false;
    }
}

export function isShareMediaDisabled(): boolean {
    try {
        const params = new URL(globalThis.location.href).searchParams;
        const shareMedia = params.get('share_media');
        const mode = params.get('mode');

        if (shareMedia === '0') {
            sessionStorage.setItem('lms_share_media_disabled', 'true');
            return true;
        }

        // Fresh LTI landing (mode=lms_embed_mode in URL) without share_media=0
        // means sharing is enabled — clear any stale disabled flag.
        if (shareMedia === '1' || mode === 'lms_embed_mode') {
            sessionStorage.removeItem('lms_share_media_disabled');
            return false;
        }

        return sessionStorage.getItem('lms_share_media_disabled') === 'true';
    } catch (e) {
        return false;
    }
}

export function isSelectMediaMode() {
    try {
        const params = new URL(globalThis.location.href).searchParams;
        const action = params.get('action');

        return action === 'select_media';
    } catch (e) {
        return false;
    }
}

export function inSelectMediaEmbedMode() {
    return inEmbeddedApp() && isSelectMediaMode();
}

// When MediaCMS is embedded inside a host platform (e.g. an LMS), the host passes a
// `parent_media_base` URL via LTI custom params so that media title links in the embed
// player navigate the parent frame to the host's own media viewer (e.g. Moodle My Media)
// instead of opening a bare MediaCMS URL. The VideoViewer appends `?token=<friendly_token>`
// and uses `target="_parent"` to perform the navigation.
export function getParentMediaBase(): string | null {
    try {
        const params = new URL(globalThis.location.href).searchParams;
        const mode = params.get('mode');
        const base = params.get('parent_media_base');

        if (mode === 'standard') {
            sessionStorage.removeItem('parent_media_base');
            return null;
        }

        if (base) {
            sessionStorage.setItem('parent_media_base', base);
            return base;
        }

        return sessionStorage.getItem('parent_media_base');
    } catch (e) {
        return null;
    }
}

export function getLtiContextId(): string | null {
    try {
        const params = new URL(globalThis.location.href).searchParams;
        const contextId = params.get('lti_context_id');

        if (contextId) {
            sessionStorage.setItem('lti_context_id', contextId);
            return contextId;
        }

        return sessionStorage.getItem('lti_context_id');
    } catch (e) {
        return null;
    }
}
