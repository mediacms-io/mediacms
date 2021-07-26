import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import visualizer from 'rollup-plugin-visualizer';
import cleanup from 'rollup-plugin-cleanup';

export function buildCommonjs(input_file, output_folder) {
  return function (filename, visualize) {
    const plugins = [
      resolve({ customResolveOptions: { moduleDirectories: 'node_modules' } }),
      typescript(),
      cleanup({ comments: 'none' }),
    ];

    if (visualize) {
      plugins.push(visualizer({ title: filename, filename: output_folder + filename + '.html' }));
    }

    return {
      input: input_file,
      output: [{ format: 'cjs', file: filename }],
      plugins: plugins,
    };
  };
}
