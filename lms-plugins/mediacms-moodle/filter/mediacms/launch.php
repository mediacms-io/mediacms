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

global $SITE, $DB, $PAGE, $OUTPUT, $CFG;

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

// Create a dummy LTI instance object
$instance = new stdClass();
$instance->id = 0;
$instance->course = $course->id;
$instance->typeid = $type->id;
$instance->name = 'MediaCMS Video';
$instance->instructorchoiceacceptgrades = 0;
$instance->grade = 0;
$instance->instructorchoicesendname = 1;
$instance->instructorchoicesendemailaddr = 1;
$instance->launchcontainer = LTI_LAUNCH_CONTAINER_EMBED_NO_BLOCKS;

// Pass the token in custom parameters
// MediaCMS expects 'media_friendly_token' to identify the video
$instance->instructorcustomparameters = "media_friendly_token=" . $mediatoken;

// Get type config
$typeconfig = lti_get_type_type_config($type->id);

// Initiate LTI Login
$content = lti_initiate_login($course->id, 0, $instance, $typeconfig, null, 'MediaCMS Video');

// Inject media_token as a hidden field for OIDC flow state if needed
// This ensures the token survives the OIDC roundtrip if the provider supports it
// Standard LTI 1.3 passes it via Custom Claims (instructorcustomparameters) which is handled above.
// However, the original plugin also injected it into the form. We'll keep it for safety.
$hidden_field = '<input type="hidden" name="media_token" value="' . htmlspecialchars($mediatoken, ENT_QUOTES) . '" />';
$content = str_replace('</form>', $hidden_field . '</form>', $content);

echo $OUTPUT->header();
echo $content;
echo $OUTPUT->footer();
