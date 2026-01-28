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
 * Settings for MediaCMS LTI Filter plugin.
 *
 * @package    filter_mediacmslti
 * @copyright  2026 MediaCMS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die;

if ($ADMIN->fulltree) {
    // MediaCMS URL setting.
    $settings->add(new admin_setting_configtext(
        'filter_mediacmslti/mediacmsurl',
        get_string('mediacmsurl', 'filter_mediacmslti'),
        get_string('mediacmsurl_desc', 'filter_mediacmslti'),
        'https://deic.mediacms.io',
        PARAM_URL
    ));

    // Get list of LTI tools for dropdown.
    $ltioptions = [];
    try {
        $tools = $DB->get_records('lti_types', null, 'name ASC', 'id, name');
        foreach ($tools as $tool) {
            $ltioptions[$tool->id] = $tool->name;
        }
    } catch (Exception $e) {
        // Database not ready yet or no tools configured.
        $ltioptions[0] = get_string('noltitoolsfound', 'filter_mediacmslti');
    }

    // LTI Tool ID setting.
    $settings->add(new admin_setting_configselect(
        'filter_mediacmslti/ltitoolid',
        get_string('ltitoolid', 'filter_mediacmslti'),
        get_string('ltitoolid_desc', 'filter_mediacmslti'),
        0,
        $ltioptions
    ));

    // Iframe width setting.
    $settings->add(new admin_setting_configtext(
        'filter_mediacmslti/iframewidth',
        get_string('iframewidth', 'filter_mediacmslti'),
        get_string('iframewidth_desc', 'filter_mediacmslti'),
        '960',
        PARAM_INT
    ));

    // Iframe height setting.
    $settings->add(new admin_setting_configtext(
        'filter_mediacmslti/iframeheight',
        get_string('iframeheight', 'filter_mediacmslti'),
        get_string('iframeheight_desc', 'filter_mediacmslti'),
        '540',
        PARAM_INT
    ));

    // Information about enabling the filter.
    $settings->add(new admin_setting_heading(
        'filter_mediacmslti/enablefilterheading',
        get_string('enablefilterheading', 'filter_mediacmslti'),
        get_string('enablefilterheading_desc', 'filter_mediacmslti')
    ));
}
