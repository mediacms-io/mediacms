import { PositiveIntegerOrZero, PositiveInteger } from '../../../../../src/static/js/utils/helpers/propTypeFilters';

// Mock the errors helper to capture error construction without side effects
jest.mock('../../../../../src/static/js/utils/helpers/errors', () => {
    return {
        logErrorAndReturnError: jest.fn((messages: string[]) => new Error(messages.join('\n'))),
    };
});

import { logErrorAndReturnError } from '../../../../../src/static/js/utils/helpers/errors';

describe('utils/helpers/propTypeFilters', () => {
    beforeEach(() => {
        (logErrorAndReturnError as jest.Mock).mockClear();
    });

    describe('PositiveIntegerOrZero', () => {
        test('returns null when property is undefined', () => {
            const obj: any = {};
            const res = PositiveIntegerOrZero(obj, 'count', 'Comp');
            expect(res).toBeNull();
            expect(logErrorAndReturnError).not.toHaveBeenCalled();
        });

        test('returns null for zero or positive integers', () => {
            const cases = [0, 1, 2, 100];
            for (const val of cases) {
                const res = PositiveIntegerOrZero({ count: val } as any, 'count', 'Comp');
                expect(res).toBeNull();
            }
            expect(logErrorAndReturnError).not.toHaveBeenCalled();
        });

        test('returns Error via logErrorAndReturnError for negative numbers', () => {
            const res = PositiveIntegerOrZero({ count: -1 } as any, 'count', 'Counter');
            expect(res).toBeInstanceOf(Error);
            expect(logErrorAndReturnError).toHaveBeenCalledTimes(1);
            const [messages] = (logErrorAndReturnError as jest.Mock).mock.calls[0];
            expect(Array.isArray(messages)).toBe(true);
            expect(messages[0]).toContain(
                'Invalid prop `count` of type `number` supplied to `Counter`, expected `positive integer or zero` (-1).'
            );
        });

        test('returns Error for non-integer numbers (e.g., float)', () => {
            const res = PositiveIntegerOrZero({ count: 1.5 } as any, 'count', 'Widget');
            expect(res).toBeInstanceOf(Error);
            expect((logErrorAndReturnError as jest.Mock).mock.calls[0][0][0]).toContain(
                'expected `positive integer or zero` (1.5).'
            );
        });

        test('uses "N/A" component label when comp is falsy', () => {
            const res = PositiveIntegerOrZero({ count: -2 } as any, 'count', '');
            expect(res).toBeInstanceOf(Error);
            expect((logErrorAndReturnError as jest.Mock).mock.calls[0][0][0]).toContain('supplied to `N/A`');
        });
    });

    describe('PositiveInteger', () => {
        test('returns null when property is undefined', () => {
            const obj: any = {};
            const res = PositiveInteger(obj, 'age', 'Person');
            expect(res).toBeNull();
            expect(logErrorAndReturnError).not.toHaveBeenCalled();
        });

        test('returns null for positive integers (excluding zero)', () => {
            const cases = [1, 2, 100];
            for (const val of cases) {
                const res = PositiveInteger({ age: val } as any, 'age', 'Person');
                expect(res).toBeNull();
            }
            expect(logErrorAndReturnError).not.toHaveBeenCalled();
        });

        test('returns Error for zero', () => {
            const res = PositiveInteger({ age: 0 } as any, 'age', 'Person');
            expect(res).toBeInstanceOf(Error);
            expect((logErrorAndReturnError as jest.Mock).mock.calls[0][0][0]).toContain(
                'expected `positive integer` (0).'
            );
        });

        test('returns Error for negative numbers', () => {
            const res = PositiveInteger({ age: -3 } as any, 'age', 'Person');
            expect(res).toBeInstanceOf(Error);
            expect((logErrorAndReturnError as jest.Mock).mock.calls[0][0][0]).toContain(
                'expected `positive integer` (-3).'
            );
        });

        test('returns Error for non-integer numbers', () => {
            const res = PositiveInteger({ age: 2.7 } as any, 'age', 'Person');
            expect(res).toBeInstanceOf(Error);
            expect((logErrorAndReturnError as jest.Mock).mock.calls[0][0][0]).toContain(
                'expected `positive integer` (2.7).'
            );
        });

        test('uses "N/A" component label when comp is falsy', () => {
            const res = PositiveInteger({ age: -1 } as any, 'age', '');
            expect(res).toBeInstanceOf(Error);
            expect((logErrorAndReturnError as jest.Mock).mock.calls[0][0][0]).toContain('supplied to `N/A`');
        });
    });
});
