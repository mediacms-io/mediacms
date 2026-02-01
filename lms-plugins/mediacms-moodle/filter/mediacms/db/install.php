<?php

defined('MOODLE_INTERNAL') || die();

/**
 * Post-installation hook.
 */
function xmldb_filter_mediacms_install() {
    global $CFG, $DB;
    require_once($CFG->libdir . '/filterlib.php');

    // 1. Enable the filter globally.
    filter_set_global_state('filter_mediacms', TEXTFILTER_ON);

    // 2. Move to top priority (lowest sortorder).
    // Get all global active filters.
    $filters = $DB->get_records('filter_active', ['contextid' => SYSCONTEXTID], 'sortorder ASC', 'filter, id, sortorder');
    
    // If we are already the only one or something failed, stop.
    if (empty($filters)) {
        return;
    }

    // Prepare the new order: mediacms first, then everyone else (excluding mediacms if present).
    $sortedfilters = ['filter_mediacms'];
    foreach ($filters as $filtername => $record) {
        if ($filtername !== 'filter_mediacms') {
            $sortedfilters[] = $filtername;
        }
    }

    // Write back the new sort orders.
    $sortorder = 1;
    foreach ($sortedfilters as $filtername) {
        if ($record = $DB->get_record('filter_active', ['filter' => $filtername, 'contextid' => SYSCONTEXTID])) {
            $record->sortorder = $sortorder;
            $DB->update_record('filter_active', $record);
            $sortorder++;
        }
    }
}
