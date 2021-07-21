import { logErrorAndReturnError, logWarningAndReturnError } from '../helpers/';

function supportLocalstorage() {
  var mod = 'test-slug';
  try {
    localStorage.setItem(mod, mod);
    localStorage.removeItem(mod);
    return true;
  } catch (e) {
    return false;
  }
}

export function BrowserCache(prefix, default_expire_seconds) {
  var default_expire_seconds = parseInt(default_expire_seconds, 10) || 3600;

  if (!supportLocalstorage) {
    console.warn(['Current browser does not support localStorage.']);
  }

  return !prefix
    ? logErrorAndReturnError(['Cache object prefix is required'])
    : {
      prefix: prefix,
      seconds: default_expire_seconds,
      set: function (key, value, expire_seconds, ret) {
        if (supportLocalstorage) {
          expire_seconds = expire_seconds ? expire_seconds : default_expire_seconds;
          if (!expire_seconds) {
            ret = logWarningAndReturnError(['Invalid cache expiration value', expire_seconds]);
          }
          try {
            localStorage.setItem(
              prefix + '[' + key + ']',
              JSON.stringify({
                value: value,
                expire: new Date().getTime() + expire_seconds * 1000,
              })
            );
            ret = !0;
          } catch (error) {
            ret = logWarningAndReturnError([error]);
          }
        }
        return ret;
      },
      get: function (key, ret) {
        ret = supportLocalstorage ? localStorage.getItem(prefix + '[' + key + ']') : null;
        ret = ret ? JSON.parse(ret) : null;
        ret = null !== ret ? (void 0 !== ret.expire && ret.expire > new Date().getTime() ? ret.value : null) : ret;
        return ret;
      },
      clear: function () {
        var k;
        if (supportLocalstorage && Object.keys(localStorage).length) {
          for (k in localStorage) {
            if (localStorage.hasOwnProperty(k)) {
              if (0 === k.indexOf(prefix)) {
                localStorage.removeItem(k);
              }
            }
          }
        }
        return !0;
      },
    };
}
