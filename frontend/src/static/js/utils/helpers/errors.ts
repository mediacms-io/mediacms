// @todo: Improve or (even better) remove this file.

import { error, warn } from './log';

export function logErrorAndReturnError(msgArr: string[]) {
    const err = new Error(msgArr[0]);
    error(...msgArr);
    return err;
}

export function logWarningAndReturnError(msgArr: string[]) {
    const err = new Error(msgArr[0]);
    warn(...msgArr);
    return err;
}
