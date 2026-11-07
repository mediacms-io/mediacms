import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import VideoJS from './VideoJS.jsx';

// Track root instances keyed by container id.
// Each entry: { root, container } so we can detect if the DOM element was replaced.
const roots = {};

const mountComponents = () => {
    const containers = [
        { id: 'video-js-root-main', videoId: 'video-main' },
        { id: 'video-js-root-embed', videoId: 'video-embed' },
    ];

    for (const { id, videoId } of containers) {
        const container = document.getElementById(id);
        if (!container) continue;

        const existing = roots[id];

        if (existing && existing.container === container) {
            // Same DOM node — re-render with latest MEDIA_DATA.
            existing.root.render(
                <StrictMode>
                    <VideoJS videoId={videoId} />
                </StrictMode>
            );
        } else {
            // First mount, or container was replaced (SPA navigation).
            if (existing) {
                existing.root.unmount();
            }
            const root = createRoot(container);
            root.render(
                <StrictMode>
                    <VideoJS videoId={videoId} />
                </StrictMode>
            );
            roots[id] = { root, container };
        }
    }
};

// Expose globally so VideoJSEmbed can trigger a re-mount after MEDIA_DATA is updated.
window.triggerVideoJSMount = mountComponents;

document.addEventListener('triggerVideoJSMount', mountComponents);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountComponents);
} else {
    mountComponents();
}
