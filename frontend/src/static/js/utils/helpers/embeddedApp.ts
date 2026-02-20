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

export function associateMediaWithLtiCategory(mediaId: string): void {
    const ltiContextId = getLtiContextId();

    if (!ltiContextId || !mediaId) {
        return;
    }

    const csrfMatch = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    const csrfToken = csrfMatch ? csrfMatch[1] : '';

    fetch('/api/v1/media/user/bulk_actions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify({
            action: 'add_to_category',
            media_ids: [mediaId],
            lti_context_id: ltiContextId,
        }),
    }).then(response => {
        if (!response.ok) {
            console.warn('[MediaCMS LTI] Failed to associate media with course category:', response.statusText);
        }
    }).catch(error => {
        console.warn('[MediaCMS LTI] Failed to associate media with course category:', error);
    });
}
