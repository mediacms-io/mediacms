const { build } = require('../dist/webpack-dev-env.js');
const parseCliArgs = require('./utils/parseCliArgs.js');
const { validateBuildOptions } = require('./utils/validateOptions.js');
const options = validateBuildOptions(parseCliArgs(process.argv.slice(2)));
build(options);
