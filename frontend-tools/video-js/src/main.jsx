import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import VideoJS from './VideoJS.jsx';

// Function to set dark background for embed contexts
const setEmbedBodyBackground = () => {
    const embedContainer = document.getElementById('video-js-root-embed');
    const pageEmbed = document.getElementById('page-embed');

    // Check if we're in embed mode
    if (embedContainer || pageEmbed) {
        // Store original background to restore later if needed
        if (!document.body.dataset.originalBackground) {
            document.body.dataset.originalBackground = document.body.style.backgroundColor || '';
        }

        // Set dark background for embed
        document.body.style.backgroundColor = '#000';
        document.documentElement.style.backgroundColor = '#000';

        // Also set margin and padding to 0 for seamless embed
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.documentElement.style.margin = '0';
        document.documentElement.style.padding = '0';
    }
};

// Mount the components when the DOM is ready
const mountComponents = () => {
    // Mount main video player
    const rootContainerMainNew = document.getElementById('video-js-root-main');
    if (rootContainerMainNew && !rootContainerMainNew.hasChildNodes()) {
        const rootMain = createRoot(rootContainerMainNew);
        rootMain.render(
            <StrictMode>
                <VideoJS videoId="video-main" />
            </StrictMode>
        );
    }

    // Mount embed video player
    const rootContainerEmbedNew = document.getElementById('video-js-root-embed');
    if (rootContainerEmbedNew && !rootContainerEmbedNew.hasChildNodes()) {
        const rootEmbed = createRoot(rootContainerEmbedNew);
        rootEmbed.render(
            <StrictMode>
                <VideoJS videoId="video-embed" />
            </StrictMode>
        );

        // Set dark background when embed player is mounted
        setEmbedBodyBackground();
    }

    // Also check for embed context even without mounting
    setEmbedBodyBackground();
};

// Expose functions globally for manual triggering
window.triggerVideoJSMount = mountComponents;
window.setVideoJSEmbedBackground = setEmbedBodyBackground;

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
