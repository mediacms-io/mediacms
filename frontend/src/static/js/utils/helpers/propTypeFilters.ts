import { logErrorAndReturnError } from './errors';
import { isPositiveInteger, isPositiveIntegerOrZero } from './math';

// @todo: Check this
export const PositiveIntegerOrZero = (function () {
    return function (obj: Record<string, number>, key: string, comp: string) {
        return obj[key] === undefined || isPositiveIntegerOrZero(obj[key])
            ? null
            : logErrorAndReturnError([
                  'Invalid prop `' +
                      key +
                      '` of type `' +
                      typeof obj[key] +
                      '` supplied to `' +
                      (comp || 'N/A') +
                      '`, expected `positive integer or zero` (' +
                      obj[key] +
                      ').',
              ]);
    };
})();

// @todo: Check this
export const PositiveInteger = (function () {
    return function (obj: Record<string, number>, key: string, comp: string) {
        return obj[key] === undefined || isPositiveInteger(obj[key])
            ? null
            : logErrorAndReturnError([
                  'Invalid prop `' +
                      key +
                      '` of type `' +
                      typeof obj[key] +
                      '` supplied to `' +
                      (comp || 'N/A') +
                      '`, expected `positive integer` (' +
                      obj[key] +
                      ').',
              ]);
    };
})();
