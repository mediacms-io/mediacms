export const isGt = (x, y) => x > y;
export const isZero = (x) => 0 === x;
export const isNumber = (x) => !isNaN(x) && x === 0 + x;
export const isInteger = (x) => x === Math.trunc(x);
export const isPositive = (x) => isGt(x, 0);
export const isPositiveNumber = (x) => isNumber(x) && isPositive(x);
export const isPositiveInteger = (x) => isInteger(x) && isPositive(x);
export const isPositiveIntegerOrZero = (x) => isInteger(x) && (isPositive(x) || isZero(x));

export const greaterCommonDivision = (a, b) => (!b ? a : greaterCommonDivision(b, a % b));
