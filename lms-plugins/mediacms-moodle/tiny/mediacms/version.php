<?php
defined('MOODLE_INTERNAL') || die();

$plugin->version   = 2026020100;
$plugin->requires  = 2024100700;
$plugin->component = 'tiny_mediacms';
$plugin->maturity  = MATURITY_STABLE;
$plugin->release   = 'v1.0.0';
$plugin->dependencies = ['filter_mediacms' => 2026020100]; // Requires the filter
