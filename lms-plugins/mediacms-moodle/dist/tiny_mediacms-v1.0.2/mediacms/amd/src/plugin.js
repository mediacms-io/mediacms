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
    let embedUrl = url;
    let width = 560;
    let height = 315;
    try {
        const urlObj = new URL(url);
        if (urlObj.pathname === '/view') {
            urlObj.pathname = '/embed';
        }
        const w = parseInt(urlObj.searchParams.get('width'));
        const h = parseInt(urlObj.searchParams.get('height'));
        if (w > 0) {
            width = w;
        }
        if (h > 0) {
            height = h;
        }
        embedUrl = urlObj.toString();
    } catch (e) {
        // Keep defaults if parsing fails
    }

    const style = `width:100%;max-width:${width}px;height:auto;` +
        `aspect-ratio:${width} / ${height};display:block;margin:0 auto;border:0;`;
    return `<iframe src="${embedUrl}" width="${width}" height="${height}" ` +
        `style="${style}" frameborder="0" allowfullscreen></iframe>`;
};

/**
 * Convert standalone MediaCMS URL text nodes to iframes.
 * Uses DOM traversal so URLs inside <a> tags (text links) are never touched.
 *
 * @param {string} html - Raw HTML string from the editor
 * @returns {string} HTML with standalone URLs replaced by iframe HTML
 */
const convertUrlsToIframes = (html) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const nodesToReplace = [];
    const walk = (el) => {
        for (const child of Array.from(el.childNodes)) {
            if (child.nodeType === Node.TEXT_NODE) {
                const url = child.textContent.trim();
                if (isMediaCMSUrl(url)) {
                    nodesToReplace.push({node: child, url});
                }
            } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() !== 'a') {
                walk(child);
            }
            // Do not recurse into <a> tags — text links must be preserved as-is
        }
    };
    walk(tempDiv);

    nodesToReplace.forEach(({node, url}) => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = mediaCMSUrlToIframe(url);
        const iframe = wrapper.firstChild;
        if (iframe) {
            node.parentNode.replaceChild(iframe, node);
        }
    });

    return tempDiv.innerHTML;
};

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

        // Convert standalone MediaCMS URL text nodes to iframes when loading content.
        // Text links (<a data-mediacms-textlink>) are preserved because DOM traversal skips <a> tags.
        editor.on('BeforeSetContent', (e) => {
            if (e.content && typeof e.content === 'string') {
                e.content = convertUrlsToIframes(e.content);
            }
        });

        // Convert MediaCMS iframes back to plain embed URLs when saving.
        // Width/height are encoded in the URL params so the filter and BeforeSetContent
        // can reconstruct the correct responsive iframe on next load.
        editor.on('GetContent', (e) => {
            if (e.format === 'html') {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = e.content;

                tempDiv.querySelectorAll('.tiny-mediacms-edit-btn').forEach(btn => btn.remove());

                tempDiv.querySelectorAll('iframe').forEach(iframe => {
                    const src = iframe.getAttribute('src');
                    if (isMediaCMSUrl(src)) {
                        const wrapper = iframe.closest('.tiny-mediacms-iframe-wrapper') ||
                                        iframe.closest('.tiny-iframe-responsive');
                        const p = document.createElement('p');
                        p.appendChild(document.createTextNode(src));
                        if (wrapper) {
                            wrapper.parentNode.insertBefore(p, wrapper);
                            wrapper.remove();
                        } else {
                            iframe.parentNode.insertBefore(p, iframe);
                            iframe.remove();
                        }
                    }
                });

                tempDiv.querySelectorAll('.tiny-mediacms-iframe-wrapper, .tiny-iframe-responsive').forEach(wrapper => {
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
