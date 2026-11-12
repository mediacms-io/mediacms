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

    function filterParams($input) {
        if (($input.is(':checkbox') || $input.is(':radio')) && !$input.is(':checked')) {
            return {};
        }
        const raw = $input.is('select')
            ? ($input.find('option:selected').attr('data-params') || '{}')
            : ($input.attr('data-params') || '{}');
        try {
            return JSON.parse(raw);
        } catch (error) {
            return {};
        }
    }

    const filtersOpenKey = 'mediacms-admin-filters-open';
    let suppressFilterSubmit = false;
    let submittingFilters = false;

    function rememberOpenFilterCard($form) {
        const open = $form.find('details.changelist-filter-card').prop('open');
        try {
            if (open) {
                sessionStorage.setItem(filtersOpenKey, window.location.pathname);
            } else {
                sessionStorage.removeItem(filtersOpenKey);
            }
        } catch (error) {
            // Session storage can be unavailable; the card just starts closed.
        }
    }

    function restoreOpenFilterCard() {
        let shouldOpen = false;
        try {
            shouldOpen = sessionStorage.getItem(filtersOpenKey) === window.location.pathname;
            sessionStorage.removeItem(filtersOpenKey);
        } catch (error) {
            shouldOpen = false;
        }
        if (!shouldOpen) {
            return;
        }
        // Opening the card initializes Select2, which must not count as a new choice.
        suppressFilterSubmit = true;
        $('details.changelist-filter-card').each(function () {
            this.open = true;
        });
        window.setTimeout(function () {
            suppressFilterSubmit = false;
        }, 0);
    }

    function writeFilterParams($form) {
        $form.find('input.changelist-filter-param').remove();
        $form.find('.changelist-filter-input').each(function () {
            const params = filterParams($(this));
            Object.keys(params).forEach(function (name) {
                const value = params[name];
                if (value === '' || value === null || value === undefined) {
                    return;
                }
                $('<input>', {
                    type: 'hidden',
                    class: 'changelist-filter-param',
                    name: name,
                    value: value,
                }).appendTo($form);
            });
        });
        $form.find('.changelist-filter-input').prop('disabled', true);
    }

    function submitFilters(form) {
        if (suppressFilterSubmit || submittingFilters) {
            return;
        }
        submittingFilters = true;
        const $form = $(form);
        // A new filter changes the result set, so start back at the first page.
        $form.find('input[name="p"]').prop('disabled', true);
        // An empty search box is not a search. Typed text is still submitted.
        const $search = $form.find('#searchbar');
        if ($search.length && $search.val() === '') {
            $search.prop('disabled', true);
        }
        rememberOpenFilterCard($form);
        writeFilterParams($form);
        form.submit();
    }

    function initFilterSelects($root) {
        // Select2 measures width, so wait until the filter card is open.
        // Ignore the change events Select2 emits while it is being created.
        const previousSuppress = suppressFilterSubmit;
        suppressFilterSubmit = true;
        $root.find('select.search-filter').not('.select2-hidden-accessible').each(function () {
            const $this = $(this);
            $this.select2({
                width: '100%',
                minimumInputLength: getMinimuInputLength($this),
                dropdownParent: $this.closest('.changelist-filter-card'),
            });
        });

        const $mptt = $root.find('.search-filter-mptt').not('.select2-hidden-accessible');
        if ($mptt.length) {
            $mptt.search_filters();
            $mptt.select2({
                width: '100%',
                minimumInputLength: getMinimuInputLength($mptt),
                dropdownParent: $mptt.closest('.changelist-filter-card'),
                templateResult: function (data) {
                    // https://stackoverflow.com/questions/30820215/selectable-optgroups-in-select2#30948247
                    if (!data.element) {
                        return data.text;
                    }
                    const $element = $(data.element);
                    const $wrapper = $('<span></span>');
                    $wrapper.attr('style', $($element[0]).attr('style'));
                    $wrapper.text(data.text);
                    return $wrapper;
                },
            });
        }
        suppressFilterSubmit = previousSuppress;
    }

    $(document).ready(function () {
        // Ensure all raw_id_fields have the search icon in them
        $('.related-lookup').append('<i class="fa fa-search"></i>')

        // Allow for styling of selects
        $('.actions select').addClass('form-control').select2({ width: 'element' });

        $('details.changelist-filter-card').each(function () {
            this.addEventListener('toggle', function () {
                if (this.open) {
                    initFilterSelects($(this));
                }
            });
        });
        restoreOpenFilterCard();

        // Copy the selected control's real query params, then drop the cosmetic inputs.
        // An unset "Any" choice has empty params and must not be submitted as an empty value.
        // The search box still submits only on Enter or the Search button.
        $('#changelist-search').on('submit', function () {
            rememberOpenFilterCard($(this));
            writeFilterParams($(this));
        });

        $('#changelist-search').on('change', '.changelist-filter-input', function () {
            submitFilters(this.form);
        });

        $(document).on('click', '.changelist-filter-clear', function (event) {
            event.preventDefault();
            event.stopPropagation();
            window.location.href = this.getAttribute('href');
        });
    });

})(jQuery);
