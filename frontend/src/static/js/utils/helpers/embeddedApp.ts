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
