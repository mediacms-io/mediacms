'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var __assign = function() {
  __assign = Object.assign || function __assign(t) {
      for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
      }
      return t;
  };
  return __assign.apply(this, arguments);
};
function __spreadArray(to, from, pack) {
  if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
      if (ar || !(i in from)) {
          if (!ar) ar = Array.prototype.slice.call(from, 0, i);
          ar[i] = from[i];
      }
  }
  return to.concat(ar || Array.prototype.slice.call(from));
}
typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
  var e = new Error(message);
  return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

function bodySnippet(id) {
    return '<div id="' + id + '"></div>';
}
var homePage = {
    staticPage: true,
    buildExclude: false,
    title: 'Home',
    filename: 'index.html',
    html: {
        head: {},
        body: {
            scripts: [],
            snippet: bodySnippet('page-home'),
        }
    },
    window: {},
    render: 'import { renderPage } from \'./js/helpers\'; import { HomePage } from \'./js/pages/HomePage\'; renderPage( \'page-home\', HomePage );',
};
var errorPage = {
    staticPage: true,
    buildExclude: false,
    title: 'Error',
    filename: 'error.html',
    html: {
        head: {},
        body: {
            scripts: [],
            snippet: bodySnippet('page-error'),
        }
    },
    window: {},
    render: 'import { renderPage } from \'./js/helpers\'; import { ErrorPage } from \'./js/pages/ErrorPage\'; renderPage( \'page-error\', ErrorPage );',
};
var pages = {
    home: homePage,
    error: errorPage,
};
var htmlHead = {
    meta: [
        { charset: 'utf-8' },
        { content: 'ie=edge', 'http-equiv': 'x-ua-compatible' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
    links: [],
    scripts: [],
};
var htmlBody = {
    scripts: [],
    snippet: '',
};
var html = {
    head: htmlHead,
    body: htmlBody,
};
var config$3 = {
    src: '',
    build: '',
    pages: pages,
    html: html,
    window: {},
    postcssConfigFile: '',
};

/*const chunksCacheGroups_0 = {
    commons: {
        test: /[\\/]src[\\/]/,
        name: "_commons",
        chunks: "all",
        enforce: true,
        reuseExistingChunk: true,
    },
};*/
/*const chunksCacheGroups_1 = {
    commons: {
        test: /[\\/]src[\\/]/,
        name: "_commons",
        // priority: -10,
        chunks: "all",
        enforce: true,
        reuseExistingChunk: true,
    },
    vendors: {
        test: /[\\/]node_modules[\\/]/,
        // test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
        // test: /[\\/]node_modules[\\/](!MediaCmsPlayer)[\\/]/,
        name: "_vendors",
        // priority: -20,
        chunks: "all",
        enforce: true,
        // reuseExistingChunk: true,
    },
};*/
/*const chunksCacheGroups_2 = {
    commons: {
        minChunks: 2,
        // maxInitialRequests: 8, // @note: Tested values from 0 to 10, and changes applied with values 0, 4, 5, 6, 7, 8.
        // minSize: 0,
        name: "_commons",
        chunks: "all",
        enforce: true,
        reuseExistingChunk: true,
    },
};*/
/*const chunksCacheGroups_3 = {
    vendors: {
        test: /[\\/]node_modules[\\/]/,
        name: "_commons",
        priority: 1,
        chunks: "initial",
    },
};*/
var config$2 = {
    mode: 'production',
    devtool: 'source-map',
    optimization: {
        runtimeChunk: false,
        /*splitChunks: {
                // minSize: 1000000,
                chunks: 'all',
                automaticNameDelimiter: '-',
            },*/
        /*splitChunks: {
                // minSize: 1000000,
                chunks: 'all',
                automaticNameDelimiter: '-',
                cacheGroups: chunksCacheGroups_0,
            },*/
        /*splitChunks: {
                chunks: 'all',
                automaticNameDelimiter: '-',
                cacheGroups: chunksCacheGroups_1,
            },*/
        /*splitChunks: {
                chunks: 'all',
                automaticNameDelimiter: '-',
                cacheGroups: chunksCacheGroups_2,
            },*/
        /*splitChunks: {
                chunks: 'all',
                automaticNameDelimiter: '-',
                cacheGroups: chunksCacheGroups_3,
            },*/
        splitChunks: {
            chunks: 'all',
            automaticNameDelimiter: '-',
            cacheGroups: {
                vendors: {
                    test: /[\\/]node_modules[\\/]/,
                    name: '_commons',
                    priority: 1,
                    chunks: 'initial',
                },
            },
        },
    },
};

/*const chunksCacheGroups_0 = {
    commons: {
        test: /[\\/]src[\\/]/,
        name: "_commons",
        chunks: "all",
        enforce: true,
        reuseExistingChunk: true,
    },
};

const chunksCacheGroups_1 = {
    commons: {
        test: /[\\/]src[\\/]/,
        name: "_commons",
        // priority: -10,
        chunks: "all",
        enforce: true,
        reuseExistingChunk: true,
    },
    vendors: {
        test: /[\\/]node_modules[\\/]/,
        // test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
        // test: /[\\/]node_modules[\\/](!MediaCmsPlayer)[\\/]/,
        name: "_vendors",
        // priority: -20,
        chunks: "all",
        enforce: true,
        // reuseExistingChunk: true,
    },
};

const chunksCacheGroups_2 = {
    commons: {
        minChunks: 2,
        // maxInitialRequests: 8, // @note: Tested values from 0 to 10, and changes applied with values 0, 4, 5, 6, 7, 8.
        // minSize: 0,
        name: "_commons",
        chunks: "all",
        enforce: true,
        reuseExistingChunk: true,
    },
};

const chunksCacheGroups_3 = {
    vendors: {
        test: /[\\/]node_modules[\\/]/,
        name: "_commons",
        priority: 1,
        chunks: "initial",
    },
};*/
var config$1 = {
    mode: 'production',
    optimization: {
        minimize: true,
        runtimeChunk: false,
        splitChunks: {
            chunks: 'all',
            automaticNameDelimiter: '-',
            cacheGroups: {
                vendors: {
                    test: /[\\/]node_modules[\\/]/,
                    name: '_commons',
                    priority: 1,
                    chunks: 'initial',
                },
            },
        },
    },
};

/**
 * @see {link: https://github.com/seeyoulater/html-beautify-webpack-plugin/blob/master/index.js}
 */
var prettify = require('html-prettify');
var HtmlWebpackPlugin$1 = require('html-webpack-plugin');
require('webpack/lib/WebpackError.js');
function htmlPluginDataFunction(pluginData, options, callback) {
    pluginData.html = prettify(options.replace.reduce(function (res, item) { return res.replace(item instanceof RegExp ? new RegExp(item, 'gi') : item, ''); }, pluginData.html) /*,
    options.config*/);
    callback(null, pluginData);
}
var MyHtmlBeautifyWebpackPlugin = /** @class */ (function () {
    function MyHtmlBeautifyWebpackPlugin() {
    }
    MyHtmlBeautifyWebpackPlugin.prototype.apply = function (compiler) {
        var options = {
            config: {
                indent_size: 4,
                indent_with_tabs: false,
                html: {
                    end_with_newline: true,
                    indent_inner_html: true,
                    preserve_newlines: true,
                    max_preserve_newlines: 0,
                }
            },
            replace: []
        };
        function tapAsyncCallback(pluginData, callback) {
            return htmlPluginDataFunction(pluginData, options, callback);
        }
        function tapHookCallback(compilation) {
            return HtmlWebpackPlugin$1.getHooks(compilation).beforeEmit.tapAsync('MyHtmlBeautifyWebpackPlugin', tapAsyncCallback);
        }
        compiler.hooks.compilation.tap('MyHtmlBeautifyWebpackPlugin', tapHookCallback);
    };
    return MyHtmlBeautifyWebpackPlugin;
}());

var fs = require('fs');
var path$1 = require('path');
var ejs = require('ejs');
var templatePath = path$1.join(__dirname, '../templates');
var sitemapTemplatePath = path$1.join(templatePath, 'sitemap.ejs');
var sitemapTemplate = ejs.compile(fs.readFileSync(sitemapTemplatePath, 'utf8'), { root: [templatePath], filename: sitemapTemplatePath, outputFunctionName: 'echo' });
function pagesConfig(pagesKeys) {
    var pages = {};
    if (-1 === pagesKeys.indexOf('sitemap')) {
        pages.sitemap = {
            staticPage: true,
            buildExclude: true,
            title: 'Sitemap',
            filename: 'sitemap.html',
            html: {
                head: {},
                body: {
                    scripts: [],
                    snippet: sitemapTemplate({ pages: __spreadArray(__spreadArray([], pagesKeys, true), Object.keys(pages), true) }),
                },
            },
            window: {},
            render: ''
        };
    }
    return pages;
}

var merge = require('lodash.merge');
function validateBoolean(value, defaultValue) {
    if (defaultValue === void 0) { defaultValue = false; }
    if (true === value || false === value) {
        return value;
    }
    if (0 === value || 1 === value) {
        return !!value;
    }
    return defaultValue;
}
function validateString(value, defaultValue) {
    if (defaultValue === void 0) { defaultValue = ''; }
    return value ? value : defaultValue;
}
function getArrayType(sourcesArr, pageArr) {
    if (pageArr === void 0) { pageArr = []; }
    if ((!sourcesArr || !sourcesArr.length) && (!pageArr || !pageArr.length)) {
        return [];
    }
    if (sourcesArr && sourcesArr.length && pageArr && pageArr.length) {
        return sourcesArr.concat(pageArr);
    }
    if (sourcesArr && sourcesArr.length) {
        return sourcesArr;
    }
    return pageArr;
}
function formatPagesConfig(sources, pages) {
    var ret = {};
    for (var pk in pages) {
        ret[pk] = {
            staticPage: validateBoolean(pages[pk].staticPage, false),
            buildExclude: validateBoolean(pages[pk].buildExclude, false),
            title: validateString(pages[pk].title, sources.title),
            filename: validateString(pages[pk].filename, sources.filename),
            html: {
                head: {
                    meta: getArrayType(sources.html.head.meta, pages[pk].html.head.meta),
                    links: getArrayType(sources.html.head.links, pages[pk].html.head.links),
                    scripts: getArrayType(sources.html.head.scripts, pages[pk].html.head.scripts),
                },
                body: {
                    scripts: getArrayType(sources.html.body.scripts, pages[pk].html.body.scripts),
                    snippet: validateString(pages[pk].html.body.snippet, sources.html.body.snippet),
                },
            },
            window: merge({}, sources.window, pages[pk].window),
            render: validateString(sources.render, pages[pk].render),
        };
    }
    return ret;
}

var path = require('path');
var NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
// Webpack plugins.
var DefinePlugin = require('webpack').DefinePlugin;
var LimitChunkCountPlugin = require('webpack').optimize.LimitChunkCountPlugin;
var HtmlWebpackPlugin = require('html-webpack-plugin');
var VirtualModulesPlugin = require('webpack-virtual-modules');
var MiniCssExtractPlugin = require('mini-css-extract-plugin');
var ProgressBarPlugin = require('progress-bar-webpack-plugin');
var CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
var CopyPlugin = require("copy-webpack-plugin");
var dotenv = require('dotenv').config({ path: path.resolve(__dirname + '../../../../.env') });
function webpackEntry(env, srcDir, pages) {
    var ret = {};
    for (var p in pages) {
        if ('development' === env || !pages[p].buildExclude) {
            ret[p] = path.resolve(srcDir + '/' + p + '.js');
        }
    }
    return ret;
}
function webpackOutput(env, destinationDir, buildDir, chunkhash, hash) {
    var ret = {
        path: destinationDir,
        filename: '',
    };
    var prefix = 'development' === env ? '' : buildDir;
    var tmp;
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
function webpackRules(env, srcDir, postcssConfigFile) {
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
                    name: function (file) {
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
                        name: function (file) {
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
        }];
}
function webpackPlugins(env, srcDir, pages, cssSrc) {
    var ret = [
        new DefinePlugin({ "process.env": JSON.stringify(dotenv.parsed) }),
        new NodePolyfillPlugin(),
        new MyHtmlBeautifyWebpackPlugin(),
    ];
    if ('development' !== env) {
        ret.push(new CopyPlugin({
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
        }));
    }
    var virtualPages = {};
    var file;
    for (var k in pages) {
        if ('production' !== env || !pages[k].buildExclude) {
            file = path.resolve(srcDir + '/' + k + '.js');
            if ((void 0 !== pages[k].staticPage && pages[k].staticPage) || void 0 === pages[k].render) {
                virtualPages[file] = '';
            }
            else {
                virtualPages[file] = pages[k].render;
            }
        }
        if ('development' === env) {
            // Export pages HTML files.
            ret.push(new HtmlWebpackPlugin(__assign({ template: path.resolve(__dirname, '../templates/index.ejs'), hash: false, chunks: [k] }, pages[k])));
        }
    }
    ret.push(new VirtualModulesPlugin(virtualPages));
    ret.push(new MiniCssExtractPlugin({
        ignoreOrder: true,
        // filename: ! is_build ? '[name].css' : '[name].[hash].css',
        // chunkFilename: ! is_build ? '[id].css' : '[id].[hash].css',
        filename: cssSrc + '[name].css',
        // chunkFilename: "../css/[id].css",
    }));
    if ('development' !== env) {
        ret.push(new LimitChunkCountPlugin({ maxChunks: 1 }));
        ret.push(new ProgressBarPlugin({
            clear: false,
        }));
    }
    if ('production' === env) {
        ret.push(new CssMinimizerPlugin({
            cache: true,
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
function generateConfig(env, config) {
    var srcDir = config.src;
    var buildDir = config.build + '/' + env + ('development' === env ? '' : '/static');
    var cssbuild = './css/';
    var jsbuild = './js/';
    var configPages = config.pages;
    var configPagesKeys = config.pages ? Object.keys(configPages) : [];
    var defPages = pagesConfig(configPagesKeys);
    var pages = formatPagesConfig({ title: '', filename: '', render: '', html: config.html, window: config.window }, __assign(__assign({}, configPages), defPages));
    var ret = {
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

var isAbsolutePath$2 = require('path').isAbsolute;
var webpack$2 = require('webpack');
var webpackFormatMessages$1 = require('webpack-format-messages');
var BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
var defaultOptions$2 = {
    env: 'production',
    host: '127.0.0.1',
    port: 8888,
    mode: 'static',
    config: config$3,
};
function analyzer(analyzerOptions) {
    if (analyzerOptions === void 0) { analyzerOptions = defaultOptions$2; }
    var options = __assign(__assign({}, defaultOptions$2), analyzerOptions);
    options.config = __assign(__assign({}, defaultOptions$2.config), analyzerOptions.config);
    var config = generateConfig(options.env, options.config);
    if (!isAbsolutePath$2(options.config.src)) {
        throw Error('"src" is not an absolute path');
    }
    if (!isAbsolutePath$2(options.config.build)) {
        throw Error('"build" is not an absolute path');
    }
    if (!isAbsolutePath$2(options.config.postcssConfigFile)) {
        throw Error('"postcssConfigFile" is not an absolute path');
    }
    var analyzerConfig = {
        analyzerMode: options.mode,
        analyzerHost: options.host,
        analyzerPort: options.port,
        generateStatsFile: 'server' !== options.mode,
        startAnalyzer: 'server' === options.mode,
        statsFilename: 'analyzer-stats.json',
        reportFilename: 'analyzer-report.html',
    };
    var compiler = 'dist' === options.env
        ? webpack$2(__assign(__assign({}, config$1), config))
        : webpack$2(__assign(__assign({}, config$2), config));
    var analyzer = new BundleAnalyzerPlugin(analyzerConfig);
    analyzer.apply(compiler);
    compiler.run(function (err, stats) {
        if (err)
            throw err;
        var messages = webpackFormatMessages$1(stats);
        if (!messages.errors.length && !messages.warnings.length) {
            console.log('Compiled successfully!', '\n');
        }
        if (messages.errors.length) {
            console.log('Failed to compile.', '\n');
            for (var _i = 0, _a = messages.errors; _i < _a.length; _i++) {
                var m = _a[_i];
                console.log(m);
            }
        }
        else if (messages.warnings.length) {
            console.log('Compiled with warnings.', '\n');
            for (var _b = 0, _c = messages.warnings; _b < _c.length; _b++) {
                var m = _c[_b];
                console.log(m);
            }
        }
    });
}

var isAbsolutePath$1 = require('path').isAbsolute;
var webpack$1 = require('webpack');
var webpackFormatMessages = require('webpack-format-messages');
var defaultOptions$1 = {
    env: 'production',
    config: config$3,
};
function build(buildOptions) {
    if (buildOptions === void 0) { buildOptions = defaultOptions$1; }
    var options = __assign(__assign({}, defaultOptions$1), buildOptions);
    options.config = __assign(__assign({}, defaultOptions$1.config), buildOptions.config);
    if (!isAbsolutePath$1(options.config.src)) {
        throw Error('"src" is not an absolute path');
    }
    if (!isAbsolutePath$1(options.config.build)) {
        throw Error('"build" is not an absolute path');
    }
    if (!isAbsolutePath$1(options.config.postcssConfigFile)) {
        throw Error('"postcssConfigFile" is not an absolute path');
    }
    var config = generateConfig(options.env, options.config);
    var compiler = 'dist' === options.env
        ? webpack$1(__assign(__assign({}, config$1), config))
        : webpack$1(__assign(__assign({}, config$2), config));
    compiler.run(function (err, stats) {
        if (err)
            throw err;
        var messages = webpackFormatMessages(stats);
        if (!messages.errors.length && !messages.warnings.length) {
            console.log('Compiled successfully!', '\n');
        }
        if (messages.errors.length) {
            console.log('Failed to compile.', '\n');
            for (var _i = 0, _a = messages.errors; _i < _a.length; _i++) {
                var m = _a[_i];
                console.log(m);
            }
        }
        else if (messages.warnings.length) {
            console.log('Compiled with warnings.', '\n');
            for (var _b = 0, _c = messages.warnings; _b < _c.length; _b++) {
                var m = _c[_b];
                console.log(m);
            }
        }
    });
}

var config = {
    mode: 'development',
    // devtool: 'eval',
    // devtool: 'source-map',
    // devtool: 'eval-cheap-source-map',
    optimization: {
        minimize: false,
    },
};

function configFunc(contentBase) {
    return {
        watchOptions: {
            poll: true,
        },
        contentBase: contentBase,
        compress: true,
        hot: true,
    };
}

var isAbsolutePath = require('path').isAbsolute;
var webpack = require('webpack');
var WebpackDevServer = require('webpack-dev-server');
var defaultOptions = {
    env: 'development',
    host: '0.0.0.0',
    port: 8080,
    config: config$3,
};
function dev(devOptions) {
    if (devOptions === void 0) { devOptions = defaultOptions; }
    var options = __assign(__assign({}, defaultOptions), devOptions);
    options.config = __assign(__assign({}, defaultOptions.config), devOptions.config);
    var config$1 = generateConfig(options.env, options.config);
    if (!isAbsolutePath(options.config.src)) {
        throw Error('"src" is not an absolute path');
    }
    if (!isAbsolutePath(options.config.build)) {
        throw Error('"build" is not an absolute path');
    }
    if (!isAbsolutePath(options.config.postcssConfigFile)) {
        throw Error('"postcssConfigFile" is not an absolute path');
    }
    var compilerConfig = __assign(__assign({}, config), config$1);
    var serverOptions = configFunc(options.config.src);
    WebpackDevServer.addDevServerEntrypoints(compilerConfig, serverOptions);
    var compiler = webpack(compilerConfig);
    var server = new WebpackDevServer(compiler, serverOptions);
    server.listen(options.port, options.host, function (err) {
        if (err)
            throw err;
    });
}

exports.analyzer = analyzer;
exports.build = build;
exports.dev = dev;
