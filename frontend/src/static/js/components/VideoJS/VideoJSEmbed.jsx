import React, { useEffect, useRef } from 'react';

/**
 * VideoJSEmbed - A React component that embeds the MediaCMS video js
 *
 * This component dynamically loads the video js's CSS and JS files,
 * then creates the required DOM element for the video js to mount to.
 *
 * Usage:
 * <VideoJSEmbed
 *   data={}
 *   siteUrl="http://localhost"
 * />
 */

const VideoJSEmbed = ({
    data,
    playerVolume,
    playerSoundMuted,
    videoQuality,
    videoPlaybackSpeed,
    inTheaterMode,
    siteId,
    siteUrl,
    info,
    cornerLayers,
    sources,
    poster,
    previewSprite,
    subtitlesInfo,
    enableAutoplay,
    inEmbed,
    hasTheaterMode,
    hasNextLink,
    hasPreviousLink,
    errorMessage,
    onClickNextCallback,
    onClickPreviousCallback,
    onStateUpdateCallback,
    onPlayerInitCallback,
}) => {
    const containerRef = useRef(null);
    const assetsLoadedRef = useRef(false);

    useEffect(() => {
        // Set the global MEDIA_DATA that the video js expects
        if (typeof window !== 'undefined') {
            window.MEDIA_DATA = {
                data: data || {}, // TODO: Check if this is needed
                playerVolume: playerVolume || 0.5,
                playerSoundMuted: playerSoundMuted || false,
                videoQuality: videoQuality || 'auto',
                videoPlaybackSpeed: videoPlaybackSpeed || 1,
                inTheaterMode: inTheaterMode || false,
                siteId: siteId || '',
                siteUrl: siteUrl || '',
                info: info || {},
                cornerLayers: cornerLayers || [],
                sources: sources || [],
                poster: poster || '',
                previewSprite: previewSprite || null,
                subtitlesInfo: subtitlesInfo || [],
                enableAutoplay: enableAutoplay || false,
                inEmbed: inEmbed || false,
                hasTheaterMode: hasTheaterMode || false,
                hasNextLink: hasNextLink || false,
                hasPreviousLink: hasPreviousLink || false,
                errorMessage: errorMessage || '',
                onClickNextCallback: onClickNextCallback || null,
                onClickPreviousCallback: onClickPreviousCallback || null,
                onStateUpdateCallback: onStateUpdateCallback || null,
                onPlayerInitCallback: onPlayerInitCallback || null,
            };
        }

        // Load assets only once
        if (!assetsLoadedRef.current) {
            loadVideoJSAssets();
            assetsLoadedRef.current = true;
        }
    }, [data, siteUrl]);

    const loadVideoJSAssets = () => {
        // Check if assets are already loaded
        const existingCSS = document.querySelector('link[href*="video-js.css"]');
        const existingJS = document.querySelector('script[src*="video-js.js"]');

        // Load CSS if not already loaded
        if (!existingCSS) {
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = siteUrl + '/static/video_js/video-js.css';
            document.head.appendChild(cssLink);
        }

        // Load JS if not already loaded
        if (!existingJS) {
            const script = document.createElement('script');
            script.src = siteUrl + '/static/video_js/video-js.js';
            document.head.appendChild(script);
        }
    };

    return (
        <div className="video-js-wrapper" ref={containerRef}>
            <div id="video-js-root" />
        </div>
    );
};

VideoJSEmbed.defaultProps = {
    data: {},
    siteUrl: '',
};

export default VideoJSEmbed;
