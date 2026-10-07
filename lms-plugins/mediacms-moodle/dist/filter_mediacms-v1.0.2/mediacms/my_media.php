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

$token      = optional_param('token', '', PARAM_ALPHANUMEXT);
$courseid   = optional_param('courseid', 0, PARAM_INT);
$start_time = optional_param('t', 0, PARAM_INT);

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
    if ($start_time > 0) {
        $launch_params['t'] = $start_time;
    }
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
    'style'           => 'border:none;display:block;width:100%;',
]);

// Fill the iframe to the remaining viewport height and suppress the outer
// page scrollbar. Uses requestAnimationFrame so it runs after Moodle theme
// JS has finished shifting the layout, and re-fires on window load + resize.
echo html_writer::script("
(function () {
  var iframe = document.getElementById('contentframe');

  function resizeIframe() {
    var top = iframe.getBoundingClientRect().top + window.scrollY;
    var h = window.innerHeight - iframe.getBoundingClientRect().top;
    iframe.style.height = Math.max(h, 100) + 'px';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }

  function schedule() { requestAnimationFrame(resizeIframe); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule);
  } else {
    schedule();
  }
  window.addEventListener('load', schedule);
  window.addEventListener('resize', schedule);
})();
");

echo $OUTPUT->footer();
