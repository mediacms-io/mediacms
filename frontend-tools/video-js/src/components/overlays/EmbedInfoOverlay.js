// components/overlays/EmbedInfoOverlay.js
import videojs from 'video.js';

// Get the Component base class from Video.js
const Component = videojs.getComponent('Component');

class EmbedInfoOverlay extends Component {
    constructor(player, options) {
        super(player, options);

        this.authorName = options.authorName || 'Unknown';
        this.authorProfile = options.authorProfile || '';
        this.authorThumbnail = options.authorThumbnail || '';
        this.videoTitle = options.videoTitle || 'Video';
        this.videoUrl = options.videoUrl || '';

        // Initialize after player is ready
        this.player().ready(() => {
            this.createOverlay();
        });
    }

    createEl() {
        const el = document.createElement('div');
        el.className = 'vjs-embed-info-overlay';
        return el;
    }

    createOverlay() {
        const playerEl = this.player().el();
        const overlay = this.el();

        // Set overlay styles for positioning at top left
        overlay.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            max-width: calc(100% - 40px);
            box-sizing: border-box;
            transition: opacity 0.3s ease-in-out;
        `;

        // Create avatar container
        if (this.authorThumbnail) {
            const avatarContainer = document.createElement('div');
            avatarContainer.className = 'embed-avatar-container';
            avatarContainer.style.cssText = `
                flex-shrink: 0;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                overflow: hidden;
                border: 1px solid rgba(255, 255, 255, 0.2);
            `;

            if (this.authorProfile) {
                const avatarLink = document.createElement('a');
                avatarLink.href = this.authorProfile;
                avatarLink.target = '_blank';
                avatarLink.rel = 'noopener noreferrer';
                avatarLink.title = this.authorName;
                avatarLink.style.cssText = `
                    display: block;
                    width: 100%;
                    height: 100%;
                `;

                const avatarImg = document.createElement('img');
                avatarImg.src = this.authorThumbnail;
                avatarImg.alt = this.authorName;
                avatarImg.title = this.authorName;
                avatarImg.style.cssText = `
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                `;

                // Handle image load error
                avatarImg.onerror = () => {
                    avatarImg.style.display = 'none';
                    avatarContainer.style.display = 'none';
                };

                avatarLink.appendChild(avatarImg);
                avatarContainer.appendChild(avatarLink);
            } else {
                const avatarImg = document.createElement('img');
                avatarImg.src = this.authorThumbnail;
                avatarImg.alt = this.authorName;
                avatarImg.title = this.authorName;
                avatarImg.style.cssText = `
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                `;

                // Handle image load error
                avatarImg.onerror = () => {
                    avatarImg.style.display = 'none';
                    avatarContainer.style.display = 'none';
                };

                avatarContainer.appendChild(avatarImg);
            }

            overlay.appendChild(avatarContainer);
        }

        // Create title container
        const titleContainer = document.createElement('div');
        titleContainer.className = 'embed-title-container';
        titleContainer.style.cssText = `
            flex: 1;
            min-width: 0;
            overflow: hidden;
        `;

        if (this.videoUrl) {
            const titleLink = document.createElement('a');
            titleLink.href = this.videoUrl;
            titleLink.target = '_blank';
            titleLink.rel = 'noopener noreferrer';
            titleLink.textContent = this.videoTitle;
            titleLink.title = this.videoTitle;
            titleLink.style.cssText = `
                color: #fff;
                text-decoration: none;
                font-size: 14px;
                font-weight: 500;
                line-height: 1.3;
                display: block;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                transition: color 0.2s ease;
            `;

            // Add hover effect
            titleLink.addEventListener('mouseenter', () => {
                titleLink.style.color = '#ccc';
            });

            titleLink.addEventListener('mouseleave', () => {
                titleLink.style.color = '#fff';
            });

            titleContainer.appendChild(titleLink);
        } else {
            const titleText = document.createElement('span');
            titleText.textContent = this.videoTitle;
            titleText.title = this.videoTitle;
            titleText.style.cssText = `
                color: #fff;
                font-size: 14px;
                font-weight: 500;
                line-height: 1.3;
                display: block;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            `;

            titleContainer.appendChild(titleText);
        }

        overlay.appendChild(titleContainer);

        // Append overlay to player
        playerEl.appendChild(overlay);

        // Hide overlay during user inactivity (like controls)
        this.setupAutoHide();
    }

    setupAutoHide() {
        const player = this.player();
        const overlay = this.el();

        // Check if device is touch-enabled
        const isTouchDevice =
            'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;

        // Show/hide with controls
        player.on('useractive', () => {
            overlay.style.opacity = '1';
            overlay.style.visibility = 'visible';
        });

        player.on('userinactive', () => {
            // On touch devices, keep overlay visible longer or don't hide it as aggressively
            if (isTouchDevice) {
                // Keep visible on touch devices when user inactive
                overlay.style.opacity = '0.8';
                overlay.style.visibility = 'visible';
            } else {
                overlay.style.opacity = '0';
                overlay.style.visibility = 'hidden';
            }
        });

        // Always show when paused
        player.on('pause', () => {
            overlay.style.opacity = '1';
            overlay.style.visibility = 'visible';
        });

        // Hide during fullscreen controls fade
        player.on('fullscreenchange', () => {
            setTimeout(() => {
                if (player.isFullscreen()) {
                    if (player.userActive()) {
                        overlay.style.opacity = '1';
                        overlay.style.visibility = 'visible';
                    } else {
                        overlay.style.opacity = '0';
                        overlay.style.visibility = 'hidden';
                    }
                } else {
                    overlay.style.opacity = '1';
                    overlay.style.visibility = 'visible';
                }
            }, 100);
        });
    }

    // Method to update overlay content if needed
    updateContent(options) {
        if (options.authorName) this.authorName = options.authorName;
        if (options.authorProfile) this.authorProfile = options.authorProfile;
        if (options.authorThumbnail) this.authorThumbnail = options.authorThumbnail;
        if (options.videoTitle) this.videoTitle = options.videoTitle;
        if (options.videoUrl) this.videoUrl = options.videoUrl;

        // Recreate overlay with new content
        const overlay = this.el();
        overlay.innerHTML = '';
        this.createOverlay();
    }

    show() {
        this.el().style.display = 'flex';
    }

    hide() {
        this.el().style.display = 'none';
    }

    dispose() {
        // Clean up any event listeners or references
        const overlay = this.el();
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        super.dispose();
    }
}

// Register the component with Video.js
videojs.registerComponent('EmbedInfoOverlay', EmbedInfoOverlay);

export default EmbedInfoOverlay;
