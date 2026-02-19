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
require_once(__DIR__ . '/locallib.php');

global $SITE, $DB, $PAGE, $OUTPUT, $CFG;

require_login();

$mediatoken = required_param('token', PARAM_ALPHANUMEXT);
$courseid = optional_param('courseid', 0, PARAM_INT);
$height = optional_param('height', 0, PARAM_INT);
$width = optional_param('width', 0, PARAM_INT);

// Extract embed parameters
$showTitle = optional_param('showTitle', '', PARAM_TEXT);
$showRelated = optional_param('showRelated', '', PARAM_TEXT);
$showUserAvatar = optional_param('showUserAvatar', '', PARAM_TEXT);
$linkTitle = optional_param('linkTitle', '', PARAM_TEXT);
$startTime = optional_param('t', '', PARAM_TEXT);

// Get configuration
$mediacmsurl = get_config('filter_mediacms', 'mediacmsurl');
$ltitoolid = get_config('filter_mediacms', 'ltitoolid');

// No default dimensions - use what's provided or nothing

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
$custom_params = ["media_friendly_token=" . $mediatoken];

// Add embed parameters if provided (check !== '' instead of !empty() because '0' is a valid value)
if ($showTitle !== '') {
    $custom_params[] = "embed_show_title=" . $showTitle;
}
if ($showRelated !== '') {
    $custom_params[] = "embed_show_related=" . $showRelated;
}
if ($showUserAvatar !== '') {
    $custom_params[] = "embed_show_user_avatar=" . $showUserAvatar;
}
if ($linkTitle !== '') {
    $custom_params[] = "embed_link_title=" . $linkTitle;
}
if ($startTime !== '') {
    $custom_params[] = "embed_start_time=" . $startTime;
}

$instance->instructorcustomparameters = implode("\n", $custom_params);
$instance->name = 'MediaCMS Video: ' . $mediatoken;

// Set up page
$page_params = [
    'token' => $mediatoken,
    'courseid' => $courseid,
    'width' => $width,
    'height' => $height
];

// Add embed parameters to page URL if provided (check !== '' because '0' is valid)
if ($showTitle !== '') {
    $page_params['showTitle'] = $showTitle;
}
if ($showRelated !== '') {
    $page_params['showRelated'] = $showRelated;
}
if ($showUserAvatar !== '') {
    $page_params['showUserAvatar'] = $showUserAvatar;
}
if ($linkTitle !== '') {
    $page_params['linkTitle'] = $linkTitle;
}
if ($startTime !== '') {
    $page_params['t'] = $startTime;
}

$PAGE->set_url(new moodle_url('/filter/mediacms/launch.php', $page_params));
$PAGE->set_context($context);
$PAGE->set_pagelayout('embedded');
$PAGE->set_title('MediaCMS');

// Get type config
$typeconfig = lti_get_type_type_config($type->id);

// Initiate LTI Login with proper cmid (for permissions) and custom token
$content = lti_initiate_login($course->id, $dummy_cmid, $instance, $typeconfig, null, $instance->name);

// CRITICAL: Inject media_token and embed parameters as hidden fields in OIDC form
// MediaCMS will encode them in state and inject into custom claims (fallback mechanism)
$hidden_fields = '<input type="hidden" name="media_token" value="' . htmlspecialchars($mediatoken, ENT_QUOTES) . '" />';

// Add embed parameters as hidden fields
if ($showTitle !== '') {
    $hidden_fields .= '<input type="hidden" name="embed_show_title" value="' . htmlspecialchars($showTitle, ENT_QUOTES) . '" />';
}
if ($showRelated !== '') {
    $hidden_fields .= '<input type="hidden" name="embed_show_related" value="' . htmlspecialchars($showRelated, ENT_QUOTES) . '" />';
}
if ($showUserAvatar !== '') {
    $hidden_fields .= '<input type="hidden" name="embed_show_user_avatar" value="' . htmlspecialchars($showUserAvatar, ENT_QUOTES) . '" />';
}
if ($linkTitle !== '') {
    $hidden_fields .= '<input type="hidden" name="embed_link_title" value="' . htmlspecialchars($linkTitle, ENT_QUOTES) . '" />';
}
if ($startTime !== '') {
    $hidden_fields .= '<input type="hidden" name="embed_start_time" value="' . htmlspecialchars($startTime, ENT_QUOTES) . '" />';
}
if ($width) {
    $hidden_fields .= '<input type="hidden" name="embed_width" value="' . htmlspecialchars($width, ENT_QUOTES) . '" />';
}
if ($height) {
    $hidden_fields .= '<input type="hidden" name="embed_height" value="' . htmlspecialchars($height, ENT_QUOTES) . '" />';
}

$content = str_replace('</form>', $hidden_fields . '</form>', $content);

echo $OUTPUT->header();
echo $content;
echo $OUTPUT->footer();
