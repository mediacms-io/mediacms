// components/controls/CustomChaptersOverlay.js
import videojs from 'video.js';

// Get the Component base class from Video.js
const Component = videojs.getComponent('Component');

class CustomChaptersOverlay extends Component {
    constructor(player, options) {
        super(player, options);

        this.chaptersData = options.chaptersData || [];
        this.overlay = null;
        this.chaptersList = null;

        // Bind methods
        this.createOverlay = this.createOverlay.bind(this);
        this.updateCurrentChapter = this.updateCurrentChapter.bind(this);
        this.toggleOverlay = this.toggleOverlay.bind(this);

        // Initialize after player is ready
        this.player().ready(() => {
            this.createOverlay();
            this.setupChaptersButton();
        });
    }

    createOverlay() {
        if (!this.chaptersData || this.chaptersData.length === 0) {
            console.log('⚠ No chapters data available for overlay');
            return;
        }

        const playerEl = this.player().el();

        // Create overlay element
        this.overlay = document.createElement('div');
        this.overlay.className = 'custom-chapters-overlay';
        this.overlay.style.cssText = `
            position: absolute;
            top: 0;
            right: 0;
            width: 300px;
            height: 100%;
            background: linear-gradient(180deg, rgba(20, 20, 30, 0.95) 0%, rgba(40, 40, 50, 0.95) 100%);
            color: white;
            z-index: 1000;
            display: none;
            overflow-y: auto;
            box-shadow: -4px 0 20px rgba(0, 0, 0, 0.5);
        `;

        // Create header
        const header = document.createElement('div');
        header.style.cssText = `
            background: rgba(0, 0, 0, 0.8);
            padding: 20px;
            text-align: center;
            font-weight: bold;
            font-size: 14px;
            letter-spacing: 2px;
            border-bottom: 2px solid #4a90e2;
            position: sticky;
            top: 0;
        `;
        header.textContent = 'CHAPTERS';
        this.overlay.appendChild(header);

        // Create close button
        const closeBtn = document.createElement('div');
        closeBtn.style.cssText = `
            position: absolute;
            top: 15px;
            right: 15px;
            width: 25px;
            height: 25px;
            background: rgba(0, 0, 0, 0.6);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 16px;
            z-index: 10;
        `;
        closeBtn.textContent = '×';
        closeBtn.onclick = () => {
            this.overlay.style.display = 'none';
        };
        this.overlay.appendChild(closeBtn);

        // Create chapters list
        this.chaptersList = document.createElement('div');
        this.chaptersList.style.cssText = `
            padding: 10px 0;
        `;

        // Add chapters from data
        this.chaptersData.forEach((chapter) => {
            const chapterItem = document.createElement('div');
            chapterItem.style.cssText = `
                padding: 15px 20px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                cursor: pointer;
                transition: background 0.2s ease;
                font-size: 14px;
                line-height: 1.4;
            `;
            chapterItem.textContent = chapter.text;

            // Add hover effect
            chapterItem.onmouseenter = () => {
                chapterItem.style.background = 'rgba(74, 144, 226, 0.2)';
            };
            chapterItem.onmouseleave = () => {
                chapterItem.style.background = 'transparent';
            };

            // Add click handler
            chapterItem.onclick = () => {
                this.player().currentTime(chapter.startTime);
                this.overlay.style.display = 'none';

                // Update active state
                this.chaptersList.querySelectorAll('div').forEach((item) => {
                    item.style.background = 'transparent';
                    item.style.fontWeight = 'normal';
                });
                chapterItem.style.background = 'rgba(74, 144, 226, 0.4)';
                chapterItem.style.fontWeight = 'bold';
            };

            this.chaptersList.appendChild(chapterItem);
        });

        this.overlay.appendChild(this.chaptersList);

        // Add to player
        playerEl.appendChild(this.overlay);

        // Set up time update listener
        this.player().on('timeupdate', this.updateCurrentChapter);

        console.log('✓ Custom chapters overlay created');
    }

    setupChaptersButton() {
        const chaptersButton = this.player().getChild('controlBar').getChild('chaptersButton');
        if (chaptersButton) {
            // Override the click handler
            chaptersButton.off('click'); // Remove default handler
            chaptersButton.on('click', this.toggleOverlay);
        }
    }

    toggleOverlay() {
        if (!this.overlay) return;

        if (this.overlay.style.display === 'none' || !this.overlay.style.display) {
            this.overlay.style.display = 'block';
        } else {
            this.overlay.style.display = 'none';
        }
    }

    updateCurrentChapter() {
        if (!this.chaptersList || !this.chaptersData) return;

        const currentTime = this.player().currentTime();
        const chapterItems = this.chaptersList.querySelectorAll('div');

        chapterItems.forEach((item, index) => {
            const chapter = this.chaptersData[index];
            const isPlaying =
                currentTime >= chapter.startTime &&
                (index === this.chaptersData.length - 1 || currentTime < this.chaptersData[index + 1].startTime);

            if (isPlaying) {
                item.style.borderLeft = '4px solid #10b981';
                item.style.paddingLeft = '16px';
            } else {
                item.style.borderLeft = 'none';
                item.style.paddingLeft = '20px';
            }
        });
    }

    dispose() {
        if (this.overlay) {
            this.overlay.remove();
        }
        super.dispose();
    }
}

// Set component name for Video.js
CustomChaptersOverlay.prototype.controlText_ = 'Chapters Overlay';

// Register the component with Video.js
videojs.registerComponent('CustomChaptersOverlay', CustomChaptersOverlay);

export default CustomChaptersOverlay;
