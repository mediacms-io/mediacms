const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');

const srcDir = path.resolve(__dirname, 'src');
const entriesDir = path.join(srcDir, 'entries');
const outputDir = path.resolve(__dirname, 'dist/static');

const entry = Object.fromEntries(
  fs
    .readdirSync(entriesDir)
    .filter((file) => file.endsWith('.js'))
    .map((file) => [path.basename(file, '.js'), path.join(entriesDir, file)])
);

module.exports = (env, argv) => {
  const isProduction = argv.mode !== 'development';
  const backend = process.env.MEDIACMS_BACKEND || 'http://localhost';

  return {
    mode: isProduction ? 'production' : 'development',
    devtool: isProduction ? false : 'eval-cheap-module-source-map',
    entry,
    output: {
      path: outputDir,
      publicPath: '/static/',
      filename: 'js/[name].js',
      clean: true,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.(jsx|js)$/,
          use: 'babel-loader',
        },
        {
          test: /\.(tsx|ts)$/,
          use: 'ts-loader',
        },
        {
          test: /\.(sa|sc|c)ss$/,
          use: [
            MiniCssExtractPlugin.loader,
            { loader: 'css-loader', options: { importLoaders: 1 } },
            'postcss-loader',
            { loader: 'sass-loader', options: { sassOptions: { silenceDeprecations: ['import'] } } },
          ],
        },
      ],
    },
    optimization: {
      runtimeChunk: false,
      splitChunks: {
        chunks: 'all',
        automaticNameDelimiter: '-',
        cacheGroups: {
          styles: {
            type: 'css/mini-extract',
            name: '_commons',
            chunks: 'all',
            minChunks: 2,
            priority: 2,
            enforce: true,
          },
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            name: '_commons',
            priority: 1,
            chunks: 'initial',
          },
        },
      },
    },
    plugins: [
      new MiniCssExtractPlugin({ filename: 'css/[name].css', ignoreOrder: true }),
      new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
      new CopyPlugin({
        patterns: [
          { from: path.join(srcDir, 'static/lib'), to: 'lib' },
          { from: path.join(srcDir, 'static/images'), to: 'images' },
          { from: path.join(srcDir, 'static/favicons'), to: 'favicons' },
          { from: path.join(srcDir, 'static/css/_extra.css'), to: 'css/_extra.css' },
        ],
      }),
    ],
    performance: {
      hints: false,
    },
    devServer: {
      host: '0.0.0.0',
      port: 8088,
      hot: false,
      liveReload: true,
      devMiddleware: {
        publicPath: '/static/',
      },
      proxy: [
        {
          context: (pathname) => !pathname.startsWith('/ws'),
          target: backend,
        },
      ],
      client: {
        overlay: { errors: true, warnings: false },
      },
    },
  };
};
