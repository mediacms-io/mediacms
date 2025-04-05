(function ($) {
    'use strict';

    const $body = $('body');
    const $footer = $('footer');
    const $sidebar_ul = $('aside#jazzy-sidebar nav ul:first-child');
    const $sidebar = $('aside#jazzy-sidebar');
    const $navbar = $('nav#jazzy-navbar');
    const $logo = $('#jazzy-logo');
    const $actions = $('#jazzy-actions');
    const buttons = [
        "primary",
        "secondary",
        "info",
        "warning",
        "danger",
        "success",
    ]
    const darkThemes = ["darkly", "cyborg", "slate", "solar", "superhero"]

    window.ui_changes = window.ui_changes || {'button_classes': {}};

    function miscListeners() {
        $('#footer-fixed').on('click', function () {
            $body.toggleClass('layout-footer-fixed');
            if (this.checked) {
                $('#layout-boxed:checked').click();
            }
            window.ui_changes['footer_fixed'] = this.checked;
        });

        $('#layout-boxed').on('click', function () {
            $body.toggleClass('layout-boxed');

            // We cannot combine these options with layout boxed
            if (this.checked) {
                $('#navbar-fixed:checked').click();
                $('#footer-fixed:checked').click();
            }
            window.ui_changes['layout_boxed'] = this.checked;
        });

        $('#actions-fixed').on('click', function () {
            $actions.toggleClass('sticky-top');
            window.ui_changes['actions_sticky_top'] = this.checked;
        });

        // Colour pickers
        $('#accent-colours div').on('click', function () {
            $(this).removeClass('inactive').addClass('active').parent().find(
                'div'
            ).not(this).removeClass('active').addClass('inactive');

            const newClasses = $(this).data('classes');

            $body.removeClass(function (index, className) {
                return (className.match(/(^|\s)accent-\S+/g) || []).join(' ');
            }).addClass(newClasses);

            window.ui_changes['accent'] = newClasses;
        });

        $('#brand-logo-variants div').on('click', function () {
            $(this).removeClass('inactive').addClass('active').parent().find(
                'div'
            ).not(this).removeClass('active').addClass('inactive');

            let newClasses = $(this).data('classes');

            $logo.removeClass(function (index, className) {
                return (className.match(/(^|\s)navbar-\S+/g) || []).join(' ');
            }).addClass(newClasses);

            if (newClasses === "") {
                newClasses = false;
                $(this).parent().find('div').removeClass('active inactive');
            }

            window.ui_changes['brand_colour'] = newClasses;
        });

        // show code
        $("#codeBox").on('show.bs.modal', function () {
            $('.modal-body code', this).html(
                'JAZZMIN_UI_TWEAKS = ' + JSON.stringify(
                window.ui_changes, null, 4
                ).replace(
                /true/g, 'True'
                ).replace(
                /false/g, 'False'
                ).replace(
                /null/g, 'None'
                )
            );
        });
    }

    function themeSpecificTweaks(theme) {
        if (darkThemes.indexOf(theme) > -1) {
            $('#navbar-variants .bg-dark').click();
            $("#jazzmin-btn-style-primary").val('btn-primary').change();
            $("#jazzmin-btn-style-secondary").val('btn-secondary').change();
            $body.addClass('dark-mode');
        } else {
            $('#navbar-variants .bg-white').click();
            $("#jazzmin-btn-style-primary").val('btn-outline-primary').change();
            $("#jazzmin-btn-style-secondary").val('btn-outline-secondary').change();
            $body.removeClass('dark-mode');
        }
    }

    function themeChooserListeners() {
        // Theme chooser (standard)
        $("#jazzmin-theme-chooser").on('change', function () {
            let $themeCSS = $('#jazzmin-theme');

            // If we are using the default theme, there will be no theme css, just the bundled one in adminlte
            if (!$themeCSS.length) {
                const staticSrc = $('#adminlte-css').attr('href').split('vendor')[0]
                $themeCSS = $('<link>').attr({
                    'href': staticSrc + 'vendor/bootswatch/default/bootstrap.min.css',
                    'rel': 'stylesheet',
                    'id': 'jazzmin-theme'
                }).appendTo('head');
            }

            const currentSrc = $themeCSS.attr('href');
            const currentTheme = currentSrc.split('/')[4];
            let newTheme = $(this).val();

            $themeCSS.attr('href', currentSrc.replace(currentTheme, newTheme));

            $body.removeClass (function (index, className) {
                return (className.match (/(^|\s)theme-\S+/g) || []).join(' ');
            });
            $body.addClass('theme-' + newTheme);

            themeSpecificTweaks(newTheme);

            window.ui_changes['theme'] = newTheme;
        });

        // Theme chooser (dark mode)
        $("#jazzmin-dark-mode-theme-chooser").on('change', function () {
            let $themeCSS = $('#jazzmin-dark-mode-theme');
            // If we are using the default theme, there will be no theme css, just the bundled one in adminlte

            if (this.value === "") {
                $themeCSS.remove();
                window.ui_changes['dark_mode_theme'] = null;
                return
            }

            if (!$themeCSS.length) {
                const staticSrc = $('#adminlte-css').attr('href').split('vendor')[0]
                $themeCSS = $('<link>').attr({
                    'href': staticSrc + 'vendor/bootswatch/darkly/bootstrap.min.css',
                    'rel': 'stylesheet',
                    'id': 'jazzmin-dark-mode-theme',
                    'media': '(prefers-color-scheme: dark)'
                }).appendTo('head');
            }

            const currentSrc = $themeCSS.attr('href');
            const currentTheme = currentSrc.split('/')[4];
            const newTheme = $(this).val();

            $themeCSS.attr('href', currentSrc.replace(currentTheme, newTheme));

            themeSpecificTweaks(newTheme);

            window.ui_changes['dark_mode_theme'] = newTheme;
        });
    }

    function navBarTweaksListeners() {
        $('#navbar-fixed').on('click', function () {
            $body.toggleClass('layout-navbar-fixed');
            if (this.checked) {$('#layout-boxed:checked').click();}
            window.ui_changes['navbar_fixed'] = this.checked;
        });

        $('#no-navbar-border').on('click', function () {
            $navbar.toggleClass('border-bottom-0');
            window.ui_changes['no_navbar_border'] = $navbar.hasClass('border-bottom-0');
        });

        // Colour picker
        $('#navbar-variants div').on('click', function () {
            $(this).removeClass('inactive').addClass('active').parent().find(
                'div'
            ).not(this).removeClass('active').addClass('inactive');

            const newClasses = $(this).data('classes');

            $navbar.removeClass(function (index, className) {
                return (className.match(/(^|\s)navbar-\S+/g) || []).join(' ');
            }).addClass('navbar-expand ' + newClasses);

            window.ui_changes['navbar'] = newClasses;
        });
    }

    function sideBarTweaksListeners() {
        $('#sidebar-nav-flat-style').on('click', function () {
            $sidebar_ul.toggleClass('nav-flat');
            window.ui_changes['sidebar_nav_flat_style'] = this.checked;
        });

        $('#sidebar-nav-legacy-style').on('click', function () {
            $sidebar_ul.toggleClass('nav-legacy');
            window.ui_changes['sidebar_nav_legacy_style'] = this.checked;
        });

        $('#sidebar-nav-compact').on('click', function () {
            $sidebar_ul.toggleClass('nav-compact');
            window.ui_changes['sidebar_nav_compact_style'] = this.checked;
        });

        $('#sidebar-nav-child-indent').on('click', function () {
            $sidebar_ul.toggleClass('nav-child-indent');
            window.ui_changes['sidebar_nav_child_indent'] = this.checked;
        });

        $('#main-sidebar-disable-hover-focus-auto-expand').on('click', function () {
            $sidebar.toggleClass('sidebar-no-expand');
            window.ui_changes['sidebar_disable_expand'] = this.checked;
        });

        $('#sidebar-fixed').on('click', function () {
            $body.toggleClass('layout-fixed');
            window.ui_changes['sidebar_fixed'] = this.checked;
        });

        // Colour pickers
        $('#dark-sidebar-variants div, #light-sidebar-variants div').on('click', function () {
            $(this).removeClass('inactive').addClass('active').parent().find(
                'div'
            ).not(this).removeClass('active').addClass('inactive');

            const newClasses = $(this).data('classes');

            $sidebar.removeClass(function (index, className) {
                return (className.match(/(^|\s)sidebar-[\S|-]+/g) || []).join(' ');
            }).addClass(newClasses);

            window.ui_changes['sidebar'] = newClasses.trim();
        });
    }

    function smallTextListeners() {
        $('#navbar-small-text').on('click', function () {
            $navbar.toggleClass('text-sm');
            window.ui_changes['navbar_small_text'] = this.checked;
        });

        $('#brand-small-text').on('click', function () {
            $logo.toggleClass('text-sm');
            window.ui_changes['brand_small_text'] = this.checked;
        });

        $('#body-small-text').on('click', function () {
            $body.toggleClass('text-sm');
            window.ui_changes['body_small_text'] = this.checked;
            const $smallTextControls = $('#navbar-small-text, #brand-small-text, #footer-small-text, #sidebar-nav-small-text');
            if (this.checked) {
                window.ui_changes['navbar_small_text'] = false;
                window.ui_changes['brand_small_text'] = false;
                window.ui_changes['footer_small_text'] = false;
                window.ui_changes['sidebar_nav_small_text'] = false;
                $smallTextControls.prop({'checked': false, 'disabled': 'disabled'});
            } else {
                $smallTextControls.prop({'checked': false, 'disabled': ''});
            }
        });

        $('#footer-small-text').on('click', function () {
            $footer.toggleClass('text-sm');
            window.ui_changes['footer_small_text'] = this.checked;
        });

        $('#sidebar-nav-small-text').on('click', function () {
            $sidebar_ul.toggleClass('text-sm');
            window.ui_changes['sidebar_nav_small_text'] = this.checked;
        });
    }

    function buttonStyleListeners() {
        buttons.forEach(function(btn) {
            $("#jazzmin-btn-style-" + btn).on('change', function () {
                const btnClasses = ['btn-' + btn, 'btn-outline-' + btn];
                const selectorClasses = '.btn-' + btn + ', .btn-outline-' + btn;
                $(selectorClasses).removeClass(btnClasses).addClass(this.value);
                window.ui_changes['button_classes'][btn] = this.value;
            });
        });
    }

    function setFromExisting() {
        $('#jazzmin-theme-chooser').val(window.ui_changes['theme']);
        $('#jazzmin-dark-mode-theme-chooser').val(window.ui_changes['dark_mode_theme']);
        $('#theme-condition').val(window.ui_changes['theme_condition']);
        $('#body-small-text').get(0).checked = window.ui_changes['body_small_text'];
        $('#footer-small-text').get(0).checked = window.ui_changes['footer_small_text'];
        $('#sidebar-nav-small-text').get(0).checked = window.ui_changes['sidebar_nav_small_text'];
        $('#sidebar-nav-legacy-style').get(0).checked = window.ui_changes['sidebar_nav_legacy_style'];
        $('#sidebar-nav-compact').get(0).checked = window.ui_changes['sidebar_nav_compact_style'];
        $('#sidebar-nav-child-indent').get(0).checked = window.ui_changes['sidebar_nav_child_indent'];
        $('#main-sidebar-disable-hover-focus-auto-expand').get(0).checked = window.ui_changes['sidebar_disable_expand'];
        $('#no-navbar-border').get(0).checked = window.ui_changes['no_navbar_border'];
        $('#navbar-small-text').get(0).checked = window.ui_changes['navbar_small_text'];
        $('#brand-small-text').get(0).checked = window.ui_changes['brand_small_text'];

        // deactivate colours
        $('#navbar-variants div, #accent-colours div, #dark-sidebar-variants div, #light-sidebar-variants div, #brand-logo-variants div').addClass('inactive');

        // set button styles
        buttons.forEach(function(btn) {
            $("#jazzmin-btn-style-" + btn).val(window.ui_changes['button_classes'][btn]);
        });

        // set colours
        $('#navbar-variants div[data-classes="' + window.ui_changes['navbar'] + '"]').addClass('active');
        $('#accent-colours div[data-classes="' + window.ui_changes['accent'] + '"]').addClass('active');
        $('#dark-sidebar-variants div[data-classes="' + window.ui_changes['sidebar'] + '"]').addClass('active');
        $('#light-sidebar-variants div[data-classes="' + window.ui_changes['sidebar'] + '"]').addClass('active');
        $('#brand-logo-variants div[data-classes="' + window.ui_changes['brand_colour'] + '"]').addClass('active');
    }

    /*
     Don't call if it is inside an iframe
     */
    if (!$body.hasClass("popup")) {
        setFromExisting();
        themeChooserListeners();
        miscListeners();
        navBarTweaksListeners();
        sideBarTweaksListeners();
        smallTextListeners();
        buttonStyleListeners();
    }

})(jQuery);
