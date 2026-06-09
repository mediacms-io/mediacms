/**
 * KeyboardHandler - Utility for handling video player keyboard controls
 *
 * Provides comprehensive keyboard event handling for video players including:
 * - Space bar for play/pause
 * - Arrow keys for seeking
 * - Input field detection to avoid conflicts
 */

class KeyboardHandler {
    constructor(playerRef, customComponents = null, options = {}) {
        this.playerRef = playerRef;
        this.customComponents = customComponents;
        this.options = {
            seekAmount: 5, // Default seek amount in seconds
            ...options,
        };
        this.eventHandler = null;
        this.isActive = false;
    }

    /**
     * Check if an input element is currently focused
     * @returns {boolean} True if an input element has focus
     */
    isInputFocused() {
        const activeElement = document.activeElement;
        return (
            activeElement &&
            (activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.contentEditable === 'true')
        );
    }

    /**
     * Handle space key for play/pause functionality
     * @param {KeyboardEvent} event - The keyboard event
     */
    handleSpaceKey(event) {
        if (event.code === 'Space' || event.key === ' ') {
            event.preventDefault();
            if (this.playerRef.current) {
                if (this.playerRef.current.paused()) {
                    this.playerRef.current.play();
                } else {
                    this.playerRef.current.pause();
                }
            }
            return true;
        }
        return false;
    }

    /**
     * Handle arrow keys for seeking functionality
     * @param {KeyboardEvent} event - The keyboard event
     */
    handleArrowKeys(event) {
        const { seekAmount } = this.options;

        if (event.key === 'ArrowRight' || event.keyCode === 39) {
            event.preventDefault();
            this.seekForward(seekAmount);
            return true;
        } else if (event.key === 'ArrowLeft' || event.keyCode === 37) {
            event.preventDefault();
            this.seekBackward(seekAmount);
            return true;
        }
        return false;
    }

    /**
     * Seek forward by specified amount
     * @param {number} amount - Seconds to seek forward
     */
    seekForward(amount) {
        if (!this.playerRef.current) return;

        const currentTime = this.playerRef.current.currentTime();
        const duration = this.playerRef.current.duration();
        const newTime = Math.min(currentTime + amount, duration);

        this.playerRef.current.currentTime(newTime);

        // Show seek indicator if available
        if (this.customComponents?.current?.seekIndicator) {
            this.customComponents.current.seekIndicator.show('forward', amount);
        }
    }

    /**
     * Seek backward by specified amount
     * @param {number} amount - Seconds to seek backward
     */
    seekBackward(amount) {
        if (!this.playerRef.current) return;

        const currentTime = this.playerRef.current.currentTime();
        const newTime = Math.max(currentTime - amount, 0);

        this.playerRef.current.currentTime(newTime);

        // Show seek indicator if available
        if (this.customComponents?.current?.seekIndicator) {
            this.customComponents.current.seekIndicator.show('backward', amount);
        }
    }

    /**
     * Main keyboard event handler
     * @param {KeyboardEvent} event - The keyboard event
     */
    handleKeyboardEvent = (event) => {
        // Only handle if no input elements are focused
        if (this.isInputFocused()) {
            return; // Don't interfere with input fields
        }

        // Handle space key for play/pause
        if (this.handleSpaceKey(event)) {
            return;
        }

        // Handle arrow keys for seeking
        if (this.handleArrowKeys(event)) {
            return;
        }
    };

    /**
     * Initialize keyboard event handling
     */
    init() {
        if (this.isActive) {
            console.warn('KeyboardHandler is already active');
            return;
        }

        // Add keyboard event listener to the document
        document.addEventListener('keydown', this.handleKeyboardEvent);
        this.isActive = true;
    }

    /**
     * Clean up keyboard event handling
     */
    destroy() {
        if (!this.isActive) {
            return;
        }

        document.removeEventListener('keydown', this.handleKeyboardEvent);
        this.isActive = false;
    }

    /**
     * Update options
     * @param {Object} newOptions - New options to merge
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
    }

    /**
     * Update player reference
     * @param {Object} newPlayerRef - New player reference
     */
    updatePlayerRef(newPlayerRef) {
        this.playerRef = newPlayerRef;
    }

    /**
     * Update custom components reference
     * @param {Object} newCustomComponents - New custom components reference
     */
    updateCustomComponents(newCustomComponents) {
        this.customComponents = newCustomComponents;
    }
}

export default KeyboardHandler;
