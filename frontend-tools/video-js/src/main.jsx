import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './VideoJS.css';

import VideoJS from './VideoJS.jsx';
// import ChapterList from './components/chapter/ChapterList.jsx';

// Mount the components when the DOM is ready
const mountComponents = () => {
    // Mount main video player
    const rootContainerMain = document.getElementById('video-js-root-main');
    if (rootContainerMain) {
        const rootMain = createRoot(rootContainerMain);
        rootMain.render(
            <StrictMode>
                <VideoJS videoId="video-main" />
            </StrictMode>
        );
    }

    // Mount embed video player
    const rootContainerEmbed = document.getElementById('video-js-root-embed');
    if (rootContainerEmbed) {
        const rootEmbed = createRoot(rootContainerEmbed);
        rootEmbed.render(
            <StrictMode>
                <VideoJS videoId="video-embed" />
            </StrictMode>
        );
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountComponents);
} else {
    mountComponents();
}
