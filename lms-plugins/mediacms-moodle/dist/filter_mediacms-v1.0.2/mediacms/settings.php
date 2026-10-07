<?php
defined('MOODLE_INTERNAL') || die;

require_once($CFG->dirroot . '/filter/mediacms/lib.php');

if ($ADMIN->fulltree) {
    $settings->add(new admin_setting_heading(
        'filter_mediacms/coresettings',
        get_string('coresettings', 'filter_mediacms'),
        get_string('coresettings_desc', 'filter_mediacms')
    ));

    $settings->add(new admin_setting_configselect(
        'filter_mediacms/mymedia_nav_position',
        get_string('mymediaposition', 'filter_mediacms'),
        get_string('mymediaposition_desc', 'filter_mediacms'),
        MEDIACMS_NAV_PLACEMENT_TOP,
        array(
            MEDIACMS_NAV_PLACEMENT_TOP => 'Top Navigation Bar',
            MEDIACMS_NAV_PLACEMENT_PROFILE => 'User Profile Dropdown',
            MEDIACMS_NAV_PLACEMENT_NONE => 'None (Do not display)'
        )
    ));

    $settings->add(new admin_setting_configtext(
        'filter_mediacms/mediacmsurl',
        get_string('mediacmsurl', 'filter_mediacms'),
        get_string('mediacmsurl_desc', 'filter_mediacms'),
        'https://lti.mediacms.io',
        PARAM_URL
    ));

    $ltioptions = [0 => get_string('noltitoolsfound', 'filter_mediacms')];
    try {
        $tools = $DB->get_records('lti_types', null, 'name ASC', 'id, name, baseurl');
        if (!empty($tools)) {
            $ltioptions = [0 => get_string('choose')];
            foreach ($tools as $tool) {
                $ltioptions[$tool->id] = $tool->name . ' (' . $tool->baseurl . ')';
            }
        }
    } catch (Exception $e) {
    }

    $settings->add(new admin_setting_configselect(
        'filter_mediacms/ltitoolid',
        get_string('ltitoolid', 'filter_mediacms'),
        get_string('ltitoolid_desc', 'filter_mediacms'),
        0,
        $ltioptions
    ));

    $settings->add(new admin_setting_configcheckbox(
        'filter_mediacms/share_embedded_media',
        get_string('shareembeddedmedia', 'filter_mediacms'),
        get_string('shareembeddedmedia_desc', 'filter_mediacms'),
        1
    ));
}
