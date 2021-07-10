const isAbsolutePath = require('path').isAbsolute;

const webpack = require('webpack');
const webpackFormatMessages = require('webpack-format-messages');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

import { config as defaultConfig } from '../lib/config';

import { AnalyzerOptionsType } from '../lib/interfaces/OptionsTypes';

import { config as buildWebpackConfig } from '../lib/.webpack/build.config';
import { config as distWebpackConfig } from '../lib/.webpack/dist.config';

import generateConfig from '../lib/webpack-helpers/generateConfig';

const defaultOptions: AnalyzerOptionsType = {
  env: 'production',
  host: '127.0.0.1',
  port: 8888,
  mode: 'static',
  config: defaultConfig,
};

export function analyzer(analyzerOptions: AnalyzerOptionsType = defaultOptions): void {
  const options: AnalyzerOptionsType = { ...defaultOptions, ...analyzerOptions };

  options.config = { ...defaultOptions.config, ...analyzerOptions.config };

  const config = generateConfig(options.env, options.config);

  if (!isAbsolutePath(options.config.src)) {
    throw Error('"src" is not an absolute path');
  }

  if (!isAbsolutePath(options.config.build)) {
    throw Error('"build" is not an absolute path');
  }

  if (!isAbsolutePath(options.config.postcssConfigFile)) {
    throw Error('"postcssConfigFile" is not an absolute path');
  }

  const analyzerConfig = {
    analyzerMode: options.mode,
    analyzerHost: options.host,
    analyzerPort: options.port,
    generateStatsFile: 'server' !== options.mode,
    startAnalyzer: 'server' === options.mode,
    statsFilename: 'analyzer-stats.json',
    reportFilename: 'analyzer-report.html',
  };

  const compiler =
    'dist' === options.env
      ? webpack({ ...distWebpackConfig, ...config })
      : webpack({ ...buildWebpackConfig, ...config });
  const analyzer = new BundleAnalyzerPlugin(analyzerConfig);

  analyzer.apply(compiler);

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
