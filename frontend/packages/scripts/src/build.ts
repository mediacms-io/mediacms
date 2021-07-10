const isAbsolutePath = require('path').isAbsolute;

const webpack = require('webpack');
const webpackFormatMessages = require('webpack-format-messages');

import { config as defaultConfig } from '../lib/config';

import { BuildOptionsType } from '../lib/interfaces/OptionsTypes';

import { config as buildWebpackConfig } from '../lib/.webpack/build.config';
import { config as distWebpackConfig } from '../lib/.webpack/dist.config';

import generateConfig from '../lib/webpack-helpers/generateConfig';

const defaultOptions: BuildOptionsType = {
  env: 'production',
  config: defaultConfig,
};

export function build(buildOptions: BuildOptionsType = defaultOptions): void {
  const options: BuildOptionsType = { ...defaultOptions, ...buildOptions };

  options.config = { ...defaultOptions.config, ...buildOptions.config };

  if (!isAbsolutePath(options.config.src)) {
    throw Error('"src" is not an absolute path');
  }

  if (!isAbsolutePath(options.config.build)) {
    throw Error('"build" is not an absolute path');
  }

  if (!isAbsolutePath(options.config.postcssConfigFile)) {
    throw Error('"postcssConfigFile" is not an absolute path');
  }

  const config = generateConfig(options.env, options.config);

  const compiler =
    'dist' === options.env
      ? webpack({ ...distWebpackConfig, ...config })
      : webpack({ ...buildWebpackConfig, ...config });

  compiler.run((err?: Error, stats?: any) => {
    if (err) throw err;

    const messages = webpackFormatMessages(stats);

    if (!messages.errors.length && !messages.warnings.length) {
      console.log('Compiled successfully!', '\n');
    }

    if (messages.errors.length) {
      console.log('Failed to compile.', '\n');

      for (const m of messages.errors) {
        console.log(m);
      }
    } else if (messages.warnings.length) {
      console.log('Compiled with warnings.', '\n');

      for (const m of messages.warnings) {
        console.log(m);
      }
    }
  });
}
