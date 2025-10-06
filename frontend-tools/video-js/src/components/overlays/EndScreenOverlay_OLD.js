import videojs from 'video.js';
import './EndScreenOverlay.css';

const Component = videojs.getComponent('Component');

class EndScreenOverlay extends Component {
    constructor(player, options) {
        // Store relatedVideos in options before calling super
        // so it's available during createEl()
        if (options && options.relatedVideos) {
            options._relatedVideos = options.relatedVideos;
        }

        super(player, options);

        // Now set the instance property after super() completes
        this.relatedVideos = options && options.relatedVideos ? options.relatedVideos : [];
    }

    createEl() {
        // Get relatedVideos from options since createEl is called during super()
        const relatedVideos = this.options_ && this.options_._relatedVideos ? this.options_._relatedVideos : [];

        // Limit videos based on screen size to fit grid properly
        const maxVideos = this.getMaxVideosForScreen();
        const videosToShow = relatedVideos.slice(0, maxVideos);

        // Determine if player is small and add appropriate class
        const playerEl = this.player().el();
        const playerWidth = playerEl ? playerEl.offsetWidth : window.innerWidth;
        const playerHeight = playerEl ? playerEl.offsetHeight : window.innerHeight;
        const isSmallPlayer = playerHeight <= 500 || playerWidth <= 600;
        const isVerySmallPlayer = playerHeight <= 400 || playerWidth <= 400;

        let overlayClasses = 'vjs-end-screen-overlay';
        if (isVerySmallPlayer) {
            overlayClasses += ' vjs-very-small-player vjs-small-player';
        } else if (isSmallPlayer) {
            overlayClasses += ' vjs-small-player';
        }

        const overlay = super.createEl('div', {
            className: overlayClasses,
        });

        // Create grid container
        const grid = videojs.dom.createEl('div', {
            className: 'vjs-related-videos-grid',
        });

        // Create video items
        if (videosToShow && Array.isArray(videosToShow) && videosToShow.length > 0) {
            videosToShow.forEach((video) => {
                const videoItem = this.createVideoItem(video);
                grid.appendChild(videoItem);
            });
        } else {
            // Create sample videos for testing if no related videos provided
            const sampleVideos = this.createSampleVideos();
            sampleVideos.slice(0, this.getMaxVideosForScreen()).forEach((video) => {
                const videoItem = this.createVideoItem(video);
                grid.appendChild(videoItem);
            });
        }

        overlay.appendChild(grid);

        return overlay;
    }

    createVideoItem(video) {
        // Detect touch device
        const isTouchDevice = this.isTouchDevice();

        const item = videojs.dom.createEl('div', {
            className: isTouchDevice ? 'vjs-related-video-item vjs-touch-device' : 'vjs-related-video-item',
        });

        // Use real YouTube thumbnail or fallback to placeholder
        const thumbnailSrc = video.thumbnail || this.getPlaceholderImage(video.title);

        const thumbnail = videojs.dom.createEl('img', {
            className: 'vjs-related-video-thumbnail',
            src: thumbnailSrc,
            alt: video.title,
            loading: 'lazy', // Lazy load for better performance
            onerror: () => {
                // Fallback to placeholder if image fails to load
                thumbnail.src = this.getPlaceholderImage(video.title);
            },
        });

        const overlay = videojs.dom.createEl('div', {
            className: 'vjs-related-video-overlay',
        });

        const title = videojs.dom.createEl('div', {
            className: 'vjs-related-video-title',
        });
        title.textContent = video.title;

        // Create meta container for author and views
        const meta = videojs.dom.createEl('div', {
            className: 'vjs-related-video-meta',
        });

        const author = videojs.dom.createEl('div', {
            className: 'vjs-related-video-author',
        });
        author.textContent = video.author;

        const views = videojs.dom.createEl('div', {
            className: 'vjs-related-video-views',
        });
        views.textContent = video.views;

        // Add author and views to meta container
        meta.appendChild(author);
        meta.appendChild(views);

        // Add duration display (positioned absolutely in bottom right)
        const duration = videojs.dom.createEl('div', {
            className: 'vjs-related-video-duration',
        });

        // Format duration from seconds to MM:SS
        const formatDuration = (seconds) => {
            if (!seconds || seconds === 0) return '';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        duration.textContent = formatDuration(video.duration);

        // Structure: title at top, meta at bottom
        overlay.appendChild(title);
        overlay.appendChild(meta);

        item.appendChild(thumbnail);
        item.appendChild(overlay);

        // Add duration to the item (positioned absolutely)
        if (video.duration && video.duration > 0) {
            item.appendChild(duration);
        }

        // Add click handler
        item.addEventListener('click', () => {
            // Check if this is an embed player - use multiple methods for reliability
            const playerId = this.player().id() || this.player().options_.id;
            const isEmbedPlayer =
                playerId === 'video-embed' ||
                window.location.pathname.includes('/embed') ||
                window.location.search.includes('embed') ||
                window.parent !== window; // Most reliable check for iframe

            if (isEmbedPlayer) {
                // Open in new tab/window for embed players
                window.open(`/view?m=${video.id}`, '_blank', 'noopener,noreferrer');
            } else {
                // Navigate in same window for regular players
                window.location.href = `/view?m=${video.id}`;
            }
        });

        return item;
    }

    getPlaceholderImage(title) {
        // Generate a placeholder image using a service or create a data URL
        // For now, we'll use a simple colored placeholder based on the title
        const colors = [
            '#009931',
            '#4ECDC4',
            '#45B7D1',
            '#96CEB4',
            '#FFEAA7',
            '#DDA0DD',
            '#98D8C8',
            '#F7DC6F',
            '#BB8FCE',
            '#85C1E9',
        ];

        // Use title hash to consistently assign colors
        let hash = 0;
        for (let i = 0; i < title.length; i++) {
            hash = title.charCodeAt(i) + ((hash << 5) - hash);
        }
        const colorIndex = Math.abs(hash) % colors.length;
        const color = colors[colorIndex];

        // Create a simple placeholder with the first letter of the title
        const firstLetter = title.charAt(0).toUpperCase();

        // Create a data URL for a simple placeholder image
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 320, 180);

        // Add a subtle pattern
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        for (let i = 0; i < 20; i++) {
            ctx.fillRect(Math.random() * 320, Math.random() * 180, 2, 2);
        }

        // Add the first letter
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(firstLetter, 160, 90);

        return canvas.toDataURL();
    }

    getMaxVideosForScreen() {
        // Get actual player dimensions instead of window dimensions
        const playerEl = this.player().el();
        const playerWidth = playerEl ? playerEl.offsetWidth : window.innerWidth;
        const playerHeight = playerEl ? playerEl.offsetHeight : window.innerHeight;

        // Check if this is an embed player
        const playerId = this.player().id() || this.player().options_.id;
        const isEmbedPlayer =
            playerId === 'video-embed' ||
            document.getElementById('page-embed') ||
            window.location.pathname.includes('embed');

        // For small player sizes, limit to 2 items for better readability
        // This works for both embed and regular players when they're small
        if (playerHeight <= 500 || playerWidth <= 600) {
            return 2; // 2x1 grid for small player sizes
        }

        // Use player width for responsive decisions
        if (playerWidth >= 1200) {
            return 12; // 4x3 grid for large player
        } else if (playerWidth >= 1024) {
            return 9; // 3x3 grid for desktop-sized player
        } else if (playerWidth >= 768) {
            return 6; // 3x2 grid for tablet-sized player
        } else {
            return 4; // 2x2 grid for mobile-sized player
        }
    }

    createSampleVideos() {
        return [
            {
                id: 'sample1',
                title: 'React Full Course for Beginners',
                author: 'Bro Code',
                views: '2.1M views',
                duration: 1800,
                thumbnail: 'https://img.youtube.com/vi/dGcsHMXbSOA/maxresdefault.jpg',
            },
            {
                id: 'sample2',
                title: 'JavaScript ES6+ Features',
                author: 'Tech Tutorials',
                views: '850K views',
                duration: 1200,
                thumbnail: 'https://img.youtube.com/vi/WZQc7RUAg18/maxresdefault.jpg',
            },
            {
                id: 'sample3',
                title: 'CSS Grid Layout Masterclass',
                author: 'Web Dev Academy',
                views: '1.2M views',
                duration: 2400,
                thumbnail: 'https://img.youtube.com/vi/0xMQfnTU6oo/maxresdefault.jpg',
            },
            {
                id: 'sample4',
                title: 'Node.js Backend Development',
                author: 'Code Master',
                views: '650K views',
                duration: 3600,
                thumbnail: 'https://img.youtube.com/vi/fBNz6F-Cowg/maxresdefault.jpg',
            },
            {
                id: 'sample5',
                title: 'Vue.js Complete Guide',
                author: 'Frontend Pro',
                views: '980K views',
                duration: 2800,
                thumbnail: 'https://img.youtube.com/vi/qZXt1Aom3Cs/maxresdefault.jpg',
            },
            {
                id: 'sample6',
                title: 'Python Data Science',
                author: 'Data Academy',
                views: '1.5M views',
                duration: 4200,
                thumbnail: 'https://img.youtube.com/vi/ua-CiDNNj30/maxresdefault.jpg',
            },
            {
                id: 'sample7',
                title: 'TypeScript Fundamentals',
                author: 'TypeScript Expert',
                views: '720K views',
                duration: 2100,
                thumbnail: 'https://img.youtube.com/vi/BwuLxPH8IDs/maxresdefault.jpg',
            },
            {
                id: 'sample8',
                title: 'MongoDB Database Tutorial',
                author: 'Database Pro',
                views: '890K views',
                duration: 1800,
                thumbnail: 'https://img.youtube.com/vi/-56x56UppqQ/maxresdefault.jpg',
            },
            {
                id: 'sample9',
                title: 'Docker Containerization',
                author: 'DevOps Master',
                views: '1.1M views',
                duration: 3200,
                thumbnail: 'https://img.youtube.com/vi/pTFZFxd4hOI/maxresdefault.jpg',
            },
            {
                id: 'sample10',
                title: 'AWS Cloud Services',
                author: 'Cloud Expert',
                views: '1.3M views',
                duration: 4500,
                thumbnail: 'https://img.youtube.com/vi/ITcXLS3h2qU/maxresdefault.jpg',
            },
            {
                id: 'sample11',
                title: 'GraphQL API Design',
                author: 'API Specialist',
                views: '680K views',
                duration: 2600,
                thumbnail: 'https://img.youtube.com/vi/ed8SzALpx1Q/maxresdefault.jpg',
            },
            {
                id: 'sample12',
                title: 'Machine Learning Basics',
                author: 'AI Academy',
                views: '2.3M views',
                duration: 5400,
                thumbnail: 'https://img.youtube.com/vi/i_LwzRVP7bg/maxresdefault.jpg',
            },
        ];
    }

    isTouchDevice() {
        // Multiple methods to detect touch devices
        return (
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            navigator.msMaxTouchPoints > 0 ||
            window.matchMedia('(pointer: coarse)').matches
        );
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
