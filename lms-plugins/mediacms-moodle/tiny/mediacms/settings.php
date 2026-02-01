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
    // LTI Tool ID setting.
    // This should be the ID of the external tool (LTI) configured in Moodle for MediaCMS.
    $setting = new admin_setting_configtext(
        'tiny_mediacms/ltitoolid',
        new lang_string('ltitoolid', 'tiny_mediacms'),
        new lang_string('ltitoolid_desc', 'tiny_mediacms'),
        '',
        PARAM_INT
    );
    $settings->add($setting);

    // Auto-convert heading.
    $settings->add(new admin_setting_heading(
        'tiny_mediacms/autoconvertheading',
        new lang_string('autoconvertheading', 'tiny_mediacms'),
        new lang_string('autoconvertheading_desc', 'tiny_mediacms')
    ));

    // Enable/disable auto-convert of pasted MediaCMS URLs.
    $setting = new admin_setting_configcheckbox(
        'tiny_mediacms/autoconvertenabled',
        new lang_string('autoconvertenabled', 'tiny_mediacms'),
        new lang_string('autoconvertenabled_desc', 'tiny_mediacms'),
        1
    );
    $settings->add($setting);

    // MediaCMS base URL for auto-convert.
    $setting = new admin_setting_configtext(
        'tiny_mediacms/autoconvert_baseurl',
        new lang_string('autoconvert_baseurl', 'tiny_mediacms'),
        new lang_string('autoconvert_baseurl_desc', 'tiny_mediacms'),
        '',
        PARAM_URL
    );
    $settings->add($setting);

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
        'tiny_mediacms/autoconvert_showrelated',
        new lang_string('autoconvert_showrelated', 'tiny_mediacms'),
        new lang_string('autoconvert_showrelated_desc', 'tiny_mediacms'),
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
