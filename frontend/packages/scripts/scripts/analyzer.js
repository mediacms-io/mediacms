const { analyzer } = require('../dist/webpack-dev-env.js');
const parseCliArgs = require('./utils/parseCliArgs.js');
const { validateAnalyzerOptions } = require('./utils/validateOptions.js');
const options = validateAnalyzerOptions(parseCliArgs(process.argv.slice(2)));
analyzer(options);
