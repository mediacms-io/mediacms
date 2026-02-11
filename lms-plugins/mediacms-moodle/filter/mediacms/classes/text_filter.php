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

        // 2. Handle Auto-convert URLs if enabled
        if (get_config('filter_mediacms', 'enableautoconvert')) {
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

            // Restore protected text-only links
            foreach ($textlink_placeholders as $placeholder => $original) {
                $newtext = str_replace($placeholder, $original, $newtext);
            }
        }

        return $newtext;
    }

    /**
     * Callback for [mediacms:TOKEN]
     */
    public function callback_tag($matches) {
        return $this->generate_iframe($matches[1]);
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
        return $this->generate_iframe($token);
    }

    /**
     * Generate the Iframe pointing to launch.php
     */
    private function generate_iframe($token) {
        global $CFG, $COURSE;

        $width = get_config('filter_mediacms', 'iframewidth') ?: 960;
        $height = get_config('filter_mediacms', 'iframeheight') ?: 540;
        $courseid = $COURSE->id ?? 0;

        $launchurl = new moodle_url('/filter/mediacms/launch.php', [
            'token' => $token,
            'courseid' => $courseid,
            'width' => $width,
            'height' => $height
        ]);

        $iframe = html_writer::tag('iframe', '', [
            'src' => $launchurl->out(false),
            'width' => $width,
            'height' => $height,
            'frameborder' => 0,
            'allowfullscreen' => 'allowfullscreen',
            'class' => 'mediacms-embed',
            'title' => 'MediaCMS Video'
        ]);

        return $iframe;
    }
}
