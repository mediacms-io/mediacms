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
 * MediaCMS LTI Filter - Converts MediaCMS URLs to LTI-authenticated iframes.
 *
 * @package    filter_mediacmslti
 * @copyright  2026 MediaCMS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace filter_mediacmslti;

defined('MOODLE_INTERNAL') || die();

/**
 * Filter class for converting MediaCMS URLs to LTI iframes.
 */
class text_filter extends \core_filters\text_filter {

    /**
     * Apply the filter to the given text.
     *
     * @param string $text The text to filter
     * @param array $options Filter options
     * @return string The filtered text
     */
    public function filter($text, array $options = array()) {
        global $USER, $CFG, $PAGE;

        // Don't process if user is not logged in.
        if (!isloggedin() || isguestuser()) {
            return $text;
        }

        // Get plugin configuration.
        $mediacmsurl = get_config('filter_mediacmslti', 'mediacmsurl');
        $ltitoolid = get_config('filter_mediacmslti', 'ltitoolid');
        $iframewidth = get_config('filter_mediacmslti', 'iframewidth') ?: 960;
        $iframeheight = get_config('filter_mediacmslti', 'iframeheight') ?: 540;

        if (empty($mediacmsurl) || empty($ltitoolid)) {
            return $text;
        }

        // Parse the MediaCMS URL to get the base domain.
        $parsedurl = parse_url($mediacmsurl);
        if (!isset($parsedurl['host'])) {
            return $text;
        }
        $domain = $parsedurl['host'];

        // Escape special regex characters in domain.
        $escapeddomain = preg_quote($domain, '/');

        // Pattern to match MediaCMS video URLs:
        // - https://lti.mediacms.io/view?m=TOKEN
        // - https://lti.mediacms.io/embed?m=TOKEN
        // - http versions
        // Improved regex to handle parameters in any order
        $pattern = '/https?:\/\/' . $escapeddomain . '\/(view|embed)\?(?:[^"\s]*&)?m=([a-zA-Z0-9_-]+)(?:&[^"\s]*)?/i';

        // Find all matches.
        if (!preg_match_all($pattern, $text, $matches, PREG_SET_ORDER)) {
            return $text;
        }

        // Get course context
        $context = isset($options['context']) ? $options['context'] : $PAGE->context;
        $courseid = 0;

        // Try to determine course ID from context
        if ($context) {
            if ($context->contextlevel == CONTEXT_COURSE) {
                $courseid = $context->instanceid;
            } else if ($context->contextlevel == CONTEXT_MODULE) {
                $cm = get_coursemodule_from_id('', $context->instanceid);
                if ($cm) {
                    $courseid = $cm->course;
                }
            }
        }

        // Replace each match with an iframe pointing to launch.php
        foreach ($matches as $match) {
            $fullurl = $match[0];
            $mediatoken = $match[2];

            // Build launch URL with parameters (like Kaltura does)
            $launchurl = new \moodle_url('/filter/mediacmslti/launch.php', [
                'token' => $mediatoken,
                'courseid' => $courseid,
                'width' => $iframewidth,
                'height' => $iframeheight
            ]);

            // Calculate aspect ratio percentage for responsive container
            $ratio = ($iframeheight / $iframewidth) * 100;

            // Generate iframe (responsive)
            $iframe = \html_writer::tag('iframe', '', array(
                'width' => '100%',
                'height' => '100%',
                'class' => 'mediacms-player-iframe',
                'allowfullscreen' => 'true',
                'allow' => 'autoplay *; fullscreen *; encrypted-media *; camera *; microphone *; display-capture *;',
                'src' => $launchurl->out(false),
                'frameborder' => '0',
                'style' => 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;',
                'title' => 'MediaCMS Video'
            ));

            $iframeContainer = \html_writer::tag('div', $iframe, array(
                'class' => 'mediacms-player-container',
                'style' => 'position: relative; padding-bottom: ' . $ratio . '%; height: 0; overflow: hidden; max-width: 100%; background: #000; border-radius: 4px;'
            ));

            $text = str_replace($fullurl, $iframeContainer, $text);
        }

        return $text;
    }
}
