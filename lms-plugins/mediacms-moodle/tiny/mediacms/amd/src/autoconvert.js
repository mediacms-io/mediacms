// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Tiny MediaCMS Auto-convert module.
 *
 * This module automatically converts pasted MediaCMS URLs into embedded videos.
 * When a user pastes a MediaCMS video URL (e.g., https://deic.mediacms.io/view?m=JpBd1Zvdl),
 * it will be automatically converted to an iframe embed.
 *
 * @module      tiny_mediacms/autoconvert
 * @copyright   2024
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import {getData} from './options';

/**
 * Regular expression patterns for MediaCMS URLs.
 * Matches URLs like:
 * - https://deic.mediacms.io/view?m=JpBd1Zvdl
 * - https://example.mediacms.io/view?m=VIDEO_ID
 * - Custom domains configured in the plugin
 */
const MEDIACMS_VIEW_URL_PATTERN = /^(https?:\/\/[^\/]+)\/view\?m=([a-zA-Z0-9_-]+)$/;

/**
 * Check if a string is a valid MediaCMS view URL.
 *
 * @param {string} text - The text to check
 * @returns {Object|null} - Parsed URL info or null if not a valid MediaCMS URL
 */
const parseMediaCMSUrl = (text) => {
    if (!text || typeof text !== 'string') {
        return null;
    }

    const trimmed = text.trim();

    // Check for MediaCMS view URL pattern
    const match = trimmed.match(MEDIACMS_VIEW_URL_PATTERN);
    if (match) {
        return {
            baseUrl: match[1],
            videoId: match[2],
            originalUrl: trimmed,
        };
    }

    return null;
};

/**
 * Check if the pasted URL's domain is allowed based on configuration.
 *
 * @param {Object} parsed - Parsed URL info
 * @param {Object} config - Plugin configuration
 * @returns {boolean} - True if the domain is allowed
 */
const isDomainAllowed = (parsed, config) => {
    // If no specific base URL is configured, allow all MediaCMS domains
    const configuredBaseUrl = config.autoConvertBaseUrl || config.mediacmsBaseUrl;
    if (!configuredBaseUrl) {
        return true;
    }

    // Check if the URL's base matches the configured base URL
    try {
        const configuredUrl = new URL(configuredBaseUrl);
        const pastedUrl = new URL(parsed.baseUrl);
        return configuredUrl.host === pastedUrl.host;
    } catch (e) {
        // If URL parsing fails, allow the conversion
        return true;
    }
};

/**
 * Generate the iframe embed HTML for a MediaCMS video.
 *
 * @param {Object} parsed - Parsed URL info
 * @param {Object} options - Embed options
 * @returns {string} - The iframe HTML
 */
const generateEmbedHtml = (parsed, options = {}) => {
    // Build the embed URL with default options
    const embedUrl = new URL(`${parsed.baseUrl}/embed`);
    embedUrl.searchParams.set('m', parsed.videoId);

    // Apply default options (all enabled by default for best user experience)
    embedUrl.searchParams.set('showTitle', options.showTitle !== false ? '1' : '0');
    embedUrl.searchParams.set('showRelated', options.showRelated !== false ? '1' : '0');
    embedUrl.searchParams.set('showUserAvatar', options.showUserAvatar !== false ? '1' : '0');
    embedUrl.searchParams.set('linkTitle', options.linkTitle !== false ? '1' : '0');

    // Generate responsive iframe HTML matching the template output format.
    // Uses aspect-ratio CSS for responsive sizing (16:9 default).
    // The wrapper will be added by editor for UI (edit button), then stripped on save.
    const html = `<iframe src="${embedUrl.toString()}" ` +
        `style="width: 100%; aspect-ratio: 16 / 9; display: block; border: 0;" ` +
        `allowfullscreen="allowfullscreen"></iframe>`;

    return html;
};

/**
 * Set up auto-conversion for the editor.
 * This registers event handlers to detect pasted MediaCMS URLs.
 *
 * @param {TinyMCE} editor - The TinyMCE editor instance
 */
export const setupAutoConvert = (editor) => {
    const config = getData(editor) || {};

    // Check if auto-convert is enabled (default: true)
    if (config.autoConvertEnabled === false) {
        return;
    }

    // Handle paste events
    editor.on('paste', (e) => {
        handlePasteEvent(editor, e, config);
    });

    // Also handle input events for drag-and-drop text or keyboard paste
    editor.on('input', (e) => {
        handleInputEvent(editor, e, config);
    });
};

/**
 * Handle paste events to detect and convert MediaCMS URLs.
 *
 * @param {TinyMCE} editor - The TinyMCE editor instance
 * @param {Event} e - The paste event
 * @param {Object} config - Plugin configuration
 */
const handlePasteEvent = (editor, e, config) => {
    // Get pasted text from clipboard
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) {
        return;
    }

    // Try to get plain text first
    const text = clipboardData.getData('text/plain') || clipboardData.getData('text');
    if (!text) {
        return;
    }

    // Check if it's a MediaCMS URL
    const parsed = parseMediaCMSUrl(text);
    if (!parsed) {
        return;
    }

    // Check if domain is allowed
    if (!isDomainAllowed(parsed, config)) {
        return;
    }

    // Prevent default paste behavior
    e.preventDefault();
    e.stopPropagation();

    // Generate and insert the embed HTML
    const embedHtml = generateEmbedHtml(parsed, config.autoConvertOptions || {});

    // Use a slight delay to ensure the editor is ready
    setTimeout(() => {
        editor.insertContent(embedHtml);
        // Move cursor after the inserted content
        editor.selection.collapse(false);
    }, 0);
};

/**
 * Handle input events to catch URLs that might have been pasted without triggering paste event.
 * This is a fallback for certain browsers/scenarios.
 *
 * @param {TinyMCE} editor - The TinyMCE editor instance
 * @param {Event} e - The input event
 * @param {Object} config - Plugin configuration
 */
const handleInputEvent = (editor, e, config) => {
    // Only process inputType 'insertFromPaste' if paste event didn't catch it
    if (e.inputType !== 'insertFromPaste' && e.inputType !== 'insertText') {
        return;
    }

    // Get the current node and check if it contains just a URL
    const node = editor.selection.getNode();
    if (!node || node.nodeName !== 'P') {
        return;
    }

    // Check if the paragraph contains only a MediaCMS URL
    const text = node.textContent || '';
    const parsed = parseMediaCMSUrl(text);

    if (!parsed || !isDomainAllowed(parsed, config)) {
        return;
    }

    // Don't convert if there's other content in the paragraph
    const trimmedHtml = node.innerHTML.trim();
    if (trimmedHtml !== text.trim() && !trimmedHtml.startsWith(text.trim())) {
        return;
    }

    // Generate the embed HTML
    const embedHtml = generateEmbedHtml(parsed, config.autoConvertOptions || {});

    // Replace the paragraph content with the embed
    // Use a slight delay to let the input event complete
    setTimeout(() => {
        // Re-check that the node still contains the URL (user might have typed more)
        const currentText = node.textContent || '';
        const currentParsed = parseMediaCMSUrl(currentText);

        if (currentParsed && currentParsed.originalUrl === parsed.originalUrl) {
            // Select and replace the entire node
            editor.selection.select(node);
            editor.insertContent(embedHtml);
        }
    }, 100);
};

/**
 * Check if a text is a MediaCMS URL (public helper).
 *
 * @param {string} text - The text to check
 * @returns {boolean} - True if it's a MediaCMS URL
 */
export const isMediaCMSUrl = (text) => {
    return parseMediaCMSUrl(text) !== null;
};

/**
 * Convert a MediaCMS URL to embed HTML (public helper).
 *
 * @param {string} url - The MediaCMS URL
 * @param {Object} options - Embed options
 * @returns {string|null} - The embed HTML or null if not a valid URL
 */
export const convertToEmbed = (url, options = {}) => {
    const parsed = parseMediaCMSUrl(url);
    if (!parsed) {
        return null;
    }
    return generateEmbedHtml(parsed, options);
};
