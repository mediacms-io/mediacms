<?php
/**
 * MediaCMS custom LTI 1.3 auth endpoint.
 *
 * Functionally identical to /mod/lti/auth.php except the no-activity (id=0)
 * branch only requires the user to be logged in — not moodle/course:manageactivities.
 *
 * Custom params (publishdata, redirect_path) are read from the PHP session
 * where lti_launch.php / select_media_picker.php store them before starting
 * the OIDC flow.
 *
 * Setup required:
 *   1. MediaCMS admin → LTI Platforms → edit Moodle record:
 *      set "Auth login url" to https://YOUR_MOODLE/filter/mediacms/lti_auth.php
 *   2. Moodle admin → Site admin → Plugins → Activity modules → External tool
 *      → Manage tools → MediaCMS tool → edit → add to "Redirection URIs":
 *      https://YOUR_MOODLE/filter/mediacms/lti_auth.php
 *
 * @package    filter_mediacms
 * @copyright  2026 MediaCMS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require_once(__DIR__ . '/../../config.php');
require_once($CFG->dirroot . '/mod/lti/locallib.php');
global $_POST, $_SERVER, $SESSION;

if (!isloggedin() && empty($_POST['repost'])) {
    header_remove("Set-Cookie");
    $PAGE->set_pagelayout('popup');
    $PAGE->set_context(context_system::instance());
    $output = $PAGE->get_renderer('mod_lti');
    $page = new \mod_lti\output\repost_crosssite_page($_SERVER['REQUEST_URI'], $_POST);
    echo $output->header();
    echo $output->render($page);
    echo $output->footer();
    return;
}

$scope          = optional_param('scope', '', PARAM_TEXT);
$responsetype   = optional_param('response_type', '', PARAM_TEXT);
$clientid       = optional_param('client_id', '', PARAM_TEXT);
$redirecturi    = optional_param('redirect_uri', '', PARAM_URL);
$loginhint      = optional_param('login_hint', '', PARAM_TEXT);
$ltimessagehintenc = optional_param('lti_message_hint', '', PARAM_TEXT);
$state          = optional_param('state', '', PARAM_TEXT);
$responsemode   = optional_param('response_mode', '', PARAM_TEXT);
$nonce          = optional_param('nonce', '', PARAM_TEXT);
$prompt         = optional_param('prompt', '', PARAM_TEXT);

$ok = !empty($scope) && !empty($responsetype) && !empty($clientid) &&
      !empty($redirecturi) && !empty($loginhint) && !empty($nonce);

if (!$ok) {
    $error = 'invalid_request';
}
$ltimessagehint = json_decode($ltimessagehintenc);
$ok = $ok && isset($ltimessagehint->launchid);
if (!$ok) {
    $error = 'invalid_request';
    $desc  = 'No launch id in LTI hint';
}
if ($ok && ($scope !== 'openid')) {
    $ok    = false;
    $error = 'invalid_scope';
}
if ($ok && ($responsetype !== 'id_token')) {
    $ok    = false;
    $error = 'unsupported_response_type';
}
if ($ok) {
    $launchid = $ltimessagehint->launchid;
    list($courseid, $typeid, $id, $messagetype, $foruserid, $titleb64, $textb64) =
        explode(',', $SESSION->$launchid, 7);
    unset($SESSION->$launchid);
    $config = lti_get_type_type_config($typeid);
    $ok = ($clientid === $config->lti_clientid);
    if (!$ok) {
        $error = 'unauthorized_client';
    }
}
if ($ok && ($loginhint !== $USER->id)) {
    $ok    = false;
    $error = 'access_denied';
}

if (empty($config)) {
    throw new moodle_exception('invalidrequest', 'error');
} else {
    $uris = array_map('trim', explode("\n", $config->lti_redirectionuris));
    if (!in_array($redirecturi, $uris)) {
        throw new moodle_exception('invalidrequest', 'error');
    }
}
if ($ok) {
    if (isset($responsemode)) {
        $ok = ($responsemode === 'form_post');
        if (!$ok) {
            $error = 'invalid_request';
            $desc  = 'Invalid response_mode';
        }
    } else {
        $ok    = false;
        $error = 'invalid_request';
        $desc  = 'Missing response_mode';
    }
}
if ($ok && !empty($prompt) && ($prompt !== 'none')) {
    $ok    = false;
    $error = 'invalid_request';
    $desc  = 'Invalid prompt';
}

if ($ok) {
    $course = $DB->get_record('course', ['id' => $courseid], '*', MUST_EXIST);

    if ($id) {
        // Activity-based launch — identical to auth.php's if ($id) branch.
        $cm      = get_coursemodule_from_id('lti', $id, 0, false, MUST_EXIST);
        $context = context_module::instance($cm->id);
        require_login($course, true, $cm);
        require_capability('mod/lti:view', $context);
        $lti       = $DB->get_record('lti', ['id' => $cm->instance], '*', MUST_EXIST);
        $lti->cmid = $cm->id;
        list($endpoint, $params) = lti_get_launch_data($lti, $nonce, $messagetype, $foruserid);
    } else {
        // No-activity launch — student-accessible.
        // Custom params (publishdata / redirect_path) were stored in the session
        // by lti_launch.php or select_media_picker.php before initiating the OIDC flow.
        require_login($course);

        // launch.php keys params by launchid (safe for concurrent embeds on one page).
        // lti_launch.php and select_media_picker.php use the fixed key (single-use pages).
        $customparams = '';
        $cpkey = 'mediacms_cp_' . $launchid;
        if (!empty($SESSION->$cpkey)) {
            $customparams = $SESSION->$cpkey;
            unset($SESSION->$cpkey);
        } elseif (!empty($SESSION->mediacms_launch_customparams)) {
            $customparams = $SESSION->mediacms_launch_customparams;
            unset($SESSION->mediacms_launch_customparams);
        }

        // Minimal LTI instance object — enough for lti_get_launch_data to sign the JWT.
        $lti                                    = new stdClass();
        $lti->id                                = 0;
        $lti->typeid                            = (int) $typeid;
        $lti->course                            = (int) $courseid;
        $lti->cmid                              = 0;
        $lti->name                              = 'MediaCMS';
        $lti->toolurl                           = '';
        $lti->securetoolurl                     = '';
        $lti->instructorcustomparameters        = $customparams;
        $lti->instructorchoicesendname          = LTI_SETTING_ALWAYS;
        $lti->instructorchoicesendemailaddr     = LTI_SETTING_ALWAYS;
        $lti->instructorchoiceacceptgrades      = LTI_SETTING_NEVER;
        $lti->instructorchoiceallowroster       = null;
        $lti->launchcontainer                   = LTI_LAUNCH_CONTAINER_EMBED_NO_BLOCKS;
        $lti->resourcekey                       = '';
        $lti->password                          = '';
        $lti->servicesalt                       = '';
        $lti->resource_link_id                  = 'mediacms_' . $typeid;

        list($endpoint, $params) = lti_get_launch_data(
            $lti,
            $nonce,
            $messagetype ?: 'basic-lti-launch-request',
            $foruserid
        );
    }
} else {
    $params['error'] = $error;
    if (!empty($desc)) {
        $params['error_description'] = $desc;
    }
}

if (isset($state)) {
    $params['state'] = $state;
}
unset($SESSION->lti_message_hint);

$r  = '<form action="' . $redirecturi . "\" name=\"ltiAuthForm\" id=\"ltiAuthForm\" " .
      "method=\"post\" enctype=\"application/x-www-form-urlencoded\">\n";
foreach ($params as $key => $value) {
    $key   = htmlspecialchars($key, ENT_COMPAT);
    $value = htmlspecialchars($value, ENT_COMPAT);
    $r    .= "  <input type=\"hidden\" name=\"{$key}\" value=\"{$value}\"/>\n";
}
$r .= "</form>\n";
$r .= "<script type=\"text/javascript\">\n" .
      "//<![CDATA[\n" .
      "document.ltiAuthForm.submit();\n" .
      "//]]>\n" .
      "</script>\n";
echo $r;
