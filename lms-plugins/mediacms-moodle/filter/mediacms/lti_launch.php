<?php
/**
 * My Media LTI launch page — runs inside the iframe from my_media.php.
 *
 * Builds custom_publishdata (enrolled courses + roles) and initiates
 * the LTI 1.3 OIDC login flow, outputting the auto-submit form directly.
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

global $SITE, $DB, $CFG, $USER;

require_login();

$mediacmsurl = get_config('filter_mediacms', 'mediacmsurl');
$ltitoolid   = get_config('filter_mediacms', 'ltitoolid');

if (empty($mediacmsurl) || empty($ltitoolid)) {
    throw new moodle_exception('notconfigured', 'filter_mediacms');
}

$type = $DB->get_record('lti_types', ['id' => $ltitoolid]);
if (!$type) {
    throw new moodle_exception('ltitoolnotfound', 'filter_mediacms');
}

// Build custom_publishdata: all courses the user is enrolled in + role.
$enrolled_courses = enrol_get_users_courses($USER->id, true, ['id', 'shortname', 'fullname']);

$publish_data = [];
foreach ($enrolled_courses as $enrolled_course) {
    if ((int)$enrolled_course->id === SITEID) {
        continue;
    }

    $course_context = context_course::instance($enrolled_course->id);
    $roles          = get_user_roles($course_context, $USER->id, false);

    $role_shortname = 'student';
    if (!empty($roles)) {
        $role           = reset($roles);
        $role_shortname = $role->shortname;
    }

    $publish_data[] = [
        'id'        => (int)$enrolled_course->id,
        'shortname' => $enrolled_course->shortname,
        'fullname'  => $enrolled_course->fullname,
        'role'      => $role_shortname,
    ];
}

$publishdata_b64 = base64_encode(json_encode($publish_data));

// Use a course the user is actually enrolled in so they have mod/lti:view during
// the OIDC flow. Fall back to SITEID only for admins with no course enrolments.
$launch_courseid = SITEID;
$launch_course   = $SITE;
foreach ($enrolled_courses as $ec) {
    if ((int)$ec->id !== SITEID) {
        $launch_courseid = (int)$ec->id;
        $launch_course   = get_course($launch_courseid);
        break;
    }
}

// Get or create the dummy activity (visible, non-stealth).
try {
    $dummy_cmid = filter_mediacms_get_dummy_activity($launch_courseid, $type->id);
} catch (Exception $e) {
    throw new moodle_exception('cannotcreatedummyactivity', 'filter_mediacms');
}

$cm       = get_coursemodule_from_id('lti', $dummy_cmid, 0, false, MUST_EXIST);
$instance = $DB->get_record('lti', ['id' => $cm->instance], '*', MUST_EXIST);

// DEBUG: log enrolled courses retrieved.
error_log('MediaCMS My Media publishdata courses (' . count($publish_data) . '): ' . json_encode($publish_data));

// Write publishdata to DB — Moodle's auth.php re-reads the instance from DB
// when building the LTI launch JWT, so in-memory changes are ignored.
$DB->set_field('lti', 'instructorcustomparameters', 'publishdata=' . $publishdata_b64, ['id' => $cm->instance]);
$instance->instructorcustomparameters = 'publishdata=' . $publishdata_b64;
$instance->name = 'MediaCMS My Media';

$typeconfig = lti_get_type_type_config($type->id);
$content    = lti_initiate_login($launch_course->id, $dummy_cmid, $instance, $typeconfig, null, $instance->name);

echo $content;
