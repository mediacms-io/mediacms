<?php
/**
 * LTI Launch for MediaCMS Filter
 *
 * @package    filter_mediacms
 * @copyright  2026 MediaCMS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../config.php');
require_once($CFG->dirroot . '/mod/lti/lib.php');
require_once($CFG->dirroot . '/mod/lti/locallib.php');
require_once($CFG->dirroot . '/course/modlib.php');

global $SITE, $DB, $PAGE, $OUTPUT, $CFG;

/**
 * Find first LTI activity for the MediaCMS tool, or create dummy if none exists
 */
function filter_mediacms_get_dummy_activity($courseid, $typeid) {
    global $DB;

    // Find any existing LTI activity with this tool
    $sql = "SELECT cm.id
            FROM {course_modules} cm
            JOIN {modules} m ON m.id = cm.module
            JOIN {lti} lti ON lti.id = cm.instance
            WHERE cm.course = :courseid
              AND m.name = 'lti'
              AND lti.typeid = :typeid
              AND cm.deletioninprogress = 0
            LIMIT 1";

    $existing = $DB->get_record_sql($sql, ['courseid' => $courseid, 'typeid' => $typeid]);
    if ($existing) {
        // Ensure it's accessible (fix if created with visible=0)
        $cm = get_coursemodule_from_id('lti', $existing->id, 0, false, IGNORE_MISSING);
        if ($cm && !$cm->visible) {
            set_coursemodule_visible($existing->id, 1);
        }
        return $existing->id;
    }

    // No existing activity - create dummy (accessible but hidden from course page)
    $moduleinfo = new stdClass();
    $moduleinfo->course = $courseid;
    $moduleinfo->module = $DB->get_field('modules', 'id', ['name' => 'lti']);
    $moduleinfo->modulename = 'lti';
    $moduleinfo->section = 0;
    $moduleinfo->visible = 1;  // Accessible to students
    $moduleinfo->visibleoncoursepage = 0;  // But hidden from course page
    $moduleinfo->name = 'MediaCMS Dummy';
    $moduleinfo->intro = 'Placeholder for filter launches';
    $moduleinfo->introformat = FORMAT_HTML;
    $moduleinfo->typeid = $typeid;
    $moduleinfo->instructorchoiceacceptgrades = 0;
    $moduleinfo->grade = 0;
    $moduleinfo->instructorchoicesendname = 1;
    $moduleinfo->instructorchoicesendemailaddr = 1;
    $moduleinfo->launchcontainer = LTI_LAUNCH_CONTAINER_EMBED_NO_BLOCKS;
    $moduleinfo->instructorcustomparameters = '';  // Empty - we'll override per launch

    $result = add_moduleinfo($moduleinfo, get_course($courseid));
    return $result->coursemodule;
}

require_login();

$mediatoken = required_param('token', PARAM_ALPHANUMEXT);
$courseid = optional_param('courseid', 0, PARAM_INT);
$height = optional_param('height', 0, PARAM_INT);
$width = optional_param('width', 0, PARAM_INT);

// Get configuration
$mediacmsurl = get_config('filter_mediacms', 'mediacmsurl');
$ltitoolid = get_config('filter_mediacms', 'ltitoolid');
$defaultwidth = get_config('filter_mediacms', 'iframewidth') ?: 960;
$defaultheight = get_config('filter_mediacms', 'iframeheight') ?: 540;

if (empty($width)) {
    $width = $defaultwidth;
}
if (empty($height)) {
    $height = $defaultheight;
}

if (empty($mediacmsurl)) {
    die('MediaCMS URL not configured');
}

// Tool Selection Logic
$type = false;
if (!empty($ltitoolid)) {
    $type = $DB->get_record('lti_types', ['id' => $ltitoolid]);
}

if (!$type) {
    die('LTI tool not found or not configured.');
}

// Set up context
if ($courseid && $courseid != SITEID) {
    $context = context_course::instance($courseid);
    $course = get_course($courseid);
} else {
    $context = context_system::instance();
    $course = $SITE;
}

// Get or create dummy activity for this course
try {
    $dummy_cmid = filter_mediacms_get_dummy_activity($courseid, $type->id);
} catch (Exception $e) {
    if (!has_capability('moodle/course:manageactivities', $context)) {
        die('No MediaCMS activity found. Please ask a teacher to add one first.');
    }
    throw $e;
}

// Get the dummy activity instance from DB
$cm = get_coursemodule_from_id('lti', $dummy_cmid, 0, false, MUST_EXIST);
$instance = $DB->get_record('lti', ['id' => $cm->instance], '*', MUST_EXIST);

// Override with our media token for THIS launch only (doesn't save to DB)
$instance->instructorcustomparameters = "media_friendly_token=" . $mediatoken;
$instance->name = 'MediaCMS Video: ' . $mediatoken;

// Set up page
$PAGE->set_url(new moodle_url('/filter/mediacms/launch.php', [
    'token' => $mediatoken,
    'courseid' => $courseid,
    'width' => $width,
    'height' => $height
]));
$PAGE->set_context($context);
$PAGE->set_pagelayout('embedded');
$PAGE->set_title('MediaCMS');

// Get type config
$typeconfig = lti_get_type_type_config($type->id);

// Initiate LTI Login with proper cmid (for permissions) and custom token
$content = lti_initiate_login($course->id, $dummy_cmid, $instance, $typeconfig, null, $instance->name);

echo $OUTPUT->header();
echo $content;
echo $OUTPUT->footer();
