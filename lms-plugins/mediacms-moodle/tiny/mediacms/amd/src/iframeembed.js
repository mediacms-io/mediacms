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
 * Tiny Media2 Iframe Embed class.
 *
 * @module      tiny_mediacms/iframeembed
 * @copyright   2024
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import Templates from 'core/templates';
import { getString } from 'core/str';
import * as ModalEvents from 'core/modal_events';
import { component } from './common';
import IframeModal from './iframemodal';
import Selectors from './selectors';
import { getLti, getData } from './options';

export default class IframeEmbed {
    editor = null;
    currentModal = null;
    isUpdating = false;
    selectedIframe = null;
    debounceTimer = null;
    // Iframe library state
    iframeLibraryLoaded = false;
    selectedLibraryVideo = null;
    iframeLibraryUrl =
        'https://temp.web357.com/mediacms/deic-mediacms-embed-videos.html';

    constructor(editor) {
        this.editor = editor;
    }

    /**
     * Parse input to extract video URL or iframe src.
     * Handles: iframe embed code, view URL, or embed URL.
     *
     * @param {string} input - The user input (URL or embed code)
     * @returns {Object|null} Parsed URL info or null if invalid
     */
    parseInput(input) {
        if (!input || !input.trim()) {
            return null;
        }

        input = input.trim();

        // Check if it's an iframe embed code
        const iframeMatch = input.match(
            /<iframe[^>]*src=["']([^"']+)["'][^>]*>/i,
        );
        if (iframeMatch) {
            return this.parseEmbedUrl(iframeMatch[1]);
        }

        // Check if it's a URL
        if (input.startsWith('http://') || input.startsWith('https://')) {
            return this.parseVideoUrl(input);
        }

        return null;
    }

    /**
     * Parse a video view URL and convert to embed format.
     *
     * @param {string} url - The video URL
     * @returns {Object|null} Parsed info
     */
    parseVideoUrl(url) {
        try {
            const urlObj = new URL(url);
            const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

            // MediaCMS view URL: /view?m=VIDEO_ID
            if (urlObj.pathname === '/view' && urlObj.searchParams.has('m')) {
                return {
                    baseUrl: baseUrl,
                    videoId: urlObj.searchParams.get('m'),
                    isEmbed: false,
                };
            }

            // MediaCMS embed URL: /embed?m=VIDEO_ID&options
            if (urlObj.pathname === '/embed' && urlObj.searchParams.has('m')) {
                const tParam = urlObj.searchParams.get('t');
                const widthParam = urlObj.searchParams.get('width');
                const heightParam = urlObj.searchParams.get('height');
                return {
                    baseUrl: baseUrl,
                    videoId: urlObj.searchParams.get('m'),
                    isEmbed: true,
                    showTitle: urlObj.searchParams.get('showTitle') === '1',
                    linkTitle: urlObj.searchParams.get('linkTitle') === '1',
                    showRelated: urlObj.searchParams.get('showRelated') === '1',
                    showUserAvatar:
                        urlObj.searchParams.get('showUserAvatar') === '1',
                    width: widthParam ? parseInt(widthParam) : null,
                    height: heightParam ? parseInt(heightParam) : null,
                    startAt: tParam
                        ? this.secondsToTimeString(parseInt(tParam))
                        : null,
                };
            }

            // Moodle LTI launch.php URL: /filter/mediacms/launch.php?token=TOKEN
            // This is used when selecting from "My Media" via LTI
            // We treat it as a generic iframe URL (keep as-is)
            if (urlObj.pathname.includes('/filter/mediacms/launch.php') && urlObj.searchParams.has('token')) {
                return {
                    baseUrl: baseUrl,
                    videoId: urlObj.searchParams.get('token'),
                    rawUrl: url,
                    isLtiLaunch: true,
                };
            }

            // Generic URL - just use as-is
            return {
                baseUrl: baseUrl,
                rawUrl: url,
                isGeneric: true,
            };
        } catch (e) {
            return null;
        }
    }

    /**
     * Parse an embed URL.
     *
     * @param {string} url - The embed URL
     * @returns {Object|null} Parsed info
     */
    parseEmbedUrl(url) {
        return this.parseVideoUrl(url);
    }

    /**
     * Convert seconds to time string (M:SS format).
     *
     * @param {number} seconds - Time in seconds
     * @returns {string} Time string
     */
    secondsToTimeString(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Convert time string to seconds.
     *
     * @param {string} timeStr - Time string (M:SS or just seconds)
     * @returns {number|null} Seconds or null if invalid
     */
    timeStringToSeconds(timeStr) {
        if (!timeStr || !timeStr.trim()) {
            return null;
        }
        timeStr = timeStr.trim();

        // Handle M:SS format
        if (timeStr.includes(':')) {
            const parts = timeStr.split(':');
            const mins = parseInt(parts[0]) || 0;
            const secs = parseInt(parts[1]) || 0;
            return mins * 60 + secs;
        }

        // Handle plain seconds
        const secs = parseInt(timeStr);
        return isNaN(secs) ? null : secs;
    }

    /**
     * Parse width/height value.
     *
     * @param {string} value - Width or height value
     * @returns {number|null} Parsed value
     */
    parseWidthHeight(value) {
        if (!value) {
            return null;
        }
        const parsed = parseInt(value.trim());
        return isNaN(parsed) ? null : parsed;
    }

    /**
     * Build the embed URL with options.
     *
     * @param {Object} parsed - Parsed URL info
     * @param {Object} options - Embed options
     * @returns {string} The complete embed URL
     */
    buildEmbedUrl(parsed, options) {
        if (parsed.isGeneric || parsed.isLtiLaunch) {
            return parsed.rawUrl;
        }

        const url = new URL(`${parsed.baseUrl}/embed`);
        url.searchParams.set('m', parsed.videoId);

        // Always include all options with 1 or 0
        url.searchParams.set('showTitle', options.showTitle ? '1' : '0');
        url.searchParams.set('showRelated', options.showRelated ? '1' : '0');
        url.searchParams.set(
            'showUserAvatar',
            options.showUserAvatar ? '1' : '0',
        );
        url.searchParams.set('linkTitle', options.linkTitle ? '1' : '0');

        // Add width and height if provided
        if (options.width) {
            url.searchParams.set('width', options.width.toString());
        }
        if (options.height) {
            url.searchParams.set('height', options.height.toString());
        }

        // Add start time if enabled
        if (options.startAtEnabled && options.startAt) {
            const seconds = this.timeStringToSeconds(options.startAt);
            if (seconds !== null && seconds > 0) {
                url.searchParams.set('t', seconds.toString());
            }
        }

        return url.toString();
    }

    /**
     * Get the template context for the modal.
     *
     * @param {Object} data - Existing data for updating
     * @returns {Object} Template context
     */
    async getTemplateContext(data = {}) {
        // Get admin settings for default checkbox values.
        const editorData = getData(this.editor);
        const autoConvertOptions = editorData?.autoConvertOptions || {};

        // Use admin settings as defaults when creating new embed (not updating).
        // When updating, use the values from the existing iframe.
        const getDefault = (key, fallback = true) => {
            if (this.isUpdating && data[key] !== undefined) {
                return data[key];
            }
            return autoConvertOptions[key] !== undefined
                ? autoConvertOptions[key]
                : fallback;
        };

        // Determine dimensions:
        // - For editing: preserve existing dimensions
        // - For new embeds: default to 640x360
        let width, height;

        if (this.isUpdating && (data.width || data.height)) {
            // Editing: preserve existing dimensions
            width = data.width || 640;
            height = data.height || 360;
        } else {
            // New embed: default to 640x360 (16:9 aspect ratio)
            width = 640;
            height = 360;
        }

        return {
            elementid: this.editor.getElement().id,
            isupdating: this.isUpdating,
            url: data.url || '',
            showTitle: getDefault('showTitle'),
            linkTitle: getDefault('linkTitle'),
            showRelated: getDefault('showRelated'),
            showUserAvatar: getDefault('showUserAvatar'),
            textLinkOnly: data.textLinkOnly || false,
            startAtEnabled: data.startAtEnabled || false,
            startAt: data.startAt || '0:00',
            width: width,
            height: height,
            is16_9: !data.aspectRatio || data.aspectRatio === '16:9',
            is4_3: data.aspectRatio === '4:3',
            is1_1: data.aspectRatio === '1:1',
            isCustom: data.aspectRatio === 'custom',
        };
    }

    /**
     * Display the iframe embed dialog.
     */
    async displayDialogue() {
        this.selectedIframe = this.getSelectedIframe();
        const data = this.getCurrentIframeData();
        this.isUpdating = data !== null;

        // Reset iframe library state for new modal
        this.iframeLibraryLoaded = false;

        this.currentModal = await IframeModal.create({
            title: getString('iframemodaltitle', component),
            templateContext: await this.getTemplateContext(data || {}),
        });

        await this.registerEventListeners(this.currentModal);
    }

    /**
     * Get the currently selected iframe or text link in the editor.
     *
     * @returns {HTMLElement|null} The iframe element, text link, or null
     */
    getSelectedIframe() {
        const node = this.editor.selection.getNode();

        // Check if it's a text-only link
        if (node.nodeName.toLowerCase() === 'a' && node.getAttribute('data-mediacms-textlink') === 'true') {
            return node;
        }

        if (node.nodeName.toLowerCase() === 'iframe') {
            return node;
        }

        // Check if selection contains an iframe wrapper (including overlay wrapper)
        const iframe = node.querySelector('iframe');
        if (iframe) {
            return iframe;
        }

        // Check if we're on the overlay or wrapper and need to find the iframe
        const wrapper =
            node.closest('.tiny-mediacms-iframe-wrapper') ||
            node.closest('.tiny-iframe-responsive');
        if (wrapper) {
            return wrapper.querySelector('iframe');
        }

        // Check if we're inside a text-only link
        const textLink = node.closest('a[data-mediacms-textlink="true"]');
        if (textLink) {
            return textLink;
        }

        return null;
    }

    /**
     * Get current iframe or text link data for editing.
     *
     * @returns {Object|null} Current iframe/link data or null
     */
    getCurrentIframeData() {
        if (!this.selectedIframe) {
            return null;
        }

        // Check if it's a text-only link
        if (this.selectedIframe.nodeName.toLowerCase() === 'a' &&
            this.selectedIframe.getAttribute('data-mediacms-textlink') === 'true') {
            const href = this.selectedIframe.getAttribute('href');
            const parsed = this.parseInput(href);

            return {
                url: href,
                width: parsed?.width || 560,
                height: parsed?.height || 315,
                showTitle: parsed?.showTitle ?? true,
                linkTitle: parsed?.linkTitle ?? true,
                showRelated: parsed?.showRelated ?? true,
                showUserAvatar: parsed?.showUserAvatar ?? true,
                responsive: true,
                textLinkOnly: true,
                startAtEnabled: parsed?.startAt !== null,
                startAt: parsed?.startAt || '0:00',
            };
        }

        // Handle iframe
        const src = this.selectedIframe.getAttribute('src');
        const parsed = this.parseInput(src);

        // Get width/height from URL params or iframe attributes
        let width = parsed?.width || this.selectedIframe.getAttribute('width') || null;
        let height = parsed?.height || this.selectedIframe.getAttribute('height') || null;

        // Parse numeric values
        width = width ? parseInt(width) : null;
        height = height ? parseInt(height) : null;

        return {
            url: src,
            width: width,
            height: height,
            showTitle: parsed?.showTitle ?? true,
            linkTitle: parsed?.linkTitle ?? true,
            showRelated: parsed?.showRelated ?? true,
            showUserAvatar: parsed?.showUserAvatar ?? true,
            startAtEnabled: parsed?.startAt !== null,
            startAt: parsed?.startAt || '0:00',
        };
    }

    /**
     * Get form values from the modal.
     *
     * @param {HTMLElement} root - Modal root element
     * @returns {Object} Form values
     */
    getFormValues(root) {
        const form = root.querySelector(Selectors.IFRAME.elements.form);

        return {
            url: form.querySelector(Selectors.IFRAME.elements.url).value.trim(),
            showTitle: form.querySelector(Selectors.IFRAME.elements.showTitle)
                .checked,
            linkTitle: form.querySelector(Selectors.IFRAME.elements.linkTitle)
                .checked,
            showRelated: form.querySelector(
                Selectors.IFRAME.elements.showRelated,
            ).checked,
            showUserAvatar: form.querySelector(
                Selectors.IFRAME.elements.showUserAvatar,
            ).checked,
            textLinkOnly: form.querySelector(Selectors.IFRAME.elements.textLinkOnly)
                .checked,
            startAtEnabled: form.querySelector(
                Selectors.IFRAME.elements.startAtEnabled,
            ).checked,
            startAt: form
                .querySelector(Selectors.IFRAME.elements.startAt)
                .value.trim(),
            aspectRatio: form.querySelector(
                Selectors.IFRAME.elements.aspectRatio,
            ).value,
            width: this.parseWidthHeight(
                form.querySelector(Selectors.IFRAME.elements.width).value,
            ),
            height: this.parseWidthHeight(
                form.querySelector(Selectors.IFRAME.elements.height).value,
            ),
        };
    }

    /**
     * Generate the iframe HTML or text link.
     *
     * @param {Object} values - Form values
     * @returns {Promise<string>} Generated HTML
     */
    async generateIframeHtml(values) {
        const parsed = this.parseInput(values.url);
        if (!parsed) {
            return '';
        }

        // If user selected "text link only", generate a link instead of iframe
        if (values.textLinkOnly) {
            // Build the view URL (not embed URL) for the link
            let viewUrl;
            if (parsed.isGeneric || parsed.isLtiLaunch) {
                // For generic URLs and LTI launch URLs, use as-is
                viewUrl = parsed.rawUrl;
            } else {
                // For MediaCMS URLs, convert to view URL
                viewUrl = `${parsed.baseUrl}/view?m=${parsed.videoId}`;
            }

            // Use the full URL as the link text
            // Escape HTML entities in the URL for safe display
            const escapeHtml = (str) => {
                const div = document.createElement('div');
                div.textContent = str;
                return div.innerHTML;
            };

            const linkText = escapeHtml(viewUrl);
            const hrefUrl = viewUrl.replace(/"/g, '&quot;');

            // Add data attribute to mark this as a text-only link
            // This prevents the filter from converting it to an LTI launch iframe
            return `<p><a href="${hrefUrl}" target="_blank" data-mediacms-textlink="true">${linkText}</a></p>`;
        }

        const embedUrl = this.buildEmbedUrl(parsed, values);

        const context = {
            src: embedUrl,
            width: values.width,
            height: values.height,
        };

        const { html } = await Templates.renderForPromise(
            'tiny_mediacms/iframe_embed_output',
            context,
        );
        return html;
    }

    /**
     * Update the preview in the modal.
     *
     * @param {HTMLElement} root - Modal root element
     * @param {boolean} updateUrlField - Whether to update the URL field with new embed options
     */
    async updatePreview(root, updateUrlField = false) {
        const values = this.getFormValues(root);
        const previewContainer = root.querySelector(
            Selectors.IFRAME.elements.preview,
        );
        const urlWarning = root.querySelector(
            Selectors.IFRAME.elements.urlWarning,
        );

        if (!values.url) {
            previewContainer.innerHTML =
                '<span class="text-muted">Enter a video URL to see preview</span>';
            urlWarning.classList.add('d-none');
            return;
        }

        const parsed = this.parseInput(values.url);
        if (!parsed) {
            previewContainer.innerHTML =
                '<span class="text-danger">Invalid URL format</span>';
            urlWarning.classList.remove('d-none');
            return;
        }

        urlWarning.classList.add('d-none');
        const embedUrl = this.buildEmbedUrl(parsed, values);

        // Update the URL field if requested (when embed options change)
        if (updateUrlField && !parsed.isGeneric) {
            const form = root.querySelector(Selectors.IFRAME.elements.form);
            const urlInput = form.querySelector(Selectors.IFRAME.elements.url);
            urlInput.value = embedUrl;
        }

        // If text link only is selected, show link preview
        if (values.textLinkOnly) {
            let viewUrl;
            if (parsed.isGeneric || parsed.isLtiLaunch) {
                viewUrl = parsed.rawUrl;
            } else {
                viewUrl = `${parsed.baseUrl}/view?m=${parsed.videoId}`;
            }

            // Escape HTML entities for safe display
            const escapeHtml = (str) => {
                const div = document.createElement('div');
                div.textContent = str;
                return div.innerHTML;
            };

            const linkText = escapeHtml(viewUrl);
            const hrefUrl = viewUrl.replace(/"/g, '&quot;');

            previewContainer.innerHTML = `
                <div class="alert alert-info">
                    <strong>Text link preview:</strong><br>
                    <a href="${hrefUrl}" target="_blank" data-mediacms-textlink="true">${linkText}</a>
                    <br><small class="text-muted mt-2 d-block">This link will not be auto-converted by the MediaCMS filter.</small>
                </div>
            `;
        } else {
            // Show a scaled preview - scale to fit preview area
            const previewWidth = Math.min(values.width, 400);
            const scale = previewWidth / values.width;
            const previewHeight = Math.round(values.height * scale);

            previewContainer.innerHTML = `
                <iframe
                    src="${embedUrl}"
                    width="${previewWidth}"
                    height="${previewHeight}"
                    frameborder="0"
                    allowfullscreen
                    style="max-width: 100%;">
                </iframe>
            `;
        }
    }

    /**
     * Handle form input changes with debounce.
     *
     * @param {HTMLElement} root - Modal root element
     * @param {boolean} updateUrlField - Whether to update the URL field
     */
    handleInputChange(root, updateUrlField = false) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.updatePreview(root, updateUrlField);
        }, 500);
    }

    /**
     * Handle aspect ratio change - update dimensions.
     *
     * @param {HTMLElement} root - Modal root element
     */
    handleAspectRatioChange(root) {
        const form = root.querySelector(Selectors.IFRAME.elements.form);
        const aspectRatio = form.querySelector(
            Selectors.IFRAME.elements.aspectRatio,
        ).value;
        const dimensions = Selectors.IFRAME.aspectRatios[aspectRatio];

        // Only update dimensions for predefined ratios, not 'custom'
        if (dimensions && aspectRatio !== 'custom') {
            form.querySelector(Selectors.IFRAME.elements.width).value =
                dimensions.width;
            form.querySelector(Selectors.IFRAME.elements.height).value =
                dimensions.height;
        }

        this.updatePreview(root);
    }

    /**
     * Toggle width/height input editability based on responsive mode.
     *
     * @param {HTMLElement} root - Modal root element
     */

    /**
     * Handle width change - adjust height to maintain aspect ratio.
     *
     * @param {HTMLElement} root - Modal root element
     * @param {string} newWidth - New width value
     */
    handleWidthChange(root, newWidth) {
        const form = root.querySelector(Selectors.IFRAME.elements.form);
        const aspectRatio = form.querySelector(Selectors.IFRAME.elements.aspectRatio).value;
        const heightInput = form.querySelector(Selectors.IFRAME.elements.height);

        // Only adjust height if aspect ratio is not 'custom'
        if (aspectRatio !== 'custom' && newWidth) {
            const width = parseInt(newWidth) || 0;
            const arr = aspectRatio.split(':');
            const x = parseInt(arr[0]);
            const y = parseInt(arr[1]);

            // Calculate height based on aspect ratio: height = (width * y) / x
            const calculatedHeight = Math.round((width * y) / x);
            heightInput.value = calculatedHeight;
        }

        this.handleInputChange(root);
    }

    /**
     * Handle height change - adjust width to maintain aspect ratio.
     *
     * @param {HTMLElement} root - Modal root element
     * @param {string} newHeight - New height value
     */
    handleHeightChange(root, newHeight) {
        const form = root.querySelector(Selectors.IFRAME.elements.form);
        const aspectRatio = form.querySelector(Selectors.IFRAME.elements.aspectRatio).value;
        const widthInput = form.querySelector(Selectors.IFRAME.elements.width);

        // Only adjust width if aspect ratio is not 'custom'
        if (aspectRatio !== 'custom' && newHeight) {
            const height = parseInt(newHeight) || 0;
            const arr = aspectRatio.split(':');
            const x = parseInt(arr[0]);
            const y = parseInt(arr[1]);

            // Calculate width based on aspect ratio: width = (height * x) / y
            const calculatedWidth = Math.round((height * x) / y);
            widthInput.value = calculatedWidth;
        }

        this.handleInputChange(root);
    }

    /**
     * Handle dialog submission.
     *
     * @param {Object} modal - The modal instance
     */
    async handleDialogueSubmission(modal) {
        const root = modal.getRoot()[0];
        const values = this.getFormValues(root);

        if (!values.url) {
            return;
        }

        const html = await this.generateIframeHtml(values);
        if (html) {
            if (this.isUpdating && this.selectedIframe) {
                // Replace existing iframe (including wrapper if present)
                // Check for both old wrapper and new overlay wrapper
                const wrapper =
                    this.selectedIframe.closest(
                        '.tiny-mediacms-iframe-wrapper',
                    ) || this.selectedIframe.closest('.tiny-iframe-responsive');

                // Check if iframe is inside a <p> tag
                const paragraphWrapper = wrapper ? wrapper.closest('p') : this.selectedIframe.closest('p');

                if (paragraphWrapper) {
                    // Replace the entire paragraph to avoid empty <p></p> tags
                    paragraphWrapper.outerHTML = html;
                } else if (wrapper) {
                    wrapper.outerHTML = html;
                } else {
                    this.selectedIframe.outerHTML = html;
                }
                this.isUpdating = false;

                // Clean up any empty paragraph tags left behind
                setTimeout(() => {
                    const body = this.editor.getBody();
                    const emptyPs = body.querySelectorAll('p:empty, p:blank');
                    emptyPs.forEach(p => {
                        if (p.innerHTML.trim() === '' || p.innerHTML === '<br>') {
                            p.remove();
                        }
                    });
                }, 10);

                // Fire change event to trigger overlay reprocessing
                this.editor.fire('Change');
            } else {
                // Insert content without wrapping in paragraph tags
                // Use setContent if cursor is in an empty paragraph, otherwise insertContent
                const node = this.editor.selection.getNode();
                if (node.nodeName === 'P' && node.innerHTML.trim() === '') {
                    // Replace empty paragraph with iframe
                    node.outerHTML = html;
                } else {
                    this.editor.insertContent(html);
                }
            }
        }
    }

    /**
     * Handle video removal from the editor.
     *
     * @param {Object} modal - The modal instance
     */
    async handleRemove(modal) {
        // Get confirmation string
        const confirmMessage = await getString(
            'removeiframeconfirm',
            component,
        );

        // Show confirmation dialog
        // eslint-disable-next-line no-alert
        if (!window.confirm(confirmMessage)) {
            return;
        }

        if (this.selectedIframe) {
            // Remove the iframe (including wrapper if present)
            const wrapper =
                this.selectedIframe.closest('.tiny-mediacms-iframe-wrapper') ||
                this.selectedIframe.closest('.tiny-iframe-responsive');
            if (wrapper) {
                wrapper.remove();
            } else {
                this.selectedIframe.remove();
            }
        }

        // Close the modal
        this.isUpdating = false;
        modal.hide();
    }

    /**
     * Register event listeners for the modal.
     *
     * @param {Object} modal - The modal instance
     */
    async registerEventListeners(modal) {
        await modal.getBody();
        const $root = modal.getRoot();
        const root = $root[0];

        // Input change handlers
        const form = root.querySelector(Selectors.IFRAME.elements.form);

        // URL input
        form.querySelector(Selectors.IFRAME.elements.url).addEventListener(
            'input',
            () => this.handleInputChange(root),
        );

        // Embed option checkboxes - these should update the URL field when changed
        [
            Selectors.IFRAME.elements.showTitle,
            Selectors.IFRAME.elements.linkTitle,
            Selectors.IFRAME.elements.showRelated,
            Selectors.IFRAME.elements.showUserAvatar,
            Selectors.IFRAME.elements.startAtEnabled,
        ].forEach((selector) => {
            form.querySelector(selector).addEventListener('change', () =>
                this.handleInputChange(root, true), // Update URL field when embed options change
            );
        });

        // Text link only checkbox - doesn't affect URL, only output format
        form.querySelector(Selectors.IFRAME.elements.textLinkOnly).addEventListener('change', () =>
            this.handleInputChange(root, false),
        );

        // Start at time input - should update URL field
        form.querySelector(Selectors.IFRAME.elements.startAt).addEventListener(
            'input',
            () => this.handleInputChange(root, true),
        );

        // Aspect ratio change
        form.querySelector(
            Selectors.IFRAME.elements.aspectRatio,
        ).addEventListener('change', () => this.handleAspectRatioChange(root));

        // Dimension inputs - maintain aspect ratio when changed
        form.querySelector(Selectors.IFRAME.elements.width).addEventListener(
            'input',
            (e) => this.handleWidthChange(root, e.target.value),
        );
        form.querySelector(Selectors.IFRAME.elements.height).addEventListener(
            'input',
            (e) => this.handleHeightChange(root, e.target.value),
        );

        // Modal events
        $root.on(ModalEvents.save, () => this.handleDialogueSubmission(modal));
        $root.on(ModalEvents.hidden, () => {
            this.currentModal.destroy();
        });

        // Remove button handler (only present when updating)
        const removeBtn = root.querySelector(Selectors.IFRAME.actions.remove);
        if (removeBtn) {
            removeBtn.addEventListener('click', () => this.handleRemove(modal));
        }

        // Initial preview if we have a URL
        const urlInput = form.querySelector(Selectors.IFRAME.elements.url);
        if (urlInput.value) {
            this.updatePreview(root);
        }

        // Tab change handler - load iframe library when switching to iframe library tab
        const iframeLibraryTabBtn = form.querySelector(
            Selectors.IFRAME.elements.tabIframeLibraryBtn,
        );
        if (iframeLibraryTabBtn) {
            iframeLibraryTabBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Manually handle tab switching for Bootstrap 5
                this.switchToIframeLibraryTab(root);

                // Small delay to ensure tab pane is visible before loading iframe
                setTimeout(() => this.handleIframeLibraryTabClick(root), 100);
            });
            // Also handle Bootstrap tab events (if Bootstrap handles it)
            iframeLibraryTabBtn.addEventListener('shown.bs.tab', () =>
                this.handleIframeLibraryTabClick(root),
            );
            // jQuery Bootstrap 4 event
            const $iframeLibraryTabBtn = window.jQuery
                ? window.jQuery(iframeLibraryTabBtn)
                : null;
            if ($iframeLibraryTabBtn) {
                $iframeLibraryTabBtn.on('shown.bs.tab', () =>
                    this.handleIframeLibraryTabClick(root),
                );
            }
        }

        // Tab change handler for URL tab
        const urlTabBtn = form.querySelector(
            Selectors.IFRAME.elements.tabUrlBtn,
        );
        if (urlTabBtn) {
            urlTabBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Manually handle tab switching
                this.switchToUrlTab(root);
            });
        }

        // Iframe library event listeners
        this.registerIframeLibraryEventListeners(root);

        // If editing, Configure tab is active - update preview immediately
        // If inserting, My Media tab is active - load the library
        if (this.isUpdating) {
            // When editing, Configure tab is already active, just update preview
            setTimeout(() => this.updatePreview(root), 100);
        } else {
            // When inserting, load My Media library tab
            setTimeout(() => this.handleIframeLibraryTabClick(root), 100);
        }
    }

    /**
     * Switch to the URL tab.
     *
     * @param {HTMLElement} root - Modal root element
     */
    switchToUrlTab(root) {
        const form = root.querySelector(Selectors.IFRAME.elements.form);

        // Get tab buttons
        const urlTabBtn = form.querySelector(
            Selectors.IFRAME.elements.tabUrlBtn,
        );
        const urlTabItem = form.querySelector('.tiny_iframecms_tab_url_item');
        const iframeLibraryTabBtn = form.querySelector(
            Selectors.IFRAME.elements.tabIframeLibraryBtn,
        );

        // Get tab panes
        const urlPane = form.querySelector(Selectors.IFRAME.elements.paneUrl);
        const iframeLibraryPane = form.querySelector(
            Selectors.IFRAME.elements.paneIframeLibrary,
        );

        // Show the Configure tab
        if (urlTabItem) {
            urlTabItem.style.display = '';
        }

        // Update tab button states
        if (urlTabBtn) {
            urlTabBtn.classList.add('active');
            urlTabBtn.setAttribute('aria-selected', 'true');
        }
        if (iframeLibraryTabBtn) {
            iframeLibraryTabBtn.classList.remove('active');
            iframeLibraryTabBtn.setAttribute('aria-selected', 'false');
        }

        // Update tab pane visibility
        if (urlPane) {
            urlPane.classList.add('show', 'active');
        }
        if (iframeLibraryPane) {
            iframeLibraryPane.classList.remove('show', 'active');
        }
    }

    /**
     * Switch to the iframe library tab.
     *
     * @param {HTMLElement} root - Modal root element
     */
    switchToIframeLibraryTab(root) {
        const form = root.querySelector(Selectors.IFRAME.elements.form);

        // Get tab buttons
        const urlTabBtn = form.querySelector(
            Selectors.IFRAME.elements.tabUrlBtn,
        );
        const urlTabItem = form.querySelector('.tiny_iframecms_tab_url_item');
        const iframeLibraryTabBtn = form.querySelector(
            Selectors.IFRAME.elements.tabIframeLibraryBtn,
        );

        // Get tab panes
        const urlPane = form.querySelector(Selectors.IFRAME.elements.paneUrl);
        const iframeLibraryPane = form.querySelector(
            Selectors.IFRAME.elements.paneIframeLibrary,
        );

        // Hide the Configure tab when switching to My Media
        if (urlTabItem) {
            urlTabItem.style.display = 'none';
        }

        // Update tab button states
        if (urlTabBtn) {
            urlTabBtn.classList.remove('active');
            urlTabBtn.setAttribute('aria-selected', 'false');
        }
        if (iframeLibraryTabBtn) {
            iframeLibraryTabBtn.classList.add('active');
            iframeLibraryTabBtn.setAttribute('aria-selected', 'true');
        }

        // Update tab pane visibility
        if (urlPane) {
            urlPane.classList.remove('show', 'active');
        }
        if (iframeLibraryPane) {
            iframeLibraryPane.classList.add('show', 'active');
        }
    }

    /**
     * Register event listeners for the iframe library.
     *
     * @param {HTMLElement} root - Modal root element
     */
    registerIframeLibraryEventListeners(root) {
        // Listen for messages from the iframe (for video selection)
        window.addEventListener('message', (event) => {
            this.handleIframeLibraryMessage(root, event);
        });
    }

    /**
     * Handle iframe library tab click - always refetch content (no caching).
     *
     * @param {HTMLElement} root - Modal root element
     */
    handleIframeLibraryTabClick(root) {
        // Always refetch content when tab is clicked (no caching)
        // Reset the loaded state to ensure fresh content is fetched
        this.iframeLibraryLoaded = false;
        this.loadIframeLibrary(root);
    }

    /**
     * Load the iframe library using LTI flow or fallback to static URL.
     *
     * @param {HTMLElement} root - Modal root element
     */
    loadIframeLibrary(root) {
        const ltiConfig = getLti(this.editor);
        // Check if LTI is configured with a content item URL
        if (ltiConfig?.contentItemUrl) {
            this.loadIframeLibraryViaLti(root);
        } else {
            // Fallback to static URL if LTI not configured
            this.loadIframeLibraryStatic(root);
        }
    }

    /**
     * Load the iframe library via LTI Deep Linking (Content Item Selection).
     * Sets the iframe src to contentitem.php which initiates the LTI Deep Linking flow.
     * This sends an LtiDeepLinkingRequest message, which will redirect to the
     * tool's content selection interface (e.g., /lti/select-media/).
     *
     * @param {HTMLElement} root - Modal root element
     */
    loadIframeLibraryViaLti(root) {
        const form = root.querySelector(Selectors.IFRAME.elements.form);
        const pane = form.querySelector(
            Selectors.IFRAME.elements.paneIframeLibrary,
        );

        if (!pane) {            return;
        }

        const placeholderEl = pane.querySelector(
            Selectors.IFRAME.elements.iframeLibraryPlaceholder,
        );
        const loadingEl = pane.querySelector(
            Selectors.IFRAME.elements.iframeLibraryLoading,
        );
        const iframeEl = pane.querySelector(
            Selectors.IFRAME.elements.iframeLibraryFrame,
        );

        if (!iframeEl) {            return;
        }

        // Hide placeholder, show loading state
        if (placeholderEl) {
            placeholderEl.classList.add('d-none');
        }
        if (loadingEl) {
            loadingEl.classList.remove('d-none');
        }
        iframeEl.classList.add('d-none');

        // Set up load listener - note: this may fire multiple times during LTI redirects
        const loadHandler = () => {            this.handleIframeLibraryLoad(root);
        };
        iframeEl.addEventListener('load', loadHandler);

        // Set the iframe src to the content item URL
        // This initiates the LTI Deep Linking flow:
        // 1. contentitem.php initiates OIDC login
        // 2. LTI provider authenticates
        // 3. Moodle sends LtiDeepLinkingRequest
        // 4. Tool provider shows content selection interface
        const ltiConfig = getLti(this.editor);
        iframeEl.src = ltiConfig.contentItemUrl;
    }

    /**
     * Load the iframe library using static URL (fallback).
     *
     * @param {HTMLElement} root - Modal root element
     */
    loadIframeLibraryStatic(root) {
        const form = root.querySelector(Selectors.IFRAME.elements.form);
        const pane = form.querySelector(
            Selectors.IFRAME.elements.paneIframeLibrary,
        );

        if (!pane) {            return;
        }

        const placeholderEl = pane.querySelector(
            Selectors.IFRAME.elements.iframeLibraryPlaceholder,
        );
        const loadingEl = pane.querySelector(
            Selectors.IFRAME.elements.iframeLibraryLoading,
        );
        const iframeEl = pane.querySelector(
            Selectors.IFRAME.elements.iframeLibraryFrame,
        );
        if (!iframeEl) {            return;
        }

        // Hide placeholder, show loading state
        if (placeholderEl) {
            placeholderEl.classList.add('d-none');
        }
        if (loadingEl) {
            loadingEl.classList.remove('d-none');
        }
        iframeEl.classList.add('d-none');

        // Set up load listener before setting src
        const loadHandler = () => {            // Only handle if the src matches our target URL
            if (iframeEl.src === this.iframeLibraryUrl) {
                this.handleIframeLibraryLoad(root);
                // Remove the listener after successful load
                iframeEl.removeEventListener('load', loadHandler);
            }
        };
        iframeEl.addEventListener('load', loadHandler);

        // Set the iframe source
        iframeEl.src = this.iframeLibraryUrl;    }

    /**
     * Handle iframe library load event.
     *
     * @param {HTMLElement} root - Modal root element
     */
    handleIframeLibraryLoad(root) {
        const form = root.querySelector(Selectors.IFRAME.elements.form);
        const pane = form.querySelector(
            Selectors.IFRAME.elements.paneIframeLibrary,
        );

        if (!pane) {
            return;
        }

        const placeholderEl = pane.querySelector(
            Selectors.IFRAME.elements.iframeLibraryPlaceholder,
        );
        const loadingEl = pane.querySelector(
            Selectors.IFRAME.elements.iframeLibraryLoading,
        );
        const iframeEl = pane.querySelector(
            Selectors.IFRAME.elements.iframeLibraryFrame,
        );

        // Hide placeholder and loading, show iframe
        if (placeholderEl) {
            placeholderEl.classList.add('d-none');
        }
        if (loadingEl) {
            loadingEl.classList.add('d-none');
        }
        if (iframeEl) {
            iframeEl.classList.remove('d-none');
        }

        this.iframeLibraryLoaded = true;
    }

    /**
     * Handle messages from the iframe library (for video selection).
     * Supports both custom videoSelected messages and LTI Deep Linking responses.
     *
     * @param {HTMLElement} root - Modal root element
     * @param {MessageEvent} event - The message event
     */
    handleIframeLibraryMessage(root, event) {
        const data = event.data;

        if (!data) {
            return;
        }

        // Handle custom videoSelected message format
        if (data.type === 'videoSelected' && data.embedUrl) {
            this.selectIframeLibraryVideo(root, data.embedUrl, data.videoId);
            return;
        }

        // Handle LTI Deep Linking response format
        if (
            data.type === 'ltiDeepLinkingResponse' ||
            data.messageType === 'LtiDeepLinkingResponse'
        ) {            const contentItems = data.content_items || data.contentItems || [];
            if (contentItems.length > 0) {
                const item = contentItems[0];
                // Extract embed URL from the content item
                const embedUrl =
                    item.url || item.embed_url || item.embedUrl || '';
                const videoId = item.id || item.mediaId || '';
                if (embedUrl) {                    this.selectIframeLibraryVideo(root, embedUrl, videoId);
                }
            }
            return;
        }

        // Handle MediaCMS specific message format (if different from above)
        if (data.action === 'selectMedia' || data.action === 'mediaSelected') {
            const embedUrl = data.embedUrl || data.url || '';
            const videoId = data.mediaId || data.videoId || data.id || '';
            if (embedUrl) {                this.selectIframeLibraryVideo(root, embedUrl, videoId);
            }
            return;
        }
    }

    /**
     * Select a video from the iframe library and populate the URL field.
     *
     * @param {HTMLElement} root - Modal root element
     * @param {string} embedUrl - The embed URL for the video
     * @param {string} videoId - The video ID
     */
    selectIframeLibraryVideo(root, embedUrl, videoId) {
        const form = root.querySelector(Selectors.IFRAME.elements.form);

        // Populate the URL field
        const urlInput = form.querySelector(Selectors.IFRAME.elements.url);
        urlInput.value = embedUrl;

        // Show the Configure tab (it starts hidden)
        const configureTabItem = root.querySelector('.tiny_iframecms_tab_url_item');
        if (configureTabItem) {
            configureTabItem.style.display = '';
        }

        // Switch to the Configure tab to show embed options
        this.switchToUrlTab(root);

        // Update the preview
        this.updatePreview(root);

        // Store the selected video
        this.selectedLibraryVideo = { embedUrl, videoId };
    }
}
