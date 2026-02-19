<?php
defined('MOODLE_INTERNAL') || die;

if ($ADMIN->fulltree) {
    // Info heading
    $settings->add(new admin_setting_heading(
        'filter_mediacms/coresettings',
        get_string('coresettings', 'filter_mediacms'),
        get_string('coresettings_desc', 'filter_mediacms')
    ));

    // MediaCMS URL
    $settings->add(new admin_setting_configtext(
        'filter_mediacms/mediacmsurl',
        get_string('mediacmsurl', 'filter_mediacms'),
        get_string('mediacmsurl_desc', 'filter_mediacms'),
        'https://lti.mediacms.io',
        PARAM_URL
    ));

    // LTI Tool Selector
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
        // Database might not be ready during install
    }

    $settings->add(new admin_setting_configselect(
        'filter_mediacms/ltitoolid',
        get_string('ltitoolid', 'filter_mediacms'),
        get_string('ltitoolid_desc', 'filter_mediacms'),
        0,
        $ltioptions
    ));
}
