<?php

namespace filter_mediacms;

use moodle_url;
use html_writer;

defined('MOODLE_INTERNAL') || die();

/**
 * MediaCMS text filter.
 *
 * @package    filter_mediacms
 * @copyright  2026 MediaCMS
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class text_filter extends \core_filters\text_filter {

    /**
     * Filter method.
     *
     * @param string $text The text to filter.
     * @param array $options Filter options.
     * @return string The filtered text.
     */
    public function filter($text, array $options = array()) {
        if (!is_string($text) or empty($text)) {
            return $text;
        }

        $mediacmsurl = get_config('filter_mediacms', 'mediacmsurl');
        if (empty($mediacmsurl)) {
            return $text;
        }

        $newtext = $text;

        // 1. Handle [mediacms:TOKEN] tag
        $pattern_tag = '/\[mediacms:([a-zA-Z0-9]+)\]/';
        $newtext = preg_replace_callback($pattern_tag, [$this, 'callback_tag'], $newtext);

        // 2a. Convert MediaCMS URLs that are already inside <iframe src="..."> attributes
        // (saved by the TinyMCE plugin) to launch.php URLs, preserving all other iframe
        // attributes. This must run before 2b so the URL pattern below does not try to
        // replace just the URL string and produce broken HTML inside the src attribute.
        $iframe_src_pattern = '/(<iframe\b[^>]*?\s)src=(["\'])('
            . $scheme . ':\/\/' . $host . $path_prefix
            . '\/(view|embed)\?m=([a-zA-Z0-9]+)[^"\']*)\2/is';
        $newtext = preg_replace_callback($iframe_src_pattern, [$this, 'callback_iframe_src'], $newtext);

        // 2b. Auto-convert plain-text MediaCMS URLs to embedded players.
        // First, protect text-only links from being converted
        // by temporarily replacing them with placeholders.
        $textlink_placeholders = [];
        $textlink_pattern = '/<a\s+[^>]*data-mediacms-textlink=["\']true["\'][^>]*>.*?<\/a>/is';

        $newtext = preg_replace_callback($textlink_pattern, function($matches) use (&$textlink_placeholders) {
            $placeholder = '###MEDIACMS_TEXTLINK_' . count($textlink_placeholders) . '###';
            $textlink_placeholders[$placeholder] = $matches[0];
            return $placeholder;
        }, $newtext);

        // Regex for plain-text MediaCMS view/embed URLs (not inside iframe src="" — those
        // were already handled by 2a above).
        $parsed_url = parse_url($mediacmsurl);
        $host = preg_quote($parsed_url['host'] ?? '', '/');
        $scheme = preg_quote($parsed_url['scheme'] ?? 'https', '/');

        // Allow http or https, and optional path prefix
        $path_prefix = preg_quote(rtrim($parsed_url['path'] ?? '', '/'), '/');

        // Pattern: https://HOST/PREFIX/view?m=TOKEN
        // Also handle /embed?m=TOKEN
        $pattern_url = '/(' . $scheme . ':\/\/' . $host . $path_prefix . '\/(view|embed)\?m=([a-zA-Z0-9]+)(?:&[^\s<]*)?)/';

        $newtext = preg_replace_callback($pattern_url, [$this, 'callback_url'], $newtext);

        // Restore protected text-only links as modal launchers
        foreach ($textlink_placeholders as $placeholder => $original) {
            $newtext = str_replace($placeholder, $this->transform_textlink($original), $newtext);
        }

        return $newtext;
    }

    /**
     * Callback for MediaCMS URLs found inside existing <iframe src="..."> attributes.
     * Replaces only the src value with a launch.php URL so the rest of the iframe
     * attributes (width, height, style, etc.) are preserved unchanged.
     *
     * $matches[1] — everything in the opening tag before `src=`
     * $matches[2] — the quote character (" or ')
     * $matches[3] — the full MediaCMS URL
     * $matches[4] — "view" or "embed"
     * $matches[5] — the media friendly_token
     */
    public function callback_iframe_src($matches) {
        global $COURSE;

        $full_url     = $matches[3];
        $token        = $matches[5];
        $before_src   = $matches[1];  // e.g. '<iframe style="..." '
        $quote        = $matches[2];

        // Extract embed params from the original URL.
        $embed_params = [];
        $parsed_qs    = parse_url($full_url);
        if (isset($parsed_qs['query'])) {
            // The saved URL may have HTML-entity-encoded ampersands.
            $raw_query = html_entity_decode($parsed_qs['query'], ENT_QUOTES | ENT_HTML5);
            parse_str($raw_query, $query_params);
            foreach (['showTitle', 'showUserAvatar', 'linkTitle', 't', 'width', 'height'] as $p) {
                if (isset($query_params[$p])) {
                    $embed_params[$p] = $query_params[$p];
                }
            }
        }

        $launch_params = array_merge(
            ['token' => $token, 'courseid' => $COURSE->id ?? 0],
            $embed_params
        );

        $launch_url = (new moodle_url('/filter/mediacms/launch.php', $launch_params))->out(false);

        // Reconstruct the opening iframe tag with the new src, keeping all other attributes.
        return $before_src . 'src=' . $quote . $launch_url . $quote;
    }

    /**
     * Callback for [mediacms:TOKEN]
     */
    public function callback_tag($matches) {
        return $this->generate_iframe($matches[1], []);
    }

    /**
     * Callback for URLs
     */
    public function callback_url($matches) {
        // matches[0] is the full matched string
        // matches[1] is full URL, matches[3] is token

        // Check if this URL is inside a text-only link
        // by looking at the context around the match
        $fullmatch = $matches[0];

        // If this is already inside an <a> tag with data-mediacms-textlink="true",
        // return the original URL unchanged
        // We'll check this in the main filter method instead

        $token = $matches[3];

        // Extract additional embed parameters from the URL
        $embed_params = [];
        $full_url = $matches[1];

        // Decode HTML entities (&amp; -> &) before parsing
        $full_url = html_entity_decode($full_url, ENT_QUOTES | ENT_HTML5);

        $parsed_url = parse_url($full_url);

        if (isset($parsed_url['query'])) {
            parse_str($parsed_url['query'], $query_params);

            // Extract embed-related parameters
            $supported_params = ['showTitle', 'showUserAvatar', 'linkTitle', 't', 'width', 'height'];
            foreach ($supported_params as $param) {
                if (isset($query_params[$param])) {
                    $embed_params[$param] = $query_params[$param];
                }
            }
        }

        return $this->generate_iframe($token, $embed_params);
    }

    /**
     * Generate the Iframe pointing to launch.php
     */
    private function generate_iframe($token, $embed_params = []) {
        global $CFG, $COURSE;

        // Use width/height from embed params if provided, no defaults
        $width = isset($embed_params['width']) ? $embed_params['width'] : null;
        $height = isset($embed_params['height']) ? $embed_params['height'] : null;
        $courseid = $COURSE->id ?? 0;

        // Build launch URL parameters
        $launch_params = [
            'token' => $token,
            'courseid' => $courseid
        ];

        // Add width/height only if provided
        if ($width !== null) {
            $launch_params['width'] = $width;
        }
        if ($height !== null) {
            $launch_params['height'] = $height;
        }

        // Add other embed parameters if provided (excluding width/height as they're already handled)
        foreach ($embed_params as $key => $value) {
            if ($key !== 'width' && $key !== 'height') {
                $launch_params[$key] = $value;
            }
        }

        $launchurl = new moodle_url('/filter/mediacms/launch.php', $launch_params);

        // Build responsive CSS
        $max_width = ($width !== null) ? (int)$width : 640;
        if ($width !== null && $height !== null && (int)$height > 0) {
            $aspect_ratio_css = (int)$width . ' / ' . (int)$height;
        } else {
            $aspect_ratio_css = '16 / 9';
        }
        $style = 'width:100%;max-width:' . $max_width . 'px;aspect-ratio:' . $aspect_ratio_css
               . ';display:block;margin:0 auto;border:0;';

        $iframe_attrs = [
            'src'           => $launchurl->out(false),
            'style'         => $style,
            'frameborder'   => '0',
            'allowfullscreen' => 'allowfullscreen',
            'title'         => 'MediaCMS Video',
        ];

        $iframe = html_writer::tag('iframe', '', $iframe_attrs);

        return $iframe;
    }

    /**
     * Transform a text-only link into a link that replaces itself with an inline iframe on click.
     *
     * @param string $anchor_html  Original <a ...>...</a> HTML
     * @return string  Transformed HTML (or original if token cannot be extracted)
     */
    private function transform_textlink($anchor_html) {
        global $COURSE;

        // Extract href.
        if (!preg_match('/href=["\']([^"\']+)["\']/', $anchor_html, $href_matches)) {
            return $anchor_html;
        }
        $href = html_entity_decode($href_matches[1], ENT_QUOTES | ENT_HTML5);

        // Extract ?m=TOKEN and optional ?t=seconds.
        parse_str(parse_url($href, PHP_URL_QUERY) ?? '', $query_params);
        $token = $query_params['m'] ?? null;
        if (!$token || !preg_match('/^[a-zA-Z0-9]+$/', $token)) {
            return $anchor_html;
        }
        $start_time = isset($query_params['t']) ? (int)$query_params['t'] : null;

        // Extract inner link text.
        if (!preg_match('/<a[^>]*>(.*?)<\/a>/is', $anchor_html, $text_matches)) {
            return $anchor_html;
        }

        $courseid = isset($COURSE->id) ? (int)$COURSE->id : 0;

        $view_params = ['token' => $token, 'courseid' => $courseid];
        if ($start_time !== null && $start_time > 0) {
            $view_params['t'] = $start_time;
        }

        $view_url = new moodle_url('/filter/mediacms/my_media.php', $view_params);

        return html_writer::tag('a', $text_matches[1], [
            'href'   => $view_url->out(false),
            'target' => '_blank',
            'rel'    => 'noopener noreferrer',
        ]);
    }
}
