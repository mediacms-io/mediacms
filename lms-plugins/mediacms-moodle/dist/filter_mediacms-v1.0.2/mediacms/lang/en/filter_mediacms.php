<?php
defined('MOODLE_INTERNAL') || die();

$string['filtername'] = 'MediaCMS';
$string['pluginname'] = 'MediaCMS';
$string['coresettings'] = 'Core MediaCMS Settings';
$string['coresettings_desc'] = 'These settings are shared with the TinyMCE MediaCMS editor plugin.';
$string['mediacmsurl'] = 'MediaCMS URL';
$string['mediacmsurl_desc'] = 'The base URL of your MediaCMS instance (e.g., https://lti.mediacms.io). This setting is used by both the filter and the TinyMCE editor plugin.';
$string['ltitoolid'] = 'LTI Tool';
$string['ltitoolid_desc'] = 'Select the External Tool configuration for MediaCMS. This enables the video library in the TinyMCE editor and LTI authentication. To set up an LTI tool, go to Site Administration > Plugins > Activity modules > External tool > Manage tools.';
$string['noltitoolsfound'] = 'No LTI tools found';
$string['iframewidth'] = 'Default Width';
$string['iframewidth_desc'] = 'Default width for embedded videos (pixels).';
$string['iframeheight'] = 'Default Height';
$string['iframeheight_desc'] = 'Default height for embedded videos (pixels).';
$string['enableautoconvert'] = 'Auto-convert URLs';
$string['enableautoconvert_desc'] = 'Automatically convert MediaCMS URLs (e.g., /view?m=xyz) in text to embedded players.';
$string['privacy:metadata'] = 'The MediaCMS filter does not store any personal data.';

$string['mymedia'] = 'My Media';
$string['notconfigured'] = 'MediaCMS is not fully configured. Please set the MediaCMS URL and LTI Tool in Site Administration → Plugins → Filters → MediaCMS.';
$string['ltitoolnotfound'] = 'The configured LTI tool could not be found. Please check the MediaCMS filter settings.';
$string['cannotcreatedummyactivity'] = 'Could not create the MediaCMS launcher activity. Please check course permissions.';

$string['mymediaposition'] = 'My Media Link Position';
$string['mymediaposition_desc'] = 'Select where the "My Media" link should appear in the Moodle interface.';
$string['pos_topbar'] = 'Top Navigation Bar';
$string['pos_userdrop'] = 'User Profile Dropdown';
$string['pos_none'] = 'None (Do not display)';

$string['shareembeddedmedia'] = 'Share Embedded Media';
$string['shareembeddedmedia_desc'] = 'When enabled, a student viewing embedded media is automatically granted viewer permission on that media (it appears under "Shared with me"). Disable this to allow viewing without creating a sharing record.';
