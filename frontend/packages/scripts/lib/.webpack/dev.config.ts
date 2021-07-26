import { Configuration } from 'webpack';

export const config: Configuration = {
  mode: 'development',
  // devtool: 'eval',
  // devtool: 'source-map',
  // devtool: 'eval-cheap-source-map',
  optimization: {
    minimize: false,
  },
};
