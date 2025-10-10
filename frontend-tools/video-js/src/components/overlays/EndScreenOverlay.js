import videojs from 'video.js';
import './EndScreenOverlay.css';
const Component = videojs.getComponent('Component');

class EndScreenOverlay extends Component {
    constructor(player, options) {
        super(player, options);
        // Safely initialize relatedVideos with multiple fallbacks
        this.relatedVideos = options?.relatedVideos || options?._relatedVideos || this.options_?.relatedVideos || [];
        console.log('relatedVideos1', this.relatedVideos);
        this.isTouchDevice = this.detectTouchDevice();

        // Bind methods to preserve 'this' context
        this.getVideosToShow = this.getVideosToShow.bind(this);
        this.getGridConfig = this.getGridConfig.bind(this);
        this.createVideoItem = this.createVideoItem.bind(this);
    }

    // Method to update related videos after initialization
    setRelatedVideos(videos) {
        this.relatedVideos = videos || [];
    }

    createEl() {
        const overlay = super.createEl('div', {
            className: 'vjs-end-screen-overlay',
        });

        // Position overlay above control bar
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '60px'; // Leave space for control bar
        overlay.style.display = 'none'; // Hidden by default
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        overlay.style.zIndex = '100';

        // Create responsive grid
        const grid = this.createGrid();
        overlay.appendChild(grid);

        return overlay;
    }

    createGrid() {
        const grid = videojs.dom.createEl('div', {
            className: 'vjs-related-videos-grid',
        });

        // Responsive grid styling
        grid.style.display = 'grid';
        grid.style.gap = '12px';
        grid.style.padding = '20px';
        grid.style.height = '100%';
        grid.style.overflowY = 'auto';

        // Responsive grid columns based on player size
        const { columns, maxVideos } = this.getGridConfig();
        grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

        // Get videos to show - access directly from options during createEl
        const relatedVideos = this.options_?.relatedVideos || this.relatedVideos || [];

        const videosToShow =
            relatedVideos.length > 0
                ? relatedVideos.slice(0, maxVideos)
                : this.createSampleVideos().slice(0, maxVideos);

        // Create video items
        videosToShow.forEach((video) => {
            const videoItem = this.createVideoItem(video);
            grid.appendChild(videoItem);
        });

        return grid;
    }

    getGridConfig() {
        const playerEl = this.player().el();
        const playerWidth = playerEl?.offsetWidth || window.innerWidth;
        const playerHeight = playerEl?.offsetHeight || window.innerHeight;

        // Responsive grid configuration
        if (playerWidth >= 1200) {
            return { columns: 4, maxVideos: 8 }; // 4x2 grid for large screens
        } else if (playerWidth >= 800) {
            return { columns: 3, maxVideos: 6 }; // 3x2 grid for medium screens
        } else if (playerWidth >= 500) {
            return { columns: 2, maxVideos: 4 }; // 2x2 grid for small screens
        } else {
            return { columns: 1, maxVideos: 3 }; // 1 column for very small screens
        }
    }

    getVideosToShow(maxVideos) {
        // Safely check if relatedVideos exists and has content
        console.log('relatedVideos', this.relatedVideos);
        if (this.relatedVideos && Array.isArray(this.relatedVideos) && this.relatedVideos.length > 0) {
            return this.relatedVideos.slice(0, maxVideos);
        }
        // Fallback to sample videos for testing
        return this.createSampleVideos().slice(0, maxVideos);
    }

    createVideoItem(video) {
        const item = videojs.dom.createEl('div', {
            className: 'vjs-related-video-item',
        });

        // Item styling
        item.style.position = 'relative';
        item.style.backgroundColor = '#1a1a1a';
        item.style.borderRadius = '8px';
        item.style.overflow = 'hidden';
        item.style.cursor = 'pointer';
        item.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';

        // Hover/touch effects
        if (this.isTouchDevice) {
            item.style.touchAction = 'manipulation';
        } else {
            item.addEventListener('mouseenter', () => {
                item.style.transform = 'scale(1.05)';
                item.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.transform = 'scale(1)';
                item.style.boxShadow = 'none';
            });
        }

        // Create thumbnail
        const thumbnail = this.createThumbnail(video);
        item.appendChild(thumbnail);

        // Create info overlay
        const info = this.createVideoInfo(video);
        item.appendChild(info);

        // Add click handler
        this.addClickHandler(item, video);

        return item;
    }

    createThumbnail(video) {
        const thumbnail = videojs.dom.createEl('img', {
            className: 'vjs-related-video-thumbnail',
            src: video.thumbnail || this.getPlaceholderImage(video.title),
            alt: video.title,
        });

        // Thumbnail styling
        thumbnail.style.width = '100%';
        thumbnail.style.height = '120px';
        thumbnail.style.objectFit = 'cover';
        thumbnail.style.display = 'block';

        // Add duration badge if available
        if (video.duration && video.duration > 0) {
            const duration = videojs.dom.createEl('div', {
                className: 'vjs-video-duration',
            });
            duration.textContent = this.formatDuration(video.duration);
            duration.style.position = 'absolute';
            duration.style.bottom = '50px';
            duration.style.right = '8px';
            duration.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            duration.style.color = 'white';
            duration.style.padding = '2px 6px';
            duration.style.borderRadius = '4px';
            duration.style.fontSize = '12px';
            duration.style.fontWeight = 'bold';

            // Add duration to parent item (will be added later)
            thumbnail.durationBadge = duration;
        }

        return thumbnail;
    }

    createVideoInfo(video) {
        const info = videojs.dom.createEl('div', {
            className: 'vjs-related-video-info',
        });

        // Info styling
        info.style.padding = '12px';
        info.style.color = 'white';

        // Title
        const title = videojs.dom.createEl('div', {
            className: 'vjs-related-video-title',
        });
        title.textContent = video.title;
        title.style.fontSize = '14px';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '4px';
        title.style.lineHeight = '1.3';
        title.style.overflow = 'hidden';
        title.style.textOverflow = 'ellipsis';
        title.style.display = '-webkit-box';
        title.style.webkitLineClamp = '2';
        title.style.webkitBoxOrient = 'vertical';

        // Author and views
        const meta = videojs.dom.createEl('div', {
            className: 'vjs-related-video-meta',
        });
        meta.textContent = `${video.author} • ${video.views}`;
        meta.style.fontSize = '12px';
        meta.style.color = '#aaa';
        meta.style.overflow = 'hidden';
        meta.style.textOverflow = 'ellipsis';
        meta.style.whiteSpace = 'nowrap';

        info.appendChild(title);
        info.appendChild(meta);

        return info;
    }

    addClickHandler(item, video) {
        const clickHandler = () => {
            const isEmbedPlayer = this.player().id() === 'video-embed' || window.parent !== window;

            if (isEmbedPlayer) {
                window.open(`/view?m=${video.id}`, '_blank', 'noopener,noreferrer');
            } else {
                window.location.href = `/view?m=${video.id}`;
            }
        };

        if (this.isTouchDevice) {
            item.addEventListener('touchend', (e) => {
                e.preventDefault();
                clickHandler();
            });
        } else {
            item.addEventListener('click', clickHandler);
        }

        // Add duration badge if it exists
        if (item.querySelector('img').durationBadge) {
            item.appendChild(item.querySelector('img').durationBadge);
        }
    }

    formatDuration(seconds) {
        if (!seconds || seconds === 0) return '';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    getPlaceholderImage(title) {
        const colors = ['#009931', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];

        // Use title hash to consistently assign colors
        let hash = 0;
        for (let i = 0; i < title.length; i++) {
            hash = title.charCodeAt(i) + ((hash << 5) - hash);
        }
        const color = colors[Math.abs(hash) % colors.length];
        const firstLetter = title.charAt(0).toUpperCase();

        // Create simple SVG placeholder
        return `data:image/svg+xml,${encodeURIComponent(`
            <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
                <rect width="320" height="180" fill="${color}"/>
                <text x="160" y="90" font-family="Arial" font-size="48" font-weight="bold" 
                      text-anchor="middle" dominant-baseline="middle" fill="white">${firstLetter}</text>
            </svg>
        `)}`;
    }

    detectTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    createSampleVideos() {
        return [
            { id: 'sample1', title: 'React Full Course', author: 'Bro Code', views: '2.1M views', duration: 1800 },
            { id: 'sample2', title: 'JavaScript ES6+', author: 'Tech Tutorials', views: '850K views', duration: 1200 },
            { id: 'sample3', title: 'CSS Grid Layout', author: 'Web Dev Academy', views: '1.2M views', duration: 2400 },
            { id: 'sample4', title: 'Node.js Backend', author: 'Code Master', views: '650K views', duration: 3600 },
            { id: 'sample5', title: 'Vue.js Guide', author: 'Frontend Pro', views: '980K views', duration: 2800 },
            {
                id: 'sample6',
                title: 'Python Data Science',
                author: 'Data Academy',
                views: '1.5M views',
                duration: 4200,
            },
        ];
    }

    show() {
        this.el().style.display = 'flex';
    }

    hide() {
        this.el().style.display = 'none';
    }
}

// Register the component
videojs.registerComponent('EndScreenOverlay', EndScreenOverlay);

export default EndScreenOverlay;
