<?php
/**
 * Student-accessible MediaCMS media picker launcher.
 *
 * Initiates a no-activity LTI 1.3 OIDC login that routes to MediaCMS's
 * /lti/select-media/ UI. No LTI activity is created in the course.
 *
 * The redirect_path custom param is stored in the PHP session and injected
 * by lti_auth.php during the OIDC callback, so MediaCMS routes to the
 * media-picker rather than the default My Media page.
 *
 * Flow:
 *   1. TinyMCE plugin opens this URL in an iframe (contentItemUrl).
 *   2. We store redirect_path in session and start the OIDC flow.
 *   3. lti_auth.php processes the OIDC callback (no manageactivities check).
 *   4. MediaCMS receives redirect_path=/lti/select-media/?mode=lms_embed_mode.
 *   5. User picks a video; MediaCMS sends postMessage({type:'videoSelected',...})
 *      which iframeembed.js already handles.
 *
 * @package    filter_mediacms
 * @copyright  2026 MediaCMS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../config.php');
require_once($CFG->dirroot . '/mod/lti/lib.php');
require_once($CFG->dirroot . '/mod/lti/locallib.php');

global $DB, $PAGE, $OUTPUT, $SITE, $USER, $SESSION;

require_login();

$courseid  = required_param('courseid', PARAM_INT);
$action    = optional_param('action', '', PARAM_TEXT);
$ltitoolid = get_config('filter_mediacms', 'ltitoolid');

if (empty($ltitoolid)) {
    die('MediaCMS LTI tool not configured.');
}

$type = $DB->get_record('lti_types', ['id' => $ltitoolid]);
if (!$type) {
    die('LTI tool not found.');
}

// Resolve course — fall back to the user's first enrolled course if needed.
if ($courseid && $courseid != SITEID) {
    $course  = get_course($courseid);
    $context = context_course::instance($courseid);
} else {
    $course  = $SITE;
    $context = context_system::instance();
    foreach (enrol_get_users_courses($USER->id, true, ['id']) as $ec) {
        if ((int)$ec->id !== SITEID) {
            $course  = get_course($ec->id);
            $context = context_course::instance($ec->id);
            break;
        }
    }
}

require_login($course);

$PAGE->set_url(new moodle_url('/filter/mediacms/select_media_picker.php', ['courseid' => $course->id]));
$PAGE->set_context($context);
$PAGE->set_pagelayout('embedded');
$PAGE->set_title('MediaCMS Select Media');

$typeconfig = lti_get_type_type_config($type->id);

// Store redirect_path in session — lti_auth.php picks it up after the OIDC roundtrip.
if ($action === 'upload') {
    $SESSION->mediacms_launch_customparams = 'redirect_path=/upload?action=select_media';
} else {
    $SESSION->mediacms_launch_customparams = 'redirect_path=/lti/select-media/?mode=lms_embed_mode';
}

$content = lti_initiate_login($course->id, 0, null, $typeconfig, null, 'MediaCMS Select Media');

echo $OUTPUT->header();
echo $content;
echo $OUTPUT->footer();
