import { quickSort } from '../../../src/static/js/utils/helpers/quickSort';

describe('js/utils/helpers', () => {
    describe('quickSort', () => {
        test('Returns the same array reference (in-place) and sorts ascending', () => {
            const arr = [3, 1, 4, 1, 5, 9, 2];
            const out = quickSort(arr, 0, arr.length - 1);
            expect(out).toBe(arr);
            expect(arr).toEqual([1, 1, 2, 3, 4, 5, 9]);
        });

        test('Handles already sorted arrays', () => {
            const arr = [1, 2, 3, 4, 5];
            quickSort(arr, 0, arr.length - 1);
            expect(arr).toEqual([1, 2, 3, 4, 5]);
        });

        test('Handles arrays with duplicates and negative numbers', () => {
            const arr = [0, -1, -1, 2, 2, 1, 0];
            quickSort(arr, 0, arr.length - 1);
            expect(arr).toEqual([-1, -1, 0, 0, 1, 2, 2]);
        });

        test('Handles single-element array', () => {
            const single = [42];
            quickSort(single, 0, single.length - 1);
            expect(single).toEqual([42]);
        });

        test('Handles empty range without changes', () => {
            const arr = [5, 4, 3];
            // call with left > right (empty range)
            quickSort(arr, 2, 1);
            expect(arr).toEqual([5, 4, 3]);
        });

        test('Sorts subrange correctly without touching elements outside range', () => {
            const arr = [9, 7, 5, 3, 1, 2, 4, 8, 6];
            // sort only the middle [2..6]
            quickSort(arr, 2, 6);
            // The subrange [5,3,1,2,4] becomes [1,2,3,4,5]
            expect(arr).toEqual([9, 7, 1, 2, 3, 4, 5, 8, 6]);
        });
    });
});
