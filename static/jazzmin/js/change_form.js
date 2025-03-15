(function($) {
    'use strict';

    function FixSelectorHeight() {
        $('.selector .selector-chosen').each(function () {
            let selector_chosen = $(this);
            let selector_available = selector_chosen.siblings('.selector-available');

            let selector_chosen_select = selector_chosen.find('select').first();
            let selector_available_select = selector_available.find('select').first();
            let selector_available_filter = selector_available.find('p.selector-filter').first();

            selector_chosen_select.height(selector_available_select.height() + selector_available_filter.outerHeight());
            selector_chosen_select.css('border-top', selector_chosen_select.css('border-bottom'));
        });
    }

    function handleCarousel($carousel) {
        const errors = $('.errorlist li', $carousel);
        const hash = document.location.hash;

        // If we have errors, open that tab first
        if (errors.length) {
            const errorCarousel = errors.eq(0).closest('.carousel-item');
            $carousel.carousel(errorCarousel.data('carouselid'));
            $('.carousel-fieldset-label', $carousel).text(errorCarousel.data()["label"]);
        } else if (hash) {
            // If we have a tab hash, open that
            const activeCarousel = $('.carousel-item[data-target="' + hash + '"]', $carousel);
            $carousel.carousel(activeCarousel.data()["carouselid"]);
            $('.carousel-fieldset-label', $carousel).text(activeCarousel.data()["label"]);
        }

        // Update page hash/history on slide
        $carousel.on('slide.bs.carousel', function (e) {

            FixSelectorHeight();
            // call resize in change view after tab switch
            window.dispatchEvent(new Event('resize'));

            if (e.relatedTarget.dataset.hasOwnProperty("label")) {
                $('.carousel-fieldset-label', $carousel).text(e.relatedTarget.dataset.label);
            }
            const hash = e.relatedTarget.dataset.target;

            if (history.pushState) {
                history.pushState(null, null, hash);
            } else {
                location.hash = hash;
            }
        });
    }

    function handleTabs($tabs) {
        const errors = $('.change-form .errorlist li');
        const hash = document.location.hash;

        // If we have errors, open that tab first
        if (errors.length) {
            const tabId = errors.eq(0).closest('.tab-pane').attr('id');
            $('a[href="#' + tabId + '"]').tab('show');
        } else if (hash) {
            // If we have a tab hash, open that
            $('a[href="' + hash + '"]', $tabs).tab('show');
        }

        // Change hash for page-reload
        $('a', $tabs).on('shown.bs.tab', function (e) {

            FixSelectorHeight();
            // call resize in change view after tab switch
            window.dispatchEvent(new Event('resize'));

            e.preventDefault();
            if (history.pushState) {
                history.pushState(null, null, e.target.hash);
            } else {
                location.hash = e.target.hash;
            }
        });
    }

    function handleCollapsible($collapsible) {
        const errors = $('.errorlist li', $collapsible);
        const hash = document.location.hash;

        // If we have errors, open that tab first
        if (errors.length) {
            $('.panel-collapse', $collapsible).collapse('hide');
            errors.eq(0).closest('.panel-collapse').collapse('show');

        } else if (hash) {
            // If we have a tab hash, open that
            $('.panel-collapse', $collapsible).collapse('hide');
            $(hash, $collapsible).collapse('show');
        }

        // Change hash for page-reload
        $collapsible.on('shown.bs.collapse', function (e) {

            FixSelectorHeight();
            // call resize in change view after tab switch
            window.dispatchEvent(new Event('resize'));

            if (history.pushState) {
                history.pushState(null, null, '#' + e.target.id);
            } else {
                location.hash = '#' + e.target.id;
            }
        });
    }

    function applySelect2() {
        // Apply select2 to any select boxes that don't yet have it
        // and are not part of the django's empty-form inline
        const noSelect2 = '.empty-form select, .select2-hidden-accessible, .selectfilter, .selector-available select, .selector-chosen select, select[data-autocomplete-light-function=select2]';
        $('select').not(noSelect2).select2({ width: 'element' });
    }

    $(document).ready(function () {
        const $carousel = $('#content-main form #jazzy-carousel');
        const $tabs = $('#content-main form #jazzy-tabs');
        const $collapsible = $('#content-main form #jazzy-collapsible');

        // Ensure all raw_id_fields have the search icon in them
        $('.related-lookup').append('<i class="fa fa-search"></i>');

        // Style the inline fieldset button
        $('.inline-related fieldset.module .add-row a').addClass('btn btn-sm btn-default float-right');
        $('div.add-row>a').addClass('btn btn-sm btn-default float-right');

        // Ensure we preserve the tab the user was on using the url hash, even on page reload
        if ($tabs.length) { handleTabs($tabs); }
        else if ($carousel.length) { handleCarousel($carousel); }
        else if ($collapsible.length) { handleCollapsible($collapsible); }

        applySelect2();

        $('body').on('change', '.related-widget-wrapper select', function(e) {
            const event = $.Event('django:update-related');
            $(this).trigger(event);
            if (!event.isDefaultPrevented() && typeof(window.updateRelatedObjectLinks) !== 'undefined') {
                updateRelatedObjectLinks(this);
            }
        });
    });

    // Apply select2 to all select boxes when new inline row is created
    django.jQuery(document).on('formset:added', applySelect2);

})(jQuery);
