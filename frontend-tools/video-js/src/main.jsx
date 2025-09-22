import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './VideoJS.css';

import VideoJS from './VideoJS.jsx';

// Mount the components when the DOM is ready
const mountComponents = () => {
    // Mount main video player
    const rootContainerMain = document.getElementById('video-js-root-main');
    if (rootContainerMain && !rootContainerMain.hasChildNodes()) {
        const rootMain = createRoot(rootContainerMain);
        rootMain.render(
            <StrictMode>
                <VideoJS videoId="video-main" />
            </StrictMode>
        );
    }

    // Mount embed video player
    const rootContainerEmbed = document.getElementById('video-js-root-embed');
    if (rootContainerEmbed && !rootContainerEmbed.hasChildNodes()) {
        const rootEmbed = createRoot(rootContainerEmbed);
        rootEmbed.render(
            <StrictMode>
                <VideoJS videoId="video-embed" />
            </StrictMode>
        );
    }
};

// Expose the mounting function globally for manual triggering
window.triggerVideoJSMount = mountComponents;

// Listen for custom events to trigger mounting
document.addEventListener('triggerVideoJSMount', () => {
    mountComponents();
});

// Initial mount
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountComponents);
} else {
    mountComponents();
}

// Also periodically check for new containers (as a fallback)
setInterval(() => {
    const embedContainer = document.getElementById('video-js-root-embed');
    if (embedContainer && !embedContainer.hasChildNodes()) {
        mountComponents();
    }
}, 1000);
