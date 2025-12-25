// Mock the errors helper to capture error construction without side effects
jest.mock('../../../src/static/js/utils/helpers/errors', () => ({
    logErrorAndReturnError: jest.fn((messages: string[]) => new Error(messages.join('\n'))),
}));

import { logErrorAndReturnError } from '../../../src/static/js/utils/helpers/errors';
import { PositiveIntegerOrZero, PositiveInteger } from '../../../src/static/js/utils/helpers/propTypeFilters';

describe('js/utils/helpers', () => {
    describe('propTypeFilters', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        describe('PositiveIntegerOrZero', () => {
            test('Returns null when property is undefined', () => {
                const obj = {};
                const res = PositiveIntegerOrZero(obj, 'count', 'Comp');
                expect(res).toBeNull();
                expect(logErrorAndReturnError).not.toHaveBeenCalled();
            });

            test('Returns null for zero or positive integers', () => {
                const cases = [0, 1, 2, 100];
                for (const val of cases) {
                    const res = PositiveIntegerOrZero({ count: val }, 'count', 'Comp');
                    expect(res).toBeNull();
                }
                expect(logErrorAndReturnError).not.toHaveBeenCalled();
            });

            test('Returns Error via logErrorAndReturnError for negative numbers', () => {
                const res = PositiveIntegerOrZero({ count: -1 }, 'count', 'Counter');
                expect(res).toBeInstanceOf(Error);
                expect(logErrorAndReturnError).toHaveBeenCalledTimes(1);

                const [messages] = (logErrorAndReturnError as jest.Mock).mock.calls[0];
                expect(Array.isArray(messages)).toBe(true);
                expect(messages[0]).toBe(
                    'Invalid prop `count` of type `number` supplied to `Counter`, expected `positive integer or zero` (-1).'
                );
            });

            test('Returns Error for non-integer numbers (e.g., float)', () => {
                const res = PositiveIntegerOrZero({ count: 1.5 }, 'count', 'Widget');
                expect(res).toBeInstanceOf(Error);
                expect((logErrorAndReturnError as jest.Mock).mock.calls[0][0][0]).toBe(
                    'Invalid prop `count` of type `number` supplied to `Widget`, expected `positive integer or zero` (1.5).'
                );
            });

            test('Uses "N/A" component label when comp is falsy', () => {
                const res = PositiveIntegerOrZero({ count: -2 }, 'count', '');
                expect(res).toBeInstanceOf(Error);
                expect((logErrorAndReturnError as jest.Mock).mock.calls[0][0][0]).toBe(
                    'Invalid prop `count` of type `number` supplied to `N/A`, expected `positive integer or zero` (-2).'
                );
            });
        });

        describe('PositiveInteger', () => {
            test('Returns null when property is undefined', () => {
                const obj = {};
                const res = PositiveInteger(obj, 'age', 'Person');
                expect(res).toBeNull();
                expect(logErrorAndReturnError).not.toHaveBeenCalled();
            });

            test('Returns null for positive integers (excluding zero)', () => {
                const cases = [1, 2, 100];
                for (const val of cases) {
                    const res = PositiveInteger({ age: val }, 'age', 'Person');
                    expect(res).toBeNull();
                }
                expect(logErrorAndReturnError).not.toHaveBeenCalled();
            });

            test('Returns Error for zero', () => {
                const res = PositiveInteger({ age: 0 }, 'age', 'Person');
                expect(res).toBeInstanceOf(Error);
                expect((logErrorAndReturnError as jest.Mock).mock.calls[0][0][0]).toContain(
                    'Invalid prop `age` of type `number` supplied to `Person`, expected `positive integer` (0).'
                );
            });

            test('Returns Error for negative numbers', () => {
                const res = PositiveInteger({ age: -3 }, 'age', 'Person');
                expect(res).toBeInstanceOf(Error);
                expect((logErrorAndReturnError as jest.Mock).mock.calls[0][0][0]).toBe(
                    'Invalid prop `age` of type `number` supplied to `Person`, expected `positive integer` (-3).'
                );
            });

            test('Returns Error for non-integer numbers', () => {
                const res = PositiveInteger({ age: 2.7 }, 'age', 'Person');
                expect(res).toBeInstanceOf(Error);
                expect((logErrorAndReturnError as jest.Mock).mock.calls[0][0][0]).toBe(
                    'Invalid prop `age` of type `number` supplied to `Person`, expected `positive integer` (2.7).'
                );
            });

            test('Uses "N/A" component label when comp is falsy', () => {
                const res = PositiveInteger({ age: -1 }, 'age', '');
                expect(res).toBeInstanceOf(Error);
                expect((logErrorAndReturnError as jest.Mock).mock.calls[0][0][0]).toBe(
                    'Invalid prop `age` of type `number` supplied to `N/A`, expected `positive integer` (-1).'
                );
            });
        });
    });
});
