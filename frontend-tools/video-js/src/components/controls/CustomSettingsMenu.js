// components/controls/CustomSettingsMenu.js
import videojs from 'video.js';
import './CustomSettingsMenu.css';

// Get the Component base class from Video.js
const Component = videojs.getComponent('Component');

class CustomSettingsMenu extends Component {
    constructor(player, options) {
        super(player, options);

        this.settingsButton = null;
        this.settingsOverlay = null;
        this.speedSubmenu = null;

        // Bind methods
        this.createSettingsButton = this.createSettingsButton.bind(this);
        this.createSettingsOverlay = this.createSettingsOverlay.bind(this);
        this.positionButton = this.positionButton.bind(this);
        this.toggleSettings = this.toggleSettings.bind(this);
        this.handleSpeedChange = this.handleSpeedChange.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);

        // Initialize after player is ready
        this.player().ready(() => {
            this.createSettingsButton();
            this.createSettingsOverlay();
            this.setupEventListeners();
        });
    }

    createSettingsButton() {
        const controlBar = this.player().getChild('controlBar');

        // Hide default playback rate button
        const playbackRateButton = controlBar.getChild('playbackRateMenuButton');
        if (playbackRateButton) {
            playbackRateButton.hide();
        }

        // Create settings button
        this.settingsButton = controlBar.addChild('button', {
            controlText: 'Settings',
            className: 'vjs-settings-button',
        });

        // Style the settings button (gear icon)
        const settingsButtonEl = this.settingsButton.el();
        settingsButtonEl.innerHTML = `
            <span class="vjs-icon-cog"></span>
        `;

        // Position the settings button at the end of the control bar
        this.positionButton();

        // Add click handler
        this.settingsButton.on('click', this.toggleSettings);
    }

    createSettingsOverlay() {
        const controlBar = this.player().getChild('controlBar');

        // Create settings overlay
        this.settingsOverlay = document.createElement('div');
        this.settingsOverlay.className = 'custom-settings-overlay';

        // Settings menu content
        this.settingsOverlay.innerHTML = `
            <div class="settings-header">Settings</div>
            
            <div class="settings-item" data-setting="playback-speed">
                <span>Playback speed</span>
                <span class="current-speed">Normal</span>
            </div>
            
            <div class="settings-item" data-setting="quality">
                <span>Quality</span>
                <span class="current-quality">Auto</span>
            </div>
        `;

        // Create speed submenu
        this.createSpeedSubmenu();

        // Add to control bar
        controlBar.el().appendChild(this.settingsOverlay);
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

        this.speedSubmenu.innerHTML = `
            <div class="submenu-header">
                <span style="margin-right: 8px;">←</span>
                <span>Playback speed</span>
            </div>
            ${speedOptions
                .map(
                    (option) => `
                <div class="speed-option ${option.value === 1 ? 'active' : ''}" data-speed="${option.value}">
                    <span>${option.label}</span>
                    ${option.value === 1 ? '<span>✓</span>' : ''}
                </div>
            `
                )
                .join('')}
        `;

        this.settingsOverlay.appendChild(this.speedSubmenu);
    }

    positionButton() {
        const controlBar = this.player().getChild('controlBar');
        const fullscreenToggle = controlBar.getChild('fullscreenToggle');

        if (this.settingsButton && fullscreenToggle) {
            // Small delay to ensure all buttons are created
            setTimeout(() => {
                const fullscreenIndex = controlBar.children().indexOf(fullscreenToggle);
                controlBar.removeChild(this.settingsButton);
                controlBar.addChild(this.settingsButton, {}, fullscreenIndex + 1);
                console.log('✓ Settings button positioned after fullscreen toggle');
            }, 50);
        }
    }

    setupEventListeners() {
        // Settings item clicks
        this.settingsOverlay.addEventListener('click', (e) => {
            e.stopPropagation();

            if (e.target.closest('[data-setting="playback-speed"]')) {
                this.speedSubmenu.style.display = 'flex';
            }
        });

        // Speed submenu header (back button)
        this.speedSubmenu.querySelector('.submenu-header').addEventListener('click', () => {
            this.speedSubmenu.style.display = 'none';
        });

        // Speed option clicks
        this.speedSubmenu.addEventListener('click', (e) => {
            const speedOption = e.target.closest('.speed-option');
            if (speedOption) {
                const speed = parseFloat(speedOption.dataset.speed);
                this.handleSpeedChange(speed, speedOption);
            }
        });

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
    }

    toggleSettings(e) {
        e.stopPropagation();
        const isVisible = this.settingsOverlay.style.display === 'block';
        this.settingsOverlay.style.display = isVisible ? 'none' : 'block';
        this.speedSubmenu.style.display = 'none'; // Hide submenu when main menu toggles
    }

    handleSpeedChange(speed, speedOption) {
        // Update player speed
        this.player().playbackRate(speed);

        // Update UI
        document.querySelectorAll('.speed-option').forEach((opt) => {
            opt.style.background = 'transparent';
            opt.querySelector('span:last-child')?.remove();
        });

        speedOption.style.background = 'rgba(255, 255, 255, 0.1)';
        speedOption.insertAdjacentHTML('beforeend', '<span>✓</span>');

        // Update main menu display
        const currentSpeedDisplay = this.settingsOverlay.querySelector('.current-speed');
        currentSpeedDisplay.textContent = speedOption.querySelector('span').textContent;

        // Hide menus
        this.settingsOverlay.style.display = 'none';
        this.speedSubmenu.style.display = 'none';
    }

    handleClickOutside(e) {
        if (
            this.settingsOverlay &&
            this.settingsButton &&
            !this.settingsOverlay.contains(e.target) &&
            !this.settingsButton.el().contains(e.target)
        ) {
            this.settingsOverlay.style.display = 'none';
            this.speedSubmenu.style.display = 'none';
        }
    }

    dispose() {
        // Remove event listeners
        document.removeEventListener('click', this.handleClickOutside);

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
