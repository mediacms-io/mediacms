define(["exports", "./common"], function (_exports, _common) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.register = _exports.getMediaCMSUrl = _exports.getLti = _exports.getLaunchUrl = void 0;
  var register = _exports.register = function register(editor) {
    var registerOption = editor.options.register;
    registerOption("".concat(_common.component, ":mediacmsurl"), {
      processor: 'string',
      default: ''
    });
    registerOption("".concat(_common.component, ":launchUrl"), {
      processor: 'string',
      default: ''
    });
    registerOption("".concat(_common.component, ":lti"), {
      processor: 'object',
      default: {}
    });
  };
  var getMediaCMSUrl = _exports.getMediaCMSUrl = function getMediaCMSUrl(editor) {
    return editor.options.get("".concat(_common.component, ":mediacmsurl"));
  };
  var getLaunchUrl = _exports.getLaunchUrl = function getLaunchUrl(editor) {
    return editor.options.get("".concat(_common.component, ":launchUrl"));
  };
  var getLti = _exports.getLti = function getLti(editor) {
    return editor.options.get("".concat(_common.component, ":lti"));
  };
});