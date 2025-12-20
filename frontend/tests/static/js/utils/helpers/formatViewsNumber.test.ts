import formatViewsNumber from '../../../../../src/static/js/utils/helpers/formatViewsNumber';

/**
 * Behaviors covered:
 * 1. Formats numbers below 1,000 without suffix, with rounding rules.
 * 2. Formats thousands to K with 1 decimal for < 10K and no decimal for >= 10K.
 * 3. Formats millions to M with 1 decimal for < 10M and no decimal for >= 10M.
 * 4. Formats billions and trillions with proper suffix and decimal rules.
 * 5. Returns locale string when fullNumber is true.
 * 6. Handles zero and small values correctly.
 * 7. Handles upper bound beyond last unit by sticking to the last unit.
 */

describe('formatViewsNumber', () => {
    describe('fullNumber = false (default compact formatting)', () => {
        test('formats values < 1,000 without suffix and with correct rounding', () => {
            expect(formatViewsNumber(0)).toBe('0');
            expect(formatViewsNumber(9)).toBe('9');
            expect(formatViewsNumber(12)).toBe('12');
            expect(formatViewsNumber(999)).toBe('999');
        });

        test('formats thousands to K with decimals for < 10K and none for >= 10K', () => {
            expect(formatViewsNumber(1000)).toBe('1K');
            expect(formatViewsNumber(1500)).toBe('1.5K');
            expect(formatViewsNumber(1499)).toBe('1.5K'); // rounds to 1 decimal
            expect(formatViewsNumber(10_000)).toBe('10K');
            expect(formatViewsNumber(10_400)).toBe('10K');
            expect(formatViewsNumber(10_500)).toBe('11K'); // rounds to nearest whole
            expect(formatViewsNumber(99_900)).toBe('100K'); // rounding up
        });

        test('formats millions to M with decimals for < 10M and none for >= 10M', () => {
            expect(formatViewsNumber(1_000_000)).toBe('1M');
            expect(formatViewsNumber(1_200_000)).toBe('1.2M');
            expect(formatViewsNumber(9_440_000)).toBe('9.4M');
            expect(formatViewsNumber(9_960_000)).toBe('10M'); // rounds to whole when >= 10M threshold after rounding
            expect(formatViewsNumber(10_000_000)).toBe('10M');
        });

        test('formats billions and trillions correctly', () => {
            expect(formatViewsNumber(1_000_000_000)).toBe('1B');
            expect(formatViewsNumber(1_500_000_000)).toBe('1.5B');
            expect(formatViewsNumber(10_000_000_000)).toBe('10B');
            expect(formatViewsNumber(1_000_000_000_000)).toBe('1T');
            expect(formatViewsNumber(1_230_000_000_000)).toBe('1.2T');
        });

        test('beyond last unit keeps using the last unit with scaling', () => {
            // Implementation scales beyond units by increasing the value so that the last unit remains applicable
            // Here, expect a number in T with rounding behavior similar to others
            expect(formatViewsNumber(9_999_999_999_999)).toBe('10T');
            // With current rounding rules, this value rounds to whole trillions
            expect(formatViewsNumber(12_345_678_901_234)).toBe('12T');
        });
    });

    describe('fullNumber = true (locale formatting)', () => {
        test('returns locale string representation of the full number', () => {
            // Use a fixed locale independent assertion by stripping non-digits except separators that could vary.
            // However, to avoid locale variance, check that it equals toLocaleString directly.
            const vals = [0, 12, 999, 1000, 1234567, 9876543210];
            for (const v of vals) {
                expect(formatViewsNumber(v, true)).toBe(v.toLocaleString());
            }
        });
    });

    describe('additional edge cases and robustness', () => {
        test('handles negative values without unit suffix (no scaling applied)', () => {
            expect(formatViewsNumber(-999)).toBe('-999');
            expect(formatViewsNumber(-1000)).toBe('-1000');
            expect(formatViewsNumber(-1500)).toBe('-1500');
            expect(formatViewsNumber(-10_500)).toBe('-10500');
            expect(formatViewsNumber(-1_230_000_000_000)).toBe('-1230000000000');
        });

        test('handles non-integer inputs with correct rounding in compact mode', () => {
            expect(formatViewsNumber(1499.5)).toBe('1.5K');
            expect(formatViewsNumber(999.9)).toBe('1000');
            expect(formatViewsNumber(10_499.5)).toBe('10K');
            expect(formatViewsNumber(10_500.49)).toBe('11K');
            expect(formatViewsNumber(9_440_000.49)).toBe('9.4M');
        });

        test('respects locale formatting in fullNumber mode', () => {
            const values = [1_234_567, -2_345_678, 0, 10_000, 99_999_999];
            for (const v of values) {
                expect(formatViewsNumber(v, true)).toBe(v.toLocaleString());
            }
        });

        test('caps unit at trillions for extremely large numbers', () => {
            expect(formatViewsNumber(9_999_999_999_999)).toBe('10T');
            expect(formatViewsNumber(12_345_678_901_234)).toBe('12T');
            expect(formatViewsNumber(987_654_321_000_000)).toBe('988T');
        });

        test('handles NaN and Infinity values gracefully', () => {
            expect(formatViewsNumber(Number.NaN, true)).toBe(Number.NaN.toLocaleString());
            expect(formatViewsNumber(Number.POSITIVE_INFINITY, true)).toBe(Number.POSITIVE_INFINITY.toLocaleString());
            expect(formatViewsNumber(Number.NEGATIVE_INFINITY, true)).toBe(Number.NEGATIVE_INFINITY.toLocaleString());

            expect(formatViewsNumber(Number.NaN)).toBe('NaN');
            // Do not test compact Infinity cases due to infinite loop behavior from while (views >= compare)
        });
    });
});
