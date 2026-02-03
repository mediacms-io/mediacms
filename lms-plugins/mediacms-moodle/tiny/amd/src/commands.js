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
    (node.classList && node.classList.contains('tiny-mediacms-iframe-wrapper'));

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
    const processIframes = () => {
        const editorBody = editor.getBody();
        if (!editorBody) {
            return;
        }

        const iframes = editorBody.querySelectorAll('iframe');
        iframes.forEach((iframe) => {
            // Skip if already wrapped
            if (iframe.parentElement?.classList.contains('tiny-mediacms-iframe-wrapper')) {
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
            editBtn.setAttribute('title', 'Edit video embed options');
            // Use clean inline SVG to avoid TinyMCE wrapper issues
            editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
                '<circle cx="50" cy="50" r="48" fill="#2EAF5A"/>' +
                '<polygon points="38,28 38,72 75,50" fill="#FFFFFF"/>' +
                '</svg>';

            // Wrap the iframe: insert wrapper, move iframe into it, add button
            iframe.parentNode.insertBefore(wrapper, iframe);
            wrapper.appendChild(iframe);
            wrapper.appendChild(editBtn);
        });
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
            }
            .tiny-mediacms-iframe-wrapper iframe {
                display: block;
            }
            .tiny-mediacms-edit-btn {
                position: absolute;
                top: 48px;
                left: 6px;
                width: 28px;
                height: 28px;
                background: #ffffff;
                border: none;
                border-radius: 50%;
                cursor: pointer;
                z-index: 10;
                padding: 0;
                margin: 0;
                box-shadow: 0 2px 6px rgba(0,0,0,0.35);
                transition: transform 0.15s, box-shadow 0.15s;
                display: flex;
                align-items: center;
                justify-content: center;
                box-sizing: border-box;
            }
            .tiny-mediacms-edit-btn:hover {
                transform: scale(1.15);
                box-shadow: 0 3px 10px rgba(0,0,0,0.45);
            }
            .tiny-mediacms-edit-btn svg {
                width: 18px !important;
                height: 18px !important;
                display: block !important;
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
            return editor.selection.selectorChangedWithUnbind(
                'iframe:not([data-mce-object]):not([data-mce-placeholder]),.tiny-iframe-responsive,.tiny-mediacms-iframe-wrapper',
                api.setActive
            ).unbind;
        }
    });

    editor.ui.registry.addMenuItem(iframeMenuItemName, {
        icon: iframeIcon,
        text: iframeButtonText,
        onAction: handleIframeAction,
    });

    editor.ui.registry.addContextToolbar(iframeButtonName, {
        predicate: isIframe,
        items: iframeButtonName,
        position: 'node',
        scope: 'node'
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
