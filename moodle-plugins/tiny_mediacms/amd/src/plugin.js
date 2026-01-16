// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Tiny MediaCMS plugin.
 *
 * @module      tiny_mediacms/plugin
 * @copyright   2026 MediaCMS
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import {getTinyMCE} from 'editor_tiny/loader';
import {getPluginOptionName} from 'editor_tiny/options';
import {component, pluginName, icon, buttonName} from './common';
import * as Configuration from './configuration';

/**
 * Handle the action when button is clicked.
 *
 * @param {TinyMCE.Editor} editor The TinyMCE editor instance.
 */
const handleAction = async(editor) => {
    const config = Configuration.getConfig(editor);

    // Get the MediaCMS LTI tool ID from the external tool in the activity
    // For simplicity, we'll use a dialog that loads the MediaCMS select-media view
    const dialogConfig = {
        title: 'Select MediaCMS content',
        size: 'large',
        body: {
            type: 'panel',
            items: [
                {
                    type: 'htmlpanel',
                    html: '<div id="mediacms-loading" style="text-align: center; padding: 20px;">Loading MediaCMS content...</div>' +
                          '<iframe id="mediacms-iframe" style="width: 100%; height: 500px; border: none; display: none;"></iframe>'
                }
            ]
        },
        buttons: [
            {
                type: 'cancel',
                text: 'Close'
            }
        ],
        initialData: {},
        onSubmit: function(api) {
            api.close();
        }
    };

    const dialog = editor.windowManager.open(dialogConfig);

    // Listen for messages from the iframe
    const messageHandler = (event) => {
        // Security check: verify origin if needed
        // if (event.origin !== expectedOrigin) return;

        if (event.data && event.data.type === 'mediacms-embed') {
            const embedCode = event.data.embedCode;
            if (embedCode) {
                editor.insertContent(embedCode);
                dialog.close();
            }
        }
    };

    window.addEventListener('message', messageHandler);

    // Get the current course ID from Moodle
    const courseId = (typeof M !== 'undefined' && M.cfg && M.cfg.courseId) ? M.cfg.courseId : 1;

    // Build the MediaCMS select-media URL with TinyMCE mode
    // This URL should point to your MediaCMS instance
    // You'll need to configure this in the plugin settings
    const mediacmsBaseUrl = config.mediacmsUrl || window.location.origin;
    const selectMediaUrl = mediacmsBaseUrl + '/lti/select-media/?mode=tinymce&courseid=' + courseId;

    // Load the iframe after dialog is rendered
    setTimeout(() => {
        const iframe = document.querySelector('#mediacms-iframe');
        const loading = document.querySelector('#mediacms-loading');

        if (iframe && loading) {
            iframe.onload = () => {
                loading.style.display = 'none';
                iframe.style.display = 'block';
            };
            iframe.onerror = () => {
                loading.innerHTML = '<p style="color: red;">Error loading MediaCMS content. Please check your configuration.</p>';
            };
            iframe.src = selectMediaUrl;
        }
    }, 100);

    // Cleanup on dialog close (TinyMCE 6 API)
    // Note: TinyMCE dialog may not have an 'on' method, so we'll rely on cleanup when the component unmounts
    const originalClose = dialog.close;
    dialog.close = function() {
        window.removeEventListener('message', messageHandler);
        originalClose.call(this);
    };
};

/**
 * Get the setup function for the buttons.
 *
 * This is performed in an async function which ultimately returns the registration function as the
 * Tiny.AddOnManager.Add() function does not support async functions.
 *
 * @returns {function} The registration function to call within the Plugin.add function.
 */
export const getSetup = async() => {
    const [
        tinyMCE,
    ] = await Promise.all([
        getTinyMCE(),
    ]);

    return (editor) => {
        // Register the button
        editor.ui.registry.addButton(buttonName, {
            icon: icon,
            tooltip: 'Insert MediaCMS content',
            onAction: () => handleAction(editor),
        });

        // Register the menu item
        editor.ui.registry.addMenuItem(buttonName, {
            icon: icon,
            text: 'Insert MediaCMS content',
            onAction: () => handleAction(editor),
        });

        return;
    };
};
