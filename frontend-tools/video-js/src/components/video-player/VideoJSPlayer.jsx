import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import '../../styles/embed.css';
import '../controls/SubtitlesButton.css';
import './VideoJSPlayer.css';
import './VideoJSPlayerRoundedCorners.css';
import '../controls/ButtonTooltips.css';

// Import the separated components
import EmbedInfoOverlay from '../overlays/EmbedInfoOverlay';
import ChapterMarkers from '../markers/ChapterMarkers';
import SpritePreview from '../markers/SpritePreview';
import NextVideoButton from '../controls/NextVideoButton';
import AutoplayToggleButton from '../controls/AutoplayToggleButton';
import CustomRemainingTime from '../controls/CustomRemainingTime';
import CustomChaptersOverlay from '../controls/CustomChaptersOverlay';
import CustomSettingsMenu from '../controls/CustomSettingsMenu';
import SeekIndicator from '../controls/SeekIndicator';
import VideoContextMenu from '../overlays/VideoContextMenu';
import UserPreferences from '../../utils/UserPreferences';
import PlayerConfig from '../../config/playerConfig';
import { AutoplayHandler } from '../../utils/AutoplayHandler';
import { OrientationHandler } from '../../utils/OrientationHandler';
import { EndScreenHandler } from '../../utils/EndScreenHandler';
import KeyboardHandler from '../../utils/KeyboardHandler';
import PlaybackEventHandler from '../../utils/PlaybackEventHandler';

// Import sample media data
import sampleMediaData from '../../assets/sample-media-file.json';

// Import fallback poster image
import audioPosterImg from '../../assets/audio-poster.jpg';

// Function to enable tooltips for all standard VideoJS buttons
const enableStandardButtonTooltips = (player) => {
    // Wait a bit for all components to be initialized
    setTimeout(() => {
        const controlBar = player.getChild('controlBar');
        if (!controlBar) return;

        // Define tooltip mappings for standard VideoJS buttons
        const buttonTooltips = {
            playToggle: () => (player.paused() ? 'Play' : 'Pause'),
            // muteToggle: () => (player.muted() ? 'Unmute' : 'Mute'), // Removed - no tooltip for mute/volume
            // volumePanel: 'Volume', // Removed - no tooltip for volume
            fullscreenToggle: () => (player.isFullscreen() ? 'Exit fullscreen' : 'Fullscreen'),
            pictureInPictureToggle: 'Picture-in-picture',
            subtitlesButton: '',
            captionsButton: 'Captions',
            subsCapsButton: '',
            chaptersButton: 'Chapters',
            audioTrackButton: 'Audio tracks',
            playbackRateMenuButton: 'Playback speed',
            // currentTimeDisplay: 'Current time', // Removed - no tooltip for time
            // durationDisplay: 'Duration', // Removed - no tooltip for duration
        };

        // Define tooltip mappings for custom buttons (by CSS class)
        const customButtonTooltips = {
            'vjs-next-video-button': 'Next Video',
            'vjs-autoplay-toggle': (el) => {
                // Check if autoplay is enabled by looking at the aria-label
                const ariaLabel = el.getAttribute('aria-label') || '';
                return ariaLabel.includes('on') ? 'Autoplay is on' : 'Autoplay is off';
            },
            'vjs-settings-button': 'Settings',
        };

        // Apply tooltips to each button
        Object.keys(buttonTooltips).forEach((buttonName) => {
            const button = controlBar.getChild(buttonName);
            if (button && button.el()) {
                const buttonEl = button.el();
                const tooltipText =
                    typeof buttonTooltips[buttonName] === 'function'
                        ? buttonTooltips[buttonName]()
                        : buttonTooltips[buttonName];

                // Skip empty tooltips
                if (!tooltipText || tooltipText.trim() === '') {
                    return;
                }

                buttonEl.setAttribute('title', tooltipText);
                buttonEl.setAttribute('aria-label', tooltipText);

                // For dynamic tooltips (play/pause, fullscreen), update on state change
                if (buttonName === 'playToggle') {
                    player.on('play', () => {
                        buttonEl.setAttribute('title', 'Pause');
                        buttonEl.setAttribute('aria-label', 'Pause');
                    });
                    player.on('pause', () => {
                        buttonEl.setAttribute('title', 'Play');
                        buttonEl.setAttribute('aria-label', 'Play');
                    });
                } else if (buttonName === 'fullscreenToggle') {
                    player.on('fullscreenchange', () => {
                        const tooltip = player.isFullscreen() ? 'Exit fullscreen' : 'Fullscreen';
                        buttonEl.setAttribute('title', tooltip);
                        buttonEl.setAttribute('aria-label', tooltip);
                    });
                }
            }
        });

        // Apply tooltips to custom buttons (by CSS class)
        Object.keys(customButtonTooltips).forEach((className) => {
            const buttonEl = controlBar.el().querySelector(`.${className}`);
            if (buttonEl) {
                const tooltipText =
                    typeof customButtonTooltips[className] === 'function'
                        ? customButtonTooltips[className](buttonEl)
                        : customButtonTooltips[className];

                // Skip empty tooltips
                if (!tooltipText || tooltipText.trim() === '') {
                    console.log('Empty tooltip for custom button:', className, tooltipText);
                    return;
                }

                buttonEl.setAttribute('title', tooltipText);
                buttonEl.setAttribute('aria-label', tooltipText);

                // For autoplay button, update tooltip when state changes
                if (className === 'vjs-autoplay-toggle') {
                    // Listen for aria-label changes to update tooltip
                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach((mutation) => {
                            if (mutation.type === 'attributes' && mutation.attributeName === 'aria-label') {
                                const newTooltip = customButtonTooltips[className](buttonEl);
                                if (newTooltip && newTooltip.trim() !== '') {
                                    buttonEl.setAttribute('title', newTooltip);
                                }
                            }
                        });
                    });
                    observer.observe(buttonEl, { attributes: true, attributeFilter: ['aria-label'] });
                }
            }
        });

        // Remove title attributes from volume-related elements to prevent blank tooltips
        const removeVolumeTooltips = () => {
            const volumeElements = [
                controlBar.getChild('volumePanel'),
                controlBar.getChild('muteToggle'),
                controlBar.getChild('volumeControl'),
            ];

            volumeElements.forEach((element) => {
                if (element && element.el()) {
                    const el = element.el();
                    el.removeAttribute('title');
                    el.removeAttribute('aria-label');

                    // Also remove from any child elements
                    const childElements = el.querySelectorAll('*');
                    childElements.forEach((child) => {
                        child.removeAttribute('title');
                    });
                }
            });
        };

        // Run immediately and also after a short delay
        removeVolumeTooltips();
        setTimeout(removeVolumeTooltips, 100);
    }, 500); // Delay to ensure all components are ready
};

function VideoJSPlayer({ videoId = 'default-video', showTitle = true, showRelated = true, showUserAvatar = true, linkTitle = true, urlTimestamp = null }) {
    const videoRef = useRef(null);
    const playerRef = useRef(null); // Track the player instance
    const userPreferences = useRef(new UserPreferences()); // User preferences instance
    const customComponents = useRef({}); // Store custom components for cleanup
    const keyboardHandler = useRef(null); // Keyboard handler instance
    const playbackEventHandler = useRef(null); // Playback event handler instance

    // Context menu state
    const [contextMenuVisible, setContextMenuVisible] = useState(false);
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

    // Check if this is an embed player (disable next video and autoplay features)
    const isEmbedPlayer = videoId === 'video-embed';

    // Environment-based development mode configuration
    const isDevMode = import.meta.env.VITE_DEV_MODE === 'true' || window.location.hostname.includes('vercel.app');

    // Read options from window.MEDIA_DATA if available (for consistency with embed logic)
    const mediaData = useMemo(
        () =>
            typeof window !== 'undefined' && window.MEDIA_DATA
                ? window.MEDIA_DATA
                : {
                      data: sampleMediaData,

                      // other
                      useRoundedCorners: false,
                      isPlayList: false,
                      previewSprite: {
                          url: sampleMediaData.sprites_url
                              ? 'https://deic.mediacms.io' + sampleMediaData.sprites_url
                              : 'https://deic.mediacms.io/media/original/thumbnails/user/admin/43cc73a8c1604425b7057ad2b50b1798.19247660hd_1920_1080_60fps.mp4sprites.jpg',
                          frame: { width: 160, height: 90, seconds: 10 },
                      },
                      siteUrl: 'https://deic.mediacms.io',
                      nextLink: 'https://deic.mediacms.io/view?m=elygiagorgechania',
                  },
        []
    );

    // Helper to get effective value (prop or MEDIA_DATA or default)
    const getOption = (propKey, mediaDataKey, defaultValue) => {
        if (isEmbedPlayer) {
            if (mediaData[mediaDataKey] !== undefined) return mediaData[mediaDataKey];
        }
        return propKey !== undefined ? propKey : defaultValue;
    };

    const finalShowTitle = getOption(showTitle, 'showTitle', true);
    const finalShowRelated = getOption(showRelated, 'showRelated', true);
    const finalShowUserAvatar = getOption(showUserAvatar, 'showUserAvatar', true);
    const finalLinkTitle = getOption(linkTitle, 'linkTitle', true);
    const finalTimestamp = getOption(urlTimestamp, 'urlTimestamp', null);

    // Utility function to detect touch devices
    const isTouchDevice = useMemo(() => {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
    }, []);

    // Utility function to detect iOS devices
    const isIOS = useMemo(() => {
        return (
            /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        );
    }, []);

    // Define chapters as JSON object
    // Note: The sample-chapters.vtt file is no longer needed as chapters are now loaded from this JSON
    // CONDITIONAL LOGIC:
    // - When chaptersData has content: Uses original ChapterMarkers with sprite preview
    // - When chaptersData is empty: Uses separate SpritePreview component
    // Utility function to convert time string (HH:MM:SS.mmm) to seconds
    const convertTimeStringToSeconds = (timeString) => {
        if (typeof timeString === 'number') {
            return timeString; // Already in seconds
        }

        if (typeof timeString !== 'string') {
            return 0;
        }

        const parts = timeString.split(':');
        if (parts.length !== 3) {
            return 0;
        }

        const hours = parseInt(parts[0], 10) || 0;
        const minutes = parseInt(parts[1], 10) || 0;
        const seconds = parseFloat(parts[2]) || 0;

        return hours * 3600 + minutes * 60 + seconds;
    };

    // Convert chapters data from backend format to required format with memoization
    const convertChaptersData = useMemo(() => {
        return (rawChaptersData) => {
            if (!rawChaptersData || !Array.isArray(rawChaptersData)) {
                return [];
            }

            const convertedData = rawChaptersData.map((chapter) => ({
                startTime: convertTimeStringToSeconds(chapter.startTime),
                endTime: convertTimeStringToSeconds(chapter.endTime),
                chapterTitle: chapter.chapterTitle,
            }));

            return convertedData;
        };
    }, []);

    // Helper function to check if chapters represent a meaningful chapter structure
    // Returns false if there's only one chapter covering the entire video duration with a generic title
    const hasRealChapters = useMemo(() => {
        return (rawChaptersData, videoDuration) => {
            if (!rawChaptersData || !Array.isArray(rawChaptersData) || rawChaptersData.length === 0) {
                return false;
            }

            // If there's more than one chapter, assume it's a real chapter structure
            if (rawChaptersData.length > 1) {
                return true;
            }

            // If there's only one chapter, check if it's a generic segment marker
            if (rawChaptersData.length === 1) {
                const chapter = rawChaptersData[0];
                const startTime = convertTimeStringToSeconds(chapter.startTime);
                const endTime = convertTimeStringToSeconds(chapter.endTime);

                // Check if it's a generic segment with common auto-generated titles
                const isGenericTitle = chapter.chapterTitle
                    ?.toLowerCase()
                    .match(/^(segment|video|full video|chapter|part)$/);

                // If we have video duration info, check if this single chapter spans the whole video
                if (videoDuration && videoDuration > 0) {
                    // Allow for small timing differences (1 second tolerance)
                    const tolerance = 1;
                    const isFullVideo = startTime <= tolerance && Math.abs(endTime - videoDuration) <= tolerance;

                    // Only hide if it's both full video AND has a generic title
                    if (isFullVideo && isGenericTitle) {
                        return false;
                    }

                    // If it doesn't span the full video, it's a real chapter
                    if (!isFullVideo) {
                        return true;
                    }
                }

                // Fallback: If start time is 0 and the title is generic, assume it's not a real chapter
                if (startTime === 0 && isGenericTitle) {
                    return false;
                }
            }

            return true;
        };
    }, []);

    // Memoized chapters data conversion
    const chaptersData = useMemo(() => {
        if (mediaData?.data?.chapter_data && mediaData?.data?.chapter_data.length > 0) {
            const videoDuration = mediaData?.data?.duration || null;

            // Check if we have real chapters or just a single segment
            if (hasRealChapters(mediaData.data.chapter_data, videoDuration)) {
                return convertChaptersData(mediaData?.data?.chapter_data);
            } else {
                // Return empty array if it's just a single segment covering the whole video
                return [];
            }
        }
        return isDevMode
            ? [
                  { startTime: '00:00:00.000', endTime: '00:00:04.000', chapterTitle: 'Introduction' },
                  { startTime: '00:00:05.000', endTime: '00:00:10.000', chapterTitle: 'Overview of Marine Life' },
                  { startTime: '00:00:10.000', endTime: '00:00:15.000', chapterTitle: 'Coral Reef Ecosystems' },
                  { startTime: '00:00:15.000', endTime: '00:00:20.000', chapterTitle: 'Deep Sea Creatures' },
                  { startTime: '00:00:20.000', endTime: '00:00:30.000', chapterTitle: 'Ocean Conservation' },
                  { startTime: '00:00:24.000', endTime: '00:00:32.000', chapterTitle: 'Ocean Conservation' },
                  { startTime: '00:00:32.000', endTime: '00:00:40.000', chapterTitle: 'Climate Change Impact' },
                  { startTime: '00:00:40.000', endTime: '00:00:48.000', chapterTitle: 'Marine Protected Areas' },
                  { startTime: '00:00:48.000', endTime: '00:00:56.000', chapterTitle: 'Sustainable Fishing' },
                  { startTime: '00:00:56.000', endTime: '00:00:64.000', chapterTitle: 'Research Methods' },
                  { startTime: '00:00:64.000', endTime: '00:00:72.000', chapterTitle: 'Future Challenges' },
                  { startTime: '00:00:72.000', endTime: '00:00:80.000', chapterTitle: 'Conclusion' },
                  { startTime: '00:00:80.000', endTime: '00:00:88.000', chapterTitle: 'Marine Biodiversity Hotspots' },
                  { startTime: '00:00:88.000', endTime: '00:00:96.000', chapterTitle: 'Marine Biodiversity test' },
                  { startTime: '00:00:96.000', endTime: '00:01:04.000', chapterTitle: 'Whale Migration Patterns' },
                  { startTime: '00:01:04.000', endTime: '00:01:12.000', chapterTitle: 'Plastic Pollution Crisis' },
                  { startTime: '00:01:12.000', endTime: '00:01:20.000', chapterTitle: 'Seagrass Meadows' },
                  { startTime: '00:01:20.000', endTime: '00:01:28.000', chapterTitle: 'Ocean Acidification' },
                  { startTime: '00:01:28.000', endTime: '00:01:36.000', chapterTitle: 'Marine Archaeology' },
                  { startTime: '00:01:28.000', endTime: '00:01:36.000', chapterTitle: 'Tidal Pool Ecosystems' },
                  { startTime: '00:01:36.000', endTime: '00:01:44.000', chapterTitle: 'Commercial Aquaculture' },
                  { startTime: '00:01:44.000', endTime: '00:01:52.000', chapterTitle: 'Ocean Exploration Technology' },
              ].map((chapter) => ({
                  startTime: convertTimeStringToSeconds(chapter.startTime),
                  endTime: convertTimeStringToSeconds(chapter.endTime),
                  chapterTitle: chapter.chapterTitle,
              }))
            : [];
    }, [mediaData?.data?.chapter_data, mediaData?.data?.duration, isDevMode, convertChaptersData, hasRealChapters]);

    // Helper function to determine MIME type based on file extension or media type
    const getMimeType = (url, mediaType) => {
        if (mediaType === 'audio') {
            if (url && url.toLowerCase().includes('.mp3')) {
                return 'audio/mpeg';
            }
            if (url && url.toLowerCase().includes('.ogg')) {
                return 'audio/ogg';
            }
            if (url && url.toLowerCase().includes('.wav')) {
                return 'audio/wav';
            }
            if (url && url.toLowerCase().includes('.m4a')) {
                return 'audio/mp4';
            }
            // Default audio MIME type
            return 'audio/mpeg';
        }

        // Default to video/mp4 for video content
        if (url && url.toLowerCase().includes('.webm')) {
            return 'video/webm';
        }
        if (url && url.toLowerCase().includes('.ogg')) {
            return 'video/ogg';
        }

        // Default video MIME type
        return 'video/mp4';
    };

    // Get user's quality preference for dependency tracking
    const userQualityPreference = userPreferences.current.getQualityPreference();

    // Get video data from mediaData
    const currentVideo = useMemo(() => {
        // Get video sources based on available data and user preferences
        const getVideoSources = () => {
            // Use the extracted quality preference
            const userQuality = userQualityPreference;

            // Check if HLS info is available and not empty
            if (mediaData.data?.hls_info) {
                // If user prefers auto quality or master file doesn't exist for specific quality
                if (userQuality === 'auto' && mediaData.data.hls_info.master_file) {
                    return [
                        {
                            src: mediaData.siteUrl + mediaData.data.hls_info.master_file,
                            type: 'application/x-mpegURL', // HLS MIME type
                            label: 'Auto',
                        },
                    ];
                }

                // If user has selected a specific quality, try to use that playlist
                if (userQuality !== 'auto') {
                    const qualityKey = `${userQuality.replace('p', '')}_playlist`;
                    if (mediaData.data.hls_info[qualityKey]) {
                        return [
                            {
                                src: mediaData.siteUrl + mediaData.data.hls_info[qualityKey],
                                type: 'application/x-mpegURL', // HLS MIME type
                                label: `${userQuality}p`,
                            },
                        ];
                    }
                }

                // Fallback to master file if specific quality not available
                if (mediaData.data.hls_info.master_file) {
                    return [
                        {
                            src: mediaData.siteUrl + mediaData.data.hls_info.master_file,
                            type: 'application/x-mpegURL', // HLS MIME type
                            label: 'Auto',
                        },
                    ];
                }
            }

            // Fallback to encoded qualities if available
            if (mediaData.data?.encodings_info) {
                const encodings = mediaData.data.encodings_info;
                const userQuality = userQualityPreference;
                // If user has selected a specific quality, try to use that encoding first
                if (userQuality !== 'auto') {
                    const qualityNumber = userQuality.replace('p', ''); // Remove 'p' from '240p' -> '240'
                    if (
                        encodings[qualityNumber] &&
                        encodings[qualityNumber].h264 &&
                        encodings[qualityNumber].h264.url
                    ) {
                        console.log(' encodings[qualityNumber].h264.url', encodings[qualityNumber].h264.url);
                        console.log(
                            ' getMimeType(encodings[qualityNumber].h264.url, mediaData.data?.media_type)',
                            getMimeType(encodings[qualityNumber].h264.url, mediaData.data?.media_type)
                        );
                        console.log('label', `${qualityNumber}p`);
                        return [
                            {
                                src: encodings[qualityNumber].h264.url,
                                type: getMimeType(encodings[qualityNumber].h264.url, mediaData.data?.media_type),
                                label: `${qualityNumber}p`,
                            },
                        ];
                    }
                }

                // If auto quality or specific quality not available, return all available qualities
                const sources = [];

                // Get available qualities dynamically from encodings_info
                const availableQualities = Object.keys(encodings)
                    .filter((quality) => encodings[quality] && encodings[quality].h264 && encodings[quality].h264.url)
                    .sort((a, b) => parseInt(b) - parseInt(a)); // Sort descending (highest first)

                for (const quality of availableQualities) {
                    const sourceUrl = encodings[quality].h264.url;
                    sources.push({
                        src: sourceUrl,
                        type: getMimeType(sourceUrl, mediaData.data?.media_type),
                        label: `${quality}p`,
                    });
                }

                if (sources.length > 0) {
                    return sources;
                }
            }

            // Final fallback to original media URL or sample video
            if (mediaData.data?.original_media_url) {
                const sourceUrl = mediaData.siteUrl + mediaData.data.original_media_url;
                return [
                    {
                        src: sourceUrl,
                        type: getMimeType(sourceUrl, mediaData.data?.media_type),
                    },
                ];
            }

            // Default sample video
            return [
                {
                    src: '/videos/sample-video.mp4',
                    // src: '/videos/sample-video-white.mp4',
                    //src: '/videos/sample-video.big.mp4',
                    type: 'video/mp4',
                },
                /*  {
                    src: '/videos/sample-video.mp3',
                    type: 'audio/mpeg',
                }, */
            ];
        };

        const currentVideo = {
            id: mediaData.data?.friendly_token || 'default-video',
            title: mediaData.data?.title || 'Video',
            author_name: mediaData.data?.author_name || 'Unknown',
            author_profile: mediaData.data?.author_profile ? mediaData.siteUrl + mediaData.data.author_profile : '',
            author_thumbnail: mediaData.data?.author_thumbnail
                ? mediaData.siteUrl + mediaData.data.author_thumbnail
                : '',
            url: mediaData.data?.url || '',
            poster: mediaData.data?.poster_url ? mediaData.siteUrl + mediaData.data.poster_url : audioPosterImg,
            previewSprite: mediaData?.previewSprite || {},
            useRoundedCorners: mediaData?.useRoundedCorners,
            isPlayList: mediaData?.isPlayList,
            related_media: mediaData.data?.related_media || [],
            nextLink: mediaData?.nextLink || null,
            sources: getVideoSources(),
        };

        return currentVideo;
    }, [mediaData, userQualityPreference]);

    // Compute available qualities. Prefer JSON (mediaData.data.qualities), otherwise build from encodings_info or current source.
    const availableQualities = useMemo(() => {
        // Generate desiredOrder dynamically based on available data
        const generateDesiredOrder = () => {
            const baseOrder = ['auto'];

            // Add qualities from encodings_info if available
            if (mediaData.data?.encodings_info) {
                const availableQualities = Object.keys(mediaData.data.encodings_info)
                    .filter((quality) => {
                        const encoding = mediaData.data.encodings_info[quality];
                        return encoding && encoding.h264 && encoding.h264.url;
                    })
                    .map((quality) => `${quality}p`)
                    .sort((a, b) => parseInt(a) - parseInt(b)); // Sort ascending

                baseOrder.push(...availableQualities);
            } else {
                // Fallback to standard order
                baseOrder.push('144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p');
            }

            return baseOrder;
        };

        const desiredOrder = generateDesiredOrder();

        const normalize = (arr) => {
            const norm = arr.map((q) => ({
                label: q.label || q.value || 'Auto',
                value: (q.value || q.label || 'auto').toString().toLowerCase(),
                src: q.src || q.url || q.href,
                type: q.type || getMimeType(q.src || q.url || q.href, mediaData.data?.media_type),
            }));

            // Only include qualities that have actual sources
            const validQualities = norm.filter((q) => q.src);

            // sort based on desired order
            const idx = (v) => {
                const i = desiredOrder.indexOf(String(v).toLowerCase());
                return i === -1 ? 999 : i;
            };
            validQualities.sort((a, b) => idx(a.value) - idx(b.value));
            return validQualities;
        };

        const jsonList = mediaData?.data?.qualities;
        if (Array.isArray(jsonList) && jsonList.length) {
            return normalize(jsonList);
        }

        // If HLS is available, build qualities from HLS playlists
        if (mediaData.data?.hls_info && mediaData.data.hls_info.master_file) {
            const hlsInfo = mediaData.data.hls_info;
            const qualities = [];

            // Add master file as auto quality
            qualities.push({
                label: 'Auto',
                value: 'auto',
                src: mediaData.siteUrl + hlsInfo.master_file,
                type: 'application/x-mpegURL',
            });

            // Add individual HLS playlists
            Object.keys(hlsInfo).forEach((key) => {
                if (key.endsWith('_playlist')) {
                    const quality = key.replace('_playlist', '');
                    qualities.push({
                        label: `${quality}p`,
                        value: `${quality}p`,
                        src: mediaData.siteUrl + hlsInfo[key],
                        type: 'application/x-mpegURL',
                    });
                }
            });

            return normalize(qualities);
        }

        // Build from encodings_info if available
        if (mediaData.data?.encodings_info) {
            const encodings = mediaData.data.encodings_info;
            const qualities = [];

            // Add auto quality first
            qualities.push({
                label: 'Auto',
                value: 'auto',
                src: null, // Will use the highest available quality
                type: getMimeType(null, mediaData.data?.media_type),
            });

            // Add available encoded qualities dynamically
            Object.keys(encodings).forEach((quality) => {
                if (encodings[quality] && encodings[quality].h264 && encodings[quality].h264.url) {
                    const sourceUrl = encodings[quality].h264.url;
                    qualities.push({
                        label: `${quality}p`,
                        value: `${quality}p`,
                        src: sourceUrl,
                        type: getMimeType(sourceUrl, mediaData.data?.media_type),
                    });
                }
            });

            if (qualities.length > 1) {
                // More than just auto
                return normalize(qualities);
            }
        }

        // Build from current source as fallback - only if we have a valid source
        const baseSrc = (currentVideo?.sources && currentVideo.sources[0]?.src) || null;
        const type =
            (currentVideo?.sources && currentVideo.sources[0]?.type) ||
            getMimeType(baseSrc, mediaData.data?.media_type);

        if (baseSrc) {
            const buildFromBase = [
                {
                    label: 'Auto',
                    value: 'auto',
                    src: baseSrc,
                    type,
                },
            ];
            return normalize(buildFromBase);
        }

        // Return empty array if no valid sources found
        return [];
    }, [mediaData, currentVideo]);

    // Get related videos from mediaData instead of static data
    const relatedVideos = useMemo(() => {
        if (!mediaData?.data?.related_media) {
            return [];
        }

        return mediaData.data.related_media
            .slice(0, 12) // Limit to maximum 12 items
            .map((media) => ({
                id: media.friendly_token,
                title: media.title,
                author: media.user || media.author_name || 'Unknown',
                views: `${media.views} views`,
                thumbnail: media.thumbnail_url || media.author_thumbnail,
                category: media.media_type,
                url: media.url,
                duration: media.duration,
                size: media.size,
                likes: media.likes,
                dislikes: media.dislikes,
                add_date: media.add_date,
                description: media.description,
            }));
    }, [mediaData]);

    // Demo array for testing purposes
    const demoSubtitleTracks = [
        {
            kind: 'subtitles',
            src: '/sample-subtitles.vtt',
            srclang: 'en',
            label: 'English Subtitles',
            default: true,
        },
        {
            kind: 'subtitles',
            src: '/sample-subtitles-greek.vtt',
            srclang: 'el',
            label: 'Greek Subtitles (Ελληνικά)',
            default: false,
        },
    ];
    // const demoSubtitleTracks = []; // NO Subtitles. TODO: hide it on production

    // Get subtitle tracks from backend response or fallback based on environment
    const backendSubtitles = mediaData?.data?.subtitles_info || (isDevMode ? demoSubtitleTracks : []);
    const hasSubtitles = backendSubtitles.length > 0;
    const subtitleTracks = hasSubtitles
        ? backendSubtitles.map((track) => ({
              kind: 'subtitles',
              src: (!isDevMode ? mediaData?.siteUrl : '') + track.src,
              srclang: track.srclang,
              label: track.label,
              default: track.default || false,
          }))
        : [];

    // Function to navigate to next video
    const goToNextVideo = () => {
        if (mediaData.onClickNextCallback && typeof mediaData.onClickNextCallback === 'function') {
            mediaData.onClickNextCallback();
        }
    };

    // Context menu handlers
    const handleContextMenu = useCallback((e) => {
        // Only handle if clicking on video player area
        const target = e.target;
        const isVideoPlayerArea =
            target.closest('.video-js') ||
            target.classList.contains('vjs-tech') ||
            target.tagName === 'VIDEO' ||
            target.closest('video');

        if (isVideoPlayerArea) {
            e.preventDefault();
            e.stopPropagation();

            setContextMenuPosition({ x: e.clientX, y: e.clientY });
            setContextMenuVisible(true);
        }
    }, []);

    const closeContextMenu = () => {
        setContextMenuVisible(false);
    };

    // Helper function to get media ID
    const getMediaId = () => {
        if (typeof window !== 'undefined' && window.MEDIA_DATA?.data?.friendly_token) {
            return window.MEDIA_DATA.data.friendly_token;
        }
        if (mediaData?.data?.friendly_token) {
            return mediaData.data.friendly_token;
        }
        // Try to get from URL (works for both main page and embed page)
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const mediaIdFromUrl = urlParams.get('m');
            if (mediaIdFromUrl) {
                return mediaIdFromUrl;
            }
            // Also check if we're on an embed page with media ID in path
            const pathMatch = window.location.pathname.match(/\/embed\/([^/?]+)/);
            if (pathMatch) {
                return pathMatch[1];
            }
        }
        return currentVideo.id || 'default-video';
    };

    // Helper function to get base origin URL (handles embed mode)
    const getBaseOrigin = () => {
        if (typeof window !== 'undefined') {
            // In embed mode, try to get origin from parent window if possible
            // Otherwise use current window origin
            try {
                // Check if we're in an iframe and can access parent
                if (window.parent !== window && window.parent.location.origin) {
                    return window.parent.location.origin;
                }
            } catch {
                // Cross-origin iframe, use current origin
            }
            return window.location.origin;
        }
        return mediaData.siteUrl || 'https://deic.mediacms.io';
    };

    // Helper function to get embed URL
    const getEmbedUrl = () => {
        const mediaId = getMediaId();
        const origin = getBaseOrigin();

        // Try to get embed URL from config or construct it
        if (typeof window !== 'undefined' && window.MediaCMS?.config?.url?.embed) {
            return window.MediaCMS.config.url.embed + mediaId;
        }

        // Fallback: construct embed URL (check if current URL is embed format)
        if (typeof window !== 'undefined' && window.location.pathname.includes('/embed')) {
            // If we're already on an embed page, use current URL format
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('m', mediaId);
            return currentUrl.toString();
        }

        // Default embed URL format
        return `${origin}/embed?m=${mediaId}`;
    };

    // Copy video URL to clipboard
    const handleCopyVideoUrl = async () => {
        const mediaId = getMediaId();
        const origin = getBaseOrigin();
        const videoUrl = `${origin}/view?m=${mediaId}`;

        // Show copy icon
        if (customComponents.current?.seekIndicator) {
            customComponents.current.seekIndicator.show('copy-url');
        }

        try {
            await navigator.clipboard.writeText(videoUrl);
            closeContextMenu();
            // You can add a notification here if needed
        } catch (err) {
            console.error('Failed to copy video URL:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = videoUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            closeContextMenu();
        }
    };

    // Copy video URL at current time to clipboard
    const handleCopyVideoUrlAtTime = async () => {
        if (!playerRef.current) {
            closeContextMenu();
            return;
        }

        const currentTime = Math.floor(playerRef.current.currentTime() || 0);
        const mediaId = getMediaId();
        const origin = getBaseOrigin();
        const videoUrl = `${origin}/view?m=${mediaId}&t=${currentTime}`;

        // Show copy icon
        if (customComponents.current?.seekIndicator) {
            customComponents.current.seekIndicator.show('copy-url');
        }

        try {
            await navigator.clipboard.writeText(videoUrl);
            closeContextMenu();
        } catch (err) {
            console.error('Failed to copy video URL at time:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = videoUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            closeContextMenu();
        }
    };

    // Copy embed code to clipboard
    const handleCopyEmbedCode = async () => {
        const embedUrl = getEmbedUrl();
        const embedCode = `<iframe width="560" height="315" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`;

        // Show copy embed icon
        if (customComponents.current?.seekIndicator) {
            customComponents.current.seekIndicator.show('copy-embed');
        }

        try {
            await navigator.clipboard.writeText(embedCode);
            closeContextMenu();
        } catch (err) {
            console.error('Failed to copy embed code:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = embedCode;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            closeContextMenu();
        }
    };

    // Add context menu handler directly to video element and document (works before and after Video.js initialization)
    useEffect(() => {
        const videoElement = videoRef.current;

        // Attach to document with capture to catch all contextmenu events, then filter
        const documentHandler = (e) => {
            // Check if the event originated from within the video player
            const target = e.target;
            const playerWrapper =
                videoElement?.closest('.video-js') || document.querySelector(`#${videoId}`)?.closest('.video-js');

            if (playerWrapper && (playerWrapper.contains(target) || target === playerWrapper)) {
                handleContextMenu(e);
            }
        };

        // Use capture phase on document to catch before anything else
        document.addEventListener('contextmenu', documentHandler, true);

        // Also attach directly to video element
        if (videoElement) {
            videoElement.addEventListener('contextmenu', handleContextMenu, true);
        }

        return () => {
            document.removeEventListener('contextmenu', documentHandler, true);
            if (videoElement) {
                videoElement.removeEventListener('contextmenu', handleContextMenu, true);
            }
        };
    }, [handleContextMenu, videoId]);

    useEffect(() => {
        // Only initialize if we don't already have a player and element exists
        if (videoRef.current && !playerRef.current) {
            // Check if element is already a Video.js player
            if (videoRef.current.player) {
                return;
            }

            //const timer = setTimeout(() => {
            // Double-check that we still don't have a player and element exists
            if (!playerRef.current && videoRef.current && !videoRef.current.player) {
                playerRef.current = videojs(videoRef.current, {
                    // ===== STANDARD <video> ELEMENT OPTIONS =====

                    // Controls whether player has user-interactive controls
                    controls: true,

                    // Player dimensions - removed for responsive design
                    // Autoplay behavior: Try unmuted first, fallback to muted if needed
                    // For embed players, disable autoplay to show poster
                    autoplay: isEmbedPlayer ? false : true, // Try unmuted autoplay first (true/false, play, muted, any)

                    // Start video over when it ends
                    loop: false,

                    // Start video muted (check URL parameter or default)
                    muted: mediaData.urlMuted || false,

                    // Poster image URL displayed before video starts
                    poster: currentVideo.poster,

                    // Preload behavior: 'auto', 'metadata', 'none'
                    preload: 'auto',

                    // Video sources from current video
                    sources: currentVideo.sources,

                    // ===== VIDEO.JS-SPECIFIC OPTIONS =====

                    // Aspect ratio for fluid mode (e.g., '16:9', '4:3')
                    aspectRatio: '16:9',

                    // Hide all components except control bar for audio-only mode
                    audioOnlyMode: false,

                    // Display poster persistently for audio poster mode
                    audioPosterMode: mediaData.data?.media_type === 'audio',

                    // Prevent autoSetup for elements with data-setup attribute
                    autoSetup: undefined,

                    // Custom breakpoints for responsive design
                    breakpoints: {
                        /* tiny: 210,
                        xsmall: 320,
                        small: 425,
                        medium: 768,
                        large: 1440,
                        xlarge: 2560,
                        huge: 2561, */
                        tiny: 300,
                        xsmall: 400,
                        small: 500,
                        medium: 600,
                        large: 700,
                        xlarge: 800,
                        huge: 900,
                    },

                    // Disable picture-in-picture mode
                    disablePictureInPicture: false,

                    // Enable document picture-in-picture API
                    enableDocumentPictureInPicture: false,

                    // Enable smooth seeking experience
                    enableSmoothSeeking: true,

                    // Use experimental SVG icons instead of font icons
                    experimentalSvgIcons: true,

                    // Make player scale to fit container
                    fluid: true,

                    // Fullscreen options
                    fullscreen: {
                        options: {
                            navigationUI: 'hide',
                        },
                    },

                    // Player element ID
                    id: mediaData.id,

                    // Milliseconds of inactivity before user considered inactive (0 = never)
                    // For embed players, use longer timeout to keep controls visible
                    inactivityTimeout: isEmbedPlayer || isTouchDevice ? 5000 : 2000,

                    // Language code for player (e.g., 'en', 'es', 'fr')
                    language: 'en',

                    // Custom language definitions
                    languages: {},

                    // Enable live UI with progress bar and live edge button
                    liveui: true,

                    // Live tracker options
                    liveTracker: {
                        trackingThreshold: 1, // Seconds threshold for showing live UI
                        liveTolerance: 3, // Seconds tolerance for being "live"
                    },

                    // Force native controls for touch devices
                    nativeControlsForTouch: PlayerConfig.nativeControlsForTouch,

                    // Ensures consistent autoplay behavior across browsers (prevents unexpected blocking or auto-play issues)
                    normalizeAutoplay: true,

                    // Custom message when media cannot be played
                    notSupportedMessage: undefined,

                    // Prevent title attributes on UI elements for better accessibility
                    noUITitleAttributes: true,

                    // Array of playback speed options (e.g., [0.5, 1, 1.5, 2])
                    playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],

                    // Prefer non-fullscreen playback on mobile
                    playsinline: true,

                    // Plugin initialization options
                    plugins: {},

                    // Control poster image display
                    posterImage: true,

                    // Prefer full window over fullscreen on some devices
                    preferFullWindow: false,

                    // Enable responsive player based on breakpoints
                    responsive: true,

                    // Restore element when player is disposed
                    restoreEl: false,

                    // Suppress "not supported" error until user interaction
                    suppressNotSupportedError: false,

                    // Allow techs to override poster
                    techCanOverridePoster: false,

                    // Order of preferred playback technologies
                    techOrder: ['html5'],

                    // User interaction options
                    userActions: {
                        // Enable/disable or customize click behavior
                        click: true,
                        tap: true,

                        // // Enable/disable or customize double-click behavior (fullscreen toggle)
                        doubleClick: true,

                        hotkeys: true,
                        // Hotkey configuration
                        /*  hotkeys: {
                            // Function to override fullscreen key (default: 'f')
                            fullscreenKey: function (event) {
                                return event.which === 70; // 'f' key
                            },

                            // Function to override mute key (default: 'm')
                            muteKey: function (event) {
                                return event.which === 77; // 'm' key
                            },

                            // Function to override play/pause key (default: 'k' and Space)
                            playPauseKey: function (event) {
                                return event.which === 75 || event.which === 32; // 'k' or Space
                            },

                            // Custom seek functions for arrow keys
                            seekForwardKey: function (event) {
                                return event.which === 39; // Right arrow key
                            },

                            seekBackwardKey: function (event) {
                                return event.which === 37; // Left arrow key
                            },
                        }, */
                    },

                    // URL to vtt.js for WebVTT support
                    // 'vtt.js': undefined,

                    // Spatial navigation for smart TV/remote control navigation
                    spatialNavigation: {
                        enabled: true,
                        horizontalSeek: true,
                    },

                    // ===== CONTROL BAR OPTIONS =====
                    controlBar: {
                        playToggle: true,
                        progressControl: {
                            seekBar: { loadProgressBar: false }, // Hide the buffered/loaded progress indicator
                        },
                        // Remaining time display configuration
                        currentTimeDisplay: false,
                        durationDisplay: false,
                        remainingTimeDisplay: false,

                        // Volume panel configuration
                        volumePanel: {
                            inline: false, // Display volume control inline
                            vertical: true, // Use horizontal volume slider
                        },

                        // Custom control spacer
                        customControlSpacer: true,

                        // Fullscreen toggle button (hide for audio files since fullscreen doesn't work on mobile)
                        fullscreenToggle: mediaData.data?.media_type === 'audio' ? false : true,

                        // Picture-in-picture toggle button (hide for audio and touch devices)
                        pictureInPictureToggle: isTouchDevice || mediaData.data?.media_type === 'audio' ? false : true,

                        // Remove default playback speed dropdown from control bar
                        playbackRateMenuButton: false,

                        // Descriptions button
                        descriptionsButton: false,

                        // Subtitles (CC) button should be visible
                        subtitlesButton: hasSubtitles ? true : false, // hasSubtitles && !isTouchDevice ? true : false,

                        // Captions button (keep disabled to avoid duplicate with subtitles)
                        captionsButton: hasSubtitles ? true : false,
                        subsCapsButton: hasSubtitles ? true : false,

                        // Audio track button
                        audioTrackButton: true,

                        // Live display
                        liveDisplay: false,

                        // Seek to live button
                        seekToLive: false,

                        // Chapters menu button (only show if we have real chapters)
                        chaptersButton: chaptersData && chaptersData.length > 0,
                    },

                    // ===== HTML5 TECH OPTIONS =====
                    html5: {
                        // Force native controls for touch devices
                        nativeControlsForTouch: PlayerConfig.nativeControlsForTouch,

                        // Use native audio tracks instead of emulated - disabled for consistency
                        nativeAudioTracks: false,

                        // Use native text tracks on iOS for fullscreen caption support
                        // On other devices, use Video.js text tracks for full CSS positioning control
                        nativeTextTracks: isIOS && mediaData.data?.media_type !== 'audio' ? true : false,

                        // Use native video tracks instead of emulated - disabled for consistency
                        nativeVideoTracks: false,

                        // Preload text tracks
                        preloadTextTracks: false,

                        // Play inline
                        playsinline: true,
                    },

                    // ===== COMPONENT CONFIGURATION =====
                    children: [
                        'mediaLoader',
                        'posterImage',
                        'textTrackDisplay',
                        'loadingSpinner',
                        'bigPlayButton',
                        'liveTracker',
                        'controlBar',
                        'errorDisplay',
                        'textTrackSettings',
                        'resizeManager',
                    ],
                });

                // Event listeners
                playerRef.current.ready(() => {
                    // Apply user preferences to player
                    userPreferences.current.applyToPlayer(playerRef.current);

                    // Set up auto-save for preference changes
                    userPreferences.current.setupAutoSave(playerRef.current);

                    // Add class for audio files to enable audio-specific styling
                    if (mediaData.data?.media_type === 'audio') {
                        playerRef.current.addClass('vjs-audio-type');

                        // For embed players, ensure poster stays visible during playback
                        if (isEmbedPlayer) {
                            const ensurePosterVisible = () => {
                                const posterEl = playerRef.current.el().querySelector('.vjs-poster');
                                if (posterEl) {
                                    posterEl.style.display = 'block';
                                    posterEl.style.opacity = '1';
                                    posterEl.style.visibility = 'visible';
                                }
                            };

                            // Keep poster visible on all play events
                            playerRef.current.on('play', ensurePosterVisible);
                            playerRef.current.on('playing', ensurePosterVisible);
                            playerRef.current.on('timeupdate', ensurePosterVisible);

                            // Initial call
                            setTimeout(ensurePosterVisible, 200);
                        }
                    }

                    // Enable tooltips for all standard VideoJS buttons
                    enableStandardButtonTooltips(playerRef.current);

                    // Setup orientation handling for touch devices
                    const orientationHandler = new OrientationHandler(playerRef.current, isTouchDevice);
                    orientationHandler.setupOrientationHandling();
                    customComponents.current.orientationHandler = orientationHandler; // Store for cleanup

                    // Setup end screen handling
                    const endScreenHandler = new EndScreenHandler(playerRef.current, {
                        isEmbedPlayer,
                        userPreferences: userPreferences.current,
                        mediaData,
                        currentVideo,
                        relatedVideos,
                        goToNextVideo,
                        showRelated: finalShowRelated,
                        showUserAvatar: finalShowUserAvatar,
                        linkTitle: finalLinkTitle,
                    });
                    customComponents.current.endScreenHandler = endScreenHandler; // Store for cleanup

                    // Inside your ready callback, replace the existing handleAutoplay code with:
                    const autoplayHandler = new AutoplayHandler(playerRef.current, mediaData, userPreferences.current);

                    // Expose the player instance globally for timestamp functionality
                    if (typeof window !== 'undefined') {
                        if (!window.videojsPlayers) {
                            window.videojsPlayers = {};
                        }
                        window.videojsPlayers[videoId] = playerRef.current;
                    }

                    // Call the onPlayerInitCallback if provided via MEDIA_DATA
                    if (mediaData.onPlayerInitCallback && typeof mediaData.onPlayerInitCallback === 'function') {
                        mediaData.onPlayerInitCallback({ player: playerRef.current }, playerRef.current.el());
                    }

                    // Handle URL timestamp parameter
                    if (finalTimestamp !== null && finalTimestamp >= 0) {
                        const timestamp = finalTimestamp;

                        // Wait for video metadata to be loaded before seeking
                        if (playerRef.current.readyState() >= 1) {
                            // Metadata is already loaded, seek immediately
                            if (timestamp < playerRef.current.duration()) {
                                playerRef.current.currentTime(timestamp);
                            } else if (timestamp >= 0) {
                                playerRef.current.play();
                            }
                        } else {
                            // Wait for metadata to load
                            playerRef.current.one('loadedmetadata', () => {
                                if (timestamp >= 0 && timestamp < playerRef.current.duration()) {
                                    playerRef.current.currentTime(timestamp);
                                } else if (timestamp >= 0) {
                                    playerRef.current.play();
                                }
                            });
                        }
                    }

                    // Skip autoplay for embed players to show poster
                    if (!isEmbedPlayer) {
                        autoplayHandler.handleAutoplay();
                    }

                    const setupMobilePlayPause = () => {
                        const playerEl = playerRef.current.el();
                        const videoEl = playerEl.querySelector('video');

                        if (videoEl) {
                            // Remove default touch handling that might interfere
                            videoEl.style.touchAction = 'manipulation';

                            // Add mobile-specific touch event handlers
                            let touchStartTime = 0;
                            let touchStartPos = { x: 0, y: 0 };

                            const handleTouchStart = (e) => {
                                touchStartTime = Date.now();
                                const touch = e.touches[0];
                                touchStartPos = { x: touch.clientX, y: touch.clientY };

                                // Check if touch is in seekbar area or the zone above it
                                const progressControl = playerRef.current
                                    .getChild('controlBar')
                                    ?.getChild('progressControl');
                                if (progressControl && progressControl.el()) {
                                    const progressRect = progressControl.el().getBoundingClientRect();
                                    const seekbarDeadZone = 8; // Only 8px above seekbar is protected for easier seeking
                                    const isInSeekbarArea =
                                        touch.clientY >= progressRect.top - seekbarDeadZone &&
                                        touch.clientY <= progressRect.bottom;
                                    if (isInSeekbarArea) {
                                        playerRef.current.seekbarTouching = true;
                                    }
                                }
                            };

                            const handleTouchEnd = (e) => {
                                const touchEndTime = Date.now();
                                const touchDuration = touchEndTime - touchStartTime;

                                // Only handle if it's a quick tap and we're not touching the seekbar
                                if (touchDuration < 500 && !playerRef.current.seekbarTouching) {
                                    const touch = e.changedTouches[0];
                                    const touchEndPos = { x: touch.clientX, y: touch.clientY };
                                    const distance = Math.sqrt(
                                        Math.pow(touchEndPos.x - touchStartPos.x, 2) +
                                            Math.pow(touchEndPos.y - touchStartPos.y, 2)
                                    );

                                    // Only trigger if it's a tap (not a swipe)
                                    if (distance < 50) {
                                        e.preventDefault();
                                        e.stopPropagation();

                                        // Check if controls are currently visible by examining control bar
                                        const controlBar = playerRef.current.getChild('controlBar');
                                        const controlBarEl = controlBar ? controlBar.el() : null;
                                        const isControlsVisible =
                                            controlBarEl &&
                                            window.getComputedStyle(controlBarEl).opacity !== '0' &&
                                            window.getComputedStyle(controlBarEl).visibility !== 'hidden';

                                        // Check if center play/pause icon is visible and if tap is on it
                                        const seekIndicator = customComponents.current.seekIndicator;
                                        const seekIndicatorEl = seekIndicator ? seekIndicator.el() : null;
                                        const isSeekIndicatorVisible =
                                            seekIndicatorEl &&
                                            window.getComputedStyle(seekIndicatorEl).opacity !== '0' &&
                                            window.getComputedStyle(seekIndicatorEl).visibility !== 'hidden' &&
                                            window.getComputedStyle(seekIndicatorEl).display !== 'none';

                                        let isTapOnCenterIcon = false;
                                        if (seekIndicatorEl && isSeekIndicatorVisible) {
                                            const iconRect = seekIndicatorEl.getBoundingClientRect();
                                            isTapOnCenterIcon =
                                                touch.clientX >= iconRect.left &&
                                                touch.clientX <= iconRect.right &&
                                                touch.clientY >= iconRect.top &&
                                                touch.clientY <= iconRect.bottom;
                                        }

                                        const isPaused = playerRef.current.paused();

                                        if (isPaused) {
                                            // Always play if video is paused
                                            playerRef.current.play();
                                        } else if (isTapOnCenterIcon) {
                                            // Pause if tapping on center icon (highest priority)
                                            playerRef.current.pause();
                                        } else if (isControlsVisible) {
                                            // Pause if controls are visible and not touching seekbar area
                                            playerRef.current.pause();
                                        } else {
                                            // If controls are not visible, show them AND show center pause icon
                                            playerRef.current.userActive(true);
                                            if (seekIndicator) {
                                                seekIndicator.showMobilePauseIcon();
                                            }
                                        }
                                    }
                                }

                                // Always clear seekbar touching flag at the end
                                setTimeout(() => {
                                    if (playerRef.current) {
                                        playerRef.current.seekbarTouching = false;
                                    }
                                }, 50);
                            };

                            videoEl.addEventListener('touchstart', handleTouchStart, { passive: true });
                            videoEl.addEventListener('touchend', handleTouchEnd, { passive: false });
                        }
                    };
                    setTimeout(setupMobilePlayPause, 100);

                    // Get control bar and its children
                    const controlBar = playerRef.current.getChild('controlBar');
                    // const fullscreenToggle = controlBar.getChild('fullscreenToggle');
                    const playToggle = controlBar.getChild('playToggle');
                    const volumePanel = controlBar.getChild('volumePanel');
                    // const currentTimeDisplay = controlBar.getChild('currentTimeDisplay');
                    const progressControl = controlBar.getChild('progressControl');
                    const seekBar = progressControl?.getChild('seekBar');

                    // BEGIN: Apply control bar styling from config (always applied)
                    const controlBarEl = controlBar?.el();
                    if (controlBarEl) {
                        // Style control bar using config values
                        controlBarEl.style.height = `${PlayerConfig.controlBar.height}em`;
                        controlBarEl.style.fontSize = `${isTouchDevice ? PlayerConfig.controlBar.mobileFontSize : PlayerConfig.controlBar.fontSize}px`;
                        controlBarEl.style.backgroundColor = PlayerConfig.controlBar.backgroundColor;

                        // Apply same line height to time-related controls
                        const timeControls = controlBarEl.querySelectorAll('.vjs-time-control');
                        timeControls.forEach((timeControl) => {
                            timeControl.style.lineHeight = `${PlayerConfig.controlBar.height}em`;
                        });
                    }
                    // END: Apply control bar styling from config

                    // BEGIN: Apply progress bar colors from config (always applied)
                    const progressEl = progressControl?.el();
                    if (progressEl) {
                        // Style the progress holder and bars with config colors
                        const progressHolder = progressEl.querySelector('.vjs-progress-holder');
                        if (progressHolder) {
                            progressHolder.style.backgroundColor = PlayerConfig.progressBar.trackColor;
                        }

                        // Style the play progress bar (the filled part)
                        const playProgress = progressEl.querySelector('.vjs-play-progress');
                        if (playProgress) {
                            playProgress.style.backgroundColor = PlayerConfig.progressBar.color;
                        }

                        // Style the load progress bar (buffered part)
                        const loadProgress = progressEl.querySelector('.vjs-load-progress');
                        if (loadProgress) {
                            loadProgress.style.backgroundColor = PlayerConfig.progressBar.bufferColor;
                        }
                    }
                    // END: Apply progress bar colors from config

                    // Determine the actual position based on device type and config
                    const getActualPosition = () => {
                        if (isTouchDevice) {
                            // Touch devices: only 'top' or 'bottom' allowed
                            return PlayerConfig.progressBar.touchPosition;
                        } else {
                            // Non-touch devices: 'default', 'top', or 'bottom' allowed
                            return PlayerConfig.progressBar.nonTouchPosition;
                        }
                    };

                    const actualPosition = getActualPosition();

                    // BEGIN: Move progress bar below control bar (native touch style)
                    setTimeout(() => {
                        if (
                            (actualPosition === 'bottom' || actualPosition === 'top') &&
                            progressControl &&
                            progressControl.el() &&
                            controlBar &&
                            controlBar.el()
                        ) {
                            const progressEl = progressControl.el();
                            const controlBarEl = controlBar.el();
                            controlBarEl.style.gap = 0;

                            // Remove progress control from control bar
                            controlBar.removeChild(progressControl);

                            // Create a wrapper div that will hold both progress and control bar
                            const wrapper = document.createElement('div');
                            wrapper.className = 'vjs-controls-wrapper';
                            wrapper.style.position = 'absolute';
                            wrapper.style.bottom = '0';
                            wrapper.style.left = '0';
                            wrapper.style.right = '0';
                            wrapper.style.width = '100%';

                            // Insert wrapper before control bar
                            controlBarEl.parentNode.insertBefore(wrapper, controlBarEl);

                            // Position elements based on actual resolved position
                            if (actualPosition === 'top') {
                                // Progress bar above control bar
                                wrapper.appendChild(progressEl);
                                wrapper.appendChild(controlBarEl);
                            } else {
                                // Progress bar below control bar (bottom/native style)
                                wrapper.appendChild(controlBarEl);
                                wrapper.appendChild(progressEl);
                            }

                            // Style the progress control using config values
                            progressEl.style.position = 'relative';
                            progressEl.style.width = '100%';
                            progressEl.style.height = '15px';
                            progressEl.style.margin = '0 0'; // Add top and bottom margin
                            progressEl.style.padding = '5px 0'; // Add left and right padding/gap
                            progressEl.style.display = 'block';
                            progressEl.style.transition = 'opacity 0.3s, visibility 0.3s'; // Smooth transition
                            progressEl.style.boxSizing = 'border-box'; // Ensure padding doesn't increase width

                            // Style control bar positioning
                            controlBarEl.style.position = 'relative';
                            controlBarEl.style.width = '100%';

                            // Store reference for cleanup
                            customComponents.current.movedProgressControl = progressControl;
                            customComponents.current.controlsWrapper = wrapper;

                            // Also store on player instance for sprite preview access
                            playerRef.current.customComponents = customComponents.current;

                            // Hide/show progress bar with control bar based on user activity

                            const syncProgressVisibility = () => {
                                const isControlBarVisible =
                                    controlBar.hasClass('vjs-visible') ||
                                    !playerRef.current.hasClass('vjs-user-inactive');

                                if (isControlBarVisible) {
                                    progressEl.style.opacity = '1';
                                    progressEl.style.visibility = 'visible';
                                } else {
                                    progressEl.style.opacity = '0';
                                    progressEl.style.visibility = 'hidden';
                                }
                            };

                            // Listen to user activity events
                            playerRef.current.on('useractive', syncProgressVisibility);
                            playerRef.current.on('userinactive', syncProgressVisibility);

                            // Initial sync
                            syncProgressVisibility();

                            // For embed players only, hide until video starts
                            if (isEmbedPlayer) {
                                progressEl.style.opacity = '0';
                                progressEl.style.visibility = 'hidden';
                            }

                            // Show when video starts (for embed players) or ensure visibility (for regular players)
                            const showOnPlay = () => {
                                syncProgressVisibility();
                                playerRef.current.off('play', showOnPlay);
                                playerRef.current.off('seeking', showOnPlay);
                            };
                            playerRef.current.on('play', showOnPlay);
                            playerRef.current.on('seeking', showOnPlay);

                            // Store cleanup function
                            customComponents.current.cleanupProgressVisibility = () => {
                                playerRef.current.off('useractive', syncProgressVisibility);
                                playerRef.current.off('userinactive', syncProgressVisibility);
                            };
                        }
                    }, 100);

                    // END: Move progress bar below control bar

                    // Auto-play video when navigating from next button (skip for embed players)
                    if (!isEmbedPlayer) {
                        const urlParams = new URLSearchParams(window.location.search);
                        const hasVideoParam = urlParams.get('m');
                        if (hasVideoParam) {
                            // Small delay to ensure everything is loaded
                            setTimeout(async () => {
                                if (playerRef.current && !playerRef.current.isDisposed()) {
                                    try {
                                        await playerRef.current.play();
                                    } catch (error) {
                                        console.error('ℹ️ Browser prevented play:', error.message);
                                        // Try muted playback as fallback
                                        if (!playerRef.current.muted()) {
                                            try {
                                                playerRef.current.muted(true);
                                                await playerRef.current.play();
                                            } catch (mutedError) {
                                                console.error('ℹ️ Even muted play was blocked:', mutedError.message);
                                            }
                                        }
                                    }
                                }
                            }, 100);
                        }
                    }

                    // BEGIN: Add subtitle tracks
                    if (hasSubtitles) {
                        try {
                            const savedLang = userPreferences.current.getPreference('subtitleLanguage');
                            const enabled = userPreferences.current.getPreference('subtitleEnabled');
                            const matchLang = (t, target) => {
                                const tl = String(t.srclang || t.language || '').toLowerCase();
                                const sl = String(target || '').toLowerCase();
                                if (!tl || !sl) return false;
                                return tl === sl || tl.startsWith(sl + '-') || sl.startsWith(tl + '-');
                            };
                            const tracksToAdd = subtitleTracks.map((t) => ({
                                ...t,
                                // Hint iOS by marking default on the matched track when enabled
                                default: !!(enabled && savedLang && matchLang(t, savedLang)),
                            }));
                            tracksToAdd.forEach((track) => {
                                playerRef.current.addRemoteTextTrack(track, false);
                            });
                        } catch {
                            // Fallback: add as-is
                            subtitleTracks.forEach((track) => {
                                playerRef.current.addRemoteTextTrack(track, false);
                            });
                        }
                    }

                    // Apply saved subtitle preference immediately and on key readiness events
                    userPreferences.current.applySubtitlePreference(playerRef.current);
                    playerRef.current.one('loadeddata', () =>
                        userPreferences.current.applySubtitlePreference(playerRef.current)
                    );
                    playerRef.current.one('canplay', () =>
                        userPreferences.current.applySubtitlePreference(playerRef.current)
                    );

                    // iOS-specific: Adjust native text track cues to position them above control bar
                    if (isIOS && hasSubtitles) {
                        const adjustIOSCues = (linePosition) => {
                            // If no line position specified, determine based on user activity
                            if (linePosition === undefined) {
                                const isUserInactive = playerRef.current.hasClass('vjs-user-inactive');
                                linePosition = isUserInactive ? -2 : -4;
                            }

                            const textTracks = playerRef.current.textTracks();
                            for (let i = 0; i < textTracks.length; i++) {
                                const track = textTracks[i];
                                if (track.kind === 'subtitles' || track.kind === 'captions') {
                                    // Wait for cues to load
                                    if (track.cues && track.cues.length > 0) {
                                        for (let j = 0; j < track.cues.length; j++) {
                                            const cue = track.cues[j];
                                            // Set line position to move captions up
                                            // Negative values count from bottom, positive from top
                                            // -4 when controls visible, -2 when controls hidden
                                            cue.line = linePosition;
                                            cue.size = 90; // Make width 90% to ensure it fits
                                            cue.position = 'auto'; // Center horizontally
                                            cue.align = 'center'; // Center align text
                                        }
                                    } else {
                                        // If cues aren't loaded yet, listen for the cuechange event
                                        const onCueChange = () => {
                                            if (track.cues && track.cues.length > 0) {
                                                for (let j = 0; j < track.cues.length; j++) {
                                                    const cue = track.cues[j];
                                                    cue.line = linePosition;
                                                    cue.size = 90;
                                                    cue.position = 'auto';
                                                    cue.align = 'center';
                                                }
                                                track.removeEventListener('cuechange', onCueChange);
                                            }
                                        };
                                        track.addEventListener('cuechange', onCueChange);
                                    }
                                }
                            }
                        };

                        // Try to adjust immediately and also after a delay
                        setTimeout(() => adjustIOSCues(), 100);
                        setTimeout(() => adjustIOSCues(), 500);
                        setTimeout(() => adjustIOSCues(), 1000);

                        // Listen for user activity changes to adjust caption position dynamically
                        playerRef.current.on('userinactive', () => {
                            adjustIOSCues(-2); // Controls hidden - move captions closer to bottom
                        });

                        playerRef.current.on('useractive', () => {
                            adjustIOSCues(-4); // Controls visible - move captions higher
                        });

                        // Also adjust when tracks change
                        playerRef.current.textTracks().addEventListener('addtrack', () => adjustIOSCues());
                        playerRef.current.textTracks().addEventListener('change', () => adjustIOSCues());
                    }
                    // END: Add subtitle tracks

                    // BEGIN: Chapters Implementation
                    if (chaptersData && chaptersData.length > 0) {
                        const chaptersTrack = playerRef.current.addTextTrack('chapters', 'Chapters', 'en');
                        // Add cues to the chapters track
                        chaptersData.forEach((chapter) => {
                            const cue = new (window.VTTCue || window.TextTrackCue)(
                                chapter.startTime,
                                chapter.endTime,
                                chapter.chapterTitle
                            );
                            chaptersTrack.addCue(cue);
                        });
                    }

                    // BEGIN: Implement custom next video button
                    if (!isEmbedPlayer && (mediaData?.nextLink || isDevMode)) {
                        // it seems that the nextLink is not always available, and it is need the this.player().trigger('nextVideo'); from NextVideoButton.js // TODO: remove the 1===1 and the mediaData?.nextLink
                        const nextVideoButton = new NextVideoButton(playerRef.current, {
                            isTouchDevice: isTouchDevice,
                        });
                        const playToggleIndex = controlBar.children().indexOf(playToggle); // Insert it after play button
                        controlBar.addChild(nextVideoButton, {}, playToggleIndex + 1); // After time display
                    }
                    // END: Implement custom next video button

                    // BEGIN: Implement custom time display component
                    const customRemainingTime = new CustomRemainingTime(playerRef.current, {
                        displayNegative: false,
                        customPrefix: '',
                        customSuffix: '',
                    });
                    const volumePanelIndex = controlBar.children().indexOf(volumePanel);
                    controlBar.addChild(customRemainingTime, {}, volumePanelIndex + 1);
                    customComponents.current.customRemainingTime = customRemainingTime;
                    // END: Implement custom time display component

                    // BEGIN: Add spacer to push right-side buttons to the right
                    if (
                        controlBar &&
                        customRemainingTime &&
                        customRemainingTime.el() &&
                        (PlayerConfig.progressBar.nonTouchPosition !== 'default' || isTouchDevice)
                    ) {
                        // Create spacer element
                        const spacer = document.createElement('div');
                        spacer.className = 'vjs-spacer-control vjs-control';
                        spacer.style.flex = '1';
                        spacer.style.minWidth = '1px';

                        // Remove background and style the spacer to be transparent
                        spacer.style.background = 'transparent';
                        spacer.style.backgroundColor = 'transparent';
                        spacer.style.border = 'none';
                        spacer.style.outline = 'none';
                        spacer.style.boxShadow = 'none';
                        spacer.style.opacity = '0';
                        spacer.style.pointerEvents = 'none';

                        // Insert spacer right after the time display
                        const controlBarEl = controlBar.el();
                        const timeDisplayEl = customRemainingTime.el();
                        const nextSibling = timeDisplayEl.nextSibling;

                        if (nextSibling) {
                            controlBarEl.insertBefore(spacer, nextSibling);
                        } else {
                            controlBarEl.appendChild(spacer);
                        }

                        // Store reference for cleanup
                        customComponents.current.spacer = spacer;
                    }
                    // END: Add spacer

                    // BEGIN: Implement autoplay toggle button - simplified
                    if (!isEmbedPlayer) {
                        try {
                            const autoplayToggleButton = new AutoplayToggleButton(playerRef.current, {
                                userPreferences: userPreferences.current,
                                isTouchDevice: isTouchDevice,
                            });
                            controlBar.addChild(autoplayToggleButton, {}, 11);

                            // Store reference for later use
                            customComponents.current.autoplayToggleButton = autoplayToggleButton;

                            // Force update icon after adding to DOM to ensure correct display
                            setTimeout(() => {
                                autoplayToggleButton.updateIcon();
                            }, 0);
                        } catch (error) {
                            console.error('✗ Failed to add autoplay toggle button:', error);
                        }
                    }
                    // END: Implement autoplay toggle button

                    // Make menus clickable instead of hover-only
                    setTimeout(() => {
                        const setupClickableMenus = () => {
                            // Find all menu buttons (subtitles, etc.) - exclude chaptersButton as it has custom overlay
                            const menuButtons = ['subtitlesButton', 'playbackRateMenuButton'];

                            menuButtons.forEach((buttonName) => {
                                const button = controlBar.getChild(buttonName);
                                if (button && button.menuButton_) {
                                    // Override the menu button behavior
                                    const menuButton = button.menuButton_;

                                    // Disable hover events
                                    menuButton.off('mouseenter');
                                    menuButton.off('mouseleave');

                                    // Add click-to-toggle behavior
                                    menuButton.on('click', function () {
                                        if (this.menu.hasClass('vjs-lock-showing')) {
                                            this.menu.removeClass('vjs-lock-showing');
                                            this.menu.hide();
                                        } else {
                                            this.menu.addClass('vjs-lock-showing');
                                            this.menu.show();
                                        }
                                    });
                                } else if (button) {
                                    // For buttons without menuButton_ property
                                    const buttonEl = button.el();
                                    if (buttonEl) {
                                        // Add click handler to show/hide menu
                                        buttonEl.addEventListener('click', function (e) {
                                            e.preventDefault();
                                            e.stopPropagation();

                                            const menu = buttonEl.querySelector('.vjs-menu');
                                            if (menu) {
                                                if (menu.style.display === 'block') {
                                                    menu.style.display = 'none';
                                                } else {
                                                    // Hide other menus first
                                                    document.querySelectorAll('.vjs-menu').forEach((m) => {
                                                        if (m !== menu) m.style.display = 'none';
                                                    });
                                                    menu.style.display = 'block';
                                                }
                                            }
                                        });
                                    }
                                }
                            });

                            // Add YouTube-like subtitles toggle with red underline
                            const ccNames = ['subtitlesButton', 'captionsButton', 'subsCapsButton'];
                            for (const n of ccNames) {
                                const cc = controlBar.getChild(n);
                                if (cc && cc.el()) {
                                    const el = cc.el();
                                    const menu = el.querySelector('.vjs-menu');
                                    if (menu) menu.style.display = 'none';

                                    // Different behavior for subtitles button - open settings menu directly
                                    if (n === 'subtitlesButton') {
                                        // Add tooltip to subtitles button
                                        el.setAttribute('title', 'Captions');
                                        el.setAttribute('aria-label', 'Captions');

                                        // Subtitles button toggles settings menu directly to subtitles
                                        const toggleSubtitlesSettings = (ev) => {
                                            ev.preventDefault();
                                            ev.stopPropagation();

                                            // Toggle settings menu - close if already open, open if closed
                                            if (
                                                customComponents.current.settingsMenu &&
                                                customComponents.current.settingsMenu.openSubtitlesMenu
                                            ) {
                                                const settingsMenu = customComponents.current.settingsMenu;
                                                const isOpen = settingsMenu.isMenuOpen && settingsMenu.isMenuOpen();

                                                if (isOpen) {
                                                    // Close the menu if it's already open
                                                    if (settingsMenu.closeMenu) {
                                                        settingsMenu.closeMenu();
                                                    }
                                                } else {
                                                    // Open the menu to subtitles submenu
                                                    settingsMenu.openSubtitlesMenu();
                                                }
                                            }
                                        };

                                        el.addEventListener('click', toggleSubtitlesSettings, { capture: true });

                                        // Add mobile touch support for subtitles button
                                        el.addEventListener(
                                            'touchend',
                                            (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                toggleSubtitlesSettings(e);
                                            },
                                            { passive: false }
                                        );

                                        // Apply red underline based on localStorage subtitleEnabled
                                        const updateSubtitleButtonState = () => {
                                            const subtitleEnabled =
                                                userPreferences.current.getPreference('subtitleEnabled');
                                            if (subtitleEnabled) {
                                                el.classList.add('vjs-subs-active');
                                            } else {
                                                el.classList.remove('vjs-subs-active');
                                            }
                                        };

                                        // Initial state
                                        updateSubtitleButtonState();

                                        // Listen for subtitle changes to update the red underline
                                        playerRef.current.on('texttrackchange', updateSubtitleButtonState);

                                        // Listen for custom subtitle state changes from settings menu
                                        const handleSubtitleStateChange = () => {
                                            updateSubtitleButtonState();
                                        };
                                        window.addEventListener('subtitleStateChanged', handleSubtitleStateChange);

                                        // Also listen for storage changes to update button state
                                        const handleStorageChange = () => {
                                            updateSubtitleButtonState();
                                        };
                                        window.addEventListener('storage', handleStorageChange);

                                        // Clean up event listeners when player is disposed
                                        playerRef.current.on('dispose', () => {
                                            window.removeEventListener(
                                                'subtitleStateChanged',
                                                handleSubtitleStateChange
                                            );
                                            window.removeEventListener('storage', handleStorageChange);
                                        });
                                    } else {
                                        // Other buttons (captions, subsCaps) keep the original toggle behavior
                                        const toggleSubs = (ev) => {
                                            ev.preventDefault();
                                            ev.stopPropagation();
                                            const tracks = playerRef.current.textTracks();
                                            let any = false;
                                            for (let i = 0; i < tracks.length; i++) {
                                                const t = tracks[i];
                                                if (t.kind === 'subtitles' && t.mode === 'showing') {
                                                    any = true;
                                                    break;
                                                }
                                            }
                                            if (any) {
                                                for (let i = 0; i < tracks.length; i++) {
                                                    const t = tracks[i];
                                                    if (t.kind === 'subtitles') t.mode = 'disabled';
                                                }
                                                el.classList.remove('vjs-subs-active');
                                                // Do not change saved language on quick toggle off; save enabled=false
                                                try {
                                                    userPreferences.current.setPreference(
                                                        'subtitleEnabled',
                                                        false,
                                                        true
                                                    );
                                                } catch (e) {
                                                    console.error('✗ Failed to set subtitleEnabled to false:', e);
                                                }
                                            } else {
                                                // Show using previously chosen language only; do not change it
                                                const preferred =
                                                    userPreferences.current.getPreference('subtitleLanguage');
                                                if (!preferred) {
                                                    // If no language chosen yet, enable first available and save it
                                                    let first = null;
                                                    for (let i = 0; i < tracks.length; i++) {
                                                        const t = tracks[i];
                                                        if (t.kind === 'subtitles') {
                                                            first = t.language;
                                                            break;
                                                        }
                                                    }
                                                    if (first) {
                                                        for (let i = 0; i < tracks.length; i++) {
                                                            const t = tracks[i];
                                                            if (t.kind === 'subtitles')
                                                                t.mode = t.language === first ? 'showing' : 'disabled';
                                                        }
                                                        try {
                                                            userPreferences.current.setPreference(
                                                                'subtitleLanguage',
                                                                first,
                                                                true
                                                            );
                                                        } catch (e) {
                                                            console.error(
                                                                '✗ Failed to set subtitleLanguage to first:',
                                                                e
                                                            );
                                                        }
                                                        try {
                                                            userPreferences.current.setPreference(
                                                                'subtitleEnabled',
                                                                true,
                                                                true
                                                            );
                                                        } catch (e) {
                                                            console.error(
                                                                '✗ Failed to set subtitleEnabled to true:',
                                                                e
                                                            );
                                                        }
                                                        el.classList.add('vjs-subs-active');
                                                    }
                                                    return;
                                                }
                                                let found = false;
                                                for (let i = 0; i < tracks.length; i++) {
                                                    const t = tracks[i];
                                                    if (t.kind === 'subtitles') {
                                                        const show = t.language === preferred;
                                                        t.mode = show ? 'showing' : 'disabled';
                                                        if (show) found = true;
                                                    }
                                                }
                                                if (found) {
                                                    el.classList.add('vjs-subs-active');
                                                    try {
                                                        userPreferences.current.setPreference(
                                                            'subtitleEnabled',
                                                            true,
                                                            true
                                                        );
                                                    } catch (e) {
                                                        console.error('✗ Failed to set subtitleEnabled to true:', e);
                                                    }
                                                }
                                            }
                                        };

                                        el.addEventListener('click', toggleSubs, { capture: true });

                                        // Add mobile touch support for subtitles button
                                        el.addEventListener(
                                            'touchend',
                                            (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                toggleSubs(e);
                                            },
                                            { passive: false }
                                        );
                                    }

                                    // Sync underline state on external changes
                                    playerRef.current.on('texttrackchange', () => {
                                        const tracks = playerRef.current.textTracks();
                                        let any = false;
                                        for (let i = 0; i < tracks.length; i++) {
                                            const t = tracks[i];
                                            if (t.kind === 'subtitles' && t.mode === 'showing') {
                                                any = true;
                                                break;
                                            }
                                        }
                                        if (any) el.classList.add('vjs-subs-active');
                                        else el.classList.remove('vjs-subs-active');
                                    });

                                    // Initialize state immediately
                                    const tracks = playerRef.current.textTracks();
                                    let any = false;
                                    for (let i = 0; i < tracks.length; i++) {
                                        const t = tracks[i];
                                        if (t.kind === 'subtitles' && t.mode === 'showing') {
                                            any = true;
                                            break;
                                        }
                                    }
                                    if (any) el.classList.add('vjs-subs-active');

                                    break;
                                }
                            }
                        };

                        setupClickableMenus();
                    }, 1500);

                    // BEGIN: Add chapter markers and sprite preview to progress control
                    if (progressControl && seekBar) {
                        // Check if we have chapters
                        const hasChapters = chaptersData && chaptersData.length > 0;

                        // Skip sprite preview and chapter markers for audio files
                        if (hasChapters && mediaData.media_type !== 'audio') {
                            // Use original ChapterMarkers with sprite functionality when chapters exist
                            const chapterMarkers = new ChapterMarkers(playerRef.current, {
                                previewSprite: mediaData.previewSprite,
                                isTouchDevice: isTouchDevice,
                            });
                            seekBar.addChild(chapterMarkers);
                        } else if (mediaData.previewSprite && !isTouchDevice && mediaData.media_type !== 'audio') {
                            // Use separate SpritePreview component only when no chapters but sprite data exists
                            // Skip on touch devices and audio files to avoid unwanted tooltips
                            const spritePreview = new SpritePreview(playerRef.current, {
                                previewSprite: mediaData.previewSprite,
                                isTouchDevice: isTouchDevice,
                            });
                            seekBar.addChild(spritePreview);

                            // Setup sprite preview hover functionality (only on non-touch devices)
                            setTimeout(() => {
                                spritePreview.setupProgressBarHover();
                            }, 100);
                        }
                    }
                    // END: Add chapter markers and sprite preview to progress control

                    // BEGIN: Move Picture-in-Picture and Fullscreen buttons to the very end
                    setTimeout(() => {
                        try {
                            const pictureInPictureToggle = controlBar.getChild('pictureInPictureToggle');
                            const fullscreenToggle = controlBar.getChild('fullscreenToggle');

                            // Move Picture-in-Picture button to the very end (if it exists)
                            if (pictureInPictureToggle) {
                                controlBar.removeChild(pictureInPictureToggle);
                                controlBar.addChild(pictureInPictureToggle);
                            }

                            // Move Fullscreen button to the very end (after PiP)
                            if (fullscreenToggle) {
                                controlBar.removeChild(fullscreenToggle);
                                controlBar.addChild(fullscreenToggle);
                            }
                        } catch (e) {
                            console.error('✗ Failed to move PiP/Fullscreen buttons to end:', e);
                        }
                    });
                    // END: Move Picture-in-Picture and Fullscreen buttons to the very end

                    // BEGIN: Add Chapters Overlay Component
                    if (chaptersData && chaptersData.length > 0) {
                        customComponents.current.chaptersOverlay = new CustomChaptersOverlay(playerRef.current, {
                            chaptersData: chaptersData,
                            seriesTitle: mediaData?.data?.title || 'Chapters',
                            channelName: 'Chapter',
                            thumbnail: mediaData?.data?.thumbnail_url || mediaData?.data?.author_thumbnail || '',
                        });
                    }
                    // END: Add Chapters Overlay Component

                    // BEGIN: Add Embed Info Overlay Component (for embed player only)
                    if (isEmbedPlayer) {
                        customComponents.current.embedInfoOverlay = new EmbedInfoOverlay(playerRef.current, {
                            authorName: currentVideo.author_name,
                            authorProfile: currentVideo.author_profile,
                            authorThumbnail: currentVideo.author_thumbnail,
                            videoTitle: currentVideo.title,
                            videoUrl: currentVideo.url,
                            showTitle: finalShowTitle,
                            showRelated: finalShowRelated,
                            showUserAvatar: finalShowUserAvatar,
                            linkTitle: finalLinkTitle,
                        });
                    }
                    // END: Add Embed Info Overlay Component

                    // BEGIN: Add Settings Menu Component
                    customComponents.current.settingsMenu = new CustomSettingsMenu(playerRef.current, {
                        userPreferences: userPreferences.current,
                        qualities: availableQualities,
                        hasSubtitles: hasSubtitles,
                        isTouchDevice: isTouchDevice,
                    });

                    // If qualities change per video (e.g., via MEDIA_DATA update), refresh menu
                    try {
                        playerRef.current.on('loadedmetadata', () => {
                            if (
                                customComponents.current.settingsMenu &&
                                customComponents.current.settingsMenu.setQualities
                            ) {
                                const md = typeof window !== 'undefined' ? window.MEDIA_DATA : null;
                                const newQualities = md?.data?.qualities || availableQualities;
                                customComponents.current.settingsMenu.setQualities(newQualities);
                            }
                        });
                    } catch {
                        // Ignore errors when setting up settings menu quality updates
                    }

                    // BEGIN: Initialize keyboard handler
                    keyboardHandler.current = new KeyboardHandler(
                        playerRef,
                        customComponents,
                        { seekAmount: 5 } // 5 seconds seek amount
                    );
                    keyboardHandler.current.init();

                    // Store cleanup function for keyboard handler
                    customComponents.current.cleanupKeyboardHandler = () => {
                        if (keyboardHandler.current) {
                            keyboardHandler.current.destroy();
                            keyboardHandler.current = null;
                        }
                    };
                    // END: Initialize keyboard handler
                });

                // Listen for next video event
                playerRef.current.on('nextVideo', () => {
                    goToNextVideo();
                });

                // BEGIN: Add Seek Indicator Component
                customComponents.current.seekIndicator = new SeekIndicator(playerRef.current, {
                    seekAmount: 5, // 5 seconds seek amount
                    isEmbedPlayer: isEmbedPlayer, // Pass embed mode flag
                });
                // Add the component but ensure it's hidden initially
                playerRef.current.addChild(customComponents.current.seekIndicator);

                customComponents.current.seekIndicator.hide(); // Explicitly hide on creation
                // END: Add Seek Indicator Component

                // BEGIN: Initialize playback event handler
                playbackEventHandler.current = new PlaybackEventHandler(playerRef, customComponents, {
                    isEmbedPlayer: isEmbedPlayer,
                    showSeekIndicators: true,
                });
                playbackEventHandler.current.init();

                // Store cleanup function for playback event handler
                customComponents.current.cleanupPlaybackEventHandler = () => {
                    if (playbackEventHandler.current) {
                        playbackEventHandler.current.destroy();
                        playbackEventHandler.current = null;
                    }
                };
                // END: Initialize playback event handler

                // Focus the player element so keyboard controls work
                // This ensures keyboard events work properly in both normal and fullscreen modes
                playerRef.current.ready(() => {
                    // Focus the player element and set up focus handling
                    if (playerRef.current.el()) {
                        // Make the video element focusable
                        const videoElement = playerRef.current.el();
                        videoElement.setAttribute('tabindex', '0');
                        
                        if (!isEmbedPlayer) {
                            videoElement.focus();
                        }

                        // Add context menu (right-click) handler to the player wrapper and video element
                        // Attach to player wrapper (this catches all clicks on the player)
                        videoElement.addEventListener('contextmenu', handleContextMenu, true);

                        // Also try to attach to the actual video tech element
                        const attachContextMenu = () => {
                            const techElement =
                                playerRef.current.el().querySelector('.vjs-tech') ||
                                playerRef.current.el().querySelector('video') ||
                                (playerRef.current.tech() && playerRef.current.tech().el());

                            if (techElement && techElement !== videoRef.current && techElement !== videoElement) {
                                // Use capture phase to catch before Video.js might prevent it
                                techElement.addEventListener('contextmenu', handleContextMenu, true);
                                return true;
                            }
                            return false;
                        };

                        // Try to attach immediately
                        attachContextMenu();

                        // Also try after a short delay in case elements aren't ready yet
                        setTimeout(() => {
                            attachContextMenu();
                        }, 100);

                        // Also try when video is loaded
                        playerRef.current.one('loadedmetadata', () => {
                            attachContextMenu();
                        });
                    }
                });
            }
            //}, 0);
        }

        // Cleanup: Remove context menu event listener
        return () => {
            if (playerRef.current && playerRef.current.el()) {
                const playerEl = playerRef.current.el();
                playerEl.removeEventListener('contextmenu', handleContextMenu, true);

                const techElement =
                    playerEl.querySelector('.vjs-tech') ||
                    playerEl.querySelector('video') ||
                    (playerRef.current.tech() && playerRef.current.tech().el());
                if (techElement) {
                    techElement.removeEventListener('contextmenu', handleContextMenu, true);
                }
            }
        };
    }, []);

    return (
        <>
            <video
                ref={videoRef}
                id={videoId}
                controls={true}
                className={`video-js ${isEmbedPlayer ? 'vjs-fill' : 'vjs-fluid'} vjs-default-skin${currentVideo.useRoundedCorners ? ' video-js-rounded-corners' : ''}`}
                preload="auto"
                poster={currentVideo.poster}
                tabIndex="0"
            >
                {/* <source src="/videos/sample-video.mp4" type="video/mp4" />
                <source src="/videos/sample-video.webm" type="video/webm" /> */}
                <p className="vjs-no-js">
                    To view this video please enable JavaScript, and consider upgrading to a web browser that
                    <a href="https://videojs.com/html5-video-support/" target="_blank">
                        supports HTML5 video
                    </a>
                </p>

                {/* Add subtitle tracks */}
                {/* {subtitleTracks &&
                    subtitleTracks.map((track, index) => (
                        <track
                            key={index}
                            kind={track.kind}
                            src={track.src}
                            srcLang={track.srclang}
                            label={track.label}
                            default={track.default}
                        />
                    ))} */}
                {/* 
                <track kind="chapters" src="/sample-chapters.vtt" /> */}
                {/* Add chapters track */}
                {/*  {chaptersData &&
                    chaptersData.length > 0 &&
                    (console.log('chaptersData', chaptersData), (<track kind="chapters" src="/sample-chapters.vtt" />))} */}
            </video>
            <VideoContextMenu
                visible={contextMenuVisible}
                position={contextMenuPosition}
                onClose={closeContextMenu}
                onCopyVideoUrl={handleCopyVideoUrl}
                onCopyVideoUrlAtTime={handleCopyVideoUrlAtTime}
                onCopyEmbedCode={handleCopyEmbedCode}
            />
        </>
    );
}

export default VideoJSPlayer;
