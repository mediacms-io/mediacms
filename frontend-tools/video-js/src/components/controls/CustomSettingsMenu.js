// components/controls/CustomSettingsMenu.js
import videojs from 'video.js';
import './CustomSettingsMenu.css';
// import './SettingsButton.css';
import UserPreferences from '../../utils/UserPreferences';

// Get the Component base class from Video.js
const Component = videojs.getComponent('Component');

class CustomSettingsMenu extends Component {
    constructor(player, options) {
        super(player, options);

        this.settingsButton = null;
        this.settingsOverlay = null;
        this.speedSubmenu = null;
        this.qualitySubmenu = null;
        this.subtitlesSubmenu = null;
        this.userPreferences = options?.userPreferences || new UserPreferences();
        this.providedQualities = options?.qualities || null;
        this.hasSubtitles = options?.hasSubtitles || false;
        // Touch scroll detection (mobile)
        this.isTouchScrolling = false;
        this.touchStartY = 0;
        this.isMobile = this.detectMobile();
        this.isSmallScreen = window.innerWidth <= 480;
        this.touchThreshold = 150; // ms for tap vs scroll detection
        this.scrollY = 0; // Track scroll position before locking

        // Bind methods
        this.createSettingsButton = this.createSettingsButton.bind(this);
        this.createSettingsOverlay = this.createSettingsOverlay.bind(this);
        this.positionButton = this.positionButton.bind(this);
        this.toggleSettings = this.toggleSettings.bind(this);
        this.handleSpeedChange = this.handleSpeedChange.bind(this);
        this.handleQualityChange = this.handleQualityChange.bind(this);
        this.getAvailableQualities = this.getAvailableQualities.bind(this);
        this.createSubtitlesSubmenu = this.createSubtitlesSubmenu.bind(this);
        this.refreshSubtitlesSubmenu = this.refreshSubtitlesSubmenu.bind(this);
        this.handleSubtitleChange = this.handleSubtitleChange.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.detectMobile = this.detectMobile.bind(this);
        this.handleMobileInteraction = this.handleMobileInteraction.bind(this);
        this.setupResizeListener = this.setupResizeListener.bind(this);
        this.lockBodyScroll = this.lockBodyScroll.bind(this);
        this.unlockBodyScroll = this.unlockBodyScroll.bind(this);

        // Initialize after player is ready
        this.player().ready(() => {
            this.createSettingsButton();
            this.createSettingsOverlay();
            this.setupEventListeners();
            this.restoreSubtitlePreference();
            this.setupResizeListener();
        });
    }

    detectMobile() {
        return (
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
            window.matchMedia('(hover: none) and (pointer: coarse)').matches
        );
    }

    handleMobileInteraction(element, callback) {
        if (!this.isMobile) return;

        let touchStartTime = 0;
        let touchMoved = false;
        let touchStartY = 0;

        element.addEventListener(
            'touchstart',
            (e) => {
                touchStartTime = Date.now();
                touchMoved = false;
                touchStartY = e.touches[0].clientY;

                // Add visual feedback
                element.style.transform = 'scale(0.98)';
                element.style.transition = 'transform 0.1s ease';

                // Add haptic feedback if available
                if (navigator.vibrate) {
                    navigator.vibrate(30);
                }
            },
            { passive: true }
        );

        element.addEventListener(
            'touchmove',
            (e) => {
                const touchMoveY = e.touches[0].clientY;
                const deltaY = Math.abs(touchMoveY - touchStartY);
                const scrollThreshold = this.isSmallScreen ? 5 : 8;

                if (deltaY > scrollThreshold) {
                    touchMoved = true;
                    // Remove visual feedback when scrolling
                    element.style.transform = '';
                }
            },
            { passive: true }
        );

        element.addEventListener(
            'touchend',
            (e) => {
                const touchEndTime = Date.now();
                const touchDuration = touchEndTime - touchStartTime;

                // Reset visual feedback
                element.style.transform = '';

                // Only trigger if it's a quick tap (not a scroll)
                const tapThreshold = this.isSmallScreen ? 120 : this.touchThreshold;
                if (!touchMoved && touchDuration < tapThreshold) {
                    e.preventDefault();
                    callback(e);
                }
            },
            { passive: false }
        );

        element.addEventListener(
            'touchcancel',
            () => {
                // Reset visual feedback on cancel
                element.style.transform = '';
            },
            { passive: true }
        );
    }

    setupResizeListener() {
        const handleResize = () => {
            this.isSmallScreen = window.innerWidth <= 480;
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);

        // Store reference for cleanup
        this.resizeHandler = handleResize;
    }

    createSettingsButton() {
        const controlBar = this.player().getChild('controlBar');

        // Do NOT hide default playback rate button to avoid control bar layout shifts

        // Create settings button
        this.settingsButton = controlBar.addChild('button', {
            controlText: 'Settings',
            className: 'vjs-settings-button vjs-control vjs-button settings-clicked',
        });

        // Style the settings button (gear icon)
        const settingsButtonEl = this.settingsButton.el();
        settingsButtonEl.innerHTML = `
            <span class="vjs-icon-placeholder vjs-icon-cog"></span>
            <span class="vjs-control-text">Settings</span>
        `;

        // Add tooltip attributes
        settingsButtonEl.setAttribute('aria-label', 'Settings');

        // Position the settings button at the end of the control bar
        this.positionButton();

        // Add touch tooltip support
        this.addTouchTooltipSupport(settingsButtonEl);

        // Add mobile touch handling and unified click handling
        const buttonEl = this.settingsButton.el();
        if (buttonEl) {
            buttonEl.style.pointerEvents = 'auto';
            buttonEl.style.cursor = 'pointer';
            buttonEl.style.touchAction = 'manipulation';
            buttonEl.style.webkitTapHighlightColor = 'transparent';

            // Use a more robust approach for mobile touch handling
            let touchStartTime = 0;
            let touchStartPos = { x: 0, y: 0 };
            let touchHandled = false;

            // Handle touchstart
            buttonEl.addEventListener(
                'touchstart',
                (e) => {
                    touchStartTime = Date.now();
                    touchHandled = false;
                    const touch = e.touches[0];
                    touchStartPos = { x: touch.clientX, y: touch.clientY };
                },
                { passive: true }
            );

            // Handle touchend with proper passive handling
            buttonEl.addEventListener(
                'touchend',
                (e) => {
                    const touchEndTime = Date.now();
                    const touchDuration = touchEndTime - touchStartTime;

                    // Only handle if it's a quick tap (not a swipe)
                    if (touchDuration < 500) {
                        const touch = e.changedTouches[0];
                        const touchEndPos = { x: touch.clientX, y: touch.clientY };
                        const distance = Math.sqrt(
                            Math.pow(touchEndPos.x - touchStartPos.x, 2) + Math.pow(touchEndPos.y - touchStartPos.y, 2)
                        );

                        // Only trigger if it's a tap (not a swipe)
                        if (distance < 50) {
                            e.preventDefault();
                            // e.stopPropagation();
                            touchHandled = true;
                            this.toggleSettings(e);
                        }
                    }
                },
                { passive: false }
            );

            // Handle click events (desktop and mobile fallback)
            buttonEl.addEventListener('click', (e) => {
                // Only handle click if touch wasn't already handled
                if (!touchHandled) {
                    e.preventDefault();
                    // e.stopPropagation();
                    this.toggleSettings(e);
                }
                touchHandled = false; // Reset for next interaction
            });
        }
    }

    createSettingsOverlay() {
        const controlBar = this.player().getChild('controlBar');

        // Create settings overlay
        this.settingsOverlay = document.createElement('div');
        this.settingsOverlay.className = 'custom-settings-overlay';

        // Get current preferences for display
        const currentPlaybackRate = this.userPreferences.getPreference('playbackRate');
        const currentQuality = this.userPreferences.getPreference('quality');
        // Find current subtitle selection for label
        let currentSubtitleLabel = 'Off';
        try {
            const tt = this.player().textTracks();
            for (let i = 0; i < tt.length; i++) {
                const t = tt[i];
                if (t.kind === 'subtitles' && t.mode === 'showing') {
                    currentSubtitleLabel = t.label || t.language || 'Captions';
                    break;
                }
            }
        } catch (e) {}

        // Format playback rate for display
        const playbackRateLabel = currentPlaybackRate === 1 ? 'Normal' : `${currentPlaybackRate}`;
        const qualities = this.getAvailableQualities();
        const activeQuality = qualities.find((q) => q.value === currentQuality) || qualities[0];
        const qualityLabelHTML =
            activeQuality?.displayLabel || activeQuality?.label || (currentQuality ? String(currentQuality) : 'Auto');

        // Settings menu content - split into separate variables for maintainability
        const settingsHeader = `
    <div class="settings-header">
        <span>Settings</span>
        <button class="settings-close-btn" aria-label="Close settings">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.7096 12L20.8596 20.15L20.1496 20.86L11.9996 12.71L3.84965 20.86L3.13965 20.15L11.2896 12L3.14965 3.85001L3.85965 3.14001L11.9996 11.29L20.1496 3.14001L20.8596 3.85001L12.7096 12Z" fill="currentColor"/>
            </svg>
        </button>
    </div>`;

        const playbackSpeedSection = `
    <div class="settings-item" data-setting="playback-speed">
        <span class="settings-left">
            <span class="vjs-icon-placeholder settings-item-svg">
                <svg height="24" viewBox="0 0 24 24" width="24"><path d="M10,8v8l6-4L10,8L10,8z M6.3,5L5.7,4.2C7.2,3,9,2.2,11,2l0.1,1C9.3,3.2,7.7,3.9,6.3,5z            M5,6.3L4.2,5.7C3,7.2,2.2,9,2,11 l1,.1C3.2,9.3,3.9,7.7,5,6.3z            M5,17.7c-1.1-1.4-1.8-3.1-2-4.8L2,13c0.2,2,1,3.8,2.2,5.4L5,17.7z            M11.1,21c-1.8-0.2-3.4-0.9-4.8-2 l-0.6,.8C7.2,21,9,21.8,11,22L11.1,21z            M22,12c0-5.2-3.9-9.4-9-10l-0.1,1c4.6,.5,8.1,4.3,8.1,9s-3.5,8.5-8.1,9l0.1,1 C18.2,21.5,22,17.2,22,12z" fill="white"></path></svg>
            </span>
        <span>Playback speed</span></span>
        <span class="settings-right">
            <span class="current-speed">${playbackRateLabel}</span>
            <span class="vjs-icon-placeholder vjs-icon-navigate-next"></span>
        </span>
    </div>`;

        const qualitySection = `
    <div class="settings-item" data-setting="quality">
        <span class="settings-left">
           <span class="vjs-icon-placeholder settings-item-svg">
              <svg height="24" viewBox="0 0 24 24" width="24"><path d="M15,17h6v1h-6V17z M11,17H3v1h8v2h1v-2v-1v-2h-1V17z M14,8h1V6V5V3h-1v2H3v1h11V8z            M18,5v1h3V5H18z M6,14h1v-2v-1V9H6v2H3v1 h3V14z M10,12h11v-1H10V12z" fill="white"></path></svg>
           </span>
        <span>Quality</span></span>
        <span class="settings-right">
            <span class="current-quality">${qualityLabelHTML}</span>
            <span class="vjs-icon-placeholder vjs-icon-navigate-next"></span>
        </span>
    </div>`;

        const subtitlesSection = `
    <div class="settings-item" data-setting="subtitles">
        <span class="settings-left">
           <span class="vjs-icon-placeholder settings-item-svg">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 4H5C3.9 4 3 4.9 3 6V18C3 19.1 3.9 20 5 20H19C20.1 20 21 19.1 21 18V6C21 4.9 20.1 4 19 4ZM11 17H5V15H11V17ZM19 13H5V11H19V13ZM19 9H5V7H19V9Z" fill="white"/></svg>
           </span>
        <span>Captions</span></span>
        <span class="settings-right">
            <span class="current-subtitles">${currentSubtitleLabel}</span>
            <span class="vjs-icon-placeholder vjs-icon-navigate-next"></span>
        </span>
    </div>`;

        // Build the complete settings overlay
        this.settingsOverlay.innerHTML = settingsHeader;
        this.settingsOverlay.innerHTML += playbackSpeedSection;
        this.settingsOverlay.innerHTML += qualitySection;

        // Check if subtitles are available
        if (this.hasSubtitles) {
            this.settingsOverlay.innerHTML += subtitlesSection;
        }

        // Create speed submenu
        this.createSpeedSubmenu();

        // Create quality submenu
        this.createQualitySubmenu(qualities, activeQuality?.value);

        // Create subtitles submenu (YouTube-like)
        this.createSubtitlesSubmenu();

        // Add mobile-specific optimizations
        if (this.isMobile) {
            this.settingsOverlay.style.cssText += `
                -webkit-overflow-scrolling: touch;
                scroll-behavior: smooth;
                overscroll-behavior-y: contain;
                touch-action: pan-y;
            `;

            // Prevent body scroll when overlay is open on mobile
            this.settingsOverlay.addEventListener(
                'touchstart',
                (e) => {
                    // e.stopPropagation();
                },
                { passive: true }
            );
        }

        // Add to control bar
        this.player().el().appendChild(this.settingsOverlay);

        // Add mobile touch handling to settings items
        if (this.isMobile) {
            const settingsItems = this.settingsOverlay.querySelectorAll('.settings-item');
            settingsItems.forEach((item) => {
                this.handleMobileInteraction(item, (e) => {
                    // Handle the same logic as click events
                    if (e.target.closest('[data-setting="playback-speed"]')) {
                        this.speedSubmenu.style.display = 'flex';
                        this.qualitySubmenu.style.display = 'none';
                        if (this.subtitlesSubmenu) this.subtitlesSubmenu.style.display = 'none';
                    }

                    if (e.target.closest('[data-setting="quality"]')) {
                        this.qualitySubmenu.style.display = 'flex';
                        this.speedSubmenu.style.display = 'none';
                        if (this.subtitlesSubmenu) this.subtitlesSubmenu.style.display = 'none';
                    }

                    if (e.target.closest('[data-setting="subtitles"]')) {
                        this.refreshSubtitlesSubmenu();
                        if (this.subtitlesSubmenu) {
                            this.subtitlesSubmenu.style.display = 'flex';
                            this.speedSubmenu.style.display = 'none';
                            this.qualitySubmenu.style.display = 'none';
                        }
                    }
                });
            });
        }
    }

    createSpeedSubmenu() {
        const speedOptions = [
            { label: '0.25', value: 0.25 },
            { label: '0.5', value: 0.5 },
            { label: '0.75', value: 0.75 },
            { label: 'Normal', value: 1 },
            { label: '1.25', value: 1.25 },
            { label: '1.5', value: 1.5 },
            { label: '1.75', value: 1.75 },
            { label: '2', value: 2 },
        ];

        this.speedSubmenu = document.createElement('div');
        this.speedSubmenu.className = 'speed-submenu';

        // Get current playback rate for highlighting
        const currentRate = this.userPreferences.getPreference('playbackRate');

        this.speedSubmenu.innerHTML = `
            <div class="submenu-header">
                <span style="margin-right: 8px;">←</span>
                <span>Playback speed</span>
            </div>
            ${speedOptions
                .map(
                    (option) => `
                <div class="speed-option ${option.value === currentRate ? 'active' : ''}" data-speed="${option.value}">
                    <span>${option.label}</span>
                    ${option.value === currentRate ? '<span class="checkmark">✓</span>' : ''}
                </div>
            `
                )
                .join('')}
        `;

        this.settingsOverlay.appendChild(this.speedSubmenu);
    }

    createQualitySubmenu(qualities, currentValue) {
        this.qualitySubmenu = document.createElement('div');
        this.qualitySubmenu.className = 'quality-submenu';

        const header = `
            <div class="submenu-header">
                <span style="margin-right: 8px;">←</span>
                <span>Quality</span>
            </div>
        `;

        const optionsHtml = qualities
            .map(
                (q) => `
                <div class="quality-option ${q.value === currentValue ? 'active' : ''}" data-quality="${q.value}">
                    <span class="quality-label">${q.displayLabel || q.label}</span>
                    ${q.value === currentValue ? '<span class="checkmark">✓</span>' : ''}
                </div>
            `
            )
            .join('');

        this.qualitySubmenu.innerHTML = header + optionsHtml;
        this.settingsOverlay.appendChild(this.qualitySubmenu);
    }

    createSubtitlesSubmenu() {
        this.subtitlesSubmenu = document.createElement('div');
        this.subtitlesSubmenu.className = 'subtitles-submenu';

        // Header
        const header = `
            <div class="submenu-header">
                <span style="margin-right: 8px;">←</span>
                <span>Captions</span>
            </div>
        `;

        this.subtitlesSubmenu.innerHTML = header + '<div class="submenu-body"></div>';
        this.settingsOverlay.appendChild(this.subtitlesSubmenu);

        // Populate now and on demand
        this.refreshSubtitlesSubmenu();
    }

    refreshSubtitlesSubmenu() {
        if (!this.subtitlesSubmenu) return;
        const body = this.subtitlesSubmenu.querySelector('.submenu-body');
        if (!body) return;
        const player = this.player();
        const tracks = player.textTracks();

        // Determine active
        let activeLang = null;
        for (let i = 0; i < tracks.length; i++) {
            const t = tracks[i];
            if (t.kind === 'subtitles' && t.mode === 'showing') {
                activeLang = t.language;
                break;
            }
        }

        // Build items: Off + languages
        const items = [];
        items.push({ label: 'Off', lang: null });
        for (let i = 0; i < tracks.length; i++) {
            const t = tracks[i];
            if (t.kind === 'subtitles') {
                items.push({ label: t.label || t.language || `Track ${i}`, lang: t.language, track: t });
            }
        }

        body.innerHTML = items
            .map(
                (it) => `
        <div class="subtitle-option ${it.lang === activeLang ? 'active' : ''}" data-lang="${it.lang || ''}">
          <span>${it.label}</span>
          ${it.lang === activeLang ? '<span class="checkmark">✓</span>' : ''}
        </div>
    `
            )
            .join('');

        // Also update the current subtitle display in main settings
        this.updateCurrentSubtitleDisplay();
    }

    updateCurrentSubtitleDisplay() {
        try {
            const player = this.player();
            const tracks = player.textTracks();
            let currentSubtitleLabel = 'Off';

            // Find the active subtitle track
            for (let i = 0; i < tracks.length; i++) {
                const t = tracks[i];
                if (t.kind === 'subtitles' && t.mode === 'showing') {
                    currentSubtitleLabel = t.label || t.language || 'Captions';
                    break;
                }
            }

            const currentSubtitlesDisplay = this.settingsOverlay.querySelector('.current-subtitles');
            if (currentSubtitlesDisplay) {
                currentSubtitlesDisplay.textContent = currentSubtitleLabel;
            }
        } catch (error) {
            console.error('Error updating current subtitle display:', error);
        }
    }

    // Method to periodically check and update subtitle display
    startSubtitleSync() {
        // Update immediately
        this.updateCurrentSubtitleDisplay();

        // Listen for real-time subtitle changes
        this.player().on('texttrackchange', () => {
            this.updateCurrentSubtitleDisplay();
            // Also refresh the subtitle submenu to show correct selection
            this.refreshSubtitlesSubmenu();
        });

        // Set up periodic updates every 2 seconds as backup
        this.subtitleSyncInterval = setInterval(() => {
            this.updateCurrentSubtitleDisplay();
        }, 2000);
    }

    // Method to stop subtitle sync
    stopSubtitleSync() {
        if (this.subtitleSyncInterval) {
            clearInterval(this.subtitleSyncInterval);
            this.subtitleSyncInterval = null;
        }
    }


    getAvailableQualities() {
        // Priority: provided options -> MEDIA_DATA JSON -> player sources -> default
        const desiredOrder = ['auto', '144p', '240p', '360p', '480p', '720p', '1080p'];

        if (Array.isArray(this.providedQualities) && this.providedQualities.length) {
            return this.sortAndDecorateQualities(this.providedQualities, desiredOrder);
        }

        try {
            const md = typeof window !== 'undefined' ? window.MEDIA_DATA : null;
            const jsonQualities = md?.data?.qualities;
            if (Array.isArray(jsonQualities) && jsonQualities.length) {
                // Expected format: [{label: '1080p', value: '1080p', src: '...'}]
                const normalized = jsonQualities.map((q) => ({
                    label: q.label || q.value || 'Auto',
                    value: (q.value || q.label || 'auto').toString().toLowerCase(),
                    src: q.src || q.url || q.href,
                    type: q.type || 'video/mp4',
                }));
                return this.sortAndDecorateQualities(normalized, desiredOrder);
            }
        } catch (e) {
            // ignore
        }

        // Derive from player's current sources
        const sources = this.player().currentSources ? this.player().currentSources() : this.player().currentSrc();
        if (Array.isArray(sources) && sources.length > 0) {
            const mapped = sources.map((s, idx) => {
                const label =
                    s.label || s.res || this.inferLabelFromSrc(s.src) || (idx === 0 ? 'Auto' : `Source ${idx + 1}`);
                const value = String(label).toLowerCase();
                return { label, value, src: s.src, type: s.type || 'video/mp4' };
            });
            return this.sortAndDecorateQualities(mapped, desiredOrder);
        }

        // Default fallback - return empty array if no valid sources found
        return [];
    }

    sortAndDecorateQualities(list, desiredOrder) {
        const orderIndex = (val) => {
            const i = desiredOrder.indexOf(String(val).toLowerCase());
            return i === -1 ? 999 : i;
        };

        // Only include qualities that have actual sources
        const validQualities = list.filter((q) => q.src);

        const decorated = validQualities
            .map((q) => {
                const val = (q.value || q.label || '').toString().toLowerCase();
                const baseLabel = q.label || q.value || '';
                const is1080 = val === '1080p';
                const displayLabel = is1080 ? `${baseLabel} <sup class="hd-badge">HD</sup>` : baseLabel;
                return { ...q, value: val, label: baseLabel, displayLabel };
            })
            .sort((a, b) => orderIndex(a.value) - orderIndex(b.value));

        return decorated;
    }

    inferLabelFromSrc(src) {
        if (!src) return null;
        // Try to detect typical resolution markers in file name or query string
        const match = /(?:_|\.|\/)\D*(1440p|1080p|720p|480p|360p|240p|144p)/i.exec(src);
        if (match && match[1]) return match[1].toUpperCase();
        const m2 = /(\b\d{3,4})p\b/i.exec(src);
        if (m2 && m2[1]) return `${m2[1]}p`;
        return null;
    }

    positionButton() {
        // CSS flexbox order handles positioning - no manual repositioning needed
        // The settings button will be positioned according to the order property in CSS
    }

    setupEventListeners() {
        // Close button functionality
        const closeButton = this.settingsOverlay.querySelector('.settings-close-btn');
        if (closeButton) {
            const closeFunction = (e) => {
                // e.stopPropagation();
                this.settingsOverlay.classList.remove('show');
                this.settingsOverlay.style.display = 'none';
                this.speedSubmenu.style.display = 'none';
                if (this.qualitySubmenu) this.qualitySubmenu.style.display = 'none';
                if (this.subtitlesSubmenu) this.subtitlesSubmenu.style.display = 'none';
                const btnEl = this.settingsButton?.el();
                if (btnEl) {
                    btnEl.classList.remove('settings-clicked');
                }
                // Restore body scroll on mobile when closing
                this.unlockBodyScroll();
            };

            closeButton.addEventListener('click', closeFunction);
            closeButton.addEventListener(
                'touchend',
                (e) => {
                    e.preventDefault();
                    closeFunction(e);
                },
                { passive: false }
            );
        }

        // Settings item clicks
        this.settingsOverlay.addEventListener('click', (e) => {
            // e.stopPropagation();

            if (e.target.closest('[data-setting="playback-speed"]')) {
                this.speedSubmenu.style.display = 'flex';
                this.qualitySubmenu.style.display = 'none';
            }

            if (e.target.closest('[data-setting="quality"]')) {
                this.qualitySubmenu.style.display = 'flex';
                this.speedSubmenu.style.display = 'none';
            }

            if (e.target.closest('[data-setting="subtitles"]')) {
                this.refreshSubtitlesSubmenu();
                this.subtitlesSubmenu.style.display = 'flex';
                this.speedSubmenu.style.display = 'none';
                this.qualitySubmenu.style.display = 'none';
            }
        });

        // Touch scroll detection for settingsOverlay
        this.settingsOverlay.addEventListener(
            'touchstart',
            (e) => {
                this.touchStartY = e.touches[0].clientY;
                this.isTouchScrolling = false;
            },
            { passive: true }
        );
        this.settingsOverlay.addEventListener(
            'touchmove',
            (e) => {
                const dy = Math.abs(e.touches[0].clientY - this.touchStartY);
                if (dy > 10) this.isTouchScrolling = true;
            },
            { passive: true }
        );
        // Mobile touch events for settings items (tap vs scroll)
        this.settingsOverlay.addEventListener(
            'touchend',
            (e) => {
                // e.stopPropagation();
                if (this.isTouchScrolling) {
                    this.isTouchScrolling = false;
                    return;
                }

                if (e.target.closest('[data-setting="playback-speed"]')) {
                    e.preventDefault();
                    this.speedSubmenu.style.display = 'flex';
                    this.qualitySubmenu.style.display = 'none';
                }

                if (e.target.closest('[data-setting="quality"]')) {
                    e.preventDefault();
                    this.qualitySubmenu.style.display = 'flex';
                    this.speedSubmenu.style.display = 'none';
                }

                if (e.target.closest('[data-setting="subtitles"]')) {
                    e.preventDefault();
                    this.refreshSubtitlesSubmenu();
                    this.subtitlesSubmenu.style.display = 'flex';
                    this.speedSubmenu.style.display = 'none';
                    this.qualitySubmenu.style.display = 'none';
                }
            },
            { passive: false }
        );

        // Speed submenu header (back button)
        const speedHeader = this.speedSubmenu.querySelector('.submenu-header');
        speedHeader.addEventListener('click', () => {
            this.speedSubmenu.style.display = 'none';
        });
        speedHeader.addEventListener(
            'touchend',
            (e) => {
                e.preventDefault();
                // e.stopPropagation();
                this.speedSubmenu.style.display = 'none';
            },
            { passive: false }
        );

        // Quality submenu header (back button)
        const qualityHeader = this.qualitySubmenu.querySelector('.submenu-header');
        qualityHeader.addEventListener('click', () => {
            this.qualitySubmenu.style.display = 'none';
        });
        qualityHeader.addEventListener(
            'touchend',
            (e) => {
                e.preventDefault();
                // e.stopPropagation();
                this.qualitySubmenu.style.display = 'none';
            },
            { passive: false }
        );

        // Subtitles submenu header (back)
        const subtitlesHeader = this.subtitlesSubmenu.querySelector('.submenu-header');
        subtitlesHeader.addEventListener('click', () => {
            this.subtitlesSubmenu.style.display = 'none';
        });
        subtitlesHeader.addEventListener(
            'touchend',
            (e) => {
                e.preventDefault();
                // e.stopPropagation();
                this.subtitlesSubmenu.style.display = 'none';
            },
            { passive: false }
        );

        // Speed option clicks
        this.speedSubmenu.addEventListener('click', (e) => {
            const speedOption = e.target.closest('.speed-option');
            if (speedOption) {
                const speed = parseFloat(speedOption.dataset.speed);
                this.handleSpeedChange(speed, speedOption);
            }
        });

        // Touch scroll detection for speed submenu
        this.speedSubmenu.addEventListener(
            'touchstart',
            (e) => {
                this.touchStartY = e.touches[0].clientY;
                this.isTouchScrolling = false;
            },
            { passive: true }
        );
        this.speedSubmenu.addEventListener(
            'touchmove',
            (e) => {
                const dy = Math.abs(e.touches[0].clientY - this.touchStartY);
                if (dy > 10) this.isTouchScrolling = true;
            },
            { passive: true }
        );
        // Mobile touch events for speed options (tap vs scroll)
        this.speedSubmenu.addEventListener(
            'touchend',
            (e) => {
                // e.stopPropagation();
                if (this.isTouchScrolling) {
                    this.isTouchScrolling = false;
                    return;
                }
                const speedOption = e.target.closest('.speed-option');
                if (speedOption) {
                    e.preventDefault();
                    const speed = parseFloat(speedOption.dataset.speed);
                    this.handleSpeedChange(speed, speedOption);
                }
            },
            { passive: false }
        );

        // Quality option clicks
        this.qualitySubmenu.addEventListener('click', (e) => {
            const qualityOption = e.target.closest('.quality-option');
            if (qualityOption) {
                const value = qualityOption.dataset.quality;
                this.handleQualityChange(value, qualityOption);
            }
        });

        this.qualitySubmenu.addEventListener(
            'touchstart',
            (e) => {
                this.touchStartY = e.touches[0].clientY;
                this.isTouchScrolling = false;
            },
            { passive: true }
        );
        this.qualitySubmenu.addEventListener(
            'touchmove',
            (e) => {
                const dy = Math.abs(e.touches[0].clientY - this.touchStartY);
                if (dy > 10) this.isTouchScrolling = true;
            },
            { passive: true }
        );
        // Mobile touch events for quality options (tap vs scroll)
        this.qualitySubmenu.addEventListener(
            'touchend',
            (e) => {
                // e.stopPropagation();
                if (this.isTouchScrolling) {
                    this.isTouchScrolling = false;
                    return;
                }
                const qualityOption = e.target.closest('.quality-option');
                if (qualityOption) {
                    e.preventDefault();
                    const value = qualityOption.dataset.quality;
                    this.handleQualityChange(value, qualityOption);
                }
            },
            { passive: false }
        );

        // Subtitle option clicks
        this.subtitlesSubmenu.addEventListener('click', (e) => {
            const opt = e.target.closest('.subtitle-option');
            if (opt) {
                const lang = opt.dataset.lang || null;
                this.handleSubtitleChange(lang, opt);
            }
        });

        // Touch scroll detection for subtitles submenu
        this.subtitlesSubmenu.addEventListener(
            'touchstart',
            (e) => {
                this.touchStartY = e.touches[0].clientY;
                this.isTouchScrolling = false;
            },
            { passive: true }
        );
        this.subtitlesSubmenu.addEventListener(
            'touchmove',
            (e) => {
                const dy = Math.abs(e.touches[0].clientY - this.touchStartY);
                if (dy > 10) this.isTouchScrolling = true;
            },
            { passive: true }
        );
        // Mobile touch events for subtitle options (tap vs scroll)
        this.subtitlesSubmenu.addEventListener(
            'touchend',
            (e) => {
                // e.stopPropagation();
                if (this.isTouchScrolling) {
                    this.isTouchScrolling = false;
                    return;
                }
                const opt = e.target.closest('.subtitle-option');
                if (opt) {
                    e.preventDefault();
                    const lang = opt.dataset.lang || null;
                    this.handleSubtitleChange(lang, opt);
                }
            },
            { passive: false }
        );

        // Close menu when clicking outside
        document.addEventListener('click', this.handleClickOutside);

        // Add hover effects
        this.settingsOverlay.addEventListener('mouseover', (e) => {
            const item = e.target.closest('.settings-item, .speed-option');
            if (item && !item.style.background.includes('0.1')) {
                item.style.background = 'rgba(255, 255, 255, 0.05)';
            }
        });

        this.settingsOverlay.addEventListener('mouseout', (e) => {
            const item = e.target.closest('.settings-item, .speed-option');
            if (item && !item.style.background.includes('0.1')) {
                item.style.background = 'transparent';
            }
        });

        // Start subtitle synchronization
        this.startSubtitleSync();
    }

    lockBodyScroll() {
        if (!this.isMobile) return;
        
        // Save current scroll position
        this.scrollY = window.scrollY || window.pageYOffset;
        
        // Lock body scroll with proper iOS handling
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this.scrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
    }

    unlockBodyScroll() {
        if (!this.isMobile) return;
        
        // Restore body scroll
        const scrollY = this.scrollY;
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
    }

    toggleSettings(e) {
        // e.stopPropagation();
        const isVisible = this.settingsOverlay.classList.contains('show');

        if (isVisible) {
            this.settingsOverlay.classList.remove('show');
            this.settingsOverlay.style.display = 'none';

            // Stop keeping controls visible
            this.stopKeepingControlsVisible();

            // Restore body scroll on mobile when closing
            this.unlockBodyScroll();
        } else {
            this.settingsOverlay.classList.add('show');
            this.settingsOverlay.style.display = 'block';

            // Keep controls visible while settings menu is open
            this.keepControlsVisible();

            // Add haptic feedback on mobile when opening
            if (this.isMobile && navigator.vibrate) {
                navigator.vibrate(30);
            }

            // Prevent body scroll on mobile when overlay is open
            this.lockBodyScroll();
        }

        this.speedSubmenu.style.display = 'none'; // Hide submenu when main menu toggles
        if (this.qualitySubmenu) this.qualitySubmenu.style.display = 'none';
        if (this.subtitlesSubmenu) this.subtitlesSubmenu.style.display = 'none';
        const btnEl = this.settingsButton?.el();
        if (btnEl) {
            if (!isVisible) {
                btnEl.classList.add('settings-clicked');
                // Hide tooltip when menu is open
                btnEl.removeAttribute('title');
            } else {
                btnEl.classList.remove('settings-clicked');
                // Restore tooltip when menu is closed
                btnEl.setAttribute('title', 'Settings');
            }
        }
    }

    // Method to open settings directly to subtitles submenu
    openSubtitlesMenu() {
        // First ensure settings overlay is visible
        this.settingsOverlay.classList.add('show');
        this.settingsOverlay.style.display = 'block';

        // Lock body scroll when opening
        this.lockBodyScroll();

        // Hide other submenus and show subtitles submenu
        this.speedSubmenu.style.display = 'none';
        if (this.qualitySubmenu) this.qualitySubmenu.style.display = 'none';
        if (this.subtitlesSubmenu) {
            this.subtitlesSubmenu.style.display = 'flex';
            // Refresh the submenu to ensure it's up to date
            this.refreshSubtitlesSubmenu();
        }

        // Mark settings button as active and hide tooltip
        const btnEl = this.settingsButton?.el();
        if (btnEl) {
            btnEl.classList.add('settings-clicked');
            // Hide tooltip when menu is open
            btnEl.removeAttribute('title');
        }
    }

    // Check if settings menu is open
    isMenuOpen() {
        return this.settingsOverlay && this.settingsOverlay.classList.contains('show');
    }

    // Keep controls visible while settings menu is open
    keepControlsVisible() {
        const player = this.player();
        if (!player) return;

        // Keep player in active state
        player.userActive(true);

        // Set up interval to periodically keep player active
        this.controlsVisibilityInterval = setInterval(() => {
            if (this.isMenuOpen()) {
                player.userActive(true);
            } else {
                this.stopKeepingControlsVisible();
            }
        }, 1000); // Check every second
    }

    // Stop keeping controls visible
    stopKeepingControlsVisible() {
        if (this.controlsVisibilityInterval) {
            clearInterval(this.controlsVisibilityInterval);
            this.controlsVisibilityInterval = null;
        }
    }

    // Close the settings menu
    closeMenu() {
        if (this.settingsOverlay) {
            this.settingsOverlay.classList.remove('show');
            this.settingsOverlay.style.display = 'none';

            // Stop keeping controls visible
            this.stopKeepingControlsVisible();
            this.speedSubmenu.style.display = 'none';
            if (this.qualitySubmenu) this.qualitySubmenu.style.display = 'none';
            if (this.subtitlesSubmenu) this.subtitlesSubmenu.style.display = 'none';

            // Remove active state from settings button and restore tooltip
            const btnEl = this.settingsButton?.el();
            if (btnEl) {
                btnEl.classList.remove('settings-clicked');
                // Restore tooltip when menu is closed
                btnEl.setAttribute('title', 'Settings');
            }

            // Restore body scroll on mobile when closing
            this.unlockBodyScroll();
        }
    }

    handleSpeedChange(speed, speedOption) {
        // Update player speed
        this.player().playbackRate(speed);

        // Save preference
        this.userPreferences.setPreference('playbackRate', speed);

        // Update UI
        this.speedSubmenu.querySelectorAll('.speed-option').forEach((opt) => {
            opt.classList.remove('active');
            opt.style.background = 'transparent';
            const check = opt.querySelector('.checkmark');
            if (check) check.remove();
        });

        speedOption.classList.add('active');
        speedOption.style.background = 'rgba(255, 255, 255, 0.1)';
        speedOption.insertAdjacentHTML('beforeend', '<span class="checkmark">✓</span>');

        // Update main menu display
        const currentSpeedDisplay = this.settingsOverlay.querySelector('.current-speed');
        const speedLabel = speed === 1 ? 'Normal' : `${speed}`;
        currentSpeedDisplay.textContent = speedLabel;

        // Close the entire settings menu after speed selection
        this.closeMenu();
    }

    handleQualityChange(value, qualityOption) {
        const qualities = this.getAvailableQualities();
        const selected = qualities.find((q) => String(q.value) === String(value));

        // Save preference
        this.userPreferences.setQualityPreference(value);

        // Update UI
        this.qualitySubmenu.querySelectorAll('.quality-option').forEach((opt) => {
            opt.classList.remove('active');
            opt.style.background = 'transparent';
            const check = opt.querySelector('.checkmark');
            if (check) check.remove();
        });

        qualityOption.classList.add('active');
        qualityOption.style.background = 'rgba(255, 255, 255, 0.1)';
        qualityOption.insertAdjacentHTML('beforeend', '<span class="checkmark">✓</span>');

        // Update main menu display
        const currentQualityDisplay = this.settingsOverlay.querySelector('.current-quality');
        currentQualityDisplay.innerHTML = selected?.displayLabel || selected?.label || String(value);

        // Perform source switch if we have src defined
        if (selected?.src) {
            const player = this.player();
            const wasPaused = player.paused();
            const currentTime = player.currentTime();
            const rate = player.playbackRate();

            // Capture active subtitle language and existing remote tracks
            let activeSubtitleLang = null;
            try {
                const tt = player.textTracks();
                for (let i = 0; i < tt.length; i++) {
                    const t = tt[i];
                    if (t.kind === 'subtitles' && t.mode === 'showing') {
                        activeSubtitleLang = t.language || t.srclang || null;
                        break;
                    }
                }
            } catch (e) {}

            // Persist active subtitle language so it survives reloads
            if (activeSubtitleLang) {
                this.userPreferences.setPreference('subtitleLanguage', activeSubtitleLang, true);
                // Also mark subtitles as enabled so applySubtitlePreference() runs on load
                this.userPreferences.setPreference('subtitleEnabled', true, true);
            }

            // Prefer remoteTextTrackEls (have src reliably)
            const subtitleTracksInfo = [];
            try {
                const els = player.remoteTextTrackEls ? player.remoteTextTrackEls() : [];
                for (let i = 0; i < els.length; i++) {
                    const el = els[i];
                    // Only keep subtitle tracks
                    if ((el.kind || '').toLowerCase() === 'subtitles') {
                        subtitleTracksInfo.push({
                            kind: 'subtitles',
                            src: el.src,
                            srclang: el.srclang || (el.track && el.track.language) || '',
                            label: el.label || (el.track && el.track.label) || '',
                            default: !!el.default,
                        });
                    }
                }
            } catch (e) {}

            // Fallback: try TextTracks if no elements found and track.src exists
            if (subtitleTracksInfo.length === 0) {
                try {
                    const tt = player.textTracks();
                    for (let i = 0; i < tt.length; i++) {
                        const t = tt[i];
                        if (t.kind === 'subtitles' && t.src) {
                            subtitleTracksInfo.push({
                                kind: 'subtitles',
                                src: t.src,
                                srclang: t.language || '',
                                label: t.label || '',
                                default: false,
                            });
                        }
                    }
                } catch (e) {}
            }

            player.addClass('vjs-changing-resolution');
            player.isChangingQuality = true; // prevent seek indicator during quality change
            player.src({ src: selected.src, type: selected.type || 'video/mp4' });

            if (wasPaused) {
                player.pause();
            }

            const finishRestore = () => {
                // Re-add remote tracks
                try {
                    subtitleTracksInfo.forEach((trackInfo) => {
                        if (trackInfo && trackInfo.src) {
                            player.addRemoteTextTrack(trackInfo, false);
                        }
                    });
                } catch (e) {}

                // Restore time and rate
                try {
                    player.playbackRate(rate);
                } catch (e) {}
                try {
                    if (!isNaN(currentTime)) player.currentTime(currentTime);
                } catch (e) {}

                // Resume state
                if (!wasPaused) {
                    player.play().catch(() => {});
                } else {
                    player.pause();
                }

                // Restore the previously active subtitle language
                setTimeout(() => {
                    try {
                        const tt2 = player.textTracks();
                        let restored = false;
                        for (let i = 0; i < tt2.length; i++) {
                            const t = tt2[i];
                            if (t.kind === 'subtitles') {
                                const match =
                                    activeSubtitleLang &&
                                    (t.language === activeSubtitleLang || t.srclang === activeSubtitleLang);
                                t.mode = match ? 'showing' : 'disabled';
                                if (match) restored = true;
                            }
                        }
                        // If nothing restored but a preference exists, try to apply it
                        if (!restored) {
                            const pref = this.userPreferences.getPreference('subtitleLanguage');
                            if (pref) {
                                for (let i = 0; i < tt2.length; i++) {
                                    const t = tt2[i];
                                    if (t.kind === 'subtitles' && (t.language === pref || t.srclang === pref)) {
                                        t.mode = 'showing';
                                        break;
                                    }
                                }
                            }
                        }
                    } catch (e) {}
                    // Sync UI
                    this.refreshSubtitlesSubmenu();
                    this.updateCurrentSubtitleDisplay();
                    player.trigger('texttrackchange');
                }, 150);

                // Ensure Subtitles (CC) button remains visible after source switch
                try {
                    const controlBar = player.getChild('controlBar');
                    const names = ['subtitlesButton', 'textTrackButton', 'subsCapsButton'];
                    for (const n of names) {
                        const btn = controlBar && controlBar.getChild(n);
                        if (btn) {
                            if (typeof btn.show === 'function') btn.show();
                            const el = btn.el && btn.el();
                            if (el) {
                                el.style.display = '';
                                el.style.visibility = '';
                            }
                        }
                    }
                } catch (e) {}

                player.removeClass('vjs-changing-resolution');

                // Close the entire settings menu after quality change completes
                this.closeMenu();
            };

            // Wait for metadata/data to be ready, then restore
            const onLoadedMeta = () => {
                player.off('loadedmetadata', onLoadedMeta);
                // Some browsers need loadeddata to have text track list ready
                player.one('loadeddata', finishRestore);
            };
            player.one('loadedmetadata', onLoadedMeta);
        } else {
            // If no source switch needed, close menu immediately
            this.closeMenu();
        }
    }

    handleSubtitleChange(lang, optionEl) {
        const player = this.player();
        const tracks = player.textTracks();

        // Update tracks
        for (let i = 0; i < tracks.length; i++) {
            const t = tracks[i];
            if (t.kind === 'subtitles') {
                t.mode = lang && t.language === lang ? 'showing' : 'disabled';
            }
        }

        // Save preference via UserPreferences (force set)
        this.userPreferences.setPreference('subtitleLanguage', lang || null, true);
        this.userPreferences.setPreference('subtitleEnabled', !!lang, true); // for iphones

        // Trigger a custom event to notify other components about subtitle state change
        const subtitleChangeEvent = new CustomEvent('subtitleStateChanged', {
            detail: { enabled: !!lang, language: lang },
        });
        window.dispatchEvent(subtitleChangeEvent);

        // Update UI selection
        this.subtitlesSubmenu.querySelectorAll('.subtitle-option').forEach((opt) => {
            opt.classList.remove('active');
            opt.style.background = 'transparent';
            const check = opt.querySelector('.checkmark');
            if (check) check.remove();
        });
        optionEl.classList.add('active');
        optionEl.style.background = 'rgba(255, 255, 255, 0.1)';
        optionEl.insertAdjacentHTML('beforeend', '<span class="checkmark">✓</span>');

        // Update label in main settings
        const label = lang ? optionEl.querySelector('span')?.textContent || lang : 'Off';
        const currentSubtitlesDisplay = this.settingsOverlay.querySelector('.current-subtitles');
        if (currentSubtitlesDisplay) currentSubtitlesDisplay.textContent = label;

        // Close the entire settings menu after subtitle selection
        this.closeMenu();
    }

    restoreSubtitlePreference() {
        const savedLanguage = this.userPreferences.getPreference('subtitleLanguage');
        if (savedLanguage) {
            const tryRestore = (attempt = 1) => {
                try {
                    const player = this.player();
                    const tracks = player.textTracks();
                    const saved = String(savedLanguage || '').toLowerCase();
                    // First disable all subtitle tracks
                    for (let i = 0; i < tracks.length; i++) {
                        const t = tracks[i];
                        if (t.kind === 'subtitles') t.mode = 'disabled';
                    }
                    // Helper for robust language matching (language or srclang; en vs en-US)
                    const matches = (t) => {
                        const tl = String(t.language || t.srclang || '').toLowerCase();
                        if (!tl || !saved) return false;
                        return tl === saved || tl.startsWith(saved + '-') || saved.startsWith(tl + '-');
                    };

                    let restored = false;
                    for (let i = 0; i < tracks.length; i++) {
                        const t = tracks[i];
                        if (t.kind === 'subtitles' && matches(t)) {
                            t.mode = 'showing';
                            restored = true;
                            // Persist enabled flag so iOS applies on next load
                            try {
                                this.userPreferences.setPreference('subtitleEnabled', true, true);
                            } catch (e) {}
                            // Refresh UI
                            this.refreshSubtitlesSubmenu();
                            this.updateCurrentSubtitleDisplay();
                            try {
                                player.trigger('texttrackchange');
                            } catch (e) {}
                            break;
                        }
                    }

                    if (!restored && attempt < 8) {
                        // Retry with incremental delay for iOS where tracks may not be ready
                        const delay = 150 * attempt;
                        setTimeout(() => tryRestore(attempt + 1), delay);
                    }
                } catch (e) {
                    if (attempt < 8) setTimeout(() => tryRestore(attempt + 1), 150 * attempt);
                }
            };
            setTimeout(() => tryRestore(1), 300);
            try {
                const p = this.player();
                const once = (ev) => p.one(ev, () => setTimeout(() => tryRestore(1), 50));
                once('loadedmetadata');
                once('loadeddata');
                once('canplay');
            } catch (e) {}
        }
    }

    handleClickOutside(e) {
        if (
            this.settingsOverlay &&
            this.settingsButton &&
            !this.settingsOverlay.contains(e.target) &&
            !this.settingsButton.el().contains(e.target)
        ) {
            this.settingsOverlay.classList.remove('show');
            this.settingsOverlay.style.display = 'none';
            this.speedSubmenu.style.display = 'none';
            if (this.qualitySubmenu) this.qualitySubmenu.style.display = 'none';
            const btnEl = this.settingsButton?.el();
            if (btnEl) {
                btnEl.classList.remove('settings-clicked');
            }
            // Restore body scroll on mobile when closing
            this.unlockBodyScroll();
        }
    }

    // Add touch tooltip support for mobile devices
    addTouchTooltipSupport(button) {
        // Check if device is touch-enabled
        const isTouchDevice =
            'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;

        // Only add touch tooltip support on actual touch devices
        if (!isTouchDevice) {
            return;
        }

        let touchStartTime = 0;
        let tooltipTimeout = null;

        // Touch start
        button.addEventListener(
            'touchstart',
            () => {
                touchStartTime = Date.now();
            },
            { passive: true }
        );

        // Touch end
        button.addEventListener(
            'touchend',
            (e) => {
                const touchDuration = Date.now() - touchStartTime;

                // Only show tooltip for quick taps (not swipes)
                if (touchDuration < 300) {
                    // Don't prevent default here as it might interfere with the settings menu

                    // Show tooltip briefly
                    button.classList.add('touch-tooltip-active');

                    // Clear any existing timeout
                    if (tooltipTimeout) {
                        clearTimeout(tooltipTimeout);
                    }

                    // Hide tooltip after delay
                    tooltipTimeout = setTimeout(() => {
                        button.classList.remove('touch-tooltip-active');
                    }, 2000);
                }
            },
            { passive: true }
        );
    }

    dispose() {
        // Stop subtitle sync and clear interval
        this.stopSubtitleSync();
        
        // Stop keeping controls visible
        this.stopKeepingControlsVisible();
        
        // Remove text track change listener
        if (this.player()) {
            this.player().off('texttrackchange');
        }
        
        // Remove event listeners
        document.removeEventListener('click', this.handleClickOutside);

        // Clean up resize listener
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            window.removeEventListener('orientationchange', this.resizeHandler);
        }

        // Restore body scroll on mobile when disposing
        this.unlockBodyScroll();

        // Remove DOM elements
        if (this.settingsOverlay) {
            this.settingsOverlay.remove();
        }

        super.dispose();
    }
}

// Set component name for Video.js
CustomSettingsMenu.prototype.controlText_ = 'Settings Menu';

// Register the component with Video.js
videojs.registerComponent('CustomSettingsMenu', CustomSettingsMenu);

export default CustomSettingsMenu;
