import { buildCommonjs } from './helpers/buildCommonjs.js';

export default buildCommonjs('./src/index.ts', '.')('./dist/webpack-dev-env.js');
