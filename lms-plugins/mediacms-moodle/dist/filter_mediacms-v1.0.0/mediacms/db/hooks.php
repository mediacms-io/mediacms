<?php
/**
 * Hook registrations for filter_mediacms.
 *
 * @package    filter_mediacms
 * @copyright  2026 MediaCMS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

$callbacks = [
    [
        'hook' => \core\hook\after_config::class,
        'callback' => [\filter_mediacms\hooks::class, 'append_my_media_link'],
        'priority' => 100,
    ],
];
