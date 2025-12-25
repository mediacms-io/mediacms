import {
    isGt,
    isZero,
    isNumber,
    isInteger,
    isPositive,
    isPositiveNumber,
    isPositiveInteger,
    isPositiveIntegerOrZero,
    greaterCommonDivision,
} from '../../../src/static/js/utils/helpers/math';

describe('js/utils/helpers', () => {
    describe('math', () => {
        describe('isGt', () => {
            test('Returns true when x > y', () => {
                expect(isGt(5, 3)).toBe(true);
            });

            test('Returns false when x === y', () => {
                expect(isGt(3, 3)).toBe(false);
            });

            test('Returns false when x < y', () => {
                expect(isGt(2, 3)).toBe(false);
            });
        });

        describe('isZero', () => {
            test('Returns true for 0', () => {
                expect(isZero(0)).toBe(true);
            });

            test('Returns false for non-zero numbers', () => {
                expect(isZero(1)).toBe(false);
                expect(isZero(-1)).toBe(false);
            });
        });

        describe('isNumber', () => {
            test('Returns true for numbers', () => {
                expect(isNumber(0)).toBe(true);
                expect(isNumber(1)).toBe(true);
                expect(isNumber(-1)).toBe(true);
                expect(isNumber(1.5)).toBe(true);
            });

            test('Returns false for NaN', () => {
                expect(isNumber(Number.NaN as unknown as number)).toBe(false);
            });

            test('Returns false for non-number types (via casting)', () => {
                // TypeScript type guards prevent passing non-numbers directly; simulate via casting
                expect(isNumber('3' as unknown as number)).toBe(false);
                expect(isNumber(null as unknown as number)).toBe(false);
                expect(isNumber(undefined as unknown as number)).toBe(false);
            });
        });

        describe('isInteger', () => {
            test('Returns true for integers', () => {
                expect(isInteger(0)).toBe(true);
                expect(isInteger(1)).toBe(true);
                expect(isInteger(-1)).toBe(true);
            });

            test('Returns false for non-integers', () => {
                expect(isInteger(1.1)).toBe(false);
                expect(isInteger(-2.5)).toBe(false);
            });
        });

        describe('isPositive', () => {
            test('Returns true for positive numbers', () => {
                expect(isPositive(1)).toBe(true);
                expect(isPositive(3.14)).toBe(true);
            });

            test('Returns false for zero and negatives', () => {
                expect(isPositive(0)).toBe(false);
                expect(isPositive(-1)).toBe(false);
                expect(isPositive(-3.14)).toBe(false);
            });
        });

        describe('isPositiveNumber', () => {
            test('Returns true for positive numbers', () => {
                expect(isPositiveNumber(1)).toBe(true);
                expect(isPositiveNumber(2.7)).toBe(true);
            });

            test('Returns false for zero and negatives', () => {
                expect(isPositiveNumber(0)).toBe(false);
                expect(isPositiveNumber(-1)).toBe(false);
                expect(isPositiveNumber(-3.4)).toBe(false);
            });

            test('Returns false for NaN (and non-number when cast)', () => {
                expect(isPositiveNumber(Number.NaN as unknown as number)).toBe(false);
                expect(isPositiveNumber('3' as unknown as number)).toBe(false);
            });
        });

        describe('isPositiveInteger', () => {
            test('Returns true for positive integers', () => {
                expect(isPositiveInteger(1)).toBe(true);
                expect(isPositiveInteger(10)).toBe(true);
            });

            test('Returns false for zero, negatives, and non-integers', () => {
                expect(isPositiveInteger(0)).toBe(false);
                expect(isPositiveInteger(-1)).toBe(false);
                expect(isPositiveInteger(1.5)).toBe(false);
            });
        });

        describe('isPositiveIntegerOrZero', () => {
            test('Returns true for positive integers and zero', () => {
                expect(isPositiveIntegerOrZero(0)).toBe(true);
                expect(isPositiveIntegerOrZero(1)).toBe(true);
                expect(isPositiveIntegerOrZero(10)).toBe(true);
            });

            test('Returns false for negatives and non-integers', () => {
                expect(isPositiveIntegerOrZero(-1)).toBe(false);
                expect(isPositiveIntegerOrZero(1.1)).toBe(false);
            });
        });

        describe('greaterCommonDivision', () => {
            test('Computes gcd for positive integers', () => {
                expect(greaterCommonDivision(54, 24)).toBe(6);
                expect(greaterCommonDivision(24, 54)).toBe(6);
                expect(greaterCommonDivision(21, 14)).toBe(7);
                expect(greaterCommonDivision(7, 13)).toBe(1);
            });

            test('Handles zeros', () => {
                expect(greaterCommonDivision(0, 0)).toBe(0);
                expect(greaterCommonDivision(0, 5)).toBe(5);
                expect(greaterCommonDivision(12, 0)).toBe(12);
            });

            test('Handles negative numbers by returning gcd sign of first arg (Euclid recursion behavior)', () => {
                expect(greaterCommonDivision(-54, 24)).toBe(-6);
                expect(greaterCommonDivision(54, -24)).toBe(6);
                expect(greaterCommonDivision(-54, -24)).toBe(-6);
            });

            test('Works with equal numbers', () => {
                expect(greaterCommonDivision(8, 8)).toBe(8);
                expect(greaterCommonDivision(-8, -8)).toBe(-8);
            });
        });
    });
});
