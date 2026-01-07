// components/overlays/EmbedInfoOverlay.js
import videojs from 'video.js';
import './EmbedInfoOverlay.css';

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
        this.showTitle = options.showTitle !== undefined ? options.showTitle : true;
        this.showRelated = options.showRelated !== undefined ? options.showRelated : true;
        this.showUserAvatar = options.showUserAvatar !== undefined ? options.showUserAvatar : true;
        this.linkTitle = options.linkTitle !== undefined ? options.linkTitle : true;

        // Initialize after player is ready
        this.player().ready(() => {
            if (this.showTitle) {
                this.createOverlay();
            } else {
                // Hide overlay element if showTitle is false
                const overlay = this.el();
                overlay.style.display = 'none';
                overlay.style.opacity = '0';
                overlay.style.visibility = 'hidden';
            }
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
            transition: opacity 0.3s ease, visibility 0.3s ease;
            opacity: 1;
            visibility: visible;
        `;

        // Create avatar container
        if (this.authorThumbnail && this.showUserAvatar) {
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

        if (this.videoUrl && this.linkTitle) {
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

        // If showTitle is false, ensure overlay is hidden
        if (!this.showTitle) {
            overlay.style.display = 'none';
            overlay.style.opacity = '0';
            overlay.style.visibility = 'hidden';
            return;
        }

        // Sync overlay visibility with control bar visibility
        const updateOverlayVisibility = () => {
            if (!player.hasStarted()) {
                // Show overlay when video hasn't started (poster is showing) - like before
                overlay.style.opacity = '1';
                overlay.style.visibility = 'visible';
            } else if (player.paused() || player.ended()) {
                // Always show overlay when paused or ended
                overlay.style.opacity = '1';
                overlay.style.visibility = 'visible';
            } else if (player.userActive()) {
                // Show overlay when user is active (controls are visible)
                overlay.style.opacity = '1';
                overlay.style.visibility = 'visible';
            } else {
                // Hide overlay when user is inactive (controls are hidden)
                overlay.style.opacity = '0';
                overlay.style.visibility = 'hidden';
            }
        };

        // Show overlay when video is paused
        player.on('pause', () => {
            updateOverlayVisibility();
        });

        // Update overlay when video starts playing
        player.on('play', () => {
            updateOverlayVisibility();
        });

        // Update overlay when video actually starts (first play)
        player.on('playing', () => {
            updateOverlayVisibility();
        });

        // Show overlay when video ends
        player.on('ended', () => {
            updateOverlayVisibility();
        });

        // Show overlay when player is ready
        player.on('ready', () => {
            updateOverlayVisibility();
        });

        // Show overlay when user becomes active (controls show)
        player.on('useractive', () => {
            updateOverlayVisibility();
        });

        // Hide overlay when user becomes inactive (controls hide)
        player.on('userinactive', () => {
            updateOverlayVisibility();
        });

        // Initial state check
        setTimeout(() => {
            updateOverlayVisibility();
        }, 100);
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
