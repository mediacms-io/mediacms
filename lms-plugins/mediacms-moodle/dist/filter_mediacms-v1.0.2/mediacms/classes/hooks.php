<?php
/**
 * Hook callbacks for filter_mediacms.
 *
 * @package    filter_mediacms
 * @copyright  2026 MediaCMS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace filter_mediacms;

defined('MOODLE_INTERNAL') || die();

class hooks {
    /**
     * Appends the My Media link to the custom menus after configuration is loaded.
     *
     * @param \core\hook\after_config $hook
     */
    public static function append_my_media_link(\core\hook\after_config $hook): void {
        global $CFG;

        $navposition = get_config('filter_mediacms', 'mymedia_nav_position');
        
        // MEDIACMS_NAV_PLACEMENT_NONE = 2
        if ($navposition == 2) {
            return;
        }
        
        if (!get_string_manager()->string_exists('mymedia', 'filter_mediacms')) {
            return;
        }
        
        $linktext = get_string('mymedia', 'filter_mediacms');
        $linkurl = '/filter/mediacms/my_media.php';
        $menuitem = "\n{$linktext}|{$linkurl}";

        // MEDIACMS_NAV_PLACEMENT_PROFILE = 1
        if ($navposition == 1) {
            // Add to User Profile Menu
            if (!isset($CFG->customusermenuitems)) {
                $CFG->customusermenuitems = '';
            }
            if (strpos($CFG->customusermenuitems, $linktext) === false) {
                $CFG->customusermenuitems .= $menuitem;
            }
        } else {
            // Default to Top Navigation Menu (MEDIACMS_NAV_PLACEMENT_TOP = 0)
            if (!isset($CFG->custommenuitems)) {
                $CFG->custommenuitems = '';
            }
            if (strpos($CFG->custommenuitems, $linktext) === false) {
                $CFG->custommenuitems .= $menuitem;
            }
        }
    }
}
