import gzip from 'rollup-plugin-gzip';
import postcss from 'rollup-plugin-postcss';
import babel from 'rollup-plugin-babel';
import cleanup from 'rollup-plugin-cleanup';
// import { uglify } from "rollup-plugin-uglify";
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import visualizer from 'rollup-plugin-visualizer';
import json from '@rollup/plugin-json';

export default function rollup_builds(input_file, output_folder, pkg) {
	const package_name = pkg.name;

	const dependencies = pkg.dependencies;
	const dependencies_names = !!dependencies ? Object.keys(pkg.dependencies) : [];

	const esm_format = 'es';
	const browser_format = 'umd';
	const commonjs_format = 'cjs';

	const postcss_config = {
		extract: true,
		modules: false, // Avoid adding prefixes to classnames (etc).
		extensions: ['.css', '.sss', '.pcss', '.scss'],
	};

	const postcss_plugin = postcss(postcss_config);
	const postcss_plugin_minimized = postcss({ ...postcss_config, minimize: true });

	const commonjs_resolve_config = {
		// pass custom options to the resolve plugin
		customResolveOptions: { moduleDirectory: 'node_modules' },
	};

	function beautify_plugin() {
		return cleanup(/*{
            maxEmptyLines: 1,
            sourcemap: false,
        }*/);
	}

	function visualizer_plugin(name) {
		return visualizer({
			title: name,
			filename: output_folder + '/visualizer/' + name + '.html',
		});
	}

	function es_build(filename, visualize, bundle) {
		const plugins = [postcss_plugin, json(), beautify_plugin()];

		if (!!visualize) {
			plugins.push(visualizer_plugin(filename));
		}

		return {
			input: input_file,
			external: !!bundle ? {} : dependencies_names,
			output: [{ format: esm_format, file: filename }],
			plugins: plugins,
		};
	}

	function commonjs_build(filename, visualize, bundle) {
		const plugins = [postcss_plugin, json(), resolve(commonjs_resolve_config), beautify_plugin()];

		if (!!visualize) {
			plugins.push(visualizer_plugin(filename));
		}

		return {
			input: input_file,
			external: !!bundle ? {} : dependencies_names,
			output: [{ format: commonjs_format, file: filename }],
			plugins: plugins,
		};
	}

	function browser_build(filename, visualize, minimize, compact) {
		const plugins = [
			!!minimize ? postcss_plugin_minimized : postcss_plugin,
			json(),
			babel(),
			resolve(),
			commonjs(),
			beautify_plugin(),
		];

		if (!!minimize) {
			// plugins.push( uglify() );

			if (!!compact) {
				plugins.push(gzip());
			}
		}

		if (!!visualize) {
			plugins.push(visualizer_plugin(filename));
		}

		return {
			input: input_file,
			output: { name: package_name, format: browser_format, file: filename },
			plugins: plugins,
		};
	}

	return Object.freeze({
		es: es_build,
		browser: browser_build,
		commonjs: commonjs_build,
	});
}
