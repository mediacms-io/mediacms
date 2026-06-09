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
        const { columns, maxVideos, useSwiper, itemsPerView, gridRows } = this.getGridConfig();

        // Get videos to show - access directly from options during createEl
        const relatedVideos = this.options_?.relatedVideos || this.relatedVideos || [];
        const videosToShow = relatedVideos.slice(0, maxVideos);

        if (useSwiper) {
            return this.createSwiperGrid(videosToShow, itemsPerView || 2, columns, gridRows || 1);
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
        grid.style.width = '100%';
        grid.style.height = '100%';
        grid.style.overflowY = 'auto';
        grid.style.alignContent = 'flex-start';
        grid.style.justifyItems = 'stretch';
        grid.style.justifyContent = 'stretch';
        grid.style.gridAutoRows = '120px';
        grid.style.boxSizing = 'border-box';

        console.log('Creating grid with', columns, 'columns and', videosToShow.length, 'videos');

        // Create video items with consistent dimensions
        videosToShow.forEach((video) => {
            const videoItem = this.createVideoItem(video);
            grid.appendChild(videoItem);
        });

        return grid;
    }

    createSwiperGrid(videosToShow, itemsPerView = 2, columns = 2, gridRows = 1) {
        const container = videojs.dom.createEl('div', {
            className: 'vjs-related-videos-swiper-container',
        });

        // Container styling - ensure it stays within bounds
        container.style.position = 'relative';
        container.style.padding = gridRows > 1 ? '12px' : '20px'; // Minimal padding for 2x2 grid
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

        if (gridRows > 1) {
            // Multi-row grid layout (e.g., 2x2 for landscape)
            swiperWrapper.style.display = 'flex';
            swiperWrapper.style.overflowX = 'auto';
            swiperWrapper.style.overflowY = 'hidden';
            swiperWrapper.style.scrollBehavior = 'smooth';
            swiperWrapper.style.scrollSnapType = 'x mandatory';
            swiperWrapper.style.width = '100%';
            swiperWrapper.style.maxWidth = '100%';
            swiperWrapper.style.height = '100%';
            swiperWrapper.style.flex = '1';
            swiperWrapper.style.boxSizing = 'border-box';
            swiperWrapper.style.gap = '0'; // Remove gap, we'll handle it in pages
        } else {
            // Single row layout (original swiper)
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
        }

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

        if (gridRows > 1) {
            // Create pages with grid layout (e.g., 2x2 grid per page)
            const itemsPerPage = itemsPerView;
            const totalPages = Math.ceil(videosToShow.length / itemsPerPage);

            for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
                const page = videojs.dom.createEl('div', {
                    className: 'vjs-swiper-page',
                });

                page.style.minWidth = '100%';
                page.style.width = '100%';
                page.style.height = '100%';
                page.style.display = 'grid';
                page.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
                page.style.gridTemplateRows = `repeat(${gridRows}, 1fr)`;
                page.style.gap = '12px'; // Increased gap for better spacing
                page.style.scrollSnapAlign = 'start';
                page.style.boxSizing = 'border-box';
                page.style.alignContent = 'stretch';
                page.style.justifyContent = 'stretch';
                page.style.alignItems = 'stretch';
                page.style.justifyItems = 'stretch';

                // Get videos for this page
                const startIndex = pageIndex * itemsPerPage;
                const endIndex = Math.min(startIndex + itemsPerPage, videosToShow.length);
                const pageVideos = videosToShow.slice(startIndex, endIndex);

                // Create video items for this page
                pageVideos.forEach((video) => {
                    const videoItem = this.createVideoItem(video, true, itemsPerView, true); // Pass true for grid mode
                    page.appendChild(videoItem);
                });

                swiperWrapper.appendChild(page);
            }
        } else {
            // Single row - create video items directly
            videosToShow.forEach((video) => {
                const videoItem = this.createVideoItem(video, true, itemsPerView, false);
                swiperWrapper.appendChild(videoItem);
            });
        }

        container.appendChild(swiperWrapper);

        // Add navigation indicators if there are more videos than can fit in one view
        if (videosToShow.length > itemsPerView) {
            const indicators = this.createSwiperIndicators(videosToShow.length, swiperWrapper, itemsPerView);
            container.appendChild(indicators);
        }

        return container;
    }

    getGridConfig() {
        const playerEl = this.player().el();
        const playerWidth = playerEl?.offsetWidth || window.innerWidth;
        const playerHeight = playerEl?.offsetHeight || window.innerHeight;

        // Calculate available space more accurately
        const controlBarHeight = 60;
        const padding = 40; // Total padding (20px top + 20px bottom)
        const availableHeight = playerHeight - controlBarHeight - padding;
        const cardHeight = 120; // Compact card height with text overlay
        const gap = 12; // Gap between items

        // Calculate maximum rows that can fit - be more aggressive
        const maxRows = Math.max(2, Math.floor((availableHeight + gap) / (cardHeight + gap)));

        // Detect landscape orientation on mobile
        // Check screen/window orientation first, then player dimensions
        const screenWidth = window.innerWidth || document.documentElement.clientWidth;
        const screenHeight = window.innerHeight || document.documentElement.clientHeight;
        const isScreenLandscape = screenWidth > screenHeight;

        const isLandscape = playerWidth > playerHeight;

        // Detect mobile/touch devices - should always show swiper
        // Check both width and touch capability for better detection
        const isTouchDevice = this.isTouchDevice;
        const isSmallScreen = screenWidth < 700 || playerWidth < 700;
        const isMobileOrTouch = isTouchDevice || isSmallScreen;

        // For mobile, prioritize screen orientation over player dimensions
        // Only consider it landscape if BOTH screen and player are in landscape
        const isDefinitelyLandscape = isMobileOrTouch ? isScreenLandscape && isLandscape : isLandscape;

        console.log('Grid Config:', {
            screenWidth,
            screenHeight,
            isScreenLandscape,
            playerWidth,
            playerHeight,
            availableHeight,
            maxRows,
            isLandscape,
            isDefinitelyLandscape,
            isTouchDevice,
            isSmallScreen,
            isMobileOrTouch,
        });

        // Enhanced grid configuration to fill all available space
        // Check mobile/touch conditions first - swiper should ALWAYS be used on mobile/touch devices
        if (isMobileOrTouch && isDefinitelyLandscape) {
            // Mobile/Touch landscape: show 2x2 grid (4 items total) with swiper for pagination
            return { columns: 2, maxVideos: 12, useSwiper: true, itemsPerView: 4, gridRows: 2 };
        } else if (isMobileOrTouch) {
            // Mobile/Touch portrait: show 2 items in single row swiper mode
            return { columns: 2, maxVideos: 12, useSwiper: true, itemsPerView: 2, gridRows: 1 };
        } else if (playerWidth >= 1600) {
            const columns = 5;
            return { columns, maxVideos: columns * maxRows, useSwiper: false }; // Fill all available rows
        } else if (playerWidth >= 1200) {
            const columns = 4;
            return { columns, maxVideos: columns * maxRows, useSwiper: false }; // Fill all available rows
        } else if (playerWidth >= 900) {
            const columns = 3;
            return { columns, maxVideos: columns * maxRows, useSwiper: false }; // Fill all available rows
        } else {
            const columns = 2;
            return { columns, maxVideos: columns * maxRows, useSwiper: false }; // Fill all available rows
        }
    }

    getVideosToShow(maxVideos) {
        // Safely check if relatedVideos exists and has content
        console.log('relatedVideos', this.relatedVideos);
        if (this.relatedVideos && Array.isArray(this.relatedVideos) && this.relatedVideos.length > 0) {
            return this.relatedVideos.slice(0, maxVideos);
        }
        // Return empty array if no related videos
        return [];
    }

    createVideoItem(video, isSwiperMode = false, itemsPerView = 2, isGridMode = false) {
        const item = videojs.dom.createEl('div', {
            className: `vjs-related-video-item ${isSwiperMode ? 'vjs-swiper-item' : ''}`,
        });

        // Consistent item styling with fixed dimensions
        item.style.position = 'relative';
        item.style.backgroundColor = '#1a1a1a';
        item.style.borderRadius = '8px';
        item.style.overflow = 'hidden';
        item.style.cursor = 'pointer';
        item.style.transition = 'transform 0.15s ease, box-shadow 0.15s ease';
        item.style.display = 'flex';
        item.style.flexDirection = 'column';

        // Consistent dimensions for all cards
        if (isGridMode) {
            // Grid mode (2x2): items fill their grid cell completely
            item.style.height = '100%';
            item.style.minHeight = '0';
            item.style.width = '100%';
            item.style.maxWidth = 'none';
            item.style.flex = '1';
        } else if (isSwiperMode) {
            // Single row swiper mode: calculate width based on items per view
            // Formula: (100% / itemsPerView) - (gap * (itemsPerView - 1) / itemsPerView)
            const itemsPerRow = itemsPerView / (itemsPerView === 4 ? 2 : 1); // For 4 items in 2 rows, show 2 per row
            const gapAdjustment = (12 * (itemsPerRow - 1)) / itemsPerRow;
            item.style.minWidth = `calc(${100 / itemsPerRow}% - ${gapAdjustment}px)`;
            item.style.width = `calc(${100 / itemsPerRow}% - ${gapAdjustment}px)`;
            item.style.maxWidth = itemsPerView === 4 ? '150px' : '180px'; // Smaller max width for 4 items

            // Simpler height since text is overlaid on thumbnail
            const cardHeight = '120px'; // Just the thumbnail height

            item.style.height = cardHeight;
            item.style.minHeight = cardHeight;
            item.style.flexShrink = '0';
            item.style.scrollSnapAlign = 'start';
        } else {
            item.style.height = '120px'; // Same compact height for regular grid
            item.style.minHeight = '120px';
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

        // Create thumbnail container with overlaid text
        const thumbnailContainer = this.createThumbnailWithOverlay(video, isSwiperMode, itemsPerView);
        item.appendChild(thumbnailContainer);

        console.log('Created video item with overlay:', item);

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

    createThumbnailWithOverlay(video, isSwiperMode = false, itemsPerView = 2) {
        const container = videojs.dom.createEl('div', {
            className: 'vjs-related-video-thumbnail-container',
        });

        // Container styling - full height since it contains everything
        container.style.position = 'relative';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.minHeight = '120px';
        container.style.overflow = 'hidden';
        container.style.borderRadius = '8px';
        container.style.flex = '1';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';

        // Create thumbnail image
        const thumbnail = videojs.dom.createEl('img', {
            className: 'vjs-related-video-thumbnail',
            src: video.thumbnail || this.getPlaceholderImage(video.title),
            alt: video.title,
        });

        thumbnail.style.width = '100%';
        thumbnail.style.height = '100%';
        thumbnail.style.objectFit = 'cover';
        thumbnail.style.display = 'block';
        thumbnail.style.flex = '1';
        thumbnail.style.minWidth = '0';
        thumbnail.style.minHeight = '0';

        container.appendChild(thumbnail);

        // Add duration badge at bottom right
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
            duration.style.fontSize = itemsPerView === 4 ? '10px' : '11px';
            duration.style.fontWeight = '600';
            duration.style.lineHeight = '1';
            duration.style.zIndex = '3';

            container.appendChild(duration);
        }

        // Create text overlay at top-left
        const textOverlay = videojs.dom.createEl('div', {
            className: 'vjs-video-text-overlay',
        });

        textOverlay.style.position = 'absolute';
        textOverlay.style.top = itemsPerView === 4 ? '6px' : '8px';
        textOverlay.style.left = itemsPerView === 4 ? '6px' : '8px';
        textOverlay.style.right = itemsPerView === 4 ? '6px' : '8px';
        textOverlay.style.background =
            'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)';
        textOverlay.style.padding = itemsPerView === 4 ? '6px' : '8px';
        textOverlay.style.borderRadius = '4px';
        textOverlay.style.zIndex = '2';

        // Create title
        const title = videojs.dom.createEl('div', {
            className: 'vjs-overlay-title',
        });
        title.textContent = video.title || 'Sample Video Title';
        title.style.color = '#ffffff';
        // Adjust font sizes based on items per view
        title.style.fontSize = itemsPerView === 4 ? '11px' : isSwiperMode ? '12px' : '13px';
        title.style.fontWeight = '600';
        title.style.lineHeight = '1.3';
        title.style.marginBottom = itemsPerView === 4 ? '3px' : '4px';
        title.style.overflow = 'hidden';
        title.style.textOverflow = 'ellipsis';
        title.style.display = '-webkit-box';
        title.style.webkitLineClamp = '2';
        title.style.webkitBoxOrient = 'vertical';
        title.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)';

        // Create meta info
        const meta = videojs.dom.createEl('div', {
            className: 'vjs-overlay-meta',
        });

        let metaText = '';
        if (video.author && video.views) {
            metaText = `${video.author} • ${video.views}`;
        } else if (video.author) {
            metaText = video.author;
        } else if (video.views) {
            metaText = video.views;
        } else {
            metaText = 'Unknown • No views';
        }

        meta.textContent = metaText;
        meta.style.color = '#e0e0e0';
        // Adjust font sizes based on items per view
        meta.style.fontSize = itemsPerView === 4 ? '9px' : isSwiperMode ? '10px' : '11px';
        meta.style.lineHeight = '1.2';
        meta.style.overflow = 'hidden';
        meta.style.textOverflow = 'ellipsis';
        meta.style.whiteSpace = 'nowrap';
        meta.style.textShadow = '0 1px 2px rgba(0,0,0,0.8)';

        textOverlay.appendChild(title);
        textOverlay.appendChild(meta);
        container.appendChild(textOverlay);

        console.log('Created thumbnail with overlay:', container);
        console.log('Title:', title.textContent, 'Meta:', meta.textContent);

        return container;
    }

    createVideoInfo(video) {
        const info = videojs.dom.createEl('div', {
            className: 'vjs-related-video-info',
        });

        // Note: Using simplified styling for debugging

        // Force visible info section with simple styling
        info.style.padding = '12px';
        info.style.backgroundColor = 'rgba(26, 26, 26, 0.9)'; // Visible background for debugging
        info.style.color = 'white';
        info.style.display = 'block'; // Use simple block display
        info.style.width = '100%';
        info.style.height = 'auto';
        info.style.minHeight = '80px';
        info.style.position = 'relative';
        info.style.zIndex = '10';

        // Title with responsive text handling
        const title = videojs.dom.createEl('div', {
            className: 'vjs-related-video-title',
        });
        title.textContent = video.title || 'Sample Video Title';
        console.log('Setting title:', video.title, 'for video:', video);

        // Note: Using fixed styling for debugging

        // Simple, guaranteed visible title styling
        title.style.fontSize = '14px';
        title.style.fontWeight = 'bold';
        title.style.lineHeight = '1.4';
        title.style.color = '#ffffff';
        title.style.backgroundColor = 'rgba(255, 0, 0, 0.2)'; // Red background for debugging
        title.style.padding = '4px';
        title.style.marginBottom = '8px';
        title.style.display = 'block';
        title.style.width = '100%';
        title.style.wordWrap = 'break-word';
        title.style.position = 'relative';
        title.style.zIndex = '20';

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

        meta.textContent = metaText || 'Sample Author • 1K views';
        console.log('Setting meta:', metaText, 'for video:', video);

        // Note: Using fixed styling for debugging

        // Simple, guaranteed visible meta styling
        meta.style.fontSize = '12px';
        meta.style.color = '#b3b3b3';
        meta.style.backgroundColor = 'rgba(0, 255, 0, 0.2)'; // Green background for debugging
        meta.style.padding = '4px';
        meta.style.display = 'block';
        meta.style.width = '100%';
        meta.style.position = 'relative';
        meta.style.zIndex = '20';

        info.appendChild(title);
        info.appendChild(meta);

        console.log('Created info section:', info);
        console.log('Title element:', title, 'Text:', title.textContent);
        console.log('Meta element:', meta, 'Text:', meta.textContent);

        return info;
    }

    createSwiperIndicators(totalVideos, swiperWrapper, itemsPerView = 2) {
        const indicators = videojs.dom.createEl('div', {
            className: 'vjs-swiper-indicators',
        });

        indicators.style.display = 'flex';
        indicators.style.justifyContent = 'center';
        indicators.style.gap = '8px';
        indicators.style.marginTop = '10px';

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

    show() {
        // Only show if there are related videos
        const relatedVideos = this.options_?.relatedVideos || this.relatedVideos || [];
        if (relatedVideos.length > 0) {
            this.el().style.display = 'flex';
        }
    }

    hide() {
        this.el().style.display = 'none';
    }
}

// Register the component
videojs.registerComponent('EndScreenOverlay', EndScreenOverlay);

export default EndScreenOverlay;
