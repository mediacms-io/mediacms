<?php
/**
 * Navigation callbacks for filter_mediacms
 *
 * @package    filter_mediacms
 * @copyright  2026 MediaCMS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Add My Media to the global / flat navigation (nav drawer).
 * Fires on every page when placement is set to 'top'.
 * In Moodle 4.x Boost the nav drawer is opened via the hamburger icon
 * and the node appears as a top-level item alongside Home / My courses.
 */
function filter_mediacms_extend_navigation(global_navigation $navigation): void {
    $placement = get_config('filter_mediacms', 'mymedia_placement');
    if ($placement !== 'top') {
        return;
    }

    if (!isloggedin() || isguestuser()) {
        return;
    }

    $url  = new moodle_url('/filter/mediacms/my_media.php');
    $node = navigation_node::create(
        get_string('mymedia', 'filter_mediacms'),
        $url,
        navigation_node::TYPE_CUSTOM,
        null,
        'mediacms_mymedia',
        new pix_icon('i/media', '')
    );
    // showinflatnavigation = true makes it visible in the Boost nav drawer.
    $node->showinflatnavigation = true;
    $navigation->add_node($node);
}

/**
 * Add My Media to the user account / settings navigation.
 * Fires when placement is set to 'user'.
 * In Moodle 4.x Boost this section is reachable via avatar → Preferences.
 */
function filter_mediacms_extend_navigation_user_settings(
    navigation_node $navigation,
    stdClass $user,
    context_user $usercontext,
    stdClass $course,
    context_course $coursecontext
): void {
    $placement = get_config('filter_mediacms', 'mymedia_placement');
    if ($placement !== 'user') {
        return;
    }

    if (!isloggedin() || isguestuser()) {
        return;
    }

    $url = new moodle_url('/filter/mediacms/my_media.php');
    $navigation->add(
        get_string('mymedia', 'filter_mediacms'),
        $url,
        navigation_node::TYPE_SETTING,
        null,
        'mediacms_mymedia',
        new pix_icon('i/media', '')
    );
}
