(function($) {
    'use strict';

    function setCookie(key, value) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (value * 24 * 60 * 60 * 1000));
        document.cookie = key + '=' + value + ';expires=' + expires.toUTCString() + '; SameSite=Strict;path=/';
    }

    function getCookie(key) {
        const keyValue = document.cookie.match('(^|;) ?' + key + '=([^;]*)(;|$)');
        return keyValue ? keyValue[2] : null;
    }

    function handleMenu() {
        $('[data-widget=pushmenu]').bind('click', function () {
            const menuClosed = getCookie('jazzy_menu') === 'closed';
            if (!menuClosed) {
                setCookie('jazzy_menu', 'closed');
            } else {
                setCookie('jazzy_menu', 'open');
            }
        });
    }


    function setActiveLinks() {
        /*
         Set the currently active menu item based on the current url, or failing that, find the parent
         item from the breadcrumbs
         */
        const url = window.location.pathname;
        const $breadcrumb = $('.breadcrumb a').last();
        const $link = $('a[href="' + url + '"]');
        const $parent_link = $('a[href="' + $breadcrumb.attr('href') + '"]');

        if ($link.length) {
            $link.addClass('active');
        } else if ($parent_link.length) {
            $parent_link.addClass('active');
        };

        const $a_active = $('a.nav-link.active');
        const $main_li_parent = $a_active.closest('li.nav-item.has-treeview');
        const $ul_child = $main_li_parent.children('ul');

        $ul_child.show();
        $main_li_parent.addClass('menu-is-opening menu-open');
    };

    function hideClippedTooltips() {
        $('.changelist-clipped-text__full.is-open').removeClass('is-open').removeAttr('style');
    }

    function placeClippedTooltip(host) {
        const $host = $(host);
        const $tip = $host.children('.changelist-clipped-text__full');
        const preview = $host.children('.changelist-clipped-text__preview')[0];
        if (!$tip.length || !preview) {
            return;
        }
        hideClippedTooltips();
        $tip.addClass('is-open').css({
            position: 'fixed',
            pointerEvents: 'none',
            width: 'auto',
            maxWidth: 'none',
            left: '0px',
            top: '0px',
        });
        const anchor = preview.getBoundingClientRect();
        const width = Math.min(Math.max(anchor.width, 160), window.innerWidth - 16);
        $tip.css({ width: width + 'px', maxWidth: width + 'px' });
        const tipHeight = $tip.outerHeight();
        const tipWidth = $tip.outerWidth();
        const gap = 6;
        let top = anchor.top - tipHeight - gap;
        if (top < 8) {
            top = Math.min(anchor.bottom + gap, window.innerHeight - tipHeight - 8);
        }
        let left = anchor.left;
        if (left + tipWidth > window.innerWidth - 8) {
            left = Math.max(8, anchor.right - tipWidth);
        }
        if (left < 8) {
            left = 8;
        }
        $tip.css({ top: top + 'px', left: left + 'px' });
    }

    $(document).ready(function () {
        // Set active status on links
        setActiveLinks()

        $(document).on('mouseenter', '.changelist-clipped-text', function () {
            placeClippedTooltip(this);
        });
        $(document).on('mouseleave', '.changelist-clipped-text', function () {
            hideClippedTooltips();
        });
        $(document).on('focusin', 'a, td', function () {
            const host = this.querySelector('.changelist-clipped-text');
            if (host) {
                placeClippedTooltip(host);
            }
        });
        $(document).on('focusout', 'a, td', function () {
            if (this.querySelector('.changelist-clipped-text')) {
                hideClippedTooltips();
            }
        });
        document.addEventListener('scroll', hideClippedTooltips, true);
        $(window).on('resize', hideClippedTooltips);

        // When we use the menu, store its state in a cookie to preserve it
        handleMenu();

        // Add minimal changelist styling to templates that we have been unable to override (e.g MPTT)
        // Needs to be here and not in change_list.js because this is the only JS we are guaranteed to run
        // (as its included in base.html)
        const $changeListTable = $('#changelist .results table');
        if ($changeListTable.length && !$changeListTable.hasClass('table table-striped')) {
            $changeListTable.addClass('table table-striped');
        };
    });

})(jQuery);
