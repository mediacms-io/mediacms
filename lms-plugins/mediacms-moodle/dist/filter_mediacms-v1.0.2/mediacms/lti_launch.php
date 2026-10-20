<?php
/**
 * My Media LTI launch page — runs inside the iframe from my_media.php.
 *
 * Builds custom_publishdata (enrolled courses + roles) and initiates
 * the LTI 1.3 OIDC login flow, outputting the auto-submit form directly.
 *
 * No dummy LTI activity is created. The publishdata is stored in the PHP
 * session and picked up by lti_auth.php during the OIDC callback.
 *
 * Edge case: if the user is not enrolled in any course the launch still
 * proceeds using the site course (SITEID). MediaCMS will receive an empty
 * publishdata array and can decide how to handle it (e.g. show a message).
 *
 * @package    filter_mediacms
 * @copyright  2026 MediaCMS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../config.php');
require_once($CFG->dirroot . '/mod/lti/lib.php');
require_once($CFG->dirroot . '/mod/lti/locallib.php');

global $SITE, $DB, $CFG, $USER, $SESSION;

require_login();

$mediacmsurl           = get_config('filter_mediacms', 'mediacmsurl');
$ltitoolid             = get_config('filter_mediacms', 'ltitoolid');
$share_raw             = get_config('filter_mediacms', 'share_embedded_media');
$share_embedded_media  = ($share_raw === false) ? 1 : (int)(bool)$share_raw;

if (empty($mediacmsurl) || empty($ltitoolid)) {
    throw new moodle_exception('notconfigured', 'filter_mediacms');
}

$type = $DB->get_record('lti_types', ['id' => $ltitoolid]);
if (!$type) {
    throw new moodle_exception('ltitoolnotfound', 'filter_mediacms');
}

// Build publishdata: all courses the user is enrolled in + role.
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

// Use a course the user is actually enrolled in so they pass require_login
// in lti_auth.php. Fall back to SITEID for admins with no course enrolments.
$launch_courseid = SITEID;
$launch_course   = $SITE;
foreach ($enrolled_courses as $ec) {
    if ((int)$ec->id !== SITEID) {
        $launch_courseid = (int)$ec->id;
        $launch_course   = get_course($launch_courseid);
        break;
    }
}

// Store publishdata in session — lti_auth.php picks it up after the OIDC roundtrip.
$SESSION->mediacms_launch_customparams = 'publishdata=' . $publishdata_b64 . "\nembed_share_media=" . $share_embedded_media;

$typeconfig = lti_get_type_type_config($type->id);
$content    = lti_initiate_login($launch_courseid, 0, null, $typeconfig, null, 'MediaCMS My Media');

echo $content;
