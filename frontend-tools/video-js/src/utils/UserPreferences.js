// utils/UserPreferences.js

class UserPreferences {
    constructor() {
        this.storageKey = 'videojs_user_preferences';
        this.isRestoringSubtitles = false; // Flag to prevent interference during restoration
        this.subtitleAutoSaveDisabled = false; // Emergency flag to completely disable subtitle auto-save
        this.defaultPreferences = {
            volume: 1.0, // 100%
            playbackRate: 1.0, // Normal speed
            quality: 'auto', // Auto quality
            subtitleLanguage: null, // No subtitles by default
            subtitleEnabled: false, // Subtitles off by default
            muted: false,
            autoplay: true, // Autoplay disabled by default
        };
    }

    /**
     * Get all user preferences from localStorage
     * @returns {Object} User preferences object
     */
    getPreferences() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Merge with defaults to ensure all properties exist
                return { ...this.defaultPreferences, ...parsed };
            }
        } catch (error) {
            console.warn('Error reading user preferences from localStorage:', error);
        }
        return { ...this.defaultPreferences };
    }

    /**
     * Save user preferences to localStorage
     * @param {Object} preferences - Preferences object to save
     */
    savePreferences(preferences) {
        try {
            const currentPrefs = this.getPreferences();
            const updatedPrefs = { ...currentPrefs, ...preferences };
            localStorage.setItem(this.storageKey, JSON.stringify(updatedPrefs));
        } catch (error) {
            console.warn('Error saving user preferences to localStorage:', error);
        }
    }

    /**
     * Get specific preference value
     * @param {string} key - Preference key
     * @returns {*} Preference value
     */
    getPreference(key) {
        const prefs = this.getPreferences();
        return prefs[key];
    }

    /**
     * Set specific preference value
     * @param {string} key - Preference key
     * @param {*} value - Preference value
     * @param {boolean} forceSet - Force set even if auto-save is disabled
     */
    setPreference(key, value, forceSet = false) {
        // Add special logging for subtitle language changes
        if (key === 'subtitleLanguage') {
            // Block subtitle language changes during restoration, but allow forced sets
            if (this.isRestoringSubtitles) {
                return; // Don't save during restoration
            }

            // Allow forced sets even if auto-save is disabled (for direct user clicks)
            if (this.subtitleAutoSaveDisabled && !forceSet) {
                return; // Don't save if disabled unless forced
            }

            console.trace('Subtitle preference change stack trace');
        }
        this.savePreferences({ [key]: value });
    }

    /**
     * Reset all preferences to defaults
     */
    resetPreferences() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (error) {
            console.warn('Error resetting user preferences:', error);
        }
    }

    /**
     * Apply preferences to a Video.js player instance
     * @param {Object} player - Video.js player instance
     */
    applyToPlayer(player) {
        const prefs = this.getPreferences();

        // DISABLE subtitle auto-save completely during initial load
        this.subtitleAutoSaveDisabled = true;

        // Re-enable after 3 seconds to ensure everything has settled
        setTimeout(() => {
            this.subtitleAutoSaveDisabled = false;
        }, 3000);

        // Apply volume and mute state
        if (typeof prefs.volume === 'number' && prefs.volume >= 0 && prefs.volume <= 1) {
            player.volume(prefs.volume);
        }

        if (typeof prefs.muted === 'boolean') {
            player.muted(prefs.muted);
        }

        // Apply playback rate
        if (typeof prefs.playbackRate === 'number' && prefs.playbackRate > 0) {
            player.playbackRate(prefs.playbackRate);
        }
    }

    /**
     * Set up event listeners to automatically save preferences when they change
     * @param {Object} player - Video.js player instance
     */
    setupAutoSave(player) {
        // Save volume changes
        player.on('volumechange', () => {
            this.setPreference('volume', player.volume());
            this.setPreference('muted', player.muted());
        });

        // Save playback rate changes
        player.on('ratechange', () => {
            this.setPreference('playbackRate', player.playbackRate());
        });

        // Save subtitle language changes
        player.on('texttrackchange', () => {
            // Skip saving if we're currently restoring subtitles
            if (this.isRestoringSubtitles) {
                return;
            }

            // Small delay to ensure the change has been processed
            setTimeout(() => {
                const textTracks = player.textTracks();
                let activeLanguage = null;

                for (let i = 0; i < textTracks.length; i++) {
                    const track = textTracks[i];
                    if (track.kind === 'subtitles' && track.mode === 'showing') {
                        activeLanguage = track.language;
                        break;
                    }
                }

                this.setPreference('subtitleLanguage', activeLanguage);
            }, 100);
        });

        // Also hook into subtitle menu clicks directly
        this.setupSubtitleMenuListeners(player);
    }

    /**
     * Set up listeners on subtitle menu items
     * @param {Object} player - Video.js player instance
     */
    setupSubtitleMenuListeners(player) {
        // Wait for the control bar to be ready
        setTimeout(() => {
            const controlBar = player.getChild('controlBar');

            // Check all possible subtitle button names
            const possibleNames = ['subtitlesButton', 'captionsButton', 'subsCapsButton', 'textTrackButton'];
            let subtitlesButton = null;

            for (const name of possibleNames) {
                const button = controlBar.getChild(name);
                if (button) {
                    subtitlesButton = button;
                    break;
                }
            }

            // Also try to find by scanning all children
            if (!subtitlesButton) {
                const children = controlBar.children();
                children.forEach((child) => {
                    const name = child.name_ || child.constructor.name || 'Unknown';

                    if (
                        name.toLowerCase().includes('subtitle') ||
                        name.toLowerCase().includes('caption') ||
                        name.toLowerCase().includes('text')
                    ) {
                        subtitlesButton = child;
                    }
                });
            }

            if (subtitlesButton) {
                // Wait a bit more for the menu to be created
                setTimeout(() => {
                    this.attachMenuItemListeners(player, subtitlesButton);
                }, 500);

                // Also try with longer delays
                setTimeout(() => {
                    this.attachMenuItemListeners(player, subtitlesButton);
                }, 2000);
            } else {
                // Try alternative approach - listen to DOM changes
                this.setupDOMBasedListeners(player);
            }
        }, 1000);
    }

    /**
     * Set up DOM-based listeners as fallback
     * @param {Object} player - Video.js player instance
     */
    setupDOMBasedListeners(player) {
        // Wait for DOM to be ready
        setTimeout(() => {
            const playerEl = player.el();
            if (playerEl) {
                // Listen for clicks on subtitle menu items
                playerEl.addEventListener('click', (event) => {
                    const target = event.target;

                    // Check if clicked element is a subtitle menu item
                    if (
                        target.closest('.vjs-subtitles-menu-item') ||
                        target.closest('.vjs-captions-menu-item') ||
                        (target.closest('.vjs-menu-item') && target.textContent.toLowerCase().includes('subtitle'))
                    ) {
                        // Extract language from the clicked item
                        setTimeout(() => {
                            this.detectActiveSubtitleFromDOM(player, true); // Force set for user clicks
                        }, 200);
                    }

                    // Also handle "captions off" clicks
                    if (target.closest('.vjs-menu-item') && target.textContent.toLowerCase().includes('off')) {
                        setTimeout(() => {
                            this.setPreference('subtitleLanguage', null, true); // Force set for user clicks
                        }, 200);
                    }
                });
            }
        }, 1500);
    }

    /**
     * Detect active subtitle from DOM and text tracks
     * @param {Object} player - Video.js player instance
     * @param {boolean} forceSet - Force set even if auto-save is disabled
     */
    detectActiveSubtitleFromDOM(player, forceSet = false) {
        // Skip saving if we're currently restoring subtitles
        if (this.isRestoringSubtitles) {
            return;
        }

        const textTracks = player.textTracks();
        let activeLanguage = null;

        for (let i = 0; i < textTracks.length; i++) {
            const track = textTracks[i];
            if (track.kind === 'subtitles' && track.mode === 'showing') {
                activeLanguage = track.language;
                break;
            }
        }

        this.setPreference('subtitleLanguage', activeLanguage, forceSet);
    }

    /**
     * Attach click listeners to subtitle menu items
     * @param {Object} player - Video.js player instance
     * @param {Object} subtitlesButton - The subtitles button component
     */
    attachMenuItemListeners(player, subtitlesButton) {
        try {
            const menu = subtitlesButton.menu;
            if (menu && menu.children_) {
                menu.children_.forEach((menuItem) => {
                    if (menuItem.track) {
                        const track = menuItem.track;

                        // Override the handleClick method
                        const originalHandleClick = menuItem.handleClick.bind(menuItem);
                        menuItem.handleClick = () => {
                            // Call original click handler
                            originalHandleClick();

                            // Save the preference after a short delay
                            setTimeout(() => {
                                if (track.mode === 'showing') {
                                    this.setPreference('subtitleLanguage', track.language, true); // Force set for user clicks
                                } else {
                                    this.setPreference('subtitleLanguage', null, true); // Force set for user clicks
                                }
                            }, 100);
                        };
                    } else if (menuItem.label && menuItem.label.toLowerCase().includes('off')) {
                        // Handle "captions off" option
                        const originalHandleClick = menuItem.handleClick.bind(menuItem);
                        menuItem.handleClick = () => {
                            originalHandleClick();

                            setTimeout(() => {
                                this.setPreference('subtitleLanguage', null, true); // Force set for user clicks
                            }, 100);
                        };
                    }
                });
            }
        } catch (error) {
            console.error('Error setting up subtitle menu listeners:', error);
        }
    }

    /**
     * Apply saved subtitle language preference
     * @param {Object} player - Video.js player instance
     */
    applySubtitlePreference(player) {
        const savedLanguage = this.getPreference('subtitleLanguage');
        const enabled = this.getPreference('subtitleEnabled');

        if (savedLanguage) {
            // Set flag to prevent auto-save during restoration
            this.isRestoringSubtitles = true;
            // Multiple attempts with increasing delays to ensure text tracks are loaded
            // Mobile devices need more time and attempts
            const maxAttempts = 10; // Increased from 5 for mobile compatibility
            const attemptToApplySubtitles = (attempt = 1) => {
                const textTracks = player.textTracks();

                // Check if we have any subtitle tracks loaded yet
                let hasSubtitleTracks = false;
                for (let i = 0; i < textTracks.length; i++) {
                    if (textTracks[i].kind === 'subtitles') {
                        hasSubtitleTracks = true;
                        break;
                    }
                }

                // If no subtitle tracks found yet and we have attempts left, retry with longer delay
                if (!hasSubtitleTracks && attempt < maxAttempts) {
                    // Use exponential backoff: 100ms, 200ms, 400ms, 800ms, etc.
                    const delay = Math.min(100 * Math.pow(1.5, attempt - 1), 1000);
                    setTimeout(() => attemptToApplySubtitles(attempt + 1), delay);
                    return;
                }

                // First, disable all subtitle tracks
                for (let i = 0; i < textTracks.length; i++) {
                    const track = textTracks[i];
                    if (track.kind === 'subtitles') {
                        track.mode = 'disabled';
                    }
                }

                // Helper to match language robustly (handles en vs en-US, srclang fallback)
                const matchesLang = (track, target) => {
                    const tl = String(track.language || track.srclang || '').toLowerCase();
                    const sl = String(target || '').toLowerCase();
                    if (!tl || !sl) return false;
                    return tl === sl || tl.startsWith(sl + '-') || sl.startsWith(tl + '-');
                };

                // Then enable the saved language
                let found = false;
                for (let i = 0; i < textTracks.length; i++) {
                    const track = textTracks[i];
                    if (track.kind === 'subtitles' && matchesLang(track, savedLanguage)) {
                        track.mode = 'showing';
                        found = true;

                        // Also update the menu UI to reflect the selection
                        this.updateSubtitleMenuUI(player, track);

                        // Update subtitle button visual state immediately
                        this.updateSubtitleButtonVisualState(player, true);
                        // Ensure enabled flips to true after successful restore
                        this.setPreference('subtitleEnabled', true, true);
                        break;
                    }
                }

                // Fallback: if not found but enabled is true, enable the first available subtitles track
                if (!found && enabled) {
                    for (let i = 0; i < textTracks.length; i++) {
                        const track = textTracks[i];
                        if (track.kind === 'subtitles') {
                            track.mode = 'showing';

                            // Save back the language we actually enabled for future precise matches
                            const langToSave = track.language || track.srclang || null;
                            if (langToSave) this.setPreference('subtitleLanguage', langToSave, true);
                            // Ensure enabled flips to true after successful restore
                            this.setPreference('subtitleEnabled', true, true);
                            this.updateSubtitleMenuUI(player, track);
                            this.updateSubtitleButtonVisualState(player, true);
                            found = true;
                            break;
                        }
                    }
                }

                // Clear the restoration flag after a longer delay to ensure all events have settled
                setTimeout(() => {
                    this.isRestoringSubtitles = false;
                }, 600);

                // If not found and we haven't tried too many times, try again with longer delay
                if (!found && attempt < maxAttempts) {
                    const delay = Math.min(100 * Math.pow(1.5, attempt - 1), 1000);
                    setTimeout(() => attemptToApplySubtitles(attempt + 1), delay);
                } else if (!found) {
                    // Only log warning if we had subtitle tracks but couldn't match the language
                    if (hasSubtitleTracks) {
                        console.warn('Could not find subtitle track for language:', savedLanguage);
                    }
                    // Clear flag even if not found
                    this.isRestoringSubtitles = false;
                }
            };

            // Start attempting to apply subtitles immediately
            attemptToApplySubtitles();

            // Also attempt when tracks are added/changed (iOS timing)
            try {
                const vEl =
                    (player.tech_ && player.tech_.el_) ||
                    (player.el && player.el().querySelector && player.el().querySelector('video'));
                const ttList = vEl && vEl.textTracks;
                if (ttList && typeof ttList.addEventListener === 'function') {
                    const onAddTrack = () => setTimeout(() => attemptToApplySubtitles(1), 50);
                    const onChange = () => setTimeout(() => attemptToApplySubtitles(1), 50);
                    ttList.addEventListener('addtrack', onAddTrack, { once: true });
                    ttList.addEventListener('change', onChange, { once: true });
                }
            } catch {
                // Silently ignore errors accessing native text track list
            }
        } else {
            // Ensure subtitles are off on load when not enabled
            try {
                const textTracks = player.textTracks();
                for (let i = 0; i < textTracks.length; i++) {
                    const track = textTracks[i];
                    if (track.kind === 'subtitles') {
                        track.mode = 'disabled';
                    }
                }

                // Update subtitle button visual state to show disabled
                this.updateSubtitleButtonVisualState(player, false);

                // Update custom settings menu to show "Off" as selected
                this.updateCustomSettingsMenuUI(player);
            } catch (e) {
                console.error('Error applying subtitle preference:', e);
            }
        }
    }

    /**
     * Update subtitle button visual state (red underline)
     * @param {Object} player - Video.js player instance
     * @param {boolean} enabled - Whether subtitles are enabled
     */
    updateSubtitleButtonVisualState(player, enabled) {
        try {
            const controlBar = player.getChild('controlBar');
            const subtitlesButton = controlBar.getChild('subtitlesButton');

            if (subtitlesButton && subtitlesButton.el()) {
                const buttonEl = subtitlesButton.el();

                if (enabled) {
                    buttonEl.classList.add('vjs-subs-active');
                } else {
                    buttonEl.classList.remove('vjs-subs-active');
                }
            }
        } catch (error) {
            console.error('Error updating subtitle button visual state:', error);
        }
    }

    /**
     * Update subtitle menu UI to reflect the active track
     * @param {Object} player - Video.js player instance
     * @param {Object} activeTrack - The active text track
     */
    updateSubtitleMenuUI(player, activeTrack) {
        try {
            const controlBar = player.getChild('controlBar');
            const subtitlesButton = controlBar.getChild('subtitlesButton');

            if (subtitlesButton && subtitlesButton.menu) {
                const menu = subtitlesButton.menu;

                // Update menu items to reflect selection
                menu.children_.forEach((menuItem) => {
                    if (menuItem.track) {
                        if (menuItem.track === activeTrack) {
                            menuItem.selected(true);
                        } else {
                            menuItem.selected(false);
                        }
                    } else if (menuItem.label && menuItem.label.toLowerCase().includes('off')) {
                        menuItem.selected(false);
                    }
                });
            }

            // Also update the custom settings menu if it exists
            this.updateCustomSettingsMenuUI(player);
        } catch (error) {
            console.error('Error updating subtitle menu UI:', error);
        }
    }

    /**
     * Update custom settings menu UI to reflect the current subtitle state
     * @param {Object} player - Video.js player instance
     */
    updateCustomSettingsMenuUI(player) {
        const attemptUpdate = (attempt = 1) => {
            try {
                // Find the custom settings menu component
                const controlBar = player.getChild('controlBar');
                const customSettingsMenu = controlBar.getChild('CustomSettingsMenu');

                if (customSettingsMenu && customSettingsMenu.refreshSubtitlesSubmenu) {
                    customSettingsMenu.refreshSubtitlesSubmenu();
                } else if (attempt < 5) {
                    // Retry after a short delay if menu not found

                    setTimeout(() => attemptUpdate(attempt + 1), attempt * 200);
                }
            } catch (error) {
                console.error('Error updating custom settings menu UI:', error);
            }
        };

        // Start the update attempt
        attemptUpdate();
    }

    /**
     * Get quality preference for settings menu
     * @returns {string} Quality preference
     */
    getQualityPreference() {
        return this.getPreference('quality');
    }

    /**
     * Set quality preference from settings menu
     * @param {string} quality - Quality setting
     */
    setQualityPreference(quality) {
        this.setPreference('quality', quality);
    }

    /**
     * Force save subtitle language preference (bypasses all protection)
     * @param {string} language - Subtitle language code
     */
    forceSetSubtitleLanguage(language) {
        const currentPrefs = this.getPreferences();
        const updatedPrefs = { ...currentPrefs, subtitleLanguage: language };
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(updatedPrefs));
        } catch (error) {
            console.error('❌ Error force saving subtitle language:', error);
        }
    }

    /**
     * Get autoplay preference
     * @returns {boolean} Autoplay preference
     */
    getAutoplayPreference() {
        return this.getPreference('autoplay');
    }

    /**
     * Set autoplay preference
     * @param {boolean} autoplay - Autoplay setting
     */
    setAutoplayPreference(autoplay) {
        this.setPreference('autoplay', autoplay);
    }
}

export default UserPreferences;
