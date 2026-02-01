<?php

namespace tiny_mediacms;

use context;
use moodle_url;

defined('MOODLE_INTERNAL') || die();

class plugininfo extends \editor_tiny\plugin {

    /**
     * Get the plugin configuration for the editor.
     */
    protected static function get_plugin_configuration_for_context(context $context, array $options = []): array {
        global $CFG;

        // Read settings from the FILTER plugin
        $mediacmsurl = get_config('filter_mediacms', 'mediacmsurl');
        $ltitoolid = get_config('filter_mediacms', 'ltitoolid');
        
        // Construct launch URL for the filter
        $launchurl = new moodle_url('/filter/mediacms/launch.php');
        
        // Content Item URL for LTI Deep Linking (if using the picker)
        // Usually: /mod/lti/contentitem.php?id=LTI_TYPE_ID
        $contentitemurl = '';
        if ($ltitoolid) {
            $contentitemurl = new moodle_url('/mod/lti/contentitem.php');
        }

        return [
            'mediacmsurl' => $mediacmsurl,
            'launchUrl' => $launchurl->out(false),
            'lti' => [
                'toolId' => (int) $ltitoolid,
                'courseId' => $context->get_course_context(false)->instanceid ?? 0,
                'contentItemUrl' => $contentitemurl ? $contentitemurl->out(false) : '',
            ]
        ];
    }
}
