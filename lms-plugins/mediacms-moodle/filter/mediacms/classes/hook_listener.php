<?php
/**
 * Hook listener for filter_mediacms navigation hooks (Moodle 4.3+)
 *
 * @package    filter_mediacms
 * @copyright  2026 MediaCMS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace filter_mediacms;

/**
 * Extends the primary (top) navigation bar with a My Media link.
 */
class hook_listener {

    /**
     * Called by the \core\hook\navigation\primary_extend hook.
     * Adds the My Media link to the primary nav bar when placement = 'top'.
     */
    public static function extend_primary_navigation(
        \core\hook\navigation\primary_extend $hook
    ): void {
        $placement = get_config('filter_mediacms', 'mymedia_placement');
        if ($placement !== 'top') {
            return;
        }

        if (!isloggedin() || isguestuser()) {
            return;
        }

        $url  = new \moodle_url('/filter/mediacms/my_media.php');
        $node = \navigation_node::create(
            get_string('mymedia', 'filter_mediacms'),
            $url,
            \navigation_node::TYPE_CUSTOM,
            null,
            'mediacms_mymedia',
            new \pix_icon('i/media', '')
        );

        $primarynav = $hook->get_primarynav();
        if ($primarynav === null) {
            return;
        }
        $primarynav->add_node($node);
    }
}
