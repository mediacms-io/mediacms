'use strict';

{
  function initTinyMCE(el) {
    if (el.closest('.empty-form') === null) {  // Don't do empty inlines
      var mce_conf = JSON.parse(el.dataset.mceConf);

      // There is no way to pass a JavaScript function as an option
      // because all options are serialized as JSON.
      const fns = [
        'color_picker_callback',
        'file_browser_callback',
        'file_picker_callback',
        'images_dataimg_filter',
        'images_upload_handler',
        'paste_postprocess',
        'paste_preprocess',
        'setup',
        'urlconverter_callback',
      ];
      fns.forEach((fn_name) => {
        if (typeof mce_conf[fn_name] != 'undefined') {
          if (mce_conf[fn_name].includes('(')) {
            mce_conf[fn_name] = eval('(' + mce_conf[fn_name] + ')');
          }
          else {
            mce_conf[fn_name] = window[mce_conf[fn_name]];
          }
        }
      });

      // replace default prefix of 'empty-form' if used in selector
      if (mce_conf.selector && mce_conf.selector.includes('__prefix__')) {
        mce_conf.selector = `#${el.id}`;
      }
      else if (!('selector' in mce_conf)) {
        mce_conf['target'] = el;
      }
      if (el.dataset.mceGzConf) {
        tinyMCE_GZ.init(JSON.parse(el.dataset.mceGzConf));
      }
      if (!tinyMCE.get(el.id)) {
        tinyMCE.init(mce_conf);
      }
    }
  }

  // Call function fn when the DOM is loaded and ready. If it is already
  // loaded, call the function now.
  function ready(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  function initializeTinyMCE(element, formsetName) {
    Array.from(element.querySelectorAll('.tinymce')).forEach(area => initTinyMCE(area));
  }

  ready(function() {
    if (!tinyMCE) {
      throw 'tinyMCE is not loaded. If you customized TINYMCE_JS_URL, double-check its content.';
    }
    // initialize the TinyMCE editors on load
    initializeTinyMCE(document);

    // initialize the TinyMCE editor after adding an inline in the django admin context.
    if (typeof(django) !== 'undefined' && typeof(django.jQuery) !== 'undefined') {
      django.jQuery(document).on('formset:added', (event, $row, formsetName) => {
        if (event.detail && event.detail.formsetName) {
          // Django >= 4.1
          initializeTinyMCE(event.target);
        } else {
          // Django < 4.1, use $row
          initializeTinyMCE($row.get(0));
        }
      });
    }
  });
}
