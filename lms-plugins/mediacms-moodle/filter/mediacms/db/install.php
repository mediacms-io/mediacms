<?php

defined('MOODLE_INTERNAL') || die();

/**
 * Post-installation hook.
 */
function xmldb_filter_mediacms_install() {
    global $CFG, $DB;
    require_once($CFG->libdir . '/filterlib.php');

    // Enable the filter globally.
    filter_set_global_state('filter_mediacms', TEXTFILTER_ON);

    // Move to top priority (lowest sortorder).
    $syscontextid = context_system::instance()->id;
    $filters = $DB->get_records('filter_active', ['contextid' => $syscontextid], 'sortorder ASC');

    if (empty($filters)) {
        return;
    }

    // Separate mediacms from other filters by inspecting the record property,
    // not the array key (get_records indexes by id, not by filter name).
    $mediacmsrecord = null;
    $otherrecords = [];
    foreach ($filters as $record) {
        if ($record->filter === 'filter_mediacms') {
            $mediacmsrecord = $record;
        } else {
            $otherrecords[] = $record;
        }
    }

    // Reassign sortorders: mediacms first, then everyone else.
    $sortorder = 1;
    if ($mediacmsrecord) {
        $mediacmsrecord->sortorder = $sortorder++;
        $DB->update_record('filter_active', $mediacmsrecord);
    }
    foreach ($otherrecords as $record) {
        $record->sortorder = $sortorder++;
        $DB->update_record('filter_active', $record);
    }
}
