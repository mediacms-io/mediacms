const { dev } = require('../dist/webpack-dev-env.js');
const parseCliArgs = require('./utils/parseCliArgs.js');
const { validateDevOptions } = require('./utils/validateOptions.js');
const options = validateDevOptions(parseCliArgs(process.argv.slice(2)));
dev(options);
