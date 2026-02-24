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
    useRoundedCorners,
    version,
    isPlayList,
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
    inEmbed,
    showTitle,
    showRelated,
    showUserAvatar,
    linkTitle,
    hasTheaterMode,
    hasNextLink,
    nextLink,
    hasPreviousLink,
    errorMessage,
    onClickNextCallback,
    onClickPreviousCallback,
    onStateUpdateCallback,
    onPlayerInitCallback,
}) => {
    const containerRef = useRef(null);
    const assetsLoadedRef = useRef(false);
    const playerInstanceRef = useRef(null);
    const inEmbedRef = useRef(inEmbed);

    // Helper function to get URL parameters
    const getUrlParameter = (name) => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    };

    useEffect(() => {
        // Update the ref whenever inEmbed changes
        inEmbedRef.current = inEmbed;
        
        // Set the global MEDIA_DATA that the video js expects
        if (typeof window !== 'undefined') {
            // Get URL parameters for autoplay, muted, and timestamp
            const urlTimestamp = getUrlParameter('t');
            const urlMuted = getUrlParameter('muted');
            const urlShowRelated = getUrlParameter('showRelated');
            const urlShowUserAvatar = getUrlParameter('showUserAvatar');
            const urlLinkTitle = getUrlParameter('linkTitle');
            
            window.MEDIA_DATA = {
                data: data || {}, 
                useRoundedCorners: useRoundedCorners,
                version: version,
                isPlayList: isPlayList,
                playerVolume: playerVolume || 0.5,
                playerSoundMuted: urlMuted === '1',
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
                inEmbed: inEmbed || false,
                showTitle: showTitle || false,
                showRelated: showRelated !== undefined ? showRelated : (urlShowRelated === '1' || urlShowRelated === 'true' || urlShowRelated === null),
                showUserAvatar: showUserAvatar !== undefined ? showUserAvatar : (urlShowUserAvatar === '1' || urlShowUserAvatar === 'true' || urlShowUserAvatar === null),
                linkTitle: linkTitle !== undefined ? linkTitle : (urlLinkTitle === '1' || urlLinkTitle === 'true' || urlLinkTitle === null),
                hasTheaterMode: hasTheaterMode || false,
                hasNextLink: hasNextLink || false,
                nextLink: nextLink || null,
                hasPreviousLink: hasPreviousLink || false,
                errorMessage: errorMessage || '',
                // URL parameters
                urlTimestamp: urlTimestamp ? parseInt(urlTimestamp, 10) : null,
                urlMuted: urlMuted === '1',
                urlShowRelated: urlShowRelated === '1' || urlShowRelated === 'true',
                urlShowUserAvatar: urlShowUserAvatar === '1' || urlShowUserAvatar === 'true',
                urlLinkTitle: urlLinkTitle === '1' || urlLinkTitle === 'true',
                onClickNextCallback: onClickNextCallback || null,
                onClickPreviousCallback: onClickPreviousCallback || null,
                onStateUpdateCallback: onStateUpdateCallback || null,
                onPlayerInitCallback: (instance, elem) => {
                    // Store the player instance for timestamp functionality
                    playerInstanceRef.current = instance;
                    // Call the original callback if provided
                    if (onPlayerInitCallback) {
                        onPlayerInitCallback(instance, elem);
                    }
                },
            };
        }

        // Load assets only once
        if (!assetsLoadedRef.current) {
            loadVideoJSAssets();
            assetsLoadedRef.current = true;
        }
    }, [data, siteUrl, inEmbed]);

    // New effect to manually trigger VideoJS mounting for embed players
    useEffect(() => {
        if (inEmbed && containerRef.current) {
            // Small delay to ensure DOM is fully ready, then trigger VideoJS mounting
            const timer = setTimeout(() => {
                // Try to trigger the VideoJS mount by dispatching a custom event
                const event = new CustomEvent('triggerVideoJSMount', {
                    detail: { targetId: 'video-js-root-embed' }
                });
                document.dispatchEvent(event);
                
                // Also try to trigger by calling the global function if it exists
                if (typeof window !== 'undefined' && window.triggerVideoJSMount) {
                    window.triggerVideoJSMount();
                }
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [inEmbed, containerRef.current]);

    // Set up timestamp click functionality
    useEffect(() => {
        const handleTimestampClick = (e) => {
            if (e.target.classList.contains('video-timestamp')) {
                e.preventDefault();
                const timestamp = parseInt(e.target.dataset.timestamp, 10);

                // Try to get the player from multiple sources
                let player = null;
                
                // First try: from our stored instance
                if (playerInstanceRef.current && playerInstanceRef.current.player) {
                    player = playerInstanceRef.current.player;
                }
                
                // Second try: from global window.videojsPlayers
                if (!player && typeof window !== 'undefined' && window.videojsPlayers) {
                    const videoId = inEmbedRef.current ? 'video-embed' : 'video-main';
                    player = window.videojsPlayers[videoId];
                }
                
                // Third try: from the global videojs function looking for existing players
                if (!player && typeof window !== 'undefined' && window.videojs) {
                    const videoElement = document.querySelector(inEmbedRef.current ? '#video-embed' : '#video-main');
                    if (videoElement && videoElement.player) {
                        player = videoElement.player;
                    }
                }
                
                // If we found a player, seek to the timestamp
                if (player) {
                    if (timestamp >= 0 && timestamp < player.duration()) {
                        player.currentTime(timestamp);
                    } else if (timestamp >= 0) {
                        player.play();
                    }
                    
                    // Scroll to the video player with smooth behavior
                    const videoElement = document.querySelector(inEmbedRef.current ? '#video-embed' : '#video-main');
                    if (videoElement) {
                        const urlScroll = getUrlParameter('scroll');
                        const isIframe = window.parent !== window;
                        
                        // Only scroll if not in an iframe, OR if explicitly requested via scroll=1 parameter
                        if (!isIframe || urlScroll === '1' || urlScroll === 'true') {
                            videoElement.scrollIntoView({ 
                                behavior: 'smooth', 
                                block: 'center',
                                inline: 'nearest'
                            });
                        }
                    }
                } else {
                    console.warn('VideoJS player not found for timestamp navigation');
                }
            }
        };

        // Add the event listener to the document for timestamp clicks
        document.addEventListener('click', handleTimestampClick);

        // Cleanup function
        return () => {
            document.removeEventListener('click', handleTimestampClick);
        };
    }, []); // Empty dependency array so this effect only runs once

    const loadVideoJSAssets = () => {
        // Check if assets are already loaded
        const existingCSS = document.querySelector('link[href*="video-js.css"]');
        const existingJS = document.querySelector('script[src*="video-js.js"]');

        // Load CSS if not already loaded
        if (!existingCSS) {
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = siteUrl + '/static/video_js/video-js.css?v=' + version;
            document.head.appendChild(cssLink);
        }

        // Load JS if not already loaded
        if (!existingJS) {
            const script = document.createElement('script');
            script.src = siteUrl + '/static/video_js/video-js.js?v=' + version;
            document.head.appendChild(script);
        }
    };

    return (
        <div className="video-js-wrapper" ref={containerRef}>
            {inEmbed ? (
                <div 
                    id="video-js-root-embed" 
                    className="video-js-root-embed"
                />
            ) : (
                <div id="video-js-root-main" className="video-js-root-main" />
            )}
        </div>
    );
};

VideoJSEmbed.defaultProps = {
    data: {},
    siteUrl: '',
};

export default VideoJSEmbed;
