
import Templates from 'core/templates';
import { getString } from 'core/str';
import * as ModalEvents from 'core/modal_events';
import { component } from './common';
import IframeModal from './iframemodal';
import Selectors from './selectors';
import { getLti, getLaunchUrl, getMediaCMSUrl } from './options';

export default class IframeEmbed {
    
    constructor(editor) {
        this.editor = editor;
        this.currentModal = null;
        this.isUpdating = false;
        this.selectedIframe = null;
        this.debounceTimer = null;
        this.iframeLibraryLoaded = false;
        this.selectedLibraryVideo = null;
    }

    parseInput(input) {
        if (!input || !input.trim()) {
            return null;
        }
        input = input.trim();

        // Check for iframe
        const iframeMatch = input.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
        if (iframeMatch) {
            return this.parseEmbedUrl(iframeMatch[1]);
        }

        // Check URL
        if (input.startsWith('http://') || input.startsWith('https://')) {
            return this.parseVideoUrl(input);
        }
        return null;
    }

    parseVideoUrl(url) {
        try {
            const urlObj = new URL(url);
            const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
            
            // /view?m=ID
            if (urlObj.pathname.indexOf('/view') !== -1 && urlObj.searchParams.has('m')) {
                return {
                    baseUrl: baseUrl,
                    videoId: urlObj.searchParams.get('m'),
                    isEmbed: false
                };
            }
            
            // /embed?m=ID
            if (urlObj.pathname.indexOf('/embed') !== -1 && urlObj.searchParams.has('m')) {
                return {
                    baseUrl: baseUrl,
                    videoId: urlObj.searchParams.get('m'),
                    isEmbed: true,
                    // Parse options
                    showTitle: urlObj.searchParams.get('showTitle') === '1',
                    linkTitle: urlObj.searchParams.get('linkTitle') === '1',
                    showRelated: urlObj.searchParams.get('showRelated') === '1',
                    showUserAvatar: urlObj.searchParams.get('showUserAvatar') === '1',
                };
            }
            
            // Check if it's already a launch.php URL
            if (urlObj.pathname.indexOf('/filter/mediacms/launch.php') !== -1 && urlObj.searchParams.has('token')) {
                 return {
                    baseUrl: baseUrl,
                    videoId: urlObj.searchParams.get('token'),
                    isEmbed: true,
                    isLaunchUrl: true
                };
            }

            return {
                baseUrl: baseUrl,
                rawUrl: url,
                isGeneric: true
            };
        } catch (e) {
            return null;
        }
    }

    parseEmbedUrl(url) {
        return this.parseVideoUrl(url);
    }

    buildEmbedUrl(parsed, options) {
        if (parsed.isGeneric) {
            return parsed.rawUrl;
        }

        const launchUrl = getLaunchUrl(this.editor);
        if (launchUrl && parsed.videoId) {
            const url = new URL(launchUrl);
            url.searchParams.set('token', parsed.videoId);
            return url.toString();
        }

        // Fallback to direct embed if launchUrl missing
        const url = new URL(`${parsed.baseUrl}/embed`);
        url.searchParams.set('m', parsed.videoId);
        return url.toString();
    }

    async getTemplateContext(data) {
        data = data || {};
        const width = data.width || 560;
        const height = data.height || 315;
        const aspectRatio = data.aspectRatio || '16:9';

        return {
            elementid: this.editor.getElement().id,
            isupdating: this.isUpdating,
            url: data.url || '',
            showTitle: data.showTitle !== false,
            linkTitle: data.linkTitle !== false,
            showRelated: data.showRelated !== false,
            showUserAvatar: data.showUserAvatar !== false,
            responsive: data.responsive !== false,
            startAtEnabled: data.startAtEnabled || false,
            startAt: data.startAt || '0:00',
            width: width,
            height: height,
            is16_9: aspectRatio === '16:9',
            is4_3: aspectRatio === '4:3',
            is1_1: aspectRatio === '1:1',
            isCustom: aspectRatio === 'custom',
        };
    }

    async displayDialogue() {
        this.selectedIframe = this.getSelectedIframe();
        const data = this.getCurrentIframeData();
        this.isUpdating = data !== null;
        this.iframeLibraryLoaded = false;

        const title = await getString('iframemodaltitle', component);
        const templateContext = await this.getTemplateContext(data || {});

        this.currentModal = await IframeModal.create({
            title: title,
            templateContext: templateContext,
        });

        await this.registerEventListeners(this.currentModal);
    }

    getSelectedIframe() {
        const node = this.editor.selection.getNode();
        if (node.nodeName.toLowerCase() === 'iframe') return node;
        return node.querySelector('iframe') || null;
    }

    getCurrentIframeData() {
        if (!this.selectedIframe) return null;
        const src = this.selectedIframe.getAttribute('src');
        const parsed = this.parseInput(src);
        
        // Defaults
        let showTitle = true;
        if (parsed && typeof parsed.showTitle !== 'undefined') {
            showTitle = parsed.showTitle;
        }

        return {
            url: src,
            width: this.selectedIframe.getAttribute('width') || 560,
            height: this.selectedIframe.getAttribute('height') || 315,
            showTitle: showTitle,
        };
    }

    getFormValues(root) {
        const form = root.querySelector(Selectors.IFRAME.elements.form);
        // Helper to safely get value or checked state
        const getVal = (sel) => {
            const el = form.querySelector(sel);
            return el ? el.value : '';
        };
        const getCheck = (sel) => {
            const el = form.querySelector(sel);
            return el ? el.checked : false;
        };

        return {
            url: getVal(Selectors.IFRAME.elements.url).trim(),
            showTitle: getCheck(Selectors.IFRAME.elements.showTitle),
            linkTitle: getCheck(Selectors.IFRAME.elements.linkTitle),
            showRelated: getCheck(Selectors.IFRAME.elements.showRelated),
            showUserAvatar: getCheck(Selectors.IFRAME.elements.showUserAvatar),
            responsive: getCheck(Selectors.IFRAME.elements.responsive),
            aspectRatio: getVal(Selectors.IFRAME.elements.aspectRatio),
            width: parseInt(getVal(Selectors.IFRAME.elements.width)) || 560,
            height: parseInt(getVal(Selectors.IFRAME.elements.height)) || 315,
        };
    }

    async generateIframeHtml(values) {
        const parsed = this.parseInput(values.url);
        if (!parsed) return '';

        const embedUrl = this.buildEmbedUrl(parsed, values);
        
        const aspectRatioCalcs = {
            '16:9': '16 / 9',
            '4:3': '4 / 3',
            '1:1': '1 / 1',
            'custom': `${values.width} / ${values.height}`
        };

        const context = {
            src: embedUrl,
            width: values.width,
            height: values.height,
            responsive: values.responsive,
            aspectRatioValue: aspectRatioCalcs[values.aspectRatio] || '16 / 9',
        };

        const template = await Templates.renderForPromise(
            `${component}/iframe_embed_output`,
            context
        );
        return template.html;
    }

    async updatePreview(root) {
        const values = this.getFormValues(root);
        const previewContainer = root.querySelector(Selectors.IFRAME.elements.preview);
        
        if (!values.url) {
            previewContainer.innerHTML = '<span>Enter URL</span>';
            return;
        }

        const parsed = this.parseInput(values.url);
        if (!parsed) {
             previewContainer.innerHTML = '<span class="text-danger">Invalid URL</span>';
             return;
        }
        
        const embedUrl = this.buildEmbedUrl(parsed, values);
        // Simple preview
        previewContainer.innerHTML = `<iframe src="${embedUrl}" width="100%" height="200" frameborder="0"></iframe>`;
    }
    
    async registerEventListeners(modal) {
        const root = modal.getRoot()[0];
        const form = root.querySelector(Selectors.IFRAME.elements.form);
        
        // Input changes update preview
        form.addEventListener('change', () => this.updatePreview(root));
        const urlInput = form.querySelector(Selectors.IFRAME.elements.url);
        if (urlInput) {
             urlInput.addEventListener('input', () => this.updatePreview(root));
        }
        
        // Tab switching
        const tabUrl = form.querySelector(Selectors.IFRAME.elements.tabUrlBtn);
        const tabLib = form.querySelector(Selectors.IFRAME.elements.tabIframeLibraryBtn);
        
        if (tabLib) {
            tabLib.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchToTab(root, 'library');
                this.loadIframeLibrary(root);
            });
        }
        
        if (tabUrl) {
            tabUrl.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchToTab(root, 'url');
            });
        }
        
        modal.getRoot().on(ModalEvents.save, () => this.handleDialogueSubmission(modal));
        
        // Listen for messages
        window.addEventListener('message', (e) => this.handleIframeLibraryMessage(root, e));
    }
    
    switchToTab(root, tab) {
        const form = root.querySelector(Selectors.IFRAME.elements.form);
        const urlPane = form.querySelector(Selectors.IFRAME.elements.paneUrl);
        const libPane = form.querySelector(Selectors.IFRAME.elements.paneIframeLibrary);
        const urlBtn = form.querySelector(Selectors.IFRAME.elements.tabUrlBtn);
        const libBtn = form.querySelector(Selectors.IFRAME.elements.tabIframeLibraryBtn);
        
        if (tab === 'url') {
            if(urlPane) { urlPane.classList.add('show', 'active'); }
            if(libPane) { libPane.classList.remove('show', 'active'); }
            if(urlBtn) { urlBtn.classList.add('active'); }
            if(libBtn) { libBtn.classList.remove('active'); }
        } else {
            if(urlPane) { urlPane.classList.remove('show', 'active'); }
            if(libPane) { libPane.classList.add('show', 'active'); }
            if(urlBtn) { urlBtn.classList.remove('active'); }
            if(libBtn) { libBtn.classList.add('active'); }
        }
    }
    
    loadIframeLibrary(root) {
        const ltiConfig = getLti(this.editor);
        if (ltiConfig && ltiConfig.contentItemUrl) {
            const iframe = root.querySelector(Selectors.IFRAME.elements.iframeLibraryFrame);
            const loading = root.querySelector(Selectors.IFRAME.elements.iframeLibraryLoading);
            const placeholder = root.querySelector(Selectors.IFRAME.elements.iframeLibraryPlaceholder);
            
            if (placeholder) placeholder.classList.add('d-none');

            if (iframe && !iframe.src) {
                if (loading) loading.classList.remove('d-none');
                iframe.classList.add('d-none');
                
                iframe.onload = () => {
                    if (loading) loading.classList.add('d-none');
                    iframe.classList.remove('d-none');
                };
                
                iframe.src = ltiConfig.contentItemUrl;
            }
        }
    }
    
    handleIframeLibraryMessage(root, event) {
        const data = event.data;
        if (!data) return;
        
        let embedUrl = null;
        let videoId = null;
        
        // LTI Deep Linking Response
        if (data.type === 'ltiDeepLinkingResponse' || data.messageType === 'LtiDeepLinkingResponse') {
             const items = data.content_items || data.contentItems || [];
             if (items.length) {
                 embedUrl = items[0].url || items[0].embed_url;
                 if (embedUrl) {
                     const parsed = this.parseInput(embedUrl);
                     if (parsed) videoId = parsed.videoId;
                 }
             }
        }
        
        // MediaCMS custom message
        if (data.action === 'selectMedia' || data.type === 'videoSelected') {
            embedUrl = data.embedUrl || data.url;
            videoId = data.mediaId || data.videoId || data.id;
        }
        
        if (videoId) {
            const mediaCMSUrl = getMediaCMSUrl(this.editor);
            if (mediaCMSUrl) {
                const viewUrl = `${mediaCMSUrl}/view?m=${videoId}`;
                const urlInput = root.querySelector(Selectors.IFRAME.elements.url);
                if (urlInput) {
                    urlInput.value = viewUrl;
                    this.updatePreview(root);
                    this.switchToTab(root, 'url');
                }
            }
        }
    }
    
    async handleDialogueSubmission(modal) {
        const root = modal.getRoot()[0];
        const values = this.getFormValues(root);
        const html = await this.generateIframeHtml(values);
        
        if (html) {
             this.editor.insertContent(html);
        }
        modal.hide();
    }
}
