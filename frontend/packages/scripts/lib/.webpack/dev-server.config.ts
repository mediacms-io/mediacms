import { Configuration } from 'webpack-dev-server';

export function configFunc(contentBase: string): Configuration {
  return {
    watchOptions: {
      poll: true,
    },
    contentBase: contentBase,
    compress: true,
    hot: true,
  };
}
