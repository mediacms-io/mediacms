const fs = require('fs');
const path = require('path');

function validateDevOptions(options) {
  if (void 0 !== options.config) {
    if ('string' !== typeof options.config) {
      throw Error('Invalid configuration file: ' + options.config);
    }

    options.config = path.resolve(options.config);

    if (!fs.existsSync(options.config)) {
      throw Error('Invalid configuration file: ' + options.config);
    }

    options.config = require(path.resolve(options.config));
  }

  if (void 0 !== options.env) {
    // TODO!
  }

  if (void 0 !== options.host) {
    // TODO!
  }

  if (void 0 !== options.port) {
    // TODO!
  }

  return options;
}

function validateBuildOptions(options) {
  if (void 0 !== options.config) {
    if ('string' !== typeof options.config) {
      throw Error('Invalid configuration file: ' + options.config);
    }

    options.config = path.resolve(options.config);

    if (!fs.existsSync(options.config)) {
      throw Error('Invalid configuration file: ' + options.config);
    }

    options.config = require(path.resolve(options.config));
  }

  if (void 0 !== options.env) {
    // TODO!
  }

  return options;
}

function validateAnalyzerOptions(options) {
  if (void 0 !== options.config) {
    if ('string' !== typeof options.config) {
      throw Error('Invalid configuration file: ' + options.config);
    }

    options.config = path.resolve(options.config);

    if (!fs.existsSync(options.config)) {
      throw Error('Invalid configuration file: ' + options.config);
    }

    options.config = require(path.resolve(options.config));
  }

  if (void 0 !== options.env) {
    // TODO!
  }

  if (void 0 !== options.host) {
    // TODO!
  }

  if (void 0 !== options.port) {
    // TODO!
  }

  if (void 0 !== options.mode) {
    // TODO!
  }

  return options;
}

module.exports = {
  validateDevOptions,
  validateBuildOptions,
  validateAnalyzerOptions,
};
