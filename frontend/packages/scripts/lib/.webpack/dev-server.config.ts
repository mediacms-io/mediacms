import { Configuration } from 'webpack-dev-server';

export function configFunc(contentBase: string, host: string, port: number): Configuration {
  return {
    watchOptions: {
      poll: true,
    },
    static: {
      directory: contentBase,
    },
    compress: true,
    hot: true,
    host: host,
    port: port,
  };
}
