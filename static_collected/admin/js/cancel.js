(function($) {
    'use strict';

    $(document).ready(function() {
        $('.cancel-link').click(function(e) {
            e.preventDefault();
            const parentWindow = window.parent;
            if (parentWindow && typeof(parentWindow.dismissRelatedObjectModal) === 'function' && parentWindow !== window) {
                parentWindow.dismissRelatedObjectModal();
            } else {
                // fallback to default behavior
                window.history.back();
            }
            return false;
        });
    });
})(django.jQuery);
