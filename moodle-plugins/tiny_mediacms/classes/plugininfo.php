<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

/**
 * Tiny MediaCMS plugin info.
 *
 * @package    tiny_mediacms
 * @copyright  2026 MediaCMS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace tiny_mediacms;

use context;
use editor_tiny\plugin;
use editor_tiny\plugin_with_buttons;
use editor_tiny\plugin_with_configuration;

/**
 * Tiny MediaCMS plugin for Moodle.
 *
 * @package    tiny_mediacms
 * @copyright  2026 MediaCMS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class plugininfo extends plugin implements plugin_with_buttons, plugin_with_configuration {

    /**
     * Get a list of the buttons provided by this plugin.
     *
     * @return string[]
     */
    public static function get_available_buttons(): array {
        return [
            'tiny_mediacms/button',
        ];
    }

    /**
     * Get the configuration for this plugin.
     *
     * @param context $context The context that the editor is used within
     * @param array $options The options passed in when requesting the editor
     * @param array $fpoptions The filepicker options passed in when requesting the editor
     * @param \editor_tiny\editor|null $editor The editor instance in which the plugin is initialized
     * @return array
     */
    public static function get_plugin_configuration_for_context(
        context $context,
        array $options,
        array $fpoptions,
        ?\editor_tiny\editor $editor = null
    ): array {
        global $CFG;

        // Return the MediaCMS LTI tool URL configuration
        return [
            'mediacmsUrl' => $CFG->wwwroot,
        ];
    }
}
