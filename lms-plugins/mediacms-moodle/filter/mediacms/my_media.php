<?php
/**
 * My Media page — renders the Moodle shell with an LTI iframe.
 *
 * @package    filter_mediacms
 * @copyright  2026 MediaCMS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../config.php');

global $SITE, $PAGE, $OUTPUT, $USER;

require_login();

$context = context_system::instance();

$PAGE->set_context($context);
$PAGE->set_url(new moodle_url('/filter/mediacms/my_media.php'));
$PAGE->set_course($SITE);
$PAGE->set_pagelayout('mydashboard');
$PAGE->set_title(get_string('mymedia', 'filter_mediacms'));
$PAGE->set_heading(get_string('mymedia', 'filter_mediacms'));

echo $OUTPUT->header();

$attr = [
    'id'              => 'contentframe',
    'src'             => (new moodle_url('/filter/mediacms/lti_launch.php'))->out(false),
    'width'           => '100%',
    'height'          => '600px',
    'allowfullscreen' => 'true',
    'allow'           => 'autoplay *; fullscreen *; encrypted-media *; camera *; microphone *;',
    'style'           => 'border:none;display:block;',
];
echo html_writer::tag('iframe', '', $attr);

echo $OUTPUT->footer();
