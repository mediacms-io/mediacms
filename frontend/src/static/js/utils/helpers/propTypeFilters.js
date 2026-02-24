import { logErrorAndReturnError } from './errors';

export const PositiveIntegerOrZero = (function () {
    const isPositiveIntegerOrZero = (x) => x === Math.trunc(x) && x >= 0;

    return function (obj, key, comp) {
        return void 0 === obj[key] || isPositiveIntegerOrZero(obj[key])
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

export const PositiveInteger = (function () {
    const isPositiveInteger = (x) => x === Math.trunc(x) && x > 0;

    return function (obj, key, comp) {
        return void 0 === obj[key] || isPositiveInteger(obj[key])
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
