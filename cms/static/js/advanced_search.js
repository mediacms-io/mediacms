document.addEventListener("DOMContentLoaded", function () {
    // ============================================================
    // 1. DROPDOWN TAG PICKER LOGIC (search + contains filter)
    // ============================================================

    var searchInput       = document.getElementById("other-tags-search");
    var dropdown          = document.getElementById("other-tags-dropdown");
    var dropdownInner     = document.getElementById("other-tags-dropdown-inner");
    var selectedContainer = document.getElementById("selected-other-tags");
    var noOtherMsg        = document.getElementById("no-other-tags-msg");

    // Only enable the dropdown behavior if all of these exist
    if (searchInput && dropdown && dropdownInner && selectedContainer) {

        // --- Filtering ---

        function applyFilter(query) {
            var q = (query || "").toLowerCase().trim();
            var labels = dropdownInner.querySelectorAll(".tag-pill");

            labels.forEach(function (label) {
                var title = (label.dataset.tagTitle || label.textContent || "")
                    .toLowerCase();

                if (!q || title.indexOf(q) !== -1) {
                    label.style.display = "";
                } else {
                    label.style.display = "none";
                }
            });
        }

        // --- Dropdown visibility ---

        function openDropdown() {
            dropdown.classList.add("is-open");
        }

        function closeDropdown() {
            dropdown.classList.remove("is-open");
            // When the dropdown is *fully closed* (Escape / click outside),
            // clear the search text and reset the filter.
            searchInput.value = "";
            applyFilter("");
        }

        searchInput.addEventListener("focus", function () {
            openDropdown();
        });

        // Close when clicking outside the input + dropdown
        document.addEventListener("mousedown", function (e) {
            if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
                if (dropdown.classList.contains("is-open")) {
                    closeDropdown();  // clears text & filter
                }
            }
        });

        // Close on ESC key
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" || e.key === "Esc") {
                if (dropdown.classList.contains("is-open")) {
                    closeDropdown();   // clears text & filter
                    searchInput.blur(); // optional
                }
            }
        });

        searchInput.addEventListener("input", function () {
            applyFilter(searchInput.value);
        });

        // --- Selecting tags from dropdown ---

        dropdownInner.addEventListener("change", function (e) {
            var target = e.target;
            if (
                target.tagName.toLowerCase() === "input" &&
                target.type === "checkbox" &&
                (target.name === "tags" || target.name === "untagged" || target.name === "untagged-yo") &&
                target.checked
            ) {
                var label = target.closest("label.tag-pill");
                if (!label) return;

                // Move this pill into the "Other tags" section
                selectedContainer.appendChild(label);
                label.style.display = ""; // ensure it's visible

                // Remove the "no other tags" placeholder message if present
                if (noOtherMsg) {
                    noOtherMsg.remove();
                    noOtherMsg = null;
                }

                // IMPORTANT CHANGE:
                // Do *not* clear searchInput or reset the filter here.
                // The user's typed text should remain while the dropdown is open,
                // so that when they re-open it in the same session it's still there.
                // If the dropdown was closed (ESC / click outside), closeDropdown()
                // will handle clearing the text.

                // Keep dropdown open so they can add more
                openDropdown();
            }
        });
    }

    // ============================================================
    // 2. UNTAGGED / TAG MUTUAL EXCLUSION
    // ============================================================

    var untaggedCheckbox = document.querySelector('input[name="untagged"]');
    var untaggedYoCheckbox = document.querySelector('input[name="untagged-yo"]');
    if (untaggedCheckbox || untaggedYoCheckbox) {
        // When UNTAGGED becomes active >> uncheck all tag checkboxes
        untaggedCheckbox.addEventListener("change", function () {
            if (untaggedCheckbox.checked) {
                var tagCheckboxes = document.querySelectorAll(
                    'input[name="tags"]'
                );
                tagCheckboxes.forEach(function (cb) {
                    cb.checked = false;
                });
		untaggedYoCheckbox.checked = false;
            }
        });

        untaggedYoCheckbox.addEventListener("change", function () {
            if (untaggedYoCheckbox.checked) {
                var tagCheckboxes = document.querySelectorAll(
                    'input[name="tags"]'
                );
                tagCheckboxes.forEach(function (cb) {
                    cb.checked = false;
                });
                untaggedCheckbox.checked = false;
            }
        });

        // When any TAG becomes active >> uncheck UNTAGGED and UNTAGGED-YO
        var allTagCheckboxes = document.querySelectorAll('input[name="tags"]');
        allTagCheckboxes.forEach(function (cb) {
            cb.addEventListener("change", function () {
                if (cb.checked) {
                    untaggedCheckbox.checked = false;
		    untaggedYoCheckbox.checked = false;
                }
            });
        });
    }

    // ============================================================
    // 3. TAG FILTER VALIDATION (Apply button)
    // ============================================================

    function validateTagFilters() {
        var msgBox = document.getElementById("tag-validation-message");
        if (!msgBox) {
            // If the message box isn't there, don't block submit.
            return true;
        }

        msgBox.style.display = "none";
        msgBox.textContent = "";

        // Get tag_mode = any | all
        var tagModeInput = document.querySelector('input[name="tag_mode"]:checked');
        var tagMode = tagModeInput ? tagModeInput.value : "any";

        // Collect all checked year (DC) tags — titles like "dc2003"
        var checkedYearTags = Array.from(
            document.querySelectorAll('input[name="tags"]:checked')
        ).filter(function (cb) {
            var label = cb.closest("label");
            if (!label) return false;

            var titleSpan = label.querySelector("span");
            if (!titleSpan) return false;

            var title = titleSpan.textContent.trim().toLowerCase();
            return /^dc\d{4}$/.test(title); // match dc2003, dc2024 etc
        });

        // RULE 1:
        // If >= 2 year tags selected and tag_mode = all --> INVALID
        if (checkedYearTags.length > 1 && tagMode === "all") {
            msgBox.textContent =
                "Warning: A clip will never have multiple years. Check your selection and hit 'Apply' again.";
            msgBox.style.display = "block";
            return false; // validation FAILED
        }

        return true; // all good
    }

    var applyBtn = document.getElementById("apply-button");
    if (applyBtn) {
        applyBtn.addEventListener("click", function (e) {
            if (!validateTagFilters()) {
                e.preventDefault();  // stop form submit
                e.stopPropagation(); // stop bubbling
            }
        });
    }


    // ============================================================
    // 5. BULK TAG ACTIONS (Editors only)
    // ============================================================
    var bulkSelectAll = document.getElementById('bulk-select-all');
    var bulkSelects = document.querySelectorAll('.bulk-select');
    var bulkAddBtn = document.getElementById('bulk-add-tags');
    var bulkRemoveBtn = document.getElementById('bulk-remove-tags');
    var bulkTagsSelect = document.getElementById('bulk-tags-select');

    // ------------------------------
    // Small modal helpers using jQuery UI
    // ------------------------------
    function showModal(message, title, onClose) {
        title = title || '';
        var $d = $('<div>').html(message).appendTo('body');
        $d.dialog({
            title: title,
            modal: true,
            width: Math.min(600, Math.max(300, $(window).width() * 0.5)),
            buttons: {
                OK: function () { $(this).dialog('close'); }
            },
            close: function () {
                if (typeof onClose === 'function') {
                    try { onClose(); } catch (e) { console.error(e); }
                }
                $(this).dialog('destroy').remove();
            }
        });
    }

    function confirmModal(message, title, onConfirm) {
        title = title || 'Confirm';
        var $d = $('<div>').html(message).appendTo('body');
        $d.dialog({
            title: title,
            modal: true,
            width: Math.min(600, Math.max(300, $(window).width() * 0.5)),
            buttons: {
                Yes: function () { var dlg = $(this); dlg.dialog('close'); if (typeof onConfirm === 'function') onConfirm(); },
                Cancel: function () { $(this).dialog('close'); }
            },
            close: function () { $(this).dialog('destroy').remove(); }
        });
    }

    function getSelectedTokens() {
        var tokens = [];
        document.querySelectorAll('.bulk-select:checked').forEach(function (cb) {
            tokens.push(cb.dataset.token);
        });
        return tokens;
    }

    function clearBulkSelection() {
        // Uncheck all per-row checkboxes
        document.querySelectorAll('.bulk-select:checked').forEach(function (cb) { cb.checked = false; });
        // Uncheck the "select all" control if present
        var selAll = document.getElementById('bulk-select-all');
        if (selAll) selAll.checked = false;
        // Clear the selected options in the bulk-tags <select>
        if (bulkTagsSelect) {
            Array.from(bulkTagsSelect.options).forEach(function (opt) { opt.selected = false; });
        }
    }

    function getSelectedTagIds() {
        if (!bulkTagsSelect) return [];
        return Array.from(bulkTagsSelect.selectedOptions).map(function (opt) { return opt.value; });
    }

    function getSelectedTagTitles() {
        if (!bulkTagsSelect) return [];
        return Array.from(bulkTagsSelect.selectedOptions).map(function (opt) { return opt.textContent || opt.innerText || opt.value; });
    }

    if (bulkSelectAll) {
        bulkSelectAll.addEventListener('change', function () {
            var checked = bulkSelectAll.checked;
            document.querySelectorAll('.bulk-select').forEach(function (cb) { cb.checked = checked; });
        });
    }

    function csrfToken() {
        var name = 'csrftoken';
        var cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            var cookies = document.cookie.split(';');
            for (var i = 0; i < cookies.length; i++) {
                var cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    function doBulkAction(action) {
        var tokens = getSelectedTokens();
        if (!tokens.length) {
            showModal('No media selected', 'Notice');
            return;
        }
        var tagIds = getSelectedTagIds();
        if (!tagIds.length) {
            showModal('No tags selected', 'Notice');
            return;
        }

        var tagTitles = getSelectedTagTitles();
        var tagListText = tagTitles.length ? ('</br></br>Tags: ' + tagTitles.join(', ')) : '';
        var confirmText = 'Are you sure you want to ' + (action === 'add_tags' ? 'add' : 'remove') + ' the selected tag(s) on ' + tokens.length + ' item(s)?' + tagListText;

        confirmModal(confirmText, 'Confirm bulk action', function () {
            fetch('/api/v1/media/user/bulk_actions', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken(),
                },
                body: JSON.stringify({ media_ids: tokens, action: action, tag_ids: tagIds }),
            })
            .then(function (resp) { return resp.json().then(function (d) { return {status: resp.status, data: d}; }); })
            .then(function (result) {
                if (result.status >= 200 && result.status < 300) {
                    var actionVerb = (action === 'add_tags') ? 'Added' : 'Removed';
                    var serverMsg = result.data && result.data.detail ? ('\n\n' + result.data.detail) : '';
                    var msg = actionVerb + ' tag(s): ' + (tagTitles.length ? tagTitles.join(', ') : '(none)') + ' on ' + tokens.length + ' item(s).';
                    showModal(msg, 'Success', function () { clearBulkSelection(); window.location.reload(); });
                } else {
                    showModal(result.data.detail || 'Action failed', 'Error');
                }
            }).catch(function (err) {
                console.error(err);
                showModal('Network error while performing bulk action', 'Network error');
            });
        });
    }

    if (bulkAddBtn) bulkAddBtn.addEventListener('click', function (e) { e.preventDefault(); doBulkAction('add_tags'); });
    if (bulkRemoveBtn) bulkRemoveBtn.addEventListener('click', function (e) { e.preventDefault(); doBulkAction('remove_tags'); });

    // No dropdown toggle behavior — using always-open <select multiple> for bulk tag selection



// ============================================================
// 4. YEAR SELECT <--> YEAR CHECKBOX SYNC
// ============================================================

var yearSelect = document.getElementById("year-select");
if (yearSelect) {
    yearSelect.addEventListener("change", function () {
        var selected = yearSelect.value; // "" or tag.id

        // Uncheck all year-tag checkboxes
        document.querySelectorAll('.tag-pill input[name="tags"]').forEach(function (cb) {
            var label = cb.closest("label.tag-pill");
            if (!label) return;
            var span = label.querySelector("span");
            if (!span) return;

            var title = span.textContent.trim().toLowerCase();
            if (/^dc\d{4}$/.test(title)) {
                cb.checked = (selected && cb.value === selected);
            }
        });

        // If a specific year was chosen, uncheck "untagged"
        if (selected) {
            var untagged = document.querySelector('input[name="untagged"]');
            if (untagged) untagged.checked = false;
        }
    });
}





});

