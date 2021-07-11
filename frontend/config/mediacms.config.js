const path = require('path');

const rootDir = '..';
const srcDir = rootDir + '/src';
const configDir = srcDir + '/templates/config';
const coreConfigDir = configDir + '/core';
const installConfigDir = configDir + '/installation';

module.exports = {
  src: path.resolve(__dirname, srcDir),
  build: path.resolve(__dirname, rootDir),
  html: require('./mediacms.config.html.js'),
  pages: require('./mediacms.config.pages.js'),
  window: {
    MediaCMS: {
      api: require(coreConfigDir + '/api.config.js'),
      url: require(coreConfigDir + '/url.config.js'),
      user: require(coreConfigDir + '/user.config.js'),
      site: require(installConfigDir + '/site.config.js'),
      pages: require(installConfigDir + '/pages.config.js'),
      contents: require(installConfigDir + '/contents.config.js'),
      features: require(installConfigDir + '/features.config.js'),
      /*notifications: [
          'Message one text',
          'Message two text',
          'Message three text'
      ],*/
    },
  },
  postcssConfigFile: path.resolve(__dirname, './postcss.config.js'),
};
