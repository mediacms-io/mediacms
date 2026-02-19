<?php
/**
 * Local helper functions for filter_mediacms
 *
 * @package    filter_mediacms
 * @copyright  2026 MediaCMS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

/**
 * Find the first LTI activity for the MediaCMS tool in a course, or create a
 * visible dummy one if none exists. Repairs any existing stealth/hidden activity.
 *
 * @param int $courseid
 * @param int $typeid  LTI tool type ID
 * @return int  course-module ID
 */
function filter_mediacms_get_dummy_activity($courseid, $typeid) {
    global $DB;

    $sql = "SELECT cm.id
              FROM {course_modules} cm
              JOIN {modules} m ON m.id = cm.module
              JOIN {lti} lti    ON lti.id = cm.instance
             WHERE cm.course = :courseid
               AND m.name = 'lti'
               AND lti.typeid = :typeid
               AND cm.deletioninprogress = 0
          ORDER BY cm.visible DESC, cm.visibleoncoursepage DESC
             LIMIT 1";

    $existing = $DB->get_record_sql($sql, ['courseid' => $courseid, 'typeid' => $typeid]);
    if ($existing) {
        $cm = get_coursemodule_from_id('lti', $existing->id, 0, false, IGNORE_MISSING);
        if ($cm && (!$cm->visible || !$cm->visibleoncoursepage)) {
            // Repair hidden or stealth activity so students can access it via LTI flow.
            set_coursemodule_visible($existing->id, 1);
        }
        return $existing->id;
    }

    // Create a fully visible dummy activity.
    $moduleinfo = new stdClass();
    $moduleinfo->course              = $courseid;
    $moduleinfo->module              = $DB->get_field('modules', 'id', ['name' => 'lti']);
    $moduleinfo->modulename          = 'lti';
    $moduleinfo->section             = 0;
    $moduleinfo->visible             = 1;
    $moduleinfo->visibleoncoursepage = 1;
    $moduleinfo->availability        = null;
    $moduleinfo->showdescription     = 0;
    $moduleinfo->name                = 'MediaCMS Filter Launcher';
    $moduleinfo->intro               = '';
    $moduleinfo->introformat         = FORMAT_HTML;
    $moduleinfo->typeid              = $typeid;
    $moduleinfo->instructorchoiceacceptgrades  = 0;
    $moduleinfo->grade               = 0;
    $moduleinfo->instructorchoicesendname      = 1;
    $moduleinfo->instructorchoicesendemailaddr = 1;
    $moduleinfo->launchcontainer     = LTI_LAUNCH_CONTAINER_EMBED_NO_BLOCKS;
    $moduleinfo->instructorcustomparameters    = '';

    $result = add_moduleinfo($moduleinfo, get_course($courseid));

    return $result->coursemodule;
}
