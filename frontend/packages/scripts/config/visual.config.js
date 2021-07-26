import { buildCommonjs } from './helpers/buildCommonjs.js';

export default buildCommonjs('./src/index.ts', './visualizer/')('./dist/webpack-dev-env.js', true);
