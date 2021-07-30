/**
 * @see {link: https://github.com/seeyoulater/html-beautify-webpack-plugin/blob/master/index.js}
 */

const prettify = require('html-prettify');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const WebpackError =  require( 'webpack/lib/WebpackError.js' );

import { Compiler, Compilation } from 'webpack';

interface OptionsConfigHtml {
	end_with_newline: boolean,
	indent_inner_html: boolean,
	preserve_newlines: boolean,
	max_preserve_newlines: number,
}

interface OptionsConfig {
	indent_size: number,
	indent_with_tabs: boolean,
	html: OptionsConfigHtml
}

interface Options{
	config: OptionsConfig,
	replace: Array<string|RegExp>
}

interface HtmlWebpackPluginArgs{
	html: string,
	plugin: typeof HtmlWebpackPlugin,
	outputName: string
}

function htmlPluginDataFunction (pluginData: HtmlWebpackPluginArgs, options: Options, callback: (err:typeof WebpackError, arg1: HtmlWebpackPluginArgs) => void) {
	
	pluginData.html = prettify( 
		options.replace.reduce( (res:string, item: string | RegExp) => res.replace( item instanceof RegExp ? new RegExp(item, 'gi') : item, '' ), pluginData.html )/*,
		options.config*/
	);

	callback(null, pluginData);
}

export default class MyHtmlBeautifyWebpackPlugin {

	apply(compiler: Compiler): void {
	
		const options: Options = {
			config: {	// TODO: Remove it.
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

		function tapAsyncCallback(pluginData: HtmlWebpackPluginArgs, callback: (err:typeof WebpackError, arg1: HtmlWebpackPluginArgs) => void ){
			return htmlPluginDataFunction (pluginData, options, callback);
		}

		function tapHookCallback(compilation: Compilation){
			return HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync( 'MyHtmlBeautifyWebpackPlugin', tapAsyncCallback );
		}

		compiler.hooks.compilation.tap( 'MyHtmlBeautifyWebpackPlugin', tapHookCallback );
	}
}
