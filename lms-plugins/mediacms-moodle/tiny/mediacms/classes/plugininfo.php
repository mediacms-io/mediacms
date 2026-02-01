<?php

namespace tiny_mediacms;

use context;
use moodle_url;
use editor_tiny\plugin;
use editor_tiny\plugin_with_buttons;
use editor_tiny\plugin_with_menuitems;

defined('MOODLE_INTERNAL') || die();

class plugininfo extends plugin implements plugin_with_buttons, plugin_with_menuitems {

    /**
     * Whether the plugin is enabled
     */
    public static function is_enabled(context $context, array $options, array $fpoptions, ?\editor_tiny\editor $editor = null): bool {
        return isloggedin() && !isguestuser();
    }

    /**
     * Get available buttons
     */
    public static function get_available_buttons(): array {
        return [
            'tiny_mediacms/tiny_mediacms_video',
        ];
    }

    /**
     * Get available menu items
     */
    public static function get_available_menuitems(): array {
        return [
            'tiny_mediacms/tiny_mediacms_video',
        ];
    }

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
