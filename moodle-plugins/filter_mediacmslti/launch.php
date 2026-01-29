<?php
// This file is part of Moodle - http://moodle.org/

/**
 * LTI Launch for MediaCMS Filter - Uses Moodle's LTI libraries like Kaltura
 *
 * @package    filter_mediacmslti
 * @copyright  2026 MediaCMS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../config.php');
require_once($CFG->dirroot . '/mod/lti/lib.php');
require_once($CFG->dirroot . '/mod/lti/locallib.php');

global $SITE;

require_login();

$mediatoken = required_param('token', PARAM_ALPHANUMEXT);
$courseid = optional_param('courseid', 0, PARAM_INT);
$height = optional_param('height', 540, PARAM_INT);
$width = optional_param('width', 960, PARAM_INT);

// Get filter configuration
$mediacmsurl = get_config('filter_mediacmslti', 'mediacmsurl');
$ltitoolid = get_config('filter_mediacmslti', 'ltitoolid');

if (empty($mediacmsurl) || empty($ltitoolid)) {
    die('Filter not configured');
}

// Get the LTI tool type
$type = $DB->get_record('lti_types', ['id' => $ltitoolid]);
if (!$type) {
    die('LTI tool not found');
}

// Set up context - if courseid is 0, use system context
if (0 != $courseid) {
    $context = context_course::instance($courseid);
    $course = get_course($courseid);
} else {
    $context = context_system::instance();
    $course = $SITE;
}

// Set up page
$PAGE->set_url(new moodle_url('/filter/mediacmslti/launch.php', [
    'token' => $mediatoken,
    'courseid' => $courseid,
    'width' => $width,
    'height' => $height
]));
$PAGE->set_context($context);
$PAGE->set_pagelayout('embedded');

// Create a dummy LTI instance object (like Kaltura does)
$instance = new stdClass();
$instance->id = 0;  // Dummy ID - not a real activity
$instance->course = $course->id;
$instance->typeid = $ltitoolid;
$instance->name = 'MediaCMS video resource';
$instance->instructorchoiceacceptgrades = 0;
$instance->grade = 0;
$instance->instructorchoicesendname = 1;
$instance->instructorchoicesendemailaddr = 1;
$instance->launchcontainer = LTI_LAUNCH_CONTAINER_EMBED_NO_BLOCKS;

// Set custom parameters to pass media token (like deep linking does)
// This will be included in the LTI custom claims JWT
$instance->instructorcustomparameters = "media_friendly_token=" . $mediatoken;

// Get type config (standard tool URL, no modifications needed)
$typeconfig = lti_get_type_type_config($ltitoolid);

// Use Moodle's LTI launch function to initiate OIDC properly
// Pass 0 as dummy cmid since we don't have a real course module
$content = lti_initiate_login($course->id, 0, $instance, $typeconfig, null, 'MediaCMS video resource');

echo $OUTPUT->header();
echo $content;
echo $OUTPUT->footer();
