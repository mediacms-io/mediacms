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
 * Tiny Media configuration.
 *
 * @module      tiny_mediacms/configuration
 * @copyright   2022 Huong Nguyen <huongnv13@gmail.com>
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import {
    iframeButtonName,
    iframeMenuItemName,
} from './common';
import {
    addContextmenuItem,
} from 'editor_tiny/utils';

const configureMenu = (menu) => {
    // Add the Iframe Embed to the insert menu.
    menu.insert.items = `${iframeMenuItemName} ${menu.insert.items}`;

    return menu;
};

const configureToolbar = (toolbar) => {
    // The toolbar contains an array of named sections.
    // The Moodle integration ensures that there is a section called 'content'.

    return toolbar.map((section) => {
        if (section.name === 'content') {
            // Insert the iframe button at the start of it.
            section.items.unshift(iframeButtonName);
        }

        return section;
    });
};

export const configure = (instanceConfig) => {
    // Update the instance configuration to add the Iframe Embed menu option to the menus and toolbars.
    return {
        contextmenu: addContextmenuItem(instanceConfig.contextmenu, iframeButtonName),
        menu: configureMenu(instanceConfig.menu),
        toolbar: configureToolbar(instanceConfig.toolbar),
    };
};
