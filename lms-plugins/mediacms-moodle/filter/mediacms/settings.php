<?php
defined('MOODLE_INTERNAL') || die;

if ($ADMIN->fulltree) {
    // MediaCMS URL
    $settings->add(new admin_setting_configtext(
        'filter_mediacms/mediacmsurl',
        get_string('mediacmsurl', 'filter_mediacms'),
        get_string('mediacmsurl_desc', 'filter_mediacms'),
        'https://lti.mediacms.io',
        PARAM_URL
    ));

    // LTI Tool Selector
    $ltioptions = [0 => get_string('autodetect', 'filter_mediacms')];
    try {
        $tools = $DB->get_records('lti_types', null, 'name ASC', 'id, name, baseurl');
        foreach ($tools as $tool) {
            $ltioptions[$tool->id] = $tool->name . ' (' . $tool->baseurl . ')';
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

    // Dimensions
    $settings->add(new admin_setting_configtext(
        'filter_mediacms/iframewidth',
        get_string('iframewidth', 'filter_mediacms'),
        get_string('iframewidth_desc', 'filter_mediacms'),
        '960',
        PARAM_INT
    ));

    $settings->add(new admin_setting_configtext(
        'filter_mediacms/iframeheight',
        get_string('iframeheight', 'filter_mediacms'),
        get_string('iframeheight_desc', 'filter_mediacms'),
        '540',
        PARAM_INT
    ));

    // Auto-convert
    $settings->add(new admin_setting_configcheckbox(
        'filter_mediacms/enableautoconvert',
        get_string('enableautoconvert', 'filter_mediacms'),
        get_string('enableautoconvert_desc', 'filter_mediacms'),
        1
    ));
}
