// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Configuration for Tiny MediaCMS plugin.
 *
 * @module      tiny_mediacms/configuration
 * @copyright   2026 MediaCMS
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import {pluginName} from './common';
import {getPluginOptionName} from 'editor_tiny/options';

const mediacmsUrlName = getPluginOptionName(pluginName, 'mediacmsUrl');

/**
 * Register the plugin configuration.
 *
 * @param {TinyMCE} editor
 */
export const register = (editor) => {
    const registerOption = editor.options.register;

    registerOption(mediacmsUrlName, {
        processor: 'string',
        "default": '',
    });
};

/**
 * Get the configuration for the plugin.
 *
 * @param {TinyMCE.Editor} editor
 * @returns {object}
 */
export const getConfig = (editor) => {
    return {
        mediacmsUrl: editor.options.get(mediacmsUrlName),
    };
};
