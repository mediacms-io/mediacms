import Templates from 'core/templates';
import { getString } from 'core/str';
import * as ModalEvents from 'core/modal_events';
import { component } from './common';
import IframeModal from './iframemodal';
import Selectors from './selectors';
import { getLti, getData } from './options';

const PREFS_KEY = 'tiny_mediacms_embed_prefs';
const PREFS_FIELDS = ['showTitle', 'linkTitle', 'showUserAvatar', 'width', 'height', 'textLinkOnly'];

export default class IframeEmbed {
    editor = null;
    currentModal = null;
    isUpdating = false;
    selectedIframe = null;
    debounceTimer = null;
    iframeLibraryUrl =
        'https://temp.web357.com/mediacms/deic-mediacms-embed-videos.html';

    constructor(editor) {
        this.editor = editor;
    }

    parseInput(input) {
        if (!input || !input.trim()) {
            return null;
        }

        input = input.trim();

        const iframeMatch = input.match(
            /<iframe[^>]*src=["']([^"']+)["'][^>]*>/i,
        );
        if (iframeMatch) {
            return this.parseEmbedUrl(iframeMatch[1]);
        }

        if (input.startsWith('http://') || input.startsWith('https://')) {
            return this.parseVideoUrl(input);
        }

        return null;
    }

    parseVideoUrl(url) {
        try {
            const urlObj = new URL(url);
            const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

            if (urlObj.pathname === '/view' && urlObj.searchParams.has('m')) {
                return {
                    baseUrl: baseUrl,
                    videoId: urlObj.searchParams.get('m'),
                    isEmbed: false,
                };
            }

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
                    showUserAvatar:
                        urlObj.searchParams.get('showUserAvatar') === '1',
                    width: widthParam ? parseInt(widthParam) : null,
                    height: heightParam ? parseInt(heightParam) : null,
                    startAt: tParam
                        ? this.secondsToTimeString(parseInt(tParam))
                        : null,
                };
            }

            if (urlObj.pathname.includes('/filter/mediacms/launch.php') && urlObj.searchParams.has('token')) {
                const tParam = urlObj.searchParams.get('t');
                const widthParam = urlObj.searchParams.get('width');
                const heightParam = urlObj.searchParams.get('height');

                return {
                    baseUrl: baseUrl,
                    videoId: urlObj.searchParams.get('token'),
                    rawUrl: url,
                    isLtiLaunch: true,
                    showTitle: urlObj.searchParams.get('showTitle') === '1',
                    linkTitle: urlObj.searchParams.get('linkTitle') === '1',
                    showUserAvatar: urlObj.searchParams.get('showUserAvatar') === '1',
                    width: widthParam ? parseInt(widthParam) : null,
                    height: heightParam ? parseInt(heightParam) : null,
                    startAt: tParam ? this.secondsToTimeString(parseInt(tParam)) : null,
                };
            }

            return {
                baseUrl: baseUrl,
                rawUrl: url,
                isGeneric: true,
            };
        } catch (e) {
            return null;
        }
    }

    parseEmbedUrl(url) {
        return this.parseVideoUrl(url);
    }

    secondsToTimeString(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    timeStringToSeconds(timeStr) {
        if (!timeStr || !timeStr.trim()) {
            return null;
        }
        timeStr = timeStr.trim();

        if (timeStr.includes(':')) {
            const parts = timeStr.split(':');
            const mins = parseInt(parts[0]) || 0;
            const secs = parseInt(parts[1]) || 0;
            return mins * 60 + secs;
        }

        const secs = parseInt(timeStr);
        return isNaN(secs) ? null : secs;
    }

    parseWidthHeight(value) {
        if (!value) {
            return null;
        }
        const parsed = parseInt(value.trim());
        return isNaN(parsed) ? null : parsed;
    }

    computeAspectRatioCSS(values) {
        const w = values.width || 560;
        const h = values.height || 315;
        return `${w} / ${h}`;
    }

    buildTextLinkUrl(parsed, options) {
        let viewUrl;
        if (parsed.isGeneric || parsed.isLtiLaunch) {
            viewUrl = parsed.rawUrl;
        } else {
            viewUrl = `${parsed.baseUrl}/view?m=${parsed.videoId}`;
        }

        if (options.startAtEnabled && options.startAt) {
            const seconds = this.timeStringToSeconds(options.startAt);
            if (seconds !== null && seconds > 0) {
                const url = new URL(viewUrl);
                url.searchParams.set('t', seconds.toString());
                viewUrl = url.toString();
            }
        }

        return viewUrl;
    }

    buildEmbedUrl(parsed, options) {
        if (parsed.isGeneric) {
            return parsed.rawUrl;
        }

        let url;
        if (parsed.isLtiLaunch) {
            url = new URL(parsed.rawUrl);
            const token = url.searchParams.get('token');
            const courseid = url.searchParams.get('courseid');
            url.search = '';
            url.searchParams.set('token', token);
            if (courseid) {
                url.searchParams.set('courseid', courseid);
            }
        } else {
            url = new URL(`${parsed.baseUrl}/embed`);
            url.searchParams.set('m', parsed.videoId);
        }

        url.searchParams.set('showTitle', options.showTitle ? '1' : '0');
        url.searchParams.set(
            'showUserAvatar',
            options.showUserAvatar ? '1' : '0',
        );
        url.searchParams.set('linkTitle', options.linkTitle ? '1' : '0');

        if (options.startAtEnabled && options.startAt) {
            const seconds = this.timeStringToSeconds(options.startAt);
            if (seconds !== null && seconds > 0) {
                url.searchParams.set('t', seconds.toString());
            }
        }

        if (options.width) {
            url.searchParams.set('width', options.width);
        }
        if (options.height) {
            url.searchParams.set('height', options.height);
        }

        return url.toString();
    }

    signalShare(values) {
        const parsed = this.parseInput(values.url);
        if (!parsed || parsed.isGeneric || !parsed.videoId) {
            return;
        }

        const editorData = getData(this.editor);
        const baseUrl = parsed.isLtiLaunch
            ? (editorData?.mediacmsBaseUrl || '')
            : parsed.baseUrl;

        if (!baseUrl) {
            return;
        }

        const ltiConfig = getLti(this.editor);
        const courseId = ltiConfig?.courseId || 0;

        fetch(`${baseUrl}/api/v1/media/${parsed.videoId}/share`, {
            method: 'POST',
            credentials: 'include',
            body: new URLSearchParams({courseid: courseId}),
        }).catch(() => {});
    }

    savePrefs(values) {
        try {
            const prefs = {};
            PREFS_FIELDS.forEach(k => { if (values[k] !== undefined) { prefs[k] = values[k]; } });
            localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
        } catch (_) { /* localStorage unavailable */ }
    }

    loadPrefs() {
        try {
            return JSON.parse(localStorage.getItem(PREFS_KEY) || 'null') || {};
        } catch (_) { return {}; }
    }

    async getTemplateContext(data = {}) {
        const editorData = getData(this.editor);
        const autoConvertOptions = editorData?.autoConvertOptions || {};
        const savedPrefs = this.loadPrefs();

        const getDefault = (key, fallback = true) => {
            if (this.isUpdating && data[key] !== undefined) {
                return data[key];
            }
            if (savedPrefs[key] !== undefined) { return savedPrefs[key]; }
            return autoConvertOptions[key] !== undefined
                ? autoConvertOptions[key]
                : fallback;
        };

        const width = (this.isUpdating && data.width) ? data.width
            : (savedPrefs.width ?? 560);
        const height = (this.isUpdating && data.height) ? data.height
            : (savedPrefs.height ?? 315);

        return {
            elementid: this.editor.getElement().id,
            isupdating: this.isUpdating,
            url: data.url || '',
            showTitle: getDefault('showTitle'),
            linkTitle: getDefault('linkTitle'),
            showUserAvatar: getDefault('showUserAvatar'),
            textLinkOnly: getDefault('textLinkOnly', false),
            startAtEnabled: data.startAtEnabled || false,
            startAt: data.startAt || '0:00',
            width,
            height,
        };
    }

    async displayDialogue() {
        this.selectedIframe = this.getSelectedIframe();
        const data = this.getCurrentIframeData();
        this.isUpdating = data !== null;

        this.currentModal = await IframeModal.create({
            title: getString('iframemodaltitle', component),
            templateContext: await this.getTemplateContext(data || {}),
        });

        await this.registerEventListeners(this.currentModal);
    }

    getSelectedIframe() {
        const node = this.editor.selection.getNode();

        if (node.nodeName.toLowerCase() === 'a' && node.getAttribute('data-mediacms-textlink') === 'true') {
            return node;
        }

        if (node.nodeName.toLowerCase() === 'iframe') {
            return node;
        }

        const iframe = node.querySelector('iframe');
        if (iframe) {
            return iframe;
        }

        const wrapper =
            node.closest('.tiny-mediacms-iframe-wrapper') ||
            node.closest('.tiny-iframe-responsive');
        if (wrapper) {
            return wrapper.querySelector('iframe');
        }

        const textLink = node.closest('a[data-mediacms-textlink="true"]');
        if (textLink) {
            return textLink;
        }

        return null;
    }

    getCurrentIframeData() {
        if (!this.selectedIframe) {
            return null;
        }

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
                showUserAvatar: parsed?.showUserAvatar ?? true,
                responsive: true,
                textLinkOnly: true,
                startAtEnabled: parsed?.startAt !== null,
                startAt: parsed?.startAt || '0:00',
            };
        }

        const src = this.selectedIframe.getAttribute('src');
        const parsed = this.parseInput(src);

        // Parse responsive dimensions from inline style
        const style = this.selectedIframe.getAttribute('style') || '';
        const maxWidthMatch = style.match(/max-width:\s*(\d+(?:\.\d+)?)px/);
        const aspectRatioMatch = style.match(/aspect-ratio:\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);

        // Fall back to wrapper's max-width for content saved with the new template
        // where max-width lives on the wrapper div rather than the iframe style.
        let maxWidth = maxWidthMatch ? parseInt(maxWidthMatch[1]) : null;
        if (!maxWidth) {
            const wrapper = this.selectedIframe.closest('.tiny-mediacms-iframe-wrapper');
            const wrapperStyle = wrapper ? (wrapper.getAttribute('style') || '') : '';
            const wrapperMatch = wrapperStyle.match(/max-width:\s*(\d+(?:\.\d+)?)px/);
            maxWidth = wrapperMatch ? parseInt(wrapperMatch[1]) : 560;
        }
        let height = 315;

        if (aspectRatioMatch) {
            const rw = parseFloat(aspectRatioMatch[1]);
            const rh = parseFloat(aspectRatioMatch[2]);
            if (rw > 0) {
                height = Math.round(maxWidth * rh / rw);
            }
        }

        return {
            url: src,
            width: maxWidth,
            height,
            showTitle: parsed?.showTitle ?? true,
            linkTitle: parsed?.linkTitle ?? true,
            showUserAvatar: parsed?.showUserAvatar ?? true,
            startAtEnabled: !!(parsed?.startAt),
            startAt: parsed?.startAt || '0:00',
        };
    }

    getFormValues(root) {
        const form = root.querySelector(Selectors.IFRAME.elements.form);

        return {
            url: form.querySelector(Selectors.IFRAME.elements.url).value.trim(),
            showTitle: form.querySelector(Selectors.IFRAME.elements.showTitle)
                .checked,
            linkTitle: form.querySelector(Selectors.IFRAME.elements.linkTitle)
                .checked,
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
            width: this.parseWidthHeight(
                form.querySelector(Selectors.IFRAME.elements.width).value,
            ),
            height: this.parseWidthHeight(
                form.querySelector(Selectors.IFRAME.elements.height).value,
            ),
        };
    }

    async generateIframeHtml(values) {
        const parsed = this.parseInput(values.url);
        if (!parsed) {
            return '';
        }

        if (values.textLinkOnly) {
            const viewUrl = this.buildTextLinkUrl(parsed, values);

            const escapeHtml = (str) => {
                const div = document.createElement('div');
                div.textContent = str;
                return div.innerHTML;
            };

            const linkText = escapeHtml(viewUrl);
            const hrefUrl = viewUrl.replace(/"/g, '&quot;');

            return `<p><a href="${hrefUrl}" target="_blank" data-mediacms-textlink="true">${linkText}</a></p>`;
        }

        const embedUrl = this.buildEmbedUrl(parsed, values);

        const context = {
            src: embedUrl,
            maxWidth: values.width || 560,
            height: values.height || 315,
            aspectRatioCSS: this.computeAspectRatioCSS(values),
        };

        const { html } = await Templates.renderForPromise(
            'tiny_mediacms/iframe_embed_output',
            context,
        );
        return html;
    }

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

        if (updateUrlField && !parsed.isGeneric) {
            const form = root.querySelector(Selectors.IFRAME.elements.form);
            const urlInput = form.querySelector(Selectors.IFRAME.elements.url);
            urlInput.value = embedUrl;
        }

        if (values.textLinkOnly) {
            const viewUrl = this.buildTextLinkUrl(parsed, values);

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
                </div>
            `;
        } else {
            const previewWidth = Math.min(values.width || 560, 400);
            const previewHeight = Math.round(previewWidth * (values.height || 315) / (values.width || 560));

            previewContainer.innerHTML = `
                <iframe
                    src="${embedUrl}"
                    width="${previewWidth}"
                    height="${previewHeight}"
                    style="display:block;border:0;"
                    frameborder="0"
                    allowfullscreen>
                </iframe>
            `;
        }
    }

    handleInputChange(root, updateUrlField = false) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.updatePreview(root, updateUrlField);
        }, 500);
    }

    handleWidthChange(root) {
        const form = root.querySelector(Selectors.IFRAME.elements.form);
        const widthInput = form.querySelector(Selectors.IFRAME.elements.width);
        const heightInput = form.querySelector(Selectors.IFRAME.elements.height);
        const newWidth = parseInt(widthInput.value);
        if (!isNaN(newWidth) && newWidth > 0) {
            heightInput.value = Math.round(newWidth * 9 / 16);
        }
        this.handleInputChange(root);
    }

    handleHeightChange(root) {
        this.handleInputChange(root);
    }

    async handleDialogueSubmission(modal) {
        const root = modal.getRoot()[0];
        const values = this.getFormValues(root);

        if (!values.url) {
            return;
        }

        this.savePrefs(values);
        this.signalShare(values);
        const html = await this.generateIframeHtml(values);
        if (html) {
            if (this.isUpdating && this.selectedIframe) {
                const wrapper =
                    this.selectedIframe.closest(
                        '.tiny-mediacms-iframe-wrapper',
                    ) || this.selectedIframe.closest('.tiny-iframe-responsive');

                const paragraphWrapper = wrapper ? wrapper.closest('p') : this.selectedIframe.closest('p');

                if (paragraphWrapper) {
                    paragraphWrapper.outerHTML = html;
                } else if (wrapper) {
                    wrapper.outerHTML = html;
                } else {
                    this.selectedIframe.outerHTML = html;
                }
                this.isUpdating = false;

                setTimeout(() => {
                    const body = this.editor.getBody();
                    const emptyPs = body.querySelectorAll('p:empty, p:blank');
                    emptyPs.forEach(p => {
                        if (p.innerHTML.trim() === '' || p.innerHTML === '<br>') {
                            p.remove();
                        }
                    });
                }, 10);

                this.editor.fire('Change');
            } else {
                const node = this.editor.selection.getNode();
                if (node.nodeName === 'P' && node.innerHTML.trim() === '') {
                    node.outerHTML = html;
                } else {
                    this.editor.insertContent(html);
                }
                setTimeout(() => {
                    const body = this.editor.getBody();
                    body.querySelectorAll('p').forEach(p => {
                        if (p.innerHTML.trim() === '' || p.innerHTML === '<br>') {
                            p.remove();
                        }
                    });
                }, 50);
            }
        }
    }

    async handleRemove(modal) {
        const confirmMessage = await getString(
            'removeiframeconfirm',
            component,
        );

        // eslint-disable-next-line no-alert
        if (!window.confirm(confirmMessage)) {
            return;
        }

        if (this.selectedIframe) {
            const wrapper =
                this.selectedIframe.closest('.tiny-mediacms-iframe-wrapper') ||
                this.selectedIframe.closest('.tiny-iframe-responsive');
            if (wrapper) {
                wrapper.remove();
            } else {
                this.selectedIframe.remove();
            }
        }

        this.isUpdating = false;
        modal.hide();
    }

    async registerEventListeners(modal) {
        await modal.getBody();
        const $root = modal.getRoot();
        const root = $root[0];

        const form = root.querySelector(Selectors.IFRAME.elements.form);

        form.querySelector(Selectors.IFRAME.elements.url).addEventListener(
            'input',
            () => this.handleInputChange(root),
        );

        [
            Selectors.IFRAME.elements.showTitle,
            Selectors.IFRAME.elements.linkTitle,
            Selectors.IFRAME.elements.showUserAvatar,
            Selectors.IFRAME.elements.startAtEnabled,
        ].forEach((selector) => {
            form.querySelector(selector).addEventListener('change', () =>
                this.handleInputChange(root, true),
            );
        });

        form.querySelector(Selectors.IFRAME.elements.textLinkOnly).addEventListener('change', () =>
            this.handleInputChange(root, false),
        );

        form.querySelector(Selectors.IFRAME.elements.startAt).addEventListener(
            'input',
            () => this.handleInputChange(root, true),
        );

        form.querySelector(Selectors.IFRAME.elements.width).addEventListener(
            'input',
            () => this.handleWidthChange(root),
        );
        form.querySelector(Selectors.IFRAME.elements.height).addEventListener(
            'input',
            () => this.handleHeightChange(root),
        );

        $root.on(ModalEvents.save, () => this.handleDialogueSubmission(modal));
        $root.on(ModalEvents.hidden, () => {
            this.currentModal.destroy();
        });

        const removeBtn = root.querySelector(Selectors.IFRAME.actions.remove);
        if (removeBtn) {
            removeBtn.addEventListener('click', () => this.handleRemove(modal));
        }

        const urlInput = form.querySelector(Selectors.IFRAME.elements.url);
        if (urlInput.value) {
            this.updatePreview(root);
        }

        const iframeLibraryTabBtn = form.querySelector(
            Selectors.IFRAME.elements.tabIframeLibraryBtn,
        );
        if (iframeLibraryTabBtn) {
            iframeLibraryTabBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                this.switchToIframeLibraryTab(root);

                setTimeout(() => this.handleIframeLibraryTabClick(root), 100);
            });
            iframeLibraryTabBtn.addEventListener('shown.bs.tab', () =>
                this.handleIframeLibraryTabClick(root),
            );
            const $iframeLibraryTabBtn = window.jQuery
                ? window.jQuery(iframeLibraryTabBtn)
                : null;
            if ($iframeLibraryTabBtn) {
                $iframeLibraryTabBtn.on('shown.bs.tab', () =>
                    this.handleIframeLibraryTabClick(root),
                );
            }
        }

        const urlTabBtn = form.querySelector(
            Selectors.IFRAME.elements.tabUrlBtn,
        );
        if (urlTabBtn) {
            urlTabBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                this.switchToUrlTab(root);
            });
        }

        const uploadMediaBtn = form.querySelector(
            Selectors.IFRAME.elements.tabUploadMediaBtn,
        );
        if (uploadMediaBtn) {
            uploadMediaBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                this.switchToIframeLibraryTab(root);

                let uploadUrl = '';
                const ltiConfig = getLti(this.editor);

                if (ltiConfig && ltiConfig.contentItemUrl) {
                    try {
                        const urlObj = new URL(ltiConfig.contentItemUrl);
                        urlObj.searchParams.set('action', 'upload');
                        uploadUrl = urlObj.toString();
                    } catch (err) {
                        // eslint-disable-next-line no-unused-vars
                    }
                }

                if (!uploadUrl) {
                    let baseUrl = '';
                    try {
                        const editorData = getData(this.editor);
                        if (editorData && editorData.mediacmsBaseUrl) {
                            baseUrl = editorData.mediacmsBaseUrl;
                        }
                    } catch (err) {
                        // eslint-disable-next-line no-unused-vars
                    }

                    if (!baseUrl) {
                        try {
                            const urlObj = new URL(this.iframeLibraryUrl);
                            baseUrl = `${urlObj.protocol}//${urlObj.host}`;
                        } catch (err) {
                            // eslint-disable-next-line no-unused-vars
                        }
                    }

                    baseUrl = baseUrl.replace(/\/$/, '');
                    uploadUrl = baseUrl ? `${baseUrl}/upload` : '';
                }

                if (uploadUrl) {
                    const pane = form.querySelector(Selectors.IFRAME.elements.paneIframeLibrary);
                    if (pane) {
                        const iframeEl = pane.querySelector(Selectors.IFRAME.elements.iframeLibraryFrame);
                        const placeholderEl = pane.querySelector(Selectors.IFRAME.elements.iframeLibraryPlaceholder);
                        const loadingEl = pane.querySelector(Selectors.IFRAME.elements.iframeLibraryLoading);

                        if (placeholderEl) {
                            placeholderEl.classList.add('d-none');
                        }
                        if (loadingEl) {
                            loadingEl.classList.remove('d-none');
                        }
                        if (iframeEl) {
                            iframeEl.classList.add('d-none');

                            const loadHandler = () => {
                                this.handleIframeLibraryLoad(root);
                                iframeEl.removeEventListener('load', loadHandler);
                            };
                            iframeEl.addEventListener('load', loadHandler);
                            iframeEl.src = uploadUrl;
                        }
                    }
                }
            });
        }

        this.registerIframeLibraryEventListeners(root);

        if (this.isUpdating) {
            setTimeout(() => this.updatePreview(root), 100);
        } else {
            setTimeout(() => this.handleIframeLibraryTabClick(root), 100);
        }
    }

    switchToUrlTab(root) {
        const form = root.querySelector(Selectors.IFRAME.elements.form);

        const urlTabBtn = form.querySelector(
            Selectors.IFRAME.elements.tabUrlBtn,
        );
        const urlTabItem = form.querySelector('.tiny_iframecms_tab_url_item');
        const iframeLibraryTabBtn = form.querySelector(
            Selectors.IFRAME.elements.tabIframeLibraryBtn,
        );

        const urlPane = form.querySelector(Selectors.IFRAME.elements.paneUrl);
        const iframeLibraryPane = form.querySelector(
            Selectors.IFRAME.elements.paneIframeLibrary,
        );

        if (urlTabItem) {
            urlTabItem.style.display = '';
        }

        if (urlTabBtn) {
            urlTabBtn.classList.add('active');
            urlTabBtn.setAttribute('aria-selected', 'true');
        }
        if (iframeLibraryTabBtn) {
            iframeLibraryTabBtn.classList.remove('active');
            iframeLibraryTabBtn.setAttribute('aria-selected', 'false');
        }

        if (urlPane) {
            urlPane.classList.add('show', 'active');
        }
        if (iframeLibraryPane) {
            iframeLibraryPane.classList.remove('show', 'active');
        }
    }

    switchToIframeLibraryTab(root) {
        const form = root.querySelector(Selectors.IFRAME.elements.form);

        const urlTabBtn = form.querySelector(
            Selectors.IFRAME.elements.tabUrlBtn,
        );
        const urlTabItem = form.querySelector('.tiny_iframecms_tab_url_item');
        const iframeLibraryTabBtn = form.querySelector(
            Selectors.IFRAME.elements.tabIframeLibraryBtn,
        );

        const urlPane = form.querySelector(Selectors.IFRAME.elements.paneUrl);
        const iframeLibraryPane = form.querySelector(
            Selectors.IFRAME.elements.paneIframeLibrary,
        );

        if (urlTabItem) {
            urlTabItem.style.display = 'none';
        }

        if (urlTabBtn) {
            urlTabBtn.classList.remove('active');
            urlTabBtn.setAttribute('aria-selected', 'false');
        }
        if (iframeLibraryTabBtn) {
            iframeLibraryTabBtn.classList.add('active');
            iframeLibraryTabBtn.setAttribute('aria-selected', 'true');
        }

        if (urlPane) {
            urlPane.classList.remove('show', 'active');
        }
        if (iframeLibraryPane) {
            iframeLibraryPane.classList.add('show', 'active');
        }
    }

    registerIframeLibraryEventListeners(root) {
        window.addEventListener('message', (event) => {
            this.handleIframeLibraryMessage(root, event);
        });
    }

    handleIframeLibraryTabClick(root) {
        this.loadIframeLibrary(root);
    }

    loadIframeLibrary(root) {
        const ltiConfig = getLti(this.editor);
        if (ltiConfig?.contentItemUrl) {
            this.loadIframeLibraryViaLti(root);
        } else {
            this.loadIframeLibraryStatic(root);
        }
    }

    loadIframeLibraryViaLti(root) {
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

        if (!iframeEl) {
            return;
        }

        if (placeholderEl) {
            placeholderEl.classList.add('d-none');
        }
        if (loadingEl) {
            loadingEl.classList.remove('d-none');
        }
        iframeEl.classList.add('d-none');

        const loadHandler = () => {
            this.handleIframeLibraryLoad(root);
        };
        iframeEl.addEventListener('load', loadHandler);

        const ltiConfig = getLti(this.editor);
        iframeEl.src = ltiConfig.contentItemUrl;
    }

    loadIframeLibraryStatic(root) {
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

        if (!iframeEl) {
            return;
        }

        if (placeholderEl) {
            placeholderEl.classList.add('d-none');
        }
        if (loadingEl) {
            loadingEl.classList.remove('d-none');
        }
        iframeEl.classList.add('d-none');

        const loadHandler = () => {
            if (iframeEl.src === this.iframeLibraryUrl) {
                this.handleIframeLibraryLoad(root);
                iframeEl.removeEventListener('load', loadHandler);
            }
        };
        iframeEl.addEventListener('load', loadHandler);

        iframeEl.src = this.iframeLibraryUrl;
    }

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

        if (placeholderEl) {
            placeholderEl.classList.add('d-none');
        }
        if (loadingEl) {
            loadingEl.classList.add('d-none');
        }
        if (iframeEl) {
            iframeEl.classList.remove('d-none');
        }
    }

    handleIframeLibraryMessage(root, event) {
        const data = event.data;

        if (!data) {
            return;
        }

        if (data.type === 'videoSelected' && data.embedUrl) {
            this.selectIframeLibraryVideo(root, data.embedUrl, data.videoId);
            return;
        }

        if (
            data.type === 'ltiDeepLinkingResponse' ||
            data.messageType === 'LtiDeepLinkingResponse'
        ) {
            const contentItems = data.content_items || data.contentItems || [];
            if (contentItems.length > 0) {
                const item = contentItems[0];
                const embedUrl =
                    item.url || item.embed_url || item.embedUrl || '';
                const videoId = item.id || item.mediaId || '';
                if (embedUrl) {
                    this.selectIframeLibraryVideo(root, embedUrl, videoId);
                }
            }
            return;
        }

        if (data.action === 'selectMedia' || data.action === 'mediaSelected') {
            const embedUrl = data.embedUrl || data.url || '';
            if (embedUrl) {
                this.selectIframeLibraryVideo(root, embedUrl);
            }
            return;
        }
    }

    selectIframeLibraryVideo(root, embedUrl) {
        const form = root.querySelector(Selectors.IFRAME.elements.form);

        const urlInput = form.querySelector(Selectors.IFRAME.elements.url);
        urlInput.value = embedUrl;

        const configureTabItem = root.querySelector('.tiny_iframecms_tab_url_item');
        if (configureTabItem) {
            configureTabItem.style.display = '';
        }

        this.switchToUrlTab(root);
        this.updatePreview(root);
    }
}
