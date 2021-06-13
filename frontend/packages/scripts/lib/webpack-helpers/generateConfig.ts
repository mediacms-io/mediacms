const path = require('path');
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

// Webpack plugins.
const { DefinePlugin } = require('webpack');
const { LimitChunkCountPlugin } = require('webpack').optimize;
const HtmlWebpackPlugin = require('html-webpack-plugin');
const VirtualModulesPlugin = require('webpack-virtual-modules');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");

var dotenv = require('dotenv').config({ path: path.resolve(__dirname + '../../../../.env') });

import MyHtmlBeautifyWebpackPlugin from '../webpack-plugins/MyHtmlBeautifyWebpackPlugin';

import { ConfigType, ConfigPages } from '../config';

import defaultPages from './pagesConfig';

import formatPagesConfig from './formatPagesConfig';

function webpackEntry(env: string, srcDir: string, pages: ConfigPages) {

	const ret: { [key: string]: string } = {};

	for (const p in pages) {

		if ('development' === env || !pages[p].buildExclude) {
			ret[p] = path.resolve(srcDir + '/' + p + '.js');
		}
	}

	return ret;
}

function webpackOutput(env: string, destinationDir: string, buildDir?: string, chunkhash?: string, hash?: string) {

	const ret = {
		path: destinationDir,
		filename: '',
	};

	const prefix = 'development' === env ? '' : buildDir;

	let tmp;

	if (undefined !== chunkhash) {

		tmp = chunkhash.trim();

		if ('' === tmp) {
			throw Error('Invalid chunkhash argument value: ' + chunkhash);
		}

		ret.filename = (prefix || '') + '[name]-[chunkhash].js';
	}
	else if (undefined !== hash) {

		tmp = hash.trim();

		if ('' === tmp) {
			throw Error('Invalid hash argument value: ' + hash);
		}

		ret.filename = (prefix || '') + '[name]-[hash].js';
	}
	else {
		ret.filename = (prefix || '') + '[name].js';
	}

	return ret;
}

function webpackAlias() {

	return {
		// modernizr$: path.resolve(__dirname, "../../.modernizrrc"),   // TODO: Enable this?
	};
}

function webpackRules(env: string, srcDir: string, postcssConfigFile: string): any[] {

	return [{
		test: /\.(jsx|js)?$/,
		use: 'babel-loader'
	},
	{
		test: /\.(tsx|ts)?$/,
		use: 'ts-loader',
		// exclude: /node_modules/,
		// options: {
		//   compilerOptions: {
		// 	"sourceMap": !isProduction,
		//   },
		// },
	},
	{
		test: /\.ejs$/,
		use: {
			loader: 'ejs-compiled-loader',
			options: {
				// beautify: true,
				htmlmin: true,
				// htmlminOptions: {
				//     removeComments: true,
				//     collapseWhitespace: true,
				//     preserveLineBreaks: true
				// }
			}
		}
	},
	{
		test: /\.(sa|sc|c)ss$/,
		use: [
			{ loader: MiniCssExtractPlugin.loader },
			// { loader: 'development' === env ? MiniCssExtractPlugin.loader : 'style-loader' },  // Use inline <style> tag.
			{ loader: 'css-loader', options: { importLoaders: 1 } },
			{ loader: 'postcss-loader', options: { postcssOptions: { config: postcssConfigFile } } },
			{ loader: 'sass-loader' },
		],
	},
	{
		test: /\.module\.(sa|sc|c)ss$/,
		use: [
			{ loader: MiniCssExtractPlugin.loader },
			// { loader: 'development' === env ? MiniCssExtractPlugin.loader : 'style-loader' },  // Use inline <style> tag.
			{ loader: 'css-loader', options: { importLoaders: 1, modules: true, onlyLocals: false } },
			{ loader: 'postcss-loader', options: { postcssOptions: { config: postcssConfigFile } } },
			{ loader: 'sass-loader' },
		]
	},
	{
		test: /\.(png|jpe?g|gif)(\?\S*)?$/,
		use: {
			loader: 'url-loader',
			options: {
				limit: 1024,
				fallback: 'file-loader',
				name: (file: string) => {
					return '.' + path.join(file.replace(srcDir, ''), '..').replace(/\\/g, '/') + '/[name].[ext]';
				},
			},
		},
	},
	{
		test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
		/*issuer: {
				test: /\.jsx?$/
			},*/
		use: ['babel-loader', '@svgr/webpack', 'url-loader']
	},
	{
		test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
		loader: 'url-loader'
	},
	{
		test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
		use: [{
			loader: 'file-loader',
			options: {
				name: (file: string) => {
					return '.' + path.join(file.replace(srcDir, ''), '..').replace(/\\/g, '/') + '/[name].[ext]';
				},
			}
		}]
	},
	{
		test: /\.modernizrrc.js$/,
		use: 'modernizr-loader',
	},
	{
		test: /\.modernizrrc(\.json)?$/,
		use: ['modernizr-loader', 'json-loader'],
	}
	];
}

function webpackPlugins(env: string, srcDir: string, pages: ConfigPages, cssSrc: string) {

	const ret = [
		new DefinePlugin({ "process.env": JSON.stringify(dotenv.parsed) }),
		new NodePolyfillPlugin(),
		new MyHtmlBeautifyWebpackPlugin(),
	];

	if ('development' !== env) {
		ret.push(
			new CopyPlugin({
				patterns: [
					{
						from: path.resolve(__dirname, '../../../src/static/lib'),
						to: path.resolve(__dirname, '../../../' + env + '/static/lib'),
					},
					{
						from: path.resolve(__dirname, '../../../src/static/images'),
						to: path.resolve(__dirname, '../../../' + env + '/static/images'),
					},
					{
						from: path.resolve(__dirname, '../../../src/static/favicons'),
						to: path.resolve(__dirname, '../../../' + env + '/static/favicons'),
					},
					{
						from: path.resolve(__dirname, '../../../src/static/css/_extra.css'),
						to: path.resolve(__dirname, '../../../' + env + '/static/css/_extra.css'),
					},
				],
			})
		);
	}

	const virtualPages: { [key: string]: string } = {};

	let file: string;

	for (const k in pages) {

		if ('production' !== env || !pages[k].buildExclude) {

			file = path.resolve(srcDir + '/' + k + '.js');

			if ((void 0 !== pages[k].staticPage && pages[k].staticPage) || void 0 === pages[k].render) {
				virtualPages[file] = '';
			} else {
				virtualPages[file] = pages[k].render;
			}
		}

		if ('development' === env) {
			// Export pages HTML files.
			ret.push(new HtmlWebpackPlugin({
				template: path.resolve(__dirname, '../templates/index.ejs'),
				hash: false,
				chunks: [k],
				...pages[k],
			}));
		}
	}

	ret.push(new VirtualModulesPlugin(virtualPages));

	ret.push(new MiniCssExtractPlugin({
		ignoreOrder: true,	// TODO: Remove it...
		// filename: ! is_build ? '[name].css' : '[name].[hash].css',
		// chunkFilename: ! is_build ? '[id].css' : '[id].[hash].css',
		filename: cssSrc + '[name].css',
		// chunkFilename: "../css/[id].css",
	}));

	if ('development' !== env) {
		ret.push(new LimitChunkCountPlugin({ maxChunks: 1 }));
		ret.push(
			new ProgressBarPlugin({
				clear: false,
			})
		);
	}

	if ('production' === env) {
		ret.push(new CssMinimizerPlugin({
			cache: true, // TODO: Ignore in Webpack 5. Use https://webpack.js.org/configuration/other-options/#cache.
			minimizerOptions: {
				preset: [
					'default',
					{
						discardComments: { removeAll: true },
					},
				],
			},
		}));
	}

	return ret;
}

export default function generateConfig(env: string, config: ConfigType) {

	const srcDir = config.src;
	const buildDir = config.build + '/' + env + ('development' === env ? '' : '/static');

	const cssbuild = './css/';
	const jsbuild = './js/';

	const configPages = config.pages;
	const configPagesKeys = config.pages ? Object.keys(configPages) : [];
	const defPages = defaultPages(configPagesKeys);

	const pages = formatPagesConfig(
		{ title: '', filename: '', render: '', html: config.html, window: config.window },
		{ ...configPages, ...defPages }
	);

	const ret = {
		entry: webpackEntry(env, srcDir, pages),
		output: 'development' === env ? webpackOutput(env, srcDir, void 0, void 0, void 0) : webpackOutput(env, buildDir, jsbuild, void 0, void 0),
		plugins: webpackPlugins(env, srcDir, pages, cssbuild),
		module: {
			rules: webpackRules(env, srcDir, config.postcssConfigFile),
		},
		resolve: {
			alias: webpackAlias(),
			extensions: ['.tsx', '.ts', '.jsx', '.js'],
		},
	};

	return ret;
}
