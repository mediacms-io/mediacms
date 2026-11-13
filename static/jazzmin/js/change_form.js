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

    function labelSelect2SearchFields($select) {
        // Select2's multi-select search control is a <textarea> with neither id nor
        // name; Chrome flags that as an autofill warning. Tie it to the <select>.
        const selectId = $select.attr('id');
        if (!selectId) {
            return;
        }
        $select.next('.select2-container').find('.select2-search__field').each(function (index) {
            const $field = $(this);
            if ($field.attr('id') || $field.attr('name')) {
                return;
            }
            $field.attr('id', selectId + '-select2-search' + (index ? '-' + index : ''));
        });
    }

    function applySelect2() {
        // Apply select2 to any select boxes that don't yet have it
        // and are not part of the django's empty-form inline
        const noSelect2 = '.empty-form select, .select2-hidden-accessible, .selectfilter, .selector-available select, .selector-chosen select, select[data-autocomplete-light-function=select2]';
        $('select').not(noSelect2).each(function () {
            const $select = $(this);
            $select.select2({ width: 'element' });
            labelSelect2SearchFields($select);
            $select.off('select2:open.jazzminSearchId').on('select2:open.jazzminSearchId', function () {
                // Dropdown search fields are created on open (single selects / autocomplete).
                window.setTimeout(function () {
                    labelSelect2SearchFields($select);
                    const selectId = $select.attr('id');
                    if (!selectId) {
                        return;
                    }
                    $('.select2-container--open .select2-search__field').each(function (index) {
                        const $field = $(this);
                        if ($field.attr('id') || $field.attr('name')) {
                            return;
                        }
                        $field.attr('id', selectId + '-select2-dropdown-search' + (index ? '-' + index : ''));
                    });
                }, 0);
            });
        });
    }

    $(document).ready(function () {
        const $carousel = $('#content-main form #jazzy-carousel');
        const $tabs = $('#content-main form #jazzy-tabs');
        const $collapsible = $('#content-main form #jazzy-collapsible');

        // Ensure all raw_id_fields have the search icon in them
        $('.related-lookup').each(function () {
            const $link = $(this);
            if ($link.find('.fa-search').length) {
                return;
            }
            $link.append($('<i>', {'class': 'fas fa-search', 'aria-hidden': 'true'}));
            $link.append(document.createTextNode(' ' + ($link.attr('title') || 'Lookup')));
        });

        function labelDateTimeIcons() {
            document.querySelectorAll('.date-icon, .clock-icon').forEach(function (icon) {
                const link = icon.closest('a');
                if (!link || link.dataset.labeled) {
                    return;
                }
                const label = icon.getAttribute('title');
                if (!label) {
                    return;
                }
                link.dataset.labeled = '1';
                link.append(document.createTextNode(' ' + label));
            });
        }
        labelDateTimeIcons();
        $(window).on('load', labelDateTimeIcons);

        // Style the inline fieldset button
        $('.inline-related fieldset.module .add-row a').addClass('btn btn-sm btn-default float-right');
        $('div.add-row>a').addClass('btn btn-sm btn-default float-right');

        // Ensure we preserve the tab the user was on using the url hash, even on page reload
        if ($tabs.length) { handleTabs($tabs); }
        else if ($carousel.length) { handleCarousel($carousel); }
        else if ($collapsible.length) { handleCollapsible($collapsible); }

        function bindImageDropzones() {
            document.querySelectorAll('.image-dropzone').forEach(function (zone) {
                if (zone.dataset.dropBound) {
                    return;
                }
                const input = zone.querySelector('input[type="file"]');
                if (!input) {
                    return;
                }
                zone.dataset.dropBound = '1';

                function showChosenName(file) {
                    const prompt = zone.querySelector('.file-dropzone__prompt');
                    if (!prompt || !file) {
                        return;
                    }
                    let name = zone.querySelector('.file-dropzone__chosen');
                    if (!name) {
                        name = document.createElement('span');
                        name.className = 'file-dropzone__chosen';
                        prompt.after(name);
                    }
                    name.textContent = file.name;
                }

                function showPreview(file) {
                    showChosenName(file);
                    if (!file || !file.type || file.type.indexOf('image/') !== 0) {
                        return;
                    }
                    let img = zone.querySelector('.image-dropzone__preview');
                    if (!img) {
                        img = document.createElement('img');
                        img.className = 'image-dropzone__preview';
                        img.alt = '';
                        zone.insertBefore(img, zone.firstChild);
                    }
                    img.src = URL.createObjectURL(file);
                }

                ['dragenter', 'dragover'].forEach(function (eventName) {
                    zone.addEventListener(eventName, function (event) {
                        event.preventDefault();
                        zone.classList.add('is-dragover');
                    });
                });
                ['dragleave', 'drop'].forEach(function (eventName) {
                    zone.addEventListener(eventName, function (event) {
                        event.preventDefault();
                        zone.classList.remove('is-dragover');
                    });
                });
                zone.addEventListener('drop', function (event) {
                    if (!event.dataTransfer || !event.dataTransfer.files.length) {
                        return;
                    }
                    input.files = event.dataTransfer.files;
                    showPreview(input.files[0]);
                });
                input.addEventListener('change', function () {
                    if (input.files && input.files.length) {
                        showPreview(input.files[0]);
                    }
                });
            });
        }
        bindImageDropzones();

        function formatThumbnailClock(seconds) {
            let tenths = Math.round(Number(seconds) * 10);
            if (!Number.isFinite(tenths) || tenths < 0) {
                return '';
            }
            const frac = tenths % 10;
            let whole = Math.floor(tenths / 10);
            const hours = Math.floor(whole / 3600);
            whole -= hours * 3600;
            const minutes = Math.floor(whole / 60);
            const secs = whole - minutes * 60;
            const pad = function (number) {
                return String(number).padStart(2, '0');
            };
            return pad(hours) + ':' + pad(minutes) + ':' + pad(secs) + '.' + frac;
        }

        function parseThumbnailClock(text) {
            const value = (text || '').trim();
            if (!value) {
                return null;
            }
            if (value.indexOf(':') === -1) {
                const number = Number(value);
                return Number.isFinite(number) ? Math.round(number * 10) / 10 : null;
            }
            const parts = value.split(':');
            if (parts.length < 2 || parts.length > 3) {
                return null;
            }
            const seconds = Number(parts[parts.length - 1]);
            const minutes = Number(parts[parts.length - 2]);
            const hours = parts.length === 3 ? Number(parts[0]) : 0;
            if (![seconds, minutes, hours].every(Number.isFinite)) {
                return null;
            }
            if (minutes < 0 || minutes > 59 || seconds < 0 || seconds >= 60 || hours < 0) {
                return null;
            }
            return Math.round((hours * 3600 + minutes * 60 + seconds) * 10) / 10;
        }

        function bindThumbnailTimes() {
            document.querySelectorAll('.thumbnail-time').forEach(function (zone) {
                if (zone.dataset.timeBound) {
                    return;
                }
                const input = zone.querySelector('input');
                if (!input) {
                    return;
                }
                zone.dataset.timeBound = '1';
                const duration = Number(zone.dataset.duration);
                const max = Number.isFinite(duration) && duration > 0 ? Math.round(duration * 10) / 10 : 0;
                zone.querySelectorAll('.thumbnail-time__step').forEach(function (button) {
                    button.addEventListener('click', function () {
                        const step = Number(button.dataset.step);
                        const current = parseThumbnailClock(input.value);
                        let next = Math.round(((current == null ? 0 : current) + step) * 10) / 10;
                        if (next <= 0) {
                            input.value = '';
                            return;
                        }
                        if (max && next > max) {
                            next = max;
                        }
                        input.value = formatThumbnailClock(next);
                    });
                });
            });
        }
        bindThumbnailTimes();

        function fallbackCopy(value) {
            const area = document.createElement('textarea');
            area.value = value;
            area.setAttribute('readonly', '');
            area.style.position = 'fixed';
            area.style.left = '-9999px';
            document.body.appendChild(area);
            area.select();
            let ok = false;
            try {
                ok = document.execCommand('copy');
            } catch (error) {
                ok = false;
            }
            document.body.removeChild(area);
            return ok;
        }

        document.querySelectorAll('.admin-copy-value__button').forEach(function (button) {
            button.addEventListener('click', function () {
                const value = button.getAttribute('data-copy-value') || '';
                const copied = button.getAttribute('data-copied-label') || 'Copied';
                const copy = button.getAttribute('data-copy-label') || 'Copy';
                const done = function () {
                    button.setAttribute('title', copied);
                    button.setAttribute('aria-label', copied);
                    window.setTimeout(function () {
                        button.setAttribute('title', copy);
                        button.setAttribute('aria-label', copy);
                    }, 1500);
                };
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(value).then(done).catch(function () {
                        if (fallbackCopy(value)) {
                            done();
                        }
                    });
                    return;
                }
                if (fallbackCopy(value)) {
                    done();
                }
            });
        });

        applySelect2();

        function syncLicenseInspect(select) {
            const wrapper = select.closest('.related-widget-wrapper');
            if (!wrapper) {
                return;
            }
            const link = wrapper.querySelector('a.license-inspect');
            if (!link) {
                return;
            }
            const template = link.getAttribute('data-href-template') || '';
            const value = select.value;
            if (value) {
                link.href = template.replace('__fk__', value);
                link.hidden = false;
                link.removeAttribute('aria-disabled');
            } else {
                link.removeAttribute('href');
                link.hidden = true;
                link.setAttribute('aria-disabled', 'true');
            }
        }

        function equalizeCategoryImageCards() {
            document.querySelectorAll('.category-image-cards').forEach(function (grid) {
                const cards = grid.querySelectorAll(':scope > .media-image-card');
                if (cards.length < 2) {
                    return;
                }
                cards.forEach(function (card) {
                    card.style.minHeight = '';
                });
                let tallest = 0;
                cards.forEach(function (card) {
                    tallest = Math.max(tallest, card.offsetHeight);
                });
                const height = tallest + 'px';
                cards.forEach(function (card) {
                    card.style.minHeight = height;
                });
            });
        }

        equalizeCategoryImageCards();
        window.addEventListener('resize', equalizeCategoryImageCards);
        document.querySelectorAll('.category-image-cards img').forEach(function (img) {
            img.addEventListener('load', equalizeCategoryImageCards);
        });

        document.querySelectorAll('.related-widget-wrapper select').forEach(syncLicenseInspect);
        $('body').on('change', '.related-widget-wrapper select', function(e) {
            syncLicenseInspect(this);
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
