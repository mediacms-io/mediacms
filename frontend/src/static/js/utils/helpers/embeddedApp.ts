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
