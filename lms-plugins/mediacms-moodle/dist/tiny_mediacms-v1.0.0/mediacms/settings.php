<?php
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
 * Settings for the tiny_mediacms plugin.
 *
 * @package    tiny_mediacms
 * @copyright  2024
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

if ($ADMIN->fulltree) {
    // Note: Core MediaCMS settings (URL, LTI Tool) are configured in the filter plugin
    // Go to: Site Administration > Plugins > Filters > MediaCMS
    $settings->add(new admin_setting_heading(
        'tiny_mediacms/coresettingsheading',
        new lang_string('coresettingsheading', 'tiny_mediacms'),
        new lang_string('coresettingsheading_desc', 'tiny_mediacms')
    ));

    // Editor-specific settings: Auto-convert default options

    // Auto-convert embed options.
    $setting = new admin_setting_configcheckbox(
        'tiny_mediacms/autoconvert_showtitle',
        new lang_string('autoconvert_showtitle', 'tiny_mediacms'),
        new lang_string('autoconvert_showtitle_desc', 'tiny_mediacms'),
        1
    );
    $settings->add($setting);

    $setting = new admin_setting_configcheckbox(
        'tiny_mediacms/autoconvert_linktitle',
        new lang_string('autoconvert_linktitle', 'tiny_mediacms'),
        new lang_string('autoconvert_linktitle_desc', 'tiny_mediacms'),
        1
    );
    $settings->add($setting);

    $setting = new admin_setting_configcheckbox(
        'tiny_mediacms/autoconvert_showuseravatar',
        new lang_string('autoconvert_showuseravatar', 'tiny_mediacms'),
        new lang_string('autoconvert_showuseravatar_desc', 'tiny_mediacms'),
        1
    );
    $settings->add($setting);
}
