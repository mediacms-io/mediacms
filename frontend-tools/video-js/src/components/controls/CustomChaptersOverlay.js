// components/controls/CustomChaptersOverlay.js
import videojs from 'video.js';
import './CustomChaptersOverlay.css';

// Get the Component base class from Video.js
const Component = videojs.getComponent('Component');

class CustomChaptersOverlay extends Component {
    constructor(player, options) {
        super(player, options);

        this.chaptersData = options.chaptersData || [];
        this.overlay = null;
        this.chaptersList = null;
        this.seriesTitle = options.seriesTitle || 'Chapters';
        this.channelName = options.channelName || '';
        this.thumbnail = options.thumbnail || '';
        this.isScrolling = false;

        // Bind methods
        this.createOverlay = this.createOverlay.bind(this);
        this.updateCurrentChapter = this.updateCurrentChapter.bind(this);
        this.toggleOverlay = this.toggleOverlay.bind(this);
        this.formatTime = this.formatTime.bind(this);
        this.getChapterTimeRange = this.getChapterTimeRange.bind(this);

        // Initialize after player is ready
        this.player().ready(() => {
            this.createOverlay();
            this.setupChaptersButton();
        });
    }

    formatTime(seconds) {
        const totalSec = Math.max(0, Math.floor(seconds));
        const hh = Math.floor(totalSec / 3600);
        const mm = Math.floor((totalSec % 3600) / 60);
        const ss = totalSec % 60;

        return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    }

    getChapterTimeRange(chapter) {
        const startTime = this.formatTime(chapter.startTime);
        const endTime = this.formatTime(chapter.endTime || chapter.startTime);
        return `${startTime} - ${endTime}`;
    }

    createOverlay() {
        if (!this.chaptersData || this.chaptersData.length === 0) {
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
            width: 100%;
            height: 100%;
            z-index: 9999;
            display: none;
            pointer-events: auto;
            background: rgba(0, 0, 0, 0.35);
        `;

        this.overlay.addEventListener('click', (event) => {
            if (event.target === this.overlay) {
                this.closeOverlay();
            }
        });

        const container = document.createElement('div');
        container.className = 'video-chapter';
        container.style.cssText = `
            pointer-events: auto;
            z-index: 9999999;
        `;
        this.overlay.appendChild(container);

        const header = document.createElement('div');
        header.className = 'chapter-head';
        container.appendChild(header);

        const playlistTitle = document.createElement('div');
        playlistTitle.className = 'playlist-title';
        header.appendChild(playlistTitle);

        const chapterTitle = document.createElement('div');
        chapterTitle.className = 'chapter-title';
        chapterTitle.innerHTML = `
            <h3><a href="#">${this.seriesTitle}</a></h3>
            <p><a href="#">${this.channelName}</a> <span>1 / ${this.chaptersData.length}</span></p>
        `;
        playlistTitle.appendChild(chapterTitle);

        // Store reference to the current chapter span for dynamic updates
        this.currentChapterSpan = chapterTitle.querySelector('span');

        const chapterClose = document.createElement('div');
        chapterClose.className = 'chapter-close';
        const closeBtn = document.createElement('button');
        closeBtn.setAttribute('aria-label', 'Close chapters');
        closeBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.7096 12L20.8596 20.15L20.1496 20.86L11.9996 12.71L3.84965 20.86L3.13965 20.15L11.2896 12L3.14965 3.85001L3.85965 3.14001L11.9996 11.29L20.1496 3.14001L20.8596 3.85001L12.7096 12Z" fill="currentColor"/>
            </svg>
        `;
        closeBtn.onclick = () => {
            this.overlay.style.display = 'none';
            const el = this.player().el();
            if (el) el.classList.remove('chapters-open');
        };
        chapterClose.appendChild(closeBtn);
        playlistTitle.appendChild(chapterClose);

        const body = document.createElement('div');
        body.className = 'chapter-body';
        // Enable smooth touch scrolling on mobile devices
        body.style.cssText += `
            -webkit-overflow-scrolling: touch;
            touch-action: pan-y;
            overscroll-behavior: contain;
        `;
        container.appendChild(body);

        const list = document.createElement('ul');
        body.appendChild(list);
        this.chaptersList = list;

        this.chaptersData.forEach((chapter, index) => {
            const li = document.createElement('li');
            const item = document.createElement('div');
            item.className = `playlist-items ${index === 0 ? 'selected' : ''}`;

            const anchor = document.createElement('a');
            anchor.href = '#';
            anchor.onclick = (e) => e.preventDefault();

            const drag = document.createElement('div');
            drag.className = 'playlist-drag-handle';
            drag.textContent = index === 0 ? '▶' : String(index + 1);

            const meta = document.createElement('div');
            meta.className = 'thumbnail-meta';

            const totalSec = Math.max(0, Math.floor((chapter.endTime || chapter.startTime) - chapter.startTime));
            const hh = Math.floor(totalSec / 3600);
            const mm = Math.floor((totalSec % 3600) / 60);
            const ss = totalSec % 60;
            const timeStr =
                hh > 0
                    ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
                    : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;

            const titleEl = document.createElement('h4');
            titleEl.textContent = chapter.chapterTitle;
            const sub = document.createElement('div');
            sub.className = 'meta-sub';
            const dynamic = document.createElement('span');
            dynamic.className = 'meta-dynamic';
            const chapterTimeRange = this.getChapterTimeRange(chapter);
            dynamic.textContent = chapterTimeRange;
            dynamic.setAttribute('data-duration', timeStr);
            dynamic.setAttribute('data-time-range', chapterTimeRange);
            sub.appendChild(dynamic);
            meta.appendChild(titleEl);
            meta.appendChild(sub);

            const action = document.createElement('div');
            action.className = 'thumbnail-action';
            const btn = document.createElement('button');
            btn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 16.5C12.83 16.5 13.5 17.17 13.5 18C13.5 18.83 12.83 19.5 12 19.5C11.17 19.5 10.5 18.83 10.5 18C10.5 17.17 11.17 16.5 12 16.5ZM10.5 12C10.5 12.83 11.17 13.5 12 13.5C12.83 13.5 13.5 12.83 13.5 12C13.5 11.17 12.83 10.5 12 10.5C11.17 10.5 10.5 11.17 10.5 12ZM10.5 6C10.5 6.83 11.17 7.5 12 7.5C12.83 7.5 13.5 6.83 13.5 6C13.5 5.17 12.83 4.5 12 4.5C11.17 4.5 10.5 5.17 10.5 6Z" fill="currentColor"/>
                </svg>`;
            action.appendChild(btn);

            // Handle click and touch events properly
            const seekFn = (e) => {
                // Prevent default only for navigation, not scrolling
                if (e.type === 'click' || (e.type === 'touchend' && !this.isScrolling)) {
                    e.preventDefault();
                    this.player().currentTime(chapter.startTime);
                    this.overlay.style.display = 'none';
                    this.updateActiveItem(index);
                }
            };

            // Track scrolling state for touch devices
            let touchStartY = 0;
            let touchStartTime = 0;

            item.addEventListener(
                'touchstart',
                (e) => {
                    touchStartY = e.touches[0].clientY;
                    touchStartTime = Date.now();
                    this.isScrolling = false;
                },
                { passive: true }
            );

            item.addEventListener(
                'touchmove',
                (e) => {
                    const touchMoveY = e.touches[0].clientY;
                    const deltaY = Math.abs(touchMoveY - touchStartY);
                    // If user moved more than 10px vertically, consider it scrolling
                    if (deltaY > 10) {
                        this.isScrolling = true;
                    }
                },
                { passive: true }
            );

            item.addEventListener('touchend', seekFn, { passive: false });
            item.addEventListener('click', seekFn);

            anchor.appendChild(drag);
            anchor.appendChild(meta);
            anchor.appendChild(action);
            item.appendChild(anchor);
            li.appendChild(item);
            this.chaptersList.appendChild(li);
        });

        playerEl.appendChild(this.overlay);

        this.player().on('timeupdate', this.updateCurrentChapter);
    }

    setupChaptersButton() {
        const chaptersButton = this.player().getChild('controlBar').getChild('chaptersButton');
        if (chaptersButton) {
            chaptersButton.off('click');
            chaptersButton.on('click', this.toggleOverlay);
            chaptersButton.on('touchstart', this.toggleOverlay); // mobile support
        }
    }

    toggleOverlay() {
        if (!this.overlay) return;

        const el = this.player().el();
        const isHidden = this.overlay.style.display === 'none' || !this.overlay.style.display;

        this.overlay.style.display = isHidden ? 'block' : 'none';
        if (el) el.classList.toggle('chapters-open', isHidden);

        try {
            this.player()
                .el()
                .querySelectorAll('.vjs-menu')
                .forEach((m) => {
                    m.classList.remove('vjs-lock-showing');
                    m.style.display = 'none';
                });
        } catch (e) {}
    }

    updateCurrentChapter() {
        if (!this.chaptersList || !this.chaptersData) return;

        const currentTime = this.player().currentTime();
        const chapterItems = this.chaptersList.querySelectorAll('.playlist-items');
        let currentChapterIndex = -1;

        chapterItems.forEach((item, index) => {
            const chapter = this.chaptersData[index];
            const isPlaying =
                currentTime >= chapter.startTime &&
                (index === this.chaptersData.length - 1 || currentTime < this.chaptersData[index + 1].startTime);

            const handle = item.querySelector('.playlist-drag-handle');
            const dynamic = item.querySelector('.meta-dynamic');
            if (isPlaying) {
                currentChapterIndex = index;
                item.classList.add('selected');
                if (handle) handle.textContent = '▶';
                if (dynamic)
                    dynamic.textContent = dynamic.getAttribute('data-time-range') || this.getChapterTimeRange(chapter);
            } else {
                item.classList.remove('selected');
                if (handle) handle.textContent = String(index + 1);
                if (dynamic)
                    dynamic.textContent = dynamic.getAttribute('data-time-range') || this.getChapterTimeRange(chapter);
            }
        });

        // Update the header chapter number
        if (this.currentChapterSpan && currentChapterIndex !== -1) {
            this.currentChapterSpan.textContent = `${currentChapterIndex + 1} / ${this.chaptersData.length}`;
        }
    }

    updateActiveItem(activeIndex) {
        const items = this.chaptersList.querySelectorAll('.playlist-items');
        items.forEach((el, idx) => {
            const handle = el.querySelector('.playlist-drag-handle');
            const dynamic = el.querySelector('.meta-dynamic');
            if (idx === activeIndex) {
                el.classList.add('selected');
                if (handle) handle.textContent = '▶';
                if (dynamic) dynamic.textContent = dynamic.getAttribute('data-duration') || '';
            } else {
                el.classList.remove('selected');
                if (handle) handle.textContent = String(idx + 1);
                if (dynamic) {
                    const timeRange = dynamic.getAttribute('data-time-range');
                    if (timeRange) {
                        dynamic.textContent = timeRange;
                    } else {
                        // Fallback: calculate time range from chapters data
                        const chapter = this.chaptersData[idx];
                        if (chapter) {
                            dynamic.textContent = this.getChapterTimeRange(chapter);
                        }
                    }
                }
            }
        });

        // Update the header chapter number
        if (this.currentChapterSpan) {
            this.currentChapterSpan.textContent = `${activeIndex + 1} / ${this.chaptersData.length}`;
        }
    }

    closeOverlay() {
        if (this.overlay) {
            this.overlay.style.display = 'none';
            const el = this.player().el();
            if (el) el.classList.remove('chapters-open');
        }
    }

    dispose() {
        if (this.overlay) {
            this.overlay.remove();
        }
        const el = this.player().el();
        if (el) el.classList.remove('chapters-open');
        super.dispose();
    }
}

// Set component name for Video.js
CustomChaptersOverlay.prototype.controlText_ = 'Chapters Overlay';

// Register the component with Video.js
videojs.registerComponent('CustomChaptersOverlay', CustomChaptersOverlay);

export default CustomChaptersOverlay;
