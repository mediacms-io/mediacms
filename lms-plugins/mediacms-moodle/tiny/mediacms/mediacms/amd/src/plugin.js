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

        // Clean up editor-only elements before content is saved.
        // Remove wrapper divs and edit buttons that are only for the editor UI.
        editor.on('GetContent', (e) => {
            if (e.format === 'html') {
                // Create a temporary container to manipulate the HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = e.content;

                // Remove edit buttons
                tempDiv.querySelectorAll('.tiny-mediacms-edit-btn').forEach(btn => btn.remove());

                // Unwrap iframes from tiny-mediacms-iframe-wrapper
                tempDiv.querySelectorAll('.tiny-mediacms-iframe-wrapper').forEach(wrapper => {
                    const iframe = wrapper.querySelector('iframe');
                    if (iframe) {
                        wrapper.parentNode.insertBefore(iframe, wrapper);
                    }
                    wrapper.remove();
                });

                // Unwrap iframes from tiny-iframe-responsive
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
