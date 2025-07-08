import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './VideoJS.css';

import VideoJS from './VideoJS.jsx';

// Mount the components when the DOM is ready
const mountComponents = () => {
    const rootContainer = document.getElementById('video-js-root');
    if (rootContainer) {
        const root = createRoot(rootContainer);
        root.render(
            <StrictMode>
                <VideoJS />
            </StrictMode>
        );
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountComponents);
} else {
    mountComponents();
}
