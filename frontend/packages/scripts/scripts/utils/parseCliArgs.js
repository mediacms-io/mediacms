function parseCliArgsFn(cliArgs) {
  const ret = {};

  let arr;

  for (let arg of cliArgs) {
    arr = arg.split('--');

    if (2 === arr.length) {
      arr = arr[1].split('=');

      if (2 === arr.length) {
        ret[arr[0]] = arr[1];
      }
    }
  }

  return ret;
}

module.exports = parseCliArgsFn;
