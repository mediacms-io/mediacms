export function inEmbeddedApp() {
    try {
        const params = new URL(globalThis.location.href).searchParams;
        const mode = params.get('mode');

        if (mode === 'embed_mode') {
            sessionStorage.setItem('media_cms_embed_mode', 'true');
            return true;
        }

        if (mode === 'standard') {
            sessionStorage.removeItem('media_cms_embed_mode');
            return false;
        }

        return sessionStorage.getItem('media_cms_embed_mode') === 'true';
    } catch (e) {
        return false;
    }
}

export function isSelectMediaMode() {
    try {
        const params = new URL(globalThis.location.href).searchParams;
        const action = params.get('action');

        if (action === 'select_media') {
            sessionStorage.setItem('media_cms_select_media', 'true');
            return true;
        }

        // Clear if action is explicitly something else
        if (action && action !== 'select_media') {
            sessionStorage.removeItem('media_cms_select_media');
            return false;
        }

        return sessionStorage.getItem('media_cms_select_media') === 'true';
    } catch (e) {
        return false;
    }
}

export function inSelectMediaEmbedMode() {
    return inEmbeddedApp() && isSelectMediaMode();
}
