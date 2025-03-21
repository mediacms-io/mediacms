(function($) {
    'use strict';

    $.fn.search_filters = function () {
        $(this).change(function () {
            const $field = $(this);
            const $option = $field.find('option:selected');
            const select_name = $option.data('name');
            if (select_name) {
                $field.attr('name', select_name);
            } else {
                $field.removeAttr('name');
            }
        });
        $(this).trigger('change');
    };

    function getMinimuInputLength(element) {
        return window.filterInputLength[element.data('name')] ?? window.filterInputLengthDefault;
    }

    function searchFilters() {
        // Make search filters select2 and ensure they work for filtering
        const $ele = $('.search-filter');
        $ele.search_filters();
        $ele.each(function () {
            const $this = $(this);
            $this.select2({  width: '100%', minimumInputLength: getMinimuInputLength($this) });
        });

        // Use select2 for mptt dropdowns
        const $mptt = $('.search-filter-mptt');
        if ($mptt.length) {
            $mptt.search_filters();
            $mptt.select2({
                width: '100%',
                minimumInputLength: getMinimuInputLength($mptt),
                templateResult: function (data) {
                    // https://stackoverflow.com/questions/30820215/selectable-optgroups-in-select2#30948247
                    // rewrite templateresult for build tree hierarchy
                    if (!data.element) {
                        return data.text;
                    }
                    const $element = $(data.element);
                    let $wrapper = $('<span></span>');
                    $wrapper.attr('style', $($element[0]).attr('style'));
                    $wrapper.text(data.text);
                    return $wrapper;
                },
            });
        }
    }

    $(document).ready(function () {
        // Ensure all raw_id_fields have the search icon in them
        $('.related-lookup').append('<i class="fa fa-search"></i>')

        // Allow for styling of selects
        $('.actions select').addClass('form-control').select2({ width: 'element' });

        searchFilters();
    });

})(jQuery);
