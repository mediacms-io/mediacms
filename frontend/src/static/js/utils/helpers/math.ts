export const isGt = (x: number, y: number) => x > y;
export const isZero = (x: number) => 0 === x;
export const isNumber = (x: number) => 'number' === typeof x && !Number.isNaN(x);
export const isInteger = (x: number) => x === Math.trunc(x);
export const isPositive = (x: number) => isGt(x, 0);
export const isPositiveNumber = (x: number) => isNumber(x) && isPositive(x);
export const isPositiveInteger = (x: number) => isInteger(x) && isPositive(x);
export const isPositiveIntegerOrZero = (x: number) => isInteger(x) && (isPositive(x) || isZero(x));

export const greaterCommonDivision = (a: number, b: number): number => (!b ? a : greaterCommonDivision(b, a % b));
