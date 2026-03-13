<?php
/**
 * My Media page — renders the Moodle shell with an LTI iframe.
 *
 * @package    filter_mediacms
 * @copyright  2026 MediaCMS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../config.php');

global $SITE, $PAGE, $OUTPUT, $USER, $COURSE;

require_login();

$token    = optional_param('token', '', PARAM_ALPHANUMEXT);
$courseid = optional_param('courseid', 0, PARAM_INT);

$context = context_system::instance();
$PAGE->set_context($context);
$PAGE->set_course($SITE);
$PAGE->set_pagelayout('mydashboard');

if ($token) {
    $PAGE->set_url(new moodle_url('/filter/mediacms/my_media.php', ['token' => $token]));
    $PAGE->set_title('MediaCMS');
    $PAGE->set_heading('MediaCMS');

    $launch_params = [
        'token'           => $token,
        'courseid'        => $courseid ?: ($COURSE->id ?? 0),
        'show_media_page' => 'true',
    ];
    $src = (new moodle_url('/filter/mediacms/launch.php', $launch_params))->out(false);
} else {
    $PAGE->set_url(new moodle_url('/filter/mediacms/my_media.php'));
    $PAGE->set_title(get_string('mymedia', 'filter_mediacms'));
    $PAGE->set_heading(get_string('mymedia', 'filter_mediacms'));

    $src = (new moodle_url('/filter/mediacms/lti_launch.php'))->out(false);
}

echo $OUTPUT->header();

echo html_writer::tag('iframe', '', [
    'id'              => 'contentframe',
    'src'             => $src,
    'allowfullscreen' => 'true',
    'allow'           => 'autoplay *; fullscreen *; encrypted-media *; camera *; microphone *; display-capture *;',
    'style'           => 'border:none;display:block;width:100%;height:calc(100vh - 120px);',
]);

echo $OUTPUT->footer();
