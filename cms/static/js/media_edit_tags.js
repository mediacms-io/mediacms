// static/js/media_edit_tags.js
(function () {
    window.DCSMHUB = window.DCSMHUB || {};

    function initMediaEditTags() {
        var input = document.getElementById("id_new_tags");
        if (!input) return;

        // avoid double-init
        if (input.dataset.tagPickerInit === "1") return;
        input.dataset.tagPickerInit = "1";

        // Wrap the existing input in our wrapper
        var parent = input.parentNode;
        var wrapper = document.createElement("div");
        wrapper.className = "tag-picker-wrapper";

        parent.insertBefore(wrapper, input);
        wrapper.appendChild(input);

	// --- Prevent browser autocomplete from interfering ---
	var dummy = document.createElement("input");
	dummy.type = "text";
	dummy.name = "tagpicker_autofill_preventer";
	dummy.style.display = "none";
	wrapper.parentNode.insertBefore(dummy, wrapper);
		
	input.setAttribute("autocomplete", "off");
	input.setAttribute("autocorrect", "off");
	input.setAttribute("autocapitalize", "none");
	input.setAttribute("spellcheck", "false");


        // Create dropdown container + inner
        var dropdown = document.createElement("div");
        dropdown.className = "tag-dropdown";
        dropdown.id = "tag-picker-dropdown";

        var inner = document.createElement("div");
        inner.className = "tag-dropdown-inner";
        inner.id = "tag-picker-dropdown-inner";

        dropdown.appendChild(inner);
        wrapper.appendChild(dropdown);

        // All tags available from backend (array of strings)
        var tags = window.DCSMHUB.editMediaAvailableTags || [];

        // ============================================================
        // NEW TAG HELPERS (known tags, normalization, escaping)
        // ============================================================
        function buildKnownTagSet(list) {
            var set = Object.create(null);
            list.forEach(function (t) {
                if (!t) return;
                var key = t.toString().trim().toLowerCase();
                if (key) set[key] = true;
            });
            return set;
        }

        var knownTagSet = buildKnownTagSet(tags);

        function normalizeTagName(str) {
            return (str || "").trim();
        }

        function normalizeTagKey(str) {
            return (str || "").trim().toLowerCase();
        }

        function escapeHtml(str) {
            return String(str).replace(/[&<>"']/g, function (ch) {
                switch (ch) {
                    case "&": return "&amp;";
                    case "<": return "&lt;";
                    case ">": return "&gt;";
                    case '"': return "&quot;";
                    case "'": return "&#39;";
                    default: return ch;
                }
            });
        }

        // jQuery UI dialog-based confirm modal (with confirm() fallback)
        function showTagConfirmModal(newTags, onConfirm, onCancel) {
            var plural = newTags.length > 1;

            var htmlMsg =
                "You entered new tag" + (plural ? "s" : "") +
                " that " + (plural ? "are" : "is") +
                " not in the existing list:<br><br>" +
                "<strong>" + newTags.map(escapeHtml).join(", ") + "</strong>" +
                "<br><br>Please check the spelling before saving.<br>If you see two words on a single line, make sure all tags are comma separated before saving.";

            var plainMsg =
                "You entered new tag" + (plural ? "s" : "") +
                " that " + (plural ? "are" : "is") +
                " not in the existing list:\n\n" +
                newTags.join(", ") +
                "\n\nPlease check the spelling before saving.\n\n" +
		"If you see two words on a single line, make sure all tags are comma separated before saving.\n\n" +
                "Click OK to save with these new tag" + (plural ? "s" : "") +
                ", or Cancel to go back and edit.";

            var $ = window.jQuery || window.$;
            var hasJqueryDialog = $ && $.fn && typeof $.fn.dialog === "function";

            if (hasJqueryDialog) {
                // Ensure dialog container exists
                var $dialog = $("#new-tag-dialog");
                if (!$dialog.length) {
                    $dialog = $(
                        '<div id="new-tag-dialog" title="New tags detected">' +
                        '  <p id="new-tag-dialog-text"></p>' +
                        '</div>'
                    ).appendTo("body");
                }

                $("#new-tag-dialog-text").html(htmlMsg);

                $dialog.dialog({
                    modal: true,
                    width: 450,
                    resizable: false,
                    draggable: false,
                    title: plural ? "New tags detected" : "New tag detected",
                    buttons: {
                        Cancel: function () {
                            $(this).dialog("close");
                            if (typeof onCancel === "function") onCancel();
                        },
                        "OK, save": function () {
                            $(this).dialog("close");
                            if (typeof onConfirm === "function") onConfirm();
                        }
                    }
                });

                return;
            }

            // Fallback: browser confirm
            if (window.confirm(plainMsg)) {
                if (typeof onConfirm === "function") onConfirm();
            } else if (typeof onCancel === "function") {
                onCancel();
            }
        }

        // ============================================================
        // ORIGINAL HELPERS (year logic, filtering, pills)
        // ============================================================

        // Extract selected dcYYYY tag (if any) from the current input value
        function extractExistingYearTag(value) {
            var current = (value || "")
                .split(",")
                .map(function (t) { return t.trim(); })
                .filter(Boolean);

            for (var i = 0; i < current.length; i++) {
                var m = current[i].match(/^dc(\d{4})$/i);
                if (m) return "dc" + m[1];
            }
            return null;
        }

        // Get what the user is currently typing:
        // use text after the last comma OR last space as the filter term.
        // If there is no comma/space yet, use the whole string.
        function getFilterTerm() {
            var raw = input.value || "";

            var lastComma = raw.lastIndexOf(",");
            var lastSpace = raw.lastIndexOf(" ");

            var start = Math.max(lastComma, lastSpace);

            // if neither is present, start == -1 >> substring(0) = whole string
            return raw.substring(start + 1).trim().toLowerCase();
        }

        // Filter by year rules (dcYYYY behavior)
        function filterByYear(dcYearTag) {
            return tags.filter(function (tag) {
                var m = tag.match(/^dc(\d{4})(.*)$/i);

                if (!m) {
                    // Non-year tag >> always keep
                    return true;
                }

                var year = "dc" + m[1];  // e.g. "dc2002"
                var suffix = m[2];       // "" or "_fri", "masq", etc.

                if (!dcYearTag) {
                    // No dcYYYY in input:
                    // - Show ONLY exact dcYYYY tags
                    // - Hide all dcYYYY_* variants
                    return suffix === "";
                }

                // There *is* a dcYYYY in the input:
                // - Only show tags for that same year
                if (year.toLowerCase() !== dcYearTag.toLowerCase()) {
                    return false;
                }

                // - And hide the pure dcYYYY itself (already selected)
                if (suffix === "") {
                    return false;
                }

                // Matching year + has a suffix >> keep
                return true;
            });
        }

        // Parse the current input into an array of tags
        function getCurrentTagsFromValue(value) {
            return (value || "")
                .split(",")
                .map(function (t) { return t.trim(); })
                .filter(Boolean);
        }

        // Replace the "current term" (after last comma/space) with tagTitle,
        // ensuring proper ", " separation, then dedupe.
        function addTagToInput(tagTitle) {
            var raw = input.value || "";

            var lastComma = raw.lastIndexOf(",");
            var lastSpace = raw.lastIndexOf(" ");
            var start = Math.max(lastComma, lastSpace);

            var newValue;

            if (start === -1) {
                // FIRST token case: replace entire value with tagTitle
                newValue = tagTitle;
            } else {
                // MULTI-TOKEN CASE
                var prefix = raw.slice(0, start + 1);   // includes the delimiter

                // Normalize prefix to end with ", "
                prefix = prefix.replace(/\s*$/, "");     // strip trailing spaces
                prefix = prefix.replace(/,+$/, ",");     // compress trailing commas

                if (!prefix.endsWith(",")) {
                    prefix += ",";
                }
                if (!prefix.endsWith(", ")) {
                    prefix += " ";
                }

                newValue = prefix + tagTitle;
            }

            // Dedupe the final list
            var tokens = getCurrentTagsFromValue(newValue);
            var seen = {};
            var deduped = [];

            tokens.forEach(function (t) {
                var key = t.toLowerCase();
                if (!seen[key]) {
                    seen[key] = true;
                    deduped.push(t);
                }
            });

            input.value = deduped.join(", ");
        }

        // ---- RENDER PILLS (year logic + type-ahead) ----
        // forceShowAll:
        //   true  -> ignore type-ahead term, just show all base tags
        //   false -> apply type-ahead based on getFilterTerm()
        function renderPills(forceShowAll) {
            // Clear previous content
            inner.innerHTML = "";

            // Helper tip
            var helper = document.createElement("div");
            helper.className = "tag-helper-tip";
            helper.textContent = "Click on a tag to add it to the list";
            inner.appendChild(helper);

            var dcYearTag = extractExistingYearTag(input.value);
            var base = filterByYear(dcYearTag);
            var visible = base;

            if (!forceShowAll) {
                var term = getFilterTerm();

                if (term) {
                    visible = base.filter(function (tag) {
                        return tag.toLowerCase().indexOf(term) !== -1;
                    });

                    // If filtering nuked everything, fall back to base so the dropdown
                    // is never totally empty just because of a typo / rare term.
                    if (!visible.length) {
                        visible = base;
                    }
                }
            }

            if (!visible.length) {
                var msg = document.createElement("div");
                msg.className = "no-tags-msg";
                msg.textContent = "No tags available";
                inner.appendChild(msg);
                return;
            }

            visible.forEach(function (tag) {
                var pill = document.createElement("span");
                pill.className = "tag-pill";
                pill.setAttribute("data-tag-title", tag);
                pill.textContent = tag;
                inner.appendChild(pill);
            });
        }

        // ---- DROPDOWN BEHAVIOR ----

        function openDropdown() {
            dropdown.classList.add("is-open");
            // On focus / (re)open: show full list for current value (dc-year rules),
            // no term-based filter yet.
            renderPills(true);
        }

        function closeDropdown() {
            dropdown.classList.remove("is-open");
        }

        // Show dropdown when input focused
        input.addEventListener("focus", openDropdown);

        // Live type-ahead filter as user types
        input.addEventListener("input", function () {
            // Always ensure dropdown is open whenever the user types
            if (!dropdown.classList.contains("is-open")) {
                dropdown.classList.add("is-open");
            }
            // Apply term-based filter
            renderPills(false);
        });

        // Click pill >> autocomplete current term with tag and re-render
        inner.addEventListener("click", function (evt) {
            var pill = evt.target.closest(".tag-pill");
            if (!pill) return;

            var title = pill.getAttribute("data-tag-title") || pill.textContent.trim();
            if (!title) return;

            addTagToInput(title);

            // Keep focus in the input so user can hit comma/space and type next tag
            input.focus();

            // After appending, reinitialize the dropdown:
            // keep it open and show full list for the new input value
            dropdown.classList.add("is-open");
            renderPills(true);
        });

        // Click outside >> close dropdown
        document.addEventListener("click", function (evt) {
            if (!wrapper.contains(evt.target)) {
                closeDropdown();
            }
        });

        // ESC closes dropdown; Enter is handled below
        input.addEventListener("keydown", function (evt) {
            if (evt.key === "Escape") {
                closeDropdown();
                input.blur();
            }
        });

        // ============================================================
        // ENTER KEY BEHAVIOR FOR TAG INPUT
        // ============================================================
        // If dropdown is open, Enter closes it (no submit).
        // If dropdown is not open, let normal form submit happen.
        input.addEventListener("keydown", function (e) {
            if (e.key !== "Enter") return;

            if (dropdown.classList.contains("is-open")) {
                e.preventDefault();
                e.stopPropagation();
                closeDropdown();
            }
            // else: allow default (form submit)
        });

        // ============================================================
        // FORM SUBMIT VALIDATION FOR NEW TAGS
        // ============================================================
        var form = input.closest("form");
        if (form) {
            form.addEventListener("submit", function (e) {
                // Avoid re-validating when we re-submit programmatically
                if (form.dataset.tagValidationDone === "1") {
                    form.dataset.tagValidationDone = "";
                    return;
                }

                var raw = input.value || "";
                if (!raw.trim()) {
                    // No tags entered, nothing to validate
                    return;
                }

                var parts = raw.split(",");
                var newTags = [];

                parts.forEach(function (part) {
                    var clean = normalizeTagName(part);
                    if (!clean) return;

                    var key = normalizeTagKey(clean);
                    if (!knownTagSet[key]) {
                        newTags.push(clean);
                    }
                });

                // If all tags are known, allow submit
                if (!newTags.length) return;

                // We have unknown tags: ask user via modal
                e.preventDefault();

                showTagConfirmModal(
                    newTags,
                    function handleConfirm() {
                        // Mark that we've validated and allow submit
                        form.dataset.tagValidationDone = "1";
                        form.submit();
                    },
                    function handleCancel() {
                        // User stays on page and can edit tags
                    }
                );
            });
        }

        // Initial render (for when dropdown is first opened via focus)
        renderPills(true);
    }

    // Export for wrappers / re-init
    window.DCSMHUB.initMediaEditTags = initMediaEditTags;

    // Auto-init for regular full-page loads
    function autoInit() {
        setTimeout(initMediaEditTags, 0);
    }

    if (document.readyState === "complete" || document.readyState === "interactive") {
        autoInit();
    } else {
        document.addEventListener("DOMContentLoaded", autoInit);
    }
})();

