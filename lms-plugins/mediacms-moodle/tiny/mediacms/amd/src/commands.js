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
 * Tiny Media commands.
 *
 * @module      tiny_mediacms/commands
 * @copyright   2022 Huong Nguyen <huongnv13@gmail.com>
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import {getStrings} from 'core/str';
import {
    component,
    iframeButtonName,
    iframeMenuItemName,
    iframeIcon,
} from './common';
import IframeEmbed from './iframeembed';
import {getButtonImage} from 'editor_tiny/utils';

const isIframe = (node) => node.nodeName.toLowerCase() === 'iframe' ||
    (node.classList && node.classList.contains('tiny-iframe-responsive')) ||
    (node.classList && node.classList.contains('tiny-mediacms-iframe-wrapper')) ||
    (node.nodeName.toLowerCase() === 'a' && node.getAttribute('data-mediacms-textlink') === 'true');

/**
 * Wrap iframes with overlay containers that allow hover detection.
 * Since iframes capture mouse events, we add an invisible overlay on top
 * that shows the edit button on hover.
 *
 * @param {TinyMCE} editor - The editor instance
 * @param {Function} handleIframeAction - The action to perform when clicking the button
 */
const setupIframeOverlays = (editor, handleIframeAction) => {
    /**
     * Process all iframes in the editor and add overlay wrappers.
     */
    const fixWrapperWidths = () => {
        const editorBody = editor.getBody();
        if (!editorBody) {
            return;
        }
        editorBody.querySelectorAll('.tiny-mediacms-iframe-wrapper').forEach((wrapper) => {
            const iframe = wrapper.querySelector('iframe');
            if (!iframe) {
                return;
            }
            const iframeStyle = iframe.getAttribute('style') || '';
            const match = iframeStyle.match(/max-width:\s*(\d+(?:\.\d+)?)px/);
            if (match) {
                wrapper.style.maxWidth = match[1] + 'px';
                wrapper.style.width = '100%';
                wrapper.style.margin = '0 auto';
            }
        });
    };

    const processIframes = () => {
        const editorBody = editor.getBody();
        if (!editorBody) {
            return;
        }

        const iframes = editorBody.querySelectorAll('iframe');
        iframes.forEach((iframe) => {
            // If already wrapped, ensure contenteditable and EDIT button are present
            if (iframe.parentElement?.classList.contains('tiny-mediacms-iframe-wrapper')) {
                const existingWrapper = iframe.parentElement;
                existingWrapper.setAttribute('contenteditable', 'false');
                if (!existingWrapper.querySelector('.tiny-mediacms-edit-btn')) {
                    const editBtn = editor.getDoc().createElement('button');
                    editBtn.className = 'tiny-mediacms-edit-btn';
                    editBtn.setAttribute('type', 'button');
                    editBtn.setAttribute('title', 'Edit media embed options');
                    editBtn.textContent = 'EDIT';
                    existingWrapper.appendChild(editBtn);
                }
                return;
            }

            // Skip TinyMCE internal iframes
            if (iframe.hasAttribute('data-mce-object') || iframe.hasAttribute('data-mce-placeholder')) {
                return;
            }

            // Create wrapper div
            const wrapper = editor.getDoc().createElement('div');
            wrapper.className = 'tiny-mediacms-iframe-wrapper';
            wrapper.setAttribute('contenteditable', 'false');

            // Create edit button (positioned inside wrapper, over the iframe)
            const editBtn = editor.getDoc().createElement('button');
            editBtn.className = 'tiny-mediacms-edit-btn';
            editBtn.setAttribute('type', 'button');
            editBtn.setAttribute('title', 'Edit media embed options');
            // Use text "EDIT" instead of icon
            editBtn.textContent = 'EDIT';

            // Wrap the iframe: insert wrapper, move iframe into it, add button
            iframe.parentNode.insertBefore(wrapper, iframe);
            wrapper.appendChild(iframe);
            wrapper.appendChild(editBtn);
        });

        fixWrapperWidths();
    };

    /**
     * Add CSS styles for hover effects to the editor's document.
     */
    const addStyles = () => {
        const editorDoc = editor.getDoc();
        if (!editorDoc) {
            return;
        }

        // Check if styles already added
        if (editorDoc.getElementById('tiny-mediacms-overlay-styles')) {
            return;
        }

        const style = editorDoc.createElement('style');
        style.id = 'tiny-mediacms-overlay-styles';
        style.textContent = `
            .tiny-mediacms-iframe-wrapper {
                display: inline-block;
                position: relative;
                line-height: 0;
                vertical-align: top;
                margin-top: 28px;
            }
            .tiny-mediacms-iframe-wrapper iframe {
                display: block;
            }
            .tiny-mediacms-edit-btn {
                position: absolute;
                top: -20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.7);
                color: #ffffff;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                z-index: 10;
                padding: 8px 20px;
                margin: 0;
                font-size: 14px;
                font-weight: bold;
                text-decoration: none;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                transition: background 0.15s, box-shadow 0.15s;
                display: inline-block;
                box-sizing: border-box;
            }
            .tiny-mediacms-edit-btn:hover {
                background: rgba(0, 0, 0, 0.85);
                box-shadow: 0 3px 6px rgba(0,0,0,0.4);
            }
        `;
        editorDoc.head.appendChild(style);
    };

    /**
     * Handle click on the edit button.
     *
     * @param {Event} e - The click event
     */
    const handleOverlayClick = (e) => {
        const target = e.target;

        // Check if clicked on edit button or its child (svg/path)
        const editBtn = target.closest('.tiny-mediacms-edit-btn');
        if (!editBtn) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        // Find the associated wrapper and iframe
        const wrapper = editBtn.closest('.tiny-mediacms-iframe-wrapper');
        if (!wrapper) {
            return;
        }

        const iframe = wrapper.querySelector('iframe');
        if (!iframe) {
            return;
        }

        // Select the wrapper so TinyMCE knows which element is selected
        editor.selection.select(wrapper);

        // Open the edit dialog
        handleIframeAction();
    };

    // Setup on editor init
    editor.on('init', () => {
        addStyles();
        processIframes();

        // Handle clicks on the overlay
        editor.getBody().addEventListener('click', handleOverlayClick);
    });

    // Re-process when content changes
    editor.on('SetContent', () => {
        processIframes();
    });

    // Re-process when content is pasted
    editor.on('PastePostProcess', () => {
        setTimeout(processIframes, 100);
    });

    // Re-process after undo/redo
    editor.on('Undo Redo', () => {
        processIframes();
    });

    // Re-process on any content change (covers modal updates)
    editor.on('Change', () => {
        setTimeout(processIframes, 50);
    });

    // Re-process when node changes (selection changes)
    editor.on('NodeChange', () => {
        processIframes();
    });
};

const registerIframeCommand = (editor, iframeButtonText, iframeButtonImage) => {
    const handleIframeAction = () => {
        const iframeEmbed = new IframeEmbed(editor);
        iframeEmbed.displayDialogue();
    };

    // Register the iframe icon
    editor.ui.registry.addIcon(iframeIcon, iframeButtonImage.html);

    // Register the Menu Button as a toggle.
    // This means that when highlighted over an existing iframe element it will show as toggled on.
    editor.ui.registry.addToggleButton(iframeButtonName, {
        icon: iframeIcon,
        tooltip: iframeButtonText,
        onAction: handleIframeAction,
        onSetup: api => {
            const selector = [
                'iframe:not([data-mce-object]):not([data-mce-placeholder])',
                '.tiny-iframe-responsive',
                '.tiny-mediacms-iframe-wrapper',
                'a[data-mediacms-textlink="true"]'
            ].join(',');
            return editor.selection.selectorChangedWithUnbind(
                selector,
                api.setActive
            ).unbind;
        }
    });

    editor.ui.registry.addMenuItem(iframeMenuItemName, {
        icon: iframeIcon,
        text: iframeButtonText,
        onAction: handleIframeAction,
    });

    editor.ui.registry.addContextMenu(iframeButtonName, {
        update: isIframe,
    });

    // Setup iframe overlays with edit button on hover
    setupIframeOverlays(editor, handleIframeAction);
};

export const getSetup = async() => {
    const [
        iframeButtonText,
    ] = await getStrings([
        'iframebuttontitle',
    ].map((key) => ({key, component})));

    const [
        iframeButtonImage,
    ] = await Promise.all([
        getButtonImage('icon', component),
    ]);

    // Note: The function returned here must be synchronous and cannot use promises.
    // All promises must be resolved prior to returning the function.
    return (editor) => {
        registerIframeCommand(editor, iframeButtonText, iframeButtonImage);
    };
};
