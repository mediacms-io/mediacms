var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');

var cliArgs = process.argv.slice(2);

function rmdir_callback(err) {
  if (err) {
    throw err;
  }
}

var i, dir;

for (i = 0; i < cliArgs.length; i++) {
  dir = path.resolve(cliArgs[i]);

  if (fs.existsSync(dir)) {
    rimraf.sync(dir, {}, rmdir_callback);
  }
}
