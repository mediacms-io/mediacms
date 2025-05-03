(function($) {
    'use strict';

    let relatedModalCounter = 0;

    function checkIfInIframe() {
        return window.top !== window.self;
    }

    // create the function that will close the modal
    function dismissModal() {
        if (checkIfInIframe()) {
            const parentWindow = window.parent;
            parentWindow.dismissModal();
            return;
        }

        $('.related-modal-' + relatedModalCounter).modal('hide');

        relatedModalCounter-=1;
    }

    // create the function that will show the modal
    function showModal(title, body, e) {
        if (checkIfInIframe()) {
            const parentWindow = window.parent;
            parentWindow.showModal(title, body, e);
            return;
        }

        relatedModalCounter+=1;


        $.showModal({
            title: title,
            body: body,
            backdrop: false,
            modalDialogClass: "modal-dialog-centered modal-lg",
            modalClass: "fade modal-wide related-modal-" + relatedModalCounter,
            onDispose: function() {
                // add focus to the previous modal (if exists) when the current one is closed
                var lastModal = $("div[class*='related-modal-']").last();
                if (lastModal) {
                        lastModal.focus();
                    }
                }
        });

        const modalEl = $("div[class*='related-modal-']");
        const iframeEl = modalEl.find('#related-modal-iframe');

        if (e.data.lookup === true) {
            // set current window as iframe opener because
            // the callback is called on the opener window
            iframeEl.on('load', function() {
                const iframeObj = $(this).get(0);
                const iframeWindow = iframeObj.contentWindow;
                iframeWindow.opener = window;
            });
        }
    }

    function dismissRelatedLookupModal(win, chosenId) {
        const windowName = win.name;
        const widgetName = windowName.replace(/^(change|add|delete|lookup)_/, '');
        let widgetEl;

        if (checkIfInIframe) {
            // select second to last iframe in the main parent document
            const secondLastIframe = $('iframe.related-iframe', win.parent.document).eq(-2);
            let documentContext;

            // if second to last iframe exists get its contents
            if (secondLastIframe.length) {
                documentContext = secondLastIframe.contents();

            // else get main parent document
            } else {
                documentContext = $(win.parent.document);
            }

            // find and select widget from the specified document context
            widgetEl = documentContext.find('#' + widgetName);

        // else select widget from the main document
        } else {
            widgetEl = $('#' + widgetName);
        }

        const widgetVal = widgetEl.val();
        if (widgetEl.hasClass('vManyToManyRawIdAdminField') && Boolean(widgetVal)) {
            widgetEl.val(widgetVal + ', ' + chosenId);
        } else {
            widgetEl.val(chosenId);
        }
        dismissModal();
    }

    // assign functions to global variables
    window.dismissRelatedObjectModal = dismissModal;
    window.dismissRelatedLookupPopup = dismissRelatedLookupModal;
    window.showModal = showModal;

    function presentRelatedObjectModal(e) {
        let linkEl = $(this);
        let href = (linkEl.attr('href') || '');

        if (href === '') {
            return;
        }

        // open the popup as modal
        e.preventDefault();
        e.stopImmediatePropagation();

        // remove focus from clicked link
        linkEl.blur();

        // use the clicked link id as iframe name
        // it will be available as window.name in the loaded iframe
        let iframeName = linkEl.attr('id');
        let iframeSrc = href;
        const modalTitle = linkEl.attr('title');

        if (e.data.lookup !== true) {
            // browsers stop loading nested iframes having the same src url
            // create a random parameter and append it to the src url to prevent it
            // this workaround doesn't work with related lookup url
            let iframeSrcRandom = String(Math.round(Math.random() * 999999));
            if (iframeSrc.indexOf('?') === -1) {
                iframeSrc += '?_modal=' + iframeSrcRandom;
            } else {
                iframeSrc += '&_modal=' + iframeSrcRandom;
            }
        }

        if (iframeSrc.indexOf('_popup=1') === -1) {
            if (iframeSrc.indexOf('?') === -1) {
                iframeSrc += '?_popup=1';
            } else {
                iframeSrc += '&_popup=1';
            }
        }

        // build the iframe html
        let iframeHTML = '<iframe id="related-modal-iframe" name="' + iframeName + '" src="' + iframeSrc + '" frameBorder="0" class="related-iframe"></iframe>';

        // the modal css class
        let iframeInternalModalClass = 'related-modal';

        // if the current window is inside an iframe, it means that it is already in a modal,
        // append an additional css class to the modal to offer more customization
        if (window.top !== window.self) {
            iframeInternalModalClass += ' related-modal__nested';
        }

        // open the modal using dynamic bootstrap modal
        showModal(modalTitle, iframeHTML, e);

        return false;
    }

    // listen click events on related links
    function presentRelatedObjectModalOnClickOn(selector, lookup) {
        let el = $(selector);
        el.removeAttr('onclick');
        el.unbind('click');
        el.click({lookup: lookup}, presentRelatedObjectModal);
    }

    function init() {
        presentRelatedObjectModalOnClickOn('a.related-widget-wrapper-link', false);

        // raw_id_fields support
        presentRelatedObjectModalOnClickOn('a.related-lookup', true);

        // django-dynamic-raw-id support - #61
        // https://github.com/lincolnloop/django-dynamic-raw-id
        presentRelatedObjectModalOnClickOn('a.dynamic_raw_id-related-lookup', true);
    }

    $(document).ready(function(){
        init()
    });

    django.jQuery(document).on('formset:added', init);

})(jQuery);
