<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Language strings for MediaCMS LTI Filter plugin.
 *
 * @package    filter_mediacmslti
 * @copyright  2026 MediaCMS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

$string['pluginname'] = 'MediaCMS LTI Filter';
$string['filtername'] = 'MediaCMS LTI Embed';

// Settings.
$string['mediacmsurl'] = 'MediaCMS URL';
$string['mediacmsurl_desc'] = 'The base URL of your MediaCMS instance (e.g., https://deic.mediacms.io). URLs from this domain will be converted to LTI-authenticated iframes.';

$string['ltitoolid'] = 'LTI External Tool';
$string['ltitoolid_desc'] = 'Select the LTI External Tool that is configured for MediaCMS integration. This tool must be pre-configured with the correct LTI settings.';

$string['noltitoolsfound'] = 'No LTI tools configured';

$string['iframewidth'] = 'Iframe Width';
$string['iframewidth_desc'] = 'Default width for embedded video iframes in pixels (default: 960).';

$string['iframeheight'] = 'Iframe Height';
$string['iframeheight_desc'] = 'Default height for embedded video iframes in pixels (default: 540).';

$string['enablefilterheading'] = 'Enable the Filter';
$string['enablefilterheading_desc'] = 'After configuring the settings above, you must enable this filter:<br><br>
<ol>
<li>Go to <strong>Site administration → Plugins → Filters → Manage filters</strong></li>
<li>Find "MediaCMS LTI Embed" in the list</li>
<li>Change the setting from "Disabled" to "On" or "Off, but available"</li>
<li>Click "Save changes"</li>
</ol>
<br>
Once enabled, any MediaCMS video URL pasted into course descriptions, page content, or other text areas will automatically be converted to an embedded video player with LTI authentication.';

// Privacy.
$string['privacy:metadata'] = 'The MediaCMS LTI Filter plugin does not store any personal data. It processes URLs in content and initiates LTI authentication using the user\'s Moodle ID as the login hint.';
