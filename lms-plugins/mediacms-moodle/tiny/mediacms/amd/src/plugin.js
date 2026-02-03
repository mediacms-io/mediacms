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
 * Tiny Media plugin for Moodle.
 *
 * @module      tiny_mediacms/plugin
 * @copyright   2022 Andrew Lyons <andrew@nicols.co.uk>
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
import {getTinyMCE} from 'editor_tiny/loader';
import {getPluginMetadata} from 'editor_tiny/utils';

import {component, pluginName} from './common';
import * as Commands from './commands';
import * as Configuration from './configuration';
import * as Options from './options';
import {setupAutoConvert} from './autoconvert';

/**
 * Check if a URL is a MediaCMS URL (embed or view).
 *
 * @param {string} url - The URL to check
 * @returns {boolean} True if it's a MediaCMS URL
 */
const isMediaCMSUrl = (url) => {
    if (!url) {
        return false;
    }
    try {
        const urlObj = new URL(url);
        // Match both /embed and /view paths with ?m= parameter
        return (urlObj.pathname === '/embed' || urlObj.pathname === '/view') && urlObj.searchParams.has('m');
    } catch (e) {
        return false;
    }
};

/**
 * Convert a MediaCMS URL (embed or view) to an iframe HTML string.
 * If it's a view URL, it will be converted to embed URL.
 *
 * @param {string} url - The MediaCMS URL
 * @returns {string} The iframe HTML
 */
const mediaCMSUrlToIframe = (url) => {
    // Convert view URL to embed URL if needed
    let embedUrl = url;
    try {
        const urlObj = new URL(url);
        if (urlObj.pathname === '/view') {
            urlObj.pathname = '/embed';
            embedUrl = urlObj.toString();
        }
    } catch (e) {
        // Keep original URL if parsing fails
    }

    return `<iframe src="${embedUrl}" ` +
        `style="width: 100%; aspect-ratio: 16 / 9; display: block; border: 0;" ` +
        `allowfullscreen="allowfullscreen"></iframe>`;
};

/**
 * Regular expression to match standalone MediaCMS URLs in content.
 * Matches URLs that are on their own line or surrounded by whitespace/tags.
 * The URL must contain /embed?m= or /view?m= pattern.
 */
const MEDIACMS_URL_PATTERN = /(^|>|\s)(https?:\/\/[^\s<>"]+\/(?:embed|view)\?m=[^\s<>"]+)(<|\s|$)/g;

// eslint-disable-next-line no-async-promise-executor
export default new Promise(async(resolve) => {
    const [
        tinyMCE,
        setupCommands,
        pluginMetadata,
    ] = await Promise.all([
        getTinyMCE(),
        Commands.getSetup(),
        getPluginMetadata(component, pluginName),
    ]);

    tinyMCE.PluginManager.add(`${component}/plugin`, (editor) => {
        // Register options.
        Options.register(editor);

        // Setup the Commands (buttons, menu items, and so on).
        setupCommands(editor);

        // Setup auto-conversion of pasted MediaCMS URLs.
        setupAutoConvert(editor);

        // Convert MediaCMS URLs to iframes when content is loaded into the editor.
        // This handles content from the database that was saved as just URLs.
        editor.on('BeforeSetContent', (e) => {
            if (e.content && typeof e.content === 'string') {
                // Replace standalone MediaCMS URLs with iframes
                e.content = e.content.replace(MEDIACMS_URL_PATTERN, (match, before, url, after) => {
                    // Verify it's a valid MediaCMS URL
                    if (isMediaCMSUrl(url)) {
                        return before + mediaCMSUrlToIframe(url) + after;
                    }
                    return match;
                });
            }
        });

        // Convert MediaCMS iframes back to just embed URLs when saving.
        // This stores only the URL in the database, not the full iframe HTML.
        editor.on('GetContent', (e) => {
            if (e.format === 'html') {
                // Create a temporary container to manipulate the HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = e.content;

                // Remove edit buttons
                tempDiv.querySelectorAll('.tiny-mediacms-edit-btn').forEach(btn => btn.remove());

                // Process all iframes - convert MediaCMS iframes to just URLs
                tempDiv.querySelectorAll('iframe').forEach(iframe => {
                    const src = iframe.getAttribute('src');
                    if (isMediaCMSUrl(src)) {
                        // Check if iframe is inside a wrapper
                        const wrapper = iframe.closest('.tiny-mediacms-iframe-wrapper') ||
                                        iframe.closest('.tiny-iframe-responsive');

                        // Create a text node with just the URL
                        const urlText = document.createTextNode(src);

                        // Wrap in a paragraph for proper formatting
                        const p = document.createElement('p');
                        p.appendChild(urlText);

                        if (wrapper) {
                            // Replace the entire wrapper with the URL
                            wrapper.parentNode.insertBefore(p, wrapper);
                            wrapper.remove();
                        } else {
                            // Replace just the iframe with the URL
                            iframe.parentNode.insertBefore(p, iframe);
                            iframe.remove();
                        }
                    }
                });

                // Clean up any remaining wrappers that might not have had MediaCMS iframes
                tempDiv.querySelectorAll('.tiny-mediacms-iframe-wrapper').forEach(wrapper => {
                    const iframe = wrapper.querySelector('iframe');
                    if (iframe) {
                        wrapper.parentNode.insertBefore(iframe, wrapper);
                    }
                    wrapper.remove();
                });

                tempDiv.querySelectorAll('.tiny-iframe-responsive').forEach(wrapper => {
                    const iframe = wrapper.querySelector('iframe');
                    if (iframe) {
                        wrapper.parentNode.insertBefore(iframe, wrapper);
                    }
                    wrapper.remove();
                });

                e.content = tempDiv.innerHTML;
            }
        });

        return pluginMetadata;
    });

    // Resolve the Media Plugin and include configuration.
    resolve([`${component}/plugin`, Configuration]);
});
