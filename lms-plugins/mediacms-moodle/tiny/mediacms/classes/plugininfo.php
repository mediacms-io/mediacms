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

namespace tiny_mediacms;

use context;
use context_course;
use context_module;
use editor_tiny\editor;
use editor_tiny\plugin;
use editor_tiny\plugin_with_buttons;
use editor_tiny\plugin_with_configuration;
use editor_tiny\plugin_with_menuitems;
use moodle_url;

/**
 * Tiny media plugin.
 *
 * @package    tiny_media
 * @copyright  2022 Andrew Lyons <andrew@nicols.co.uk>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class plugininfo extends plugin implements plugin_with_buttons, plugin_with_menuitems, plugin_with_configuration {
    /**
     * Whether the plugin is enabled
     *
     * @param context $context The context that the editor is used within
     * @param array $options The options passed in when requesting the editor
     * @param array $fpoptions The filepicker options passed in when requesting the editor
     * @param editor $editor The editor instance in which the plugin is initialised
     * @return boolean
     */
    public static function is_enabled(
        context $context,
        array $options,
        array $fpoptions,
        ?editor $editor = null
    ): bool {
        // Disabled if:
        // - Not logged in or guest.
        // - Files are not allowed.
        // - Only URL are supported.
        $canhavefiles = !empty($options['maxfiles']);
        $canhaveexternalfiles = !empty($options['return_types']) && ($options['return_types'] & FILE_EXTERNAL);

        return isloggedin() && !isguestuser() && ($canhavefiles || $canhaveexternalfiles);
    }

    public static function get_available_buttons(): array {
        return [
            'tiny_mediacms/tiny_mediacms_image',
            'tiny_mediacms/tiny_mediacms_video',
            'tiny_mediacms/tiny_mediacms_iframe',
        ];
    }

    public static function get_available_menuitems(): array {
        return [
            'tiny_mediacms/tiny_mediacms_image',
            'tiny_mediacms/tiny_mediacms_video',
            'tiny_mediacms/tiny_mediacms_iframe',
        ];
    }

    public static function get_plugin_configuration_for_context(
        context $context,
        array $options,
        array $fpoptions,
        ?editor $editor = null
    ): array {

        // TODO Fetch the actual permissions.
        $permissions = [
            'image' => [
                'filepicker' => true,
            ],
            'embed' => [
                'filepicker' => true,
            ]
        ];

        // Get LTI configuration for MediaCMS iframe library.
        $lticonfig = self::get_lti_configuration($context);

        // Get auto-convert configuration.
        $autoconvertconfig = self::get_autoconvert_configuration();

        return array_merge([
            'permissions' => $permissions,
        ], self::get_file_manager_configuration($context, $options, $fpoptions), $lticonfig, $autoconvertconfig);
    }

    /**
     * Get the auto-convert configuration for pasted MediaCMS URLs.
     *
     * @return array Auto-convert configuration data
     */
    protected static function get_autoconvert_configuration(): array {
        $baseurl = get_config('tiny_mediacms', 'autoconvert_baseurl');

        // Helper function to get config with default value of true.
        $getboolconfig = function($name) {
            $value = get_config('tiny_mediacms', $name);
            // If the setting hasn't been saved yet (false/empty), default to true.
            // Only return false if explicitly set to '0'.
            return $value !== '0' && $value !== 0;
        };

        return [
            'data' => [
                'autoConvertEnabled' => $getboolconfig('autoconvertenabled'),
                'autoConvertBaseUrl' => !empty($baseurl) ? $baseurl : '',
                'autoConvertOptions' => [
                    'showTitle' => $getboolconfig('autoconvert_showtitle'),
                    'linkTitle' => $getboolconfig('autoconvert_linktitle'),
                    'showRelated' => $getboolconfig('autoconvert_showrelated'),
                    'showUserAvatar' => $getboolconfig('autoconvert_showuseravatar'),
                ],
            ],
        ];
    }

    /**
     * Get the LTI configuration for the MediaCMS iframe library.
     *
     * @param context $context The context that the editor is used within
     * @return array LTI configuration data
     */
    protected static function get_lti_configuration(context $context): array {
        global $COURSE;

        // Get the configured LTI tool ID from plugin settings.
        $ltitoolid = get_config('tiny_mediacms', 'ltitoolid');

        // Determine the course ID from context.
        $courseid = 0;
        if ($context instanceof context_course) {
            $courseid = $context->instanceid;
        } else if ($context instanceof context_module) {
            // Get the course from the module context.
            $coursecontext = $context->get_course_context(false);
            if ($coursecontext) {
                $courseid = $coursecontext->instanceid;
            }
        } else if (!empty($COURSE->id) && $COURSE->id != SITEID) {
            // Fall back to the global $COURSE if available and not the site.
            $courseid = $COURSE->id;
        }

        // Build the content item URL for LTI Deep Linking.
        // This URL initiates the LTI Deep Linking flow which allows users
        // to select content (like videos) from the tool provider.
        $contentitemurl = '';
        if (!empty($ltitoolid) && $courseid > 0) {
            $contentitemurl = (new moodle_url('/mod/lti/contentitem.php', [
                'id' => $ltitoolid,
                'course' => $courseid,
            ]))->out(false);
        }

        return [
            'lti' => [
                'toolId' => !empty($ltitoolid) ? (int) $ltitoolid : 0,
                'courseId' => $courseid,
                'contentItemUrl' => $contentitemurl,
            ],
        ];
    }

    protected static function get_file_manager_configuration(
        context $context,
        array $options,
        array $fpoptions
    ): array {
        global $USER;

        $params = [
            'area' => [],
            'usercontext' => \context_user::instance($USER->id)->id,
        ];

        $keys = [
            'itemid',
            'areamaxbytes',
            'maxbytes',
            'subdirs',
            'return_types',
            'removeorphaneddrafts',
        ];
        if (isset($options['context'])) {
            if (is_object($options['context'])) {
                $params['area']['context'] = $options['context']->id;
            } else {
                $params['area']['context'] = $options['context'];
            }
        }
        foreach ($keys as $key) {
            if (isset($options[$key])) {
                $params['area'][$key] = $options[$key];
            }
        }

        return [
            'storeinrepo' => true,
            'data' => [
                'params' => $params,
                'fpoptions' => $fpoptions,
            ],
        ];
    }
}
