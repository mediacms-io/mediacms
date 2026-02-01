define(["exports"], function (_exports) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.configure = void 0;
  var configure = _exports.configure = function configure(instanceConfig) {
    return {
      mediacmsurl: instanceConfig.mediacmsurl,
      launchUrl: instanceConfig.launchUrl,
      lti: instanceConfig.lti
    };
  };
});