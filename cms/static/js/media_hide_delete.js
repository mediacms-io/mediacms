// static/js/media_hide_delete.js
(function () {
    const selector = "a.edit-media";

    function shouldHideEdit() {
        // If we don't have DCSMHUB, safest is to hide
        if (!window.DCSMHUB) {
            return true;
        }

        // Prefer the explicit delete-role flag
        if (typeof window.DCSMHUB.canDeleteMedia !== "undefined") {
            return !window.DCSMHUB.canDeleteMedia;
        }

        // Fallback: if we only know "isEditor", use that
        if (typeof window.DCSMHUB.isEditor !== "undefined") {
            return !window.DCSMHUB.isEditor;
        }

        // If in doubt, hide
        return true;
    }

    // If user *should* see the edit link, do nothing
    if (!shouldHideEdit()) {
        return;
    }

    function removeEditButtons() {
        document.querySelectorAll(selector).forEach(function (el) {
            if (el.classList.contains("edit-media")) {
                el.remove();
            }
        });
    }

    function initObserver() {
        // Run once immediately
        removeEditButtons();

        // Watch for dynamically added nodes (React / AJAX updates)
        const observer = new MutationObserver(function () {
            removeEditButtons();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initObserver);
    } else {
        initObserver();
    }
})();

