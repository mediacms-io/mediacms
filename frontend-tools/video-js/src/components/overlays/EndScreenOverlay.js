import videojs from 'video.js';
import './EndScreenOverlay.css';
const Component = videojs.getComponent('Component');

class EndScreenOverlay extends Component {
    constructor(player, options) {
        super(player, options);
        // Safely initialize relatedVideos with multiple fallbacks
        this.relatedVideos = options?.relatedVideos || options?._relatedVideos || this.options_?.relatedVideos || [];
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

        // Position overlay above control bar with solid black background
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '60px'; // Leave space for control bar
        overlay.style.display = 'none'; // Hidden by default
        overlay.style.backgroundColor = '#000000'; // Solid black background
        overlay.style.zIndex = '100';
        overlay.style.overflow = 'hidden';
        overlay.style.boxSizing = 'border-box';

        // Create responsive grid
        const grid = this.createGrid();
        overlay.appendChild(grid);

        return overlay;
    }

    createGrid() {
        const { columns, maxVideos, useSwiper } = this.getGridConfig();

        // Get videos to show - access directly from options during createEl
        const relatedVideos = this.options_?.relatedVideos || this.relatedVideos || [];
        const videosToShow =
            relatedVideos.length > 0
                ? relatedVideos.slice(0, maxVideos)
                : this.createSampleVideos().slice(0, maxVideos);

        if (useSwiper) {
            return this.createSwiperGrid(videosToShow);
        } else {
            return this.createRegularGrid(columns, videosToShow);
        }
    }

    createRegularGrid(columns, videosToShow) {
        const grid = videojs.dom.createEl('div', {
            className: 'vjs-related-videos-grid',
        });

        // Responsive grid styling with consistent dimensions
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
        grid.style.gap = '12px';
        grid.style.padding = '20px';
        grid.style.height = '100%';
        grid.style.overflowY = 'auto';
        grid.style.alignContent = 'start';
        grid.style.justifyItems = 'stretch';

        // Create video items with consistent dimensions
        videosToShow.forEach((video) => {
            const videoItem = this.createVideoItem(video);
            grid.appendChild(videoItem);
        });

        return grid;
    }

    createSwiperGrid(videosToShow) {
        const container = videojs.dom.createEl('div', {
            className: 'vjs-related-videos-swiper-container',
        });

        // Container styling - ensure it stays within bounds
        container.style.position = 'relative';
        container.style.padding = '20px';
        container.style.height = '100%';
        container.style.width = '100%';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.overflow = 'hidden'; // Prevent container overflow
        container.style.boxSizing = 'border-box';

        // Create swiper wrapper with proper containment
        const swiperWrapper = videojs.dom.createEl('div', {
            className: 'vjs-related-videos-swiper',
        });

        swiperWrapper.style.display = 'flex';
        swiperWrapper.style.overflowX = 'auto';
        swiperWrapper.style.overflowY = 'hidden';
        swiperWrapper.style.gap = '12px';
        swiperWrapper.style.paddingBottom = '10px';
        swiperWrapper.style.scrollBehavior = 'smooth';
        swiperWrapper.style.scrollSnapType = 'x mandatory';
        swiperWrapper.style.width = '100%';
        swiperWrapper.style.maxWidth = '100%';
        swiperWrapper.style.boxSizing = 'border-box';

        // Hide scrollbar and prevent scroll propagation
        swiperWrapper.style.scrollbarWidth = 'none'; // Firefox
        swiperWrapper.style.msOverflowStyle = 'none'; // IE/Edge

        // Prevent scroll events from bubbling up to parent
        swiperWrapper.addEventListener(
            'wheel',
            (e) => {
                e.stopPropagation();
                // Only prevent default if we're actually scrolling horizontally
                const isScrollingHorizontally = Math.abs(e.deltaX) > Math.abs(e.deltaY);
                if (isScrollingHorizontally) {
                    e.preventDefault();
                    swiperWrapper.scrollLeft += e.deltaX;
                }
            },
            { passive: false }
        );

        // Prevent touch events from affecting parent
        swiperWrapper.addEventListener(
            'touchstart',
            (e) => {
                e.stopPropagation();
            },
            { passive: true }
        );

        swiperWrapper.addEventListener(
            'touchmove',
            (e) => {
                e.stopPropagation();
            },
            { passive: true }
        );

        // Create video items for swiper (show 2 at a time, but allow scrolling through all)
        videosToShow.forEach((video) => {
            const videoItem = this.createVideoItem(video, true); // Pass true for swiper mode
            swiperWrapper.appendChild(videoItem);
        });

        container.appendChild(swiperWrapper);

        // Add navigation indicators if there are more than 2 videos
        if (videosToShow.length > 2) {
            const indicators = this.createSwiperIndicators(videosToShow.length, swiperWrapper);
            container.appendChild(indicators);
        }

        return container;
    }

    getGridConfig() {
        const playerEl = this.player().el();
        const playerWidth = playerEl?.offsetWidth || window.innerWidth;
        const playerHeight = playerEl?.offsetHeight || window.innerHeight;

        // Calculate available space for better utilization
        const availableHeight = playerHeight - 140; // Account for controls and padding
        const cardHeight = 180; // Consistent card height
        const maxRows = Math.max(2, Math.floor(availableHeight / cardHeight));

        // Enhanced grid configuration to fill large screens better
        if (playerWidth >= 1600) {
            const columns = 5;
            return { columns, maxVideos: columns * Math.min(maxRows, 3), useSwiper: false }; // 5 columns, up to 3 rows
        } else if (playerWidth >= 1200) {
            const columns = 4;
            return { columns, maxVideos: columns * Math.min(maxRows, 3), useSwiper: false }; // 4 columns, up to 3 rows
        } else if (playerWidth >= 900) {
            const columns = 3;
            return { columns, maxVideos: columns * Math.min(maxRows, 2), useSwiper: false }; // 3 columns, up to 2 rows
        } else if (playerWidth >= 600) {
            return { columns: 2, maxVideos: 4, useSwiper: false }; // 2x2 grid for medium screens
        } else {
            return { columns: 2, maxVideos: 6, useSwiper: true }; // Use swiper for small screens
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

    createVideoItem(video, isSwiperMode = false) {
        const item = videojs.dom.createEl('div', {
            className: `vjs-related-video-item ${isSwiperMode ? 'vjs-swiper-item' : ''}`,
        });

        // Consistent item styling with fixed dimensions
        item.style.position = 'relative';
        item.style.backgroundColor = '#1a1a1a';
        item.style.borderRadius = '6px';
        item.style.overflow = 'hidden';
        item.style.cursor = 'pointer';
        item.style.transition = 'transform 0.15s ease, box-shadow 0.15s ease';
        item.style.display = 'flex';
        item.style.flexDirection = 'column';

        // Consistent dimensions for all cards
        if (isSwiperMode) {
            // Calculate proper width for swiper items (2 items visible + gap)
            item.style.minWidth = 'calc(50% - 6px)'; // 50% width minus half the gap
            item.style.width = 'calc(50% - 6px)';
            item.style.maxWidth = '180px'; // Maximum width for larger screens
            item.style.height = '220px'; // Increased height for better content display
            item.style.minHeight = '220px';
            item.style.flexShrink = '0';
            item.style.scrollSnapAlign = 'start';
        } else {
            item.style.height = '180px';
            item.style.minHeight = '180px';
            item.style.width = '100%';
        }

        // Subtle hover/touch effects
        if (this.isTouchDevice) {
            item.style.touchAction = 'manipulation';
        } else {
            item.addEventListener('mouseenter', () => {
                item.style.transform = 'translateY(-2px)';
                item.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.transform = 'translateY(0)';
                item.style.boxShadow = 'none';
            });
        }

        // Create thumbnail container
        const thumbnailContainer = this.createThumbnailContainer(video, isSwiperMode);
        item.appendChild(thumbnailContainer);

        // Create simplified info section
        const info = this.createVideoInfo(video, isSwiperMode);
        item.appendChild(info);

        // Add click handler
        this.addClickHandler(item, video);

        return item;
    }

    createThumbnailContainer(video, isSwiperMode = false) {
        const container = videojs.dom.createEl('div', {
            className: 'vjs-related-video-thumbnail-container',
        });

        // Container styling with consistent height
        container.style.position = 'relative';
        container.style.width = '100%';
        container.style.height = isSwiperMode ? '100px' : '110px'; // Slightly taller for regular grid
        container.style.overflow = 'hidden';
        container.style.flexShrink = '0';

        const thumbnail = videojs.dom.createEl('img', {
            className: 'vjs-related-video-thumbnail',
            src: video.thumbnail || this.getPlaceholderImage(video.title),
            alt: video.title,
        });

        // Thumbnail styling
        thumbnail.style.width = '100%';
        thumbnail.style.height = '100%';
        thumbnail.style.objectFit = 'cover';
        thumbnail.style.display = 'block';

        container.appendChild(thumbnail);

        // Add duration badge at bottom right of thumbnail
        if (video.duration && video.duration > 0) {
            const duration = videojs.dom.createEl('div', {
                className: 'vjs-video-duration',
            });
            duration.textContent = this.formatDuration(video.duration);
            duration.style.position = 'absolute';
            duration.style.bottom = '4px';
            duration.style.right = '4px';
            duration.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
            duration.style.color = 'white';
            duration.style.padding = '2px 6px';
            duration.style.borderRadius = '3px';
            duration.style.fontSize = isSwiperMode ? '10px' : '11px';
            duration.style.fontWeight = '600';
            duration.style.lineHeight = '1';
            duration.style.zIndex = '2';

            container.appendChild(duration);
        }

        return container;
    }

    createVideoInfo(video, isSwiperMode = false) {
        const info = videojs.dom.createEl('div', {
            className: 'vjs-related-video-info',
        });

        // Consistent info styling with increased height for swiper mode
        const padding = isSwiperMode ? '10px' : '10px';
        const infoHeight = isSwiperMode ? '110px' : '70px'; // Increased height for swiper mode

        info.style.padding = padding;
        info.style.color = 'white';
        info.style.flex = '1';
        info.style.display = 'flex';
        info.style.flexDirection = 'column';
        info.style.justifyContent = 'flex-start'; // Align content to top
        info.style.height = infoHeight;
        info.style.minHeight = infoHeight;

        // Title with responsive text handling
        const title = videojs.dom.createEl('div', {
            className: 'vjs-related-video-title',
        });
        title.textContent = video.title;
        title.style.fontSize = isSwiperMode ? '13px' : '13px'; // Slightly larger font for better readability
        title.style.fontWeight = '600';
        title.style.lineHeight = '1.3';
        title.style.overflow = 'hidden';
        title.style.textOverflow = 'ellipsis';
        title.style.display = '-webkit-box';
        title.style.webkitLineClamp = isSwiperMode ? '3' : '2'; // Allow 3 lines for swiper mode
        title.style.webkitBoxOrient = 'vertical';
        title.style.marginBottom = isSwiperMode ? '8px' : '4px';
        title.style.color = '#ffffff';

        // Meta information - always show for swiper mode
        const meta = videojs.dom.createEl('div', {
            className: 'vjs-related-video-meta',
        });

        // Format meta text more cleanly - ensure both author and views are shown
        let metaText = '';
        if (video.author && video.views) {
            metaText = `${video.author} • ${video.views}`;
        } else if (video.author) {
            metaText = video.author;
        } else if (video.views) {
            metaText = video.views;
        } else {
            // Fallback for sample data
            metaText = 'Unknown • No views';
        }

        meta.textContent = metaText;
        meta.style.fontSize = isSwiperMode ? '11px' : '11px'; // Slightly larger font for better readability
        meta.style.color = '#b3b3b3';
        meta.style.overflow = 'hidden';
        meta.style.textOverflow = 'ellipsis';
        meta.style.whiteSpace = 'nowrap';
        meta.style.flexShrink = '0';
        meta.style.lineHeight = '1.3';
        meta.style.marginTop = isSwiperMode ? '4px' : '0px'; // Add some spacing

        info.appendChild(title);
        info.appendChild(meta); // Always append meta for consistent layout

        return info;
    }

    createSwiperIndicators(totalVideos, swiperWrapper) {
        const indicators = videojs.dom.createEl('div', {
            className: 'vjs-swiper-indicators',
        });

        indicators.style.display = 'flex';
        indicators.style.justifyContent = 'center';
        indicators.style.gap = '8px';
        indicators.style.marginTop = '10px';

        const itemsPerView = 2;
        const totalPages = Math.ceil(totalVideos / itemsPerView);

        for (let i = 0; i < totalPages; i++) {
            const dot = videojs.dom.createEl('div', {
                className: 'vjs-swiper-dot',
            });

            dot.style.width = '8px';
            dot.style.height = '8px';
            dot.style.borderRadius = '50%';
            dot.style.backgroundColor = i === 0 ? '#ffffff' : 'rgba(255, 255, 255, 0.4)';
            dot.style.cursor = 'pointer';
            dot.style.transition = 'background-color 0.2s ease';

            dot.addEventListener('click', () => {
                // Calculate scroll position based on container width
                const containerWidth = swiperWrapper.offsetWidth;
                const scrollPosition = i * containerWidth; // Scroll by full container width
                swiperWrapper.scrollTo({ left: scrollPosition, behavior: 'smooth' });

                // Update active dot
                indicators.querySelectorAll('.vjs-swiper-dot').forEach((d, index) => {
                    d.style.backgroundColor = index === i ? '#ffffff' : 'rgba(255, 255, 255, 0.4)';
                });
            });

            indicators.appendChild(dot);
        }

        // Update active dot on scroll
        swiperWrapper.addEventListener('scroll', () => {
            const scrollLeft = swiperWrapper.scrollLeft;
            const containerWidth = swiperWrapper.offsetWidth;
            const currentPage = Math.round(scrollLeft / containerWidth);

            indicators.querySelectorAll('.vjs-swiper-dot').forEach((dot, index) => {
                dot.style.backgroundColor = index === currentPage ? '#ffffff' : 'rgba(255, 255, 255, 0.4)';
            });
        });

        return indicators;
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
            {
                id: 'sample1',
                title: 'React Full Course - Complete Tutorial for Beginners',
                author: 'Bro Code',
                views: '2.1M views',
                duration: 1800,
            },
            {
                id: 'sample2',
                title: 'JavaScript ES6+ Modern Features',
                author: 'Tech Tutorials',
                views: '850K views',
                duration: 1200,
            },
            {
                id: 'sample3',
                title: 'CSS Grid Layout Masterclass',
                author: 'Web Dev Academy',
                views: '1.2M views',
                duration: 2400,
            },
            {
                id: 'sample4',
                title: 'Node.js Backend Development',
                author: 'Code Master',
                views: '650K views',
                duration: 3600,
            },
            {
                id: 'sample5',
                title: 'Vue.js Complete Guide',
                author: 'Frontend Pro',
                views: '980K views',
                duration: 2800,
            },
            {
                id: 'sample6',
                title: 'Python Data Science Bootcamp',
                author: 'Data Academy',
                views: '1.5M views',
                duration: 4200,
            },
            {
                id: 'sample7',
                title: 'TypeScript for Beginners',
                author: 'Code School',
                views: '750K views',
                duration: 1950,
            },
            {
                id: 'sample8',
                title: 'Docker Container Tutorial',
                author: 'DevOps Pro',
                views: '920K views',
                duration: 2700,
            },
            {
                id: 'sample9',
                title: 'MongoDB Database Design',
                author: 'DB Expert',
                views: '580K views',
                duration: 3200,
            },
            {
                id: 'sample10',
                title: 'AWS Cloud Computing',
                author: 'Cloud Master',
                views: '1.8M views',
                duration: 4800,
            },
            {
                id: 'sample11',
                title: 'GraphQL API Development',
                author: 'API Guru',
                views: '420K views',
                duration: 2100,
            },
            {
                id: 'sample12',
                title: 'Kubernetes Orchestration',
                author: 'Container Pro',
                views: '680K views',
                duration: 3900,
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
