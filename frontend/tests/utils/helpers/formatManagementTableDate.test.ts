import { formatManagementTableDate } from '../../../src/static/js/utils/helpers/formatManagementTableDate';

describe('js/utils/helpers', () => {
    describe('formatManagementTableDate', () => {
        test('Formats date with zero-padded time components', () => {
            const d = new Date(2021, 0, 5, 3, 7, 9); // Jan=0, day 5, 03:07:09
            expect(formatManagementTableDate(d)).toBe('Jan 5, 2021 03:07:09');
        });

        test('Formats date with double-digit time components and month abbreviation', () => {
            const d = new Date(1999, 11, 31, 23, 59, 58); // Dec=11
            expect(formatManagementTableDate(d)).toBe('Dec 31, 1999 23:59:58');
        });
    });
});
