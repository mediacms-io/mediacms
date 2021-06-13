// TODO: Improve or (even better) remove this file code.

import { error as logErrFn, warn as logWarnFn } from './log';

function logAndReturnError(logFn, msgArr, ErrorConstructor) {
  let err;
  switch (ErrorConstructor) {
    case TypeError:
    case RangeError:
    case SyntaxError:
    case ReferenceError:
      err = new ErrorConstructor(msgArr[0]);
      break;
    default:
      err = new Error(msgArr[0]);
  }
  logFn(err.message, ...msgArr.slice(1));
  return err;
}

export function logErrorAndReturnError(msgArr, ErrorConstructor) {
  return logAndReturnError(logErrFn, msgArr, ErrorConstructor);
}

export function logWarningAndReturnError(msgArr, ErrorConstructor) {
  return logAndReturnError(logWarnFn, msgArr, ErrorConstructor);
}
