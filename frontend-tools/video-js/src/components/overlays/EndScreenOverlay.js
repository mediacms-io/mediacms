import videojs from 'video.js';

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

        // console.log(
        //     'EndScreenOverlay created with',
        //     this.relatedVideos.length,
        //     'related videos'
        // );
    }

    createEl() {
        // Get relatedVideos from options since createEl is called during super()
        const relatedVideos = this.options_ && this.options_._relatedVideos ? this.options_._relatedVideos : [];

        // Limit items based on screen size
        const isMobile = window.innerWidth <= 768;
        const maxItems = isMobile ? 6 : 12;
        const videosToShow = relatedVideos.slice(0, maxItems);

        // console.log(
        //     'Creating end screen with',
        //     videosToShow.length,
        //     'related videos'
        // );

        const overlay = super.createEl('div', {
            className: 'vjs-end-screen-overlay',
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
            // Fallback message if no related videos
            const noVideos = videojs.dom.createEl('div', {
                className: 'vjs-no-related-videos',
            });
            noVideos.textContent = 'No related videos available';
            noVideos.style.color = 'white';
            noVideos.style.textAlign = 'center';
            grid.appendChild(noVideos);
        }

        overlay.appendChild(grid);

        return overlay;
    }

    createVideoItem(video) {
        const item = videojs.dom.createEl('div', {
            className: 'vjs-related-video-item',
        });

        const thumbnail = videojs.dom.createEl('img', {
            className: 'vjs-related-video-thumbnail',
            src: video.thumbnail,
            alt: video.title,
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
            window.location.href = `/view?m=${video.id}`;
        });

        return item;
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
