<?php
// This file is part of Moodle - http://moodle.org/

/**
 * LTI Auth Callback for Filter Launches
 *
 * This handles the OIDC redirect from MediaCMS for filter-initiated launches
 *
 * @package    filter_mediacmslti
 * @copyright  2026 MediaCMS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../config.php');
require_once($CFG->dirroot . '/mod/lti/locallib.php');

// This endpoint receives the response from Moodle's /mod/lti/auth.php
// after it completes the OIDC flow

// Get launch parameters from query string
$state = optional_param('state', '', PARAM_RAW);
$id_token = optional_param('id_token', '', PARAM_RAW);

if (empty($id_token)) {
    die('Missing id_token');
}

// Verify and decode the id_token
// Then redirect to the MediaCMS embed

$PAGE->set_context(context_system::instance());
$PAGE->set_pagelayout('embedded');

echo $OUTPUT->header();
echo '<div style="padding: 20px;">';
echo '<p>Processing authentication...</p>';
echo '<p>ID Token received, redirecting to content...</p>';
echo '</div>';
echo $OUTPUT->footer();
