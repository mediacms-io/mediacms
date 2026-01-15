export function inEmbeddedApp() {
    const url = new URL(globalThis.location.href);
    return url.searchParams.get('mode') === 'embed_mode';
}
