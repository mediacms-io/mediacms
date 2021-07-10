const isAbsolutePath = require('path').isAbsolute;

const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');

import { config as defaultConfig } from '../lib/config';

import { DevOptionsType } from '../lib/interfaces/OptionsTypes';

import { config as webpackDefaultConfig } from '../lib/.webpack/dev.config';
import { configFunc as webpackDefaultServerConfig } from '../lib/.webpack/dev-server.config';

import generateConfig from '../lib/webpack-helpers/generateConfig';

const defaultOptions: DevOptionsType = {
  env: 'development',
  host: '0.0.0.0',
  port: 8080,
  config: defaultConfig,
};

export function dev(devOptions: DevOptionsType = defaultOptions): void {
  const options: DevOptionsType = { ...defaultOptions, ...devOptions };

  options.config = { ...defaultOptions.config, ...devOptions.config };

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

  const compilerConfig = { ...webpackDefaultConfig, ...config };
  const serverOptions = webpackDefaultServerConfig(options.config.src);

  WebpackDevServer.addDevServerEntrypoints(compilerConfig, serverOptions);

  const compiler = webpack(compilerConfig);
  const server = new WebpackDevServer(compiler, serverOptions);

  server.listen(options.port, options.host, (err?: Error) => {
    if (err) throw err;
  });
}
