import publishedOnDate from '../../../src/static/js/utils/helpers/publishedOnDate';

// Helper to create Date in UTC to avoid timezone issues in CI environments
const makeDate = (y: number, mZeroBased: number, d: number) => new Date(Date.UTC(y, mZeroBased, d));

describe('js/utils/helpers', () => {
    describe('publishedOnDate', () => {
        test('Returns null when input is not a Date instance', () => {
            expect(publishedOnDate(null as unknown as Date)).toBeNull();
            expect(publishedOnDate(undefined as unknown as Date)).toBeNull();
            expect(publishedOnDate('2020-01-02' as any as Date)).toBeNull();
            expect(publishedOnDate(1577923200000 as unknown as Date)).toBeNull();
        });

        test('Type 1 (default): "Mon DD, YYYY" with 3-letter month prefix before day', () => {
            expect(publishedOnDate(makeDate(2020, 0, 2))).toBe('Jan 2, 2020');
            expect(publishedOnDate(makeDate(1999, 11, 31))).toBe('Dec 31, 1999');
            expect(publishedOnDate(makeDate(2024, 1, 29))).toBe('Feb 29, 2024');
        });

        test('Type 2: "DD Mon YYYY" with 3-letter month suffix', () => {
            expect(publishedOnDate(makeDate(2020, 0, 2), 2)).toBe('2 Jan 2020');
            expect(publishedOnDate(makeDate(1999, 11, 31), 2)).toBe('31 Dec 1999');
            expect(publishedOnDate(makeDate(2024, 1, 29), 2)).toBe('29 Feb 2024');
        });

        test('Type 3: "DD Month YYYY" with full month name', () => {
            expect(publishedOnDate(makeDate(2020, 0, 2), 3)).toBe('2 January 2020');
            expect(publishedOnDate(makeDate(1999, 11, 31), 3)).toBe('31 December 1999');
            expect(publishedOnDate(makeDate(2024, 1, 29), 3)).toBe('29 February 2024');
        });
    });
});
