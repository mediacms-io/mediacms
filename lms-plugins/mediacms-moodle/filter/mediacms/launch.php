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

global $SITE, $DB, $PAGE, $OUTPUT, $CFG, $SESSION;

require_login();

$mediatoken = required_param('token', PARAM_ALPHANUMEXT);
$courseid = optional_param('courseid', 0, PARAM_INT);
$height = optional_param('height', 0, PARAM_INT);
$width = optional_param('width', 0, PARAM_INT);

// Extract embed parameters
$showTitle = optional_param('showTitle', '', PARAM_TEXT);
$showUserAvatar = optional_param('showUserAvatar', '', PARAM_TEXT);
$linkTitle = optional_param('linkTitle', '', PARAM_TEXT);
$startTime = optional_param('t', '', PARAM_TEXT);
$show_media_page = optional_param('show_media_page', '', PARAM_TEXT);

// Get configuration
$mediacmsurl = get_config('filter_mediacms', 'mediacmsurl');
$ltitoolid = get_config('filter_mediacms', 'ltitoolid');
$share_raw = get_config('filter_mediacms', 'share_embedded_media');
$share_embedded_media = ($share_raw === false) ? 1 : (int)(bool)$share_raw;

if (empty($mediacmsurl)) {
    die('MediaCMS URL not configured');
}

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

// Build custom params for this video embed.
$custom_params = ["media_friendly_token=" . $mediatoken];

if ($showTitle !== '') {
    $custom_params[] = "embed_show_title=" . $showTitle;
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
if ($show_media_page === 'true') {
    $custom_params[] = "show_media_page=true";
}
$custom_params[] = "embed_share_media=" . $share_embedded_media;

// Pass the My Media base URL so MediaCMS can navigate the parent frame back into Moodle
// when the user clicks a media title inside the embed player (see parent_media_base in embeddedApp.ts).
$my_media_base = (new moodle_url('/filter/mediacms/my_media.php'))->out(false);
if ($courseid) {
    $my_media_base .= '?courseid=' . intval($courseid);
}
$custom_params[] = "parent_media_base=" . $my_media_base;

// Set up page
$page_params = [
    'token' => $mediatoken,
    'courseid' => $courseid,
    'width' => $width,
    'height' => $height
];

if ($showTitle !== '') {
    $page_params['showTitle'] = $showTitle;
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
if ($show_media_page === 'true') {
    $page_params['show_media_page'] = 'true';
}

$PAGE->set_url(new moodle_url('/filter/mediacms/launch.php', $page_params));
$PAGE->set_context($context);
$PAGE->set_pagelayout('embedded');
$PAGE->set_title('MediaCMS');

$typeconfig = lti_get_type_type_config($type->id);

// Build the OIDC login request params directly so we can capture the launchid.
// This avoids a shared SESSION key, which would cause a race condition when
// multiple videos are embedded on the same page and load simultaneously.
$oidc_params = lti_build_login_request($course->id, 0, null, $typeconfig, null, 0, 'MediaCMS Video');

// Key the custom params by launchid — lti_auth.php retrieves them the same way.
$hint = json_decode($oidc_params['lti_message_hint']);
$SESSION->{'mediacms_cp_' . $hint->launchid} = implode("\n", $custom_params);

// Build the fallback hidden fields (MediaCMS encodes them in state as a secondary mechanism).
$hidden_fields = '<input type="hidden" name="media_token" value="' . htmlspecialchars($mediatoken, ENT_QUOTES) . '" />';

if ($showTitle !== '') {
    $hidden_fields .= '<input type="hidden" name="embed_show_title" value="' . htmlspecialchars($showTitle, ENT_QUOTES) . '" />';
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
if ($show_media_page === 'true') {
    $hidden_fields .= '<input type="hidden" name="show_media_page" value="true" />';
}
if ($width) {
    $hidden_fields .= '<input type="hidden" name="embed_width" value="' . htmlspecialchars($width, ENT_QUOTES) . '" />';
}
if ($height) {
    $hidden_fields .= '<input type="hidden" name="embed_height" value="' . htmlspecialchars($height, ENT_QUOTES) . '" />';
}

// Produce the OIDC login form (mirrors lti_initiate_login output).
$content  = '<form action="' . htmlspecialchars($typeconfig->lti_initiatelogin, ENT_COMPAT)
          . '" name="ltiInitiateLoginForm" id="ltiInitiateLoginForm"'
          . ' method="post" encType="application/x-www-form-urlencoded">' . "\n";
foreach ($oidc_params as $key => $value) {
    $key   = htmlspecialchars($key, ENT_COMPAT);
    $value = htmlspecialchars($value, ENT_COMPAT);
    $content .= "  <input type=\"hidden\" name=\"{$key}\" value=\"{$value}\"/>\n";
}
$content .= $hidden_fields . "\n";
$content .= "</form>\n";
$content .= "<script type=\"text/javascript\">\n"
          . "//<![CDATA[\n"
          . "document.ltiInitiateLoginForm.submit();\n"
          . "//]]>\n"
          . "</script>\n";

echo $OUTPUT->header();
echo $content;
echo $OUTPUT->footer();
