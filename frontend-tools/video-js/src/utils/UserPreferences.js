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
            muted: false,
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
            console.log('User preferences saved:', updatedPrefs);
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
            console.log(
                `🔄 Setting subtitleLanguage: ${value} (restoring: ${this.isRestoringSubtitles}, autoSaveDisabled: ${this.subtitleAutoSaveDisabled}, forceSet: ${forceSet})`
            );

            // Block subtitle language changes during restoration, but allow forced sets
            if (this.isRestoringSubtitles) {
                console.log('🚫 BLOCKED: Subtitle language change during restoration');
                return; // Don't save during restoration
            }

            // Allow forced sets even if auto-save is disabled (for direct user clicks)
            if (this.subtitleAutoSaveDisabled && !forceSet) {
                console.log(
                    '🚫 BLOCKED: Subtitle language change during auto-save disabled period (use forceSet=true to override)'
                );
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
            console.log('User preferences reset to defaults');
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
        console.log('🔒 Subtitle auto-save DISABLED during initial load');

        // Re-enable after 3 seconds to ensure everything has settled
        setTimeout(() => {
            this.subtitleAutoSaveDisabled = false;
            console.log('🔓 Subtitle auto-save RE-ENABLED after initial load period');
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

        // Apply subtitle language (will be handled separately for text tracks)
        // Quality setting will be handled by the settings menu component

        console.log('Applied user preferences to player:', prefs);
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
                console.log('Skipping subtitle save - currently restoring preferences');
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
                        console.log('Active subtitle language detected:', activeLanguage);
                        break;
                    }
                }

                // If no subtitles are active, save null
                if (!activeLanguage) {
                    console.log('No subtitles active, saving null');
                }

                this.setPreference('subtitleLanguage', activeLanguage);
            }, 100);
        });

        // Also hook into subtitle menu clicks directly
        this.setupSubtitleMenuListeners(player);

        console.log('Auto-save preferences listeners set up');
    }

    /**
     * Set up listeners on subtitle menu items
     * @param {Object} player - Video.js player instance
     */
    setupSubtitleMenuListeners(player) {
        // Wait for the control bar to be ready
        setTimeout(() => {
            const controlBar = player.getChild('controlBar');
            console.log('=== Searching for subtitle controls ===');

            // Check all possible subtitle button names
            const possibleNames = ['subtitlesButton', 'captionsButton', 'subsCapsButton', 'textTrackButton'];
            let subtitlesButton = null;

            for (const name of possibleNames) {
                const button = controlBar.getChild(name);
                if (button) {
                    console.log(`Found subtitle button: ${name}`);
                    subtitlesButton = button;
                    break;
                }
            }

            // Also try to find by scanning all children
            if (!subtitlesButton) {
                console.log('Scanning all control bar children...');
                const children = controlBar.children();
                children.forEach((child, index) => {
                    const name = child.name_ || child.constructor.name || 'Unknown';
                    console.log(`Child ${index}: ${name}`);

                    if (
                        name.toLowerCase().includes('subtitle') ||
                        name.toLowerCase().includes('caption') ||
                        name.toLowerCase().includes('text')
                    ) {
                        console.log(`Potential subtitle button found: ${name}`);
                        subtitlesButton = child;
                    }
                });
            }

            if (subtitlesButton) {
                console.log('Found subtitles button, setting up menu listeners');

                // Wait a bit more for the menu to be created
                setTimeout(() => {
                    this.attachMenuItemListeners(player, subtitlesButton);
                }, 500);

                // Also try with longer delays
                setTimeout(() => {
                    this.attachMenuItemListeners(player, subtitlesButton);
                }, 2000);
            } else {
                console.log('No subtitles button found after exhaustive search');

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
        console.log('Setting up DOM-based subtitle listeners as fallback');

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
                        console.log('Subtitle menu item clicked via DOM listener:', target.textContent);

                        // Extract language from the clicked item
                        setTimeout(() => {
                            this.detectActiveSubtitleFromDOM(player, true); // Force set for user clicks
                        }, 200);
                    }

                    // Also handle "captions off" clicks
                    if (target.closest('.vjs-menu-item') && target.textContent.toLowerCase().includes('off')) {
                        console.log('Captions off clicked via DOM listener');
                        setTimeout(() => {
                            this.setPreference('subtitleLanguage', null, true); // Force set for user clicks
                        }, 200);
                    }
                });

                console.log('DOM-based subtitle listeners attached');
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
            console.log('Skipping DOM subtitle save - currently restoring preferences');
            return;
        }

        const textTracks = player.textTracks();
        let activeLanguage = null;

        for (let i = 0; i < textTracks.length; i++) {
            const track = textTracks[i];
            if (track.kind === 'subtitles' && track.mode === 'showing') {
                activeLanguage = track.language;
                console.log('DOM detection - Active subtitle language:', activeLanguage, track.label);
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
                console.log('Found subtitle menu with', menu.children_.length, 'items');

                menu.children_.forEach((menuItem, index) => {
                    if (menuItem.track) {
                        const track = menuItem.track;
                        console.log(`Menu item ${index}: ${track.label} (${track.language})`);

                        // Override the handleClick method
                        const originalHandleClick = menuItem.handleClick.bind(menuItem);
                        menuItem.handleClick = () => {
                            console.log('Subtitle menu item clicked:', track.label, track.language);

                            // Call original click handler
                            originalHandleClick();

                            // Save the preference after a short delay
                            setTimeout(() => {
                                if (track.mode === 'showing') {
                                    console.log('Saving subtitle preference:', track.language);
                                    this.setPreference('subtitleLanguage', track.language, true); // Force set for user clicks
                                } else {
                                    console.log('Subtitle disabled, saving null');
                                    this.setPreference('subtitleLanguage', null, true); // Force set for user clicks
                                }
                            }, 100);
                        };
                    } else if (menuItem.label && menuItem.label.toLowerCase().includes('off')) {
                        // Handle "captions off" option
                        console.log('Found captions off menu item');
                        const originalHandleClick = menuItem.handleClick.bind(menuItem);
                        menuItem.handleClick = () => {
                            console.log('Captions off clicked');
                            originalHandleClick();

                            setTimeout(() => {
                                console.log('Saving subtitle preference: null (off)');
                                this.setPreference('subtitleLanguage', null, true); // Force set for user clicks
                            }, 100);
                        };
                    }
                });
            } else {
                console.log('Could not find subtitle menu or menu items');
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

        if (savedLanguage) {
            // Set flag to prevent auto-save during restoration
            this.isRestoringSubtitles = true;
            console.log('isRestoringSubtitles', this.isRestoringSubtitles);

            // Multiple attempts with increasing delays to ensure text tracks are loaded
            const attemptToApplySubtitles = (attempt = 1) => {
                const textTracks = player.textTracks();
                console.log(`Subtitle application attempt ${attempt}, found ${textTracks.length} text tracks`);

                // Log all available tracks for debugging
                for (let i = 0; i < textTracks.length; i++) {
                    const track = textTracks[i];
                    console.log(
                        `Track ${i}: kind=${track.kind}, language=${track.language}, label=${track.label}, mode=${track.mode}`
                    );
                }

                // First, disable all subtitle tracks
                for (let i = 0; i < textTracks.length; i++) {
                    const track = textTracks[i];
                    if (track.kind === 'subtitles') {
                        track.mode = 'disabled';
                    }
                }

                // Then enable the saved language
                let found = false;
                for (let i = 0; i < textTracks.length; i++) {
                    const track = textTracks[i];
                    if (track.kind === 'subtitles' && track.language === savedLanguage) {
                        track.mode = 'showing';
                        console.log('✓ Applied saved subtitle language:', savedLanguage, track.label);
                        found = true;

                        // Also update the menu UI to reflect the selection
                        this.updateSubtitleMenuUI(player, track);
                        break;
                    }
                }

                // Clear the restoration flag after a longer delay to ensure all events have settled
                setTimeout(() => {
                    this.isRestoringSubtitles = false;
                    console.log('✅ Subtitle restoration complete, auto-save re-enabled');
                }, 600); // Increased to 3 seconds

                // If not found and we haven't tried too many times, try again
                if (!found && attempt < 5) {
                    console.log(`Subtitle language ${savedLanguage} not found, retrying in ${attempt * 200}ms...`);
                    setTimeout(() => attemptToApplySubtitles(attempt + 1), attempt * 200);
                } else if (!found) {
                    console.warn('Could not find subtitle track for language:', savedLanguage);
                    // Clear flag even if not found
                    this.isRestoringSubtitles = false;
                }
            };

            // Start attempting to apply subtitles
            setTimeout(() => attemptToApplySubtitles(), 500);
        } else {
            console.log('No saved subtitle language to apply');
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
                            console.log('Updated menu UI for:', menuItem.track.label);
                        } else {
                            menuItem.selected(false);
                        }
                    } else if (menuItem.label && menuItem.label.toLowerCase().includes('off')) {
                        menuItem.selected(false);
                    }
                });
            }
        } catch (error) {
            console.error('Error updating subtitle menu UI:', error);
        }
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
        console.log(`🚀 FORCE SAVING subtitle language: ${language}`);
        const currentPrefs = this.getPreferences();
        const updatedPrefs = { ...currentPrefs, subtitleLanguage: language };
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(updatedPrefs));
            console.log('✅ Force saved subtitle language:', language);
        } catch (error) {
            console.error('❌ Error force saving subtitle language:', error);
        }
    }
}

export default UserPreferences;
