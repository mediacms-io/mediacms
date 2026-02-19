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

        // 2. Auto-convert MediaCMS URLs to embedded players
        // First, protect text-only links from being converted
        // by temporarily replacing them with placeholders
        $textlink_placeholders = [];
        $textlink_pattern = '/<a\s+[^>]*data-mediacms-textlink=["\']true["\'][^>]*>.*?<\/a>/is';

        $newtext = preg_replace_callback($textlink_pattern, function($matches) use (&$textlink_placeholders) {
            $placeholder = '###MEDIACMS_TEXTLINK_' . count($textlink_placeholders) . '###';
            $textlink_placeholders[$placeholder] = $matches[0];
            return $placeholder;
        }, $newtext);

        // Regex for MediaCMS view URLs: https://domain/view?m=TOKEN
        // We need to be careful to match the configured domain
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
            $supported_params = ['showTitle', 'showRelated', 'showUserAvatar', 'linkTitle', 't', 'width', 'height'];
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

        // Build iframe attributes
        $iframe_attrs = [
            'src' => $launchurl->out(false),
            'frameborder' => 0,
            'allowfullscreen' => 'allowfullscreen',
            'class' => 'mediacms-embed',
            'title' => 'MediaCMS Video'
        ];

        // Add width/height attributes only if provided
        if ($width !== null) {
            $iframe_attrs['width'] = $width;
        }
        if ($height !== null) {
            $iframe_attrs['height'] = $height;
        }

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
        global $COURSE, $PAGE;

        // Extract href.
        if (!preg_match('/href=["\']([^"\']+)["\']/', $anchor_html, $href_matches)) {
            return $anchor_html;
        }
        $href = html_entity_decode($href_matches[1], ENT_QUOTES | ENT_HTML5);

        // Extract ?m=TOKEN.
        parse_str(parse_url($href, PHP_URL_QUERY) ?? '', $query_params);
        $token = $query_params['m'] ?? null;
        if (!$token || !preg_match('/^[a-zA-Z0-9]+$/', $token)) {
            return $anchor_html;
        }

        // Extract inner link text.
        if (!preg_match('/<a[^>]*>(.*?)<\/a>/is', $anchor_html, $text_matches)) {
            return $anchor_html;
        }

        $launch_url = new moodle_url('/filter/mediacms/launch.php', [
            'token'    => $token,
            'courseid' => isset($COURSE->id) ? (int)$COURSE->id : 0,
        ]);

        if (!self::$textlink_js_added) {
            self::$textlink_js_added = true;
            $PAGE->requires->js_init_code(
                'document.addEventListener("click",function(e){'
                . 'var a=e.target.closest("a.mediacms-textlink-launch");if(!a)return;'
                . 'e.preventDefault();'
                . 'var f=document.createElement("iframe");'
                . 'f.src=a.dataset.launchUrl;'
                . 'f.style.cssText="width:100%;height:480px;border:none;display:block;";'
                . 'f.allowFullscreen=true;'
                . 'f.setAttribute("allow","autoplay *; fullscreen *; encrypted-media *;");'
                . 'a.parentNode.replaceChild(f,a);'
                . '});',
                false
            );
        }

        return html_writer::tag('a', $text_matches[1], [
            'href'            => '#',
            'class'           => 'mediacms-textlink-launch',
            'data-launch-url' => $launch_url->out(false),
        ]);
    }

    /** @var bool  Whether the inline-iframe JS has already been added to the page. */
    private static $textlink_js_added = false;
}
