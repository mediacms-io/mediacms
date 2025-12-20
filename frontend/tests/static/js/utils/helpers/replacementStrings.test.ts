import { replaceString } from '../../../../../src/static/js/utils/helpers/replacementStrings';

describe('utils/helpers/replacementStrings.replaceString', () => {
    const originalReplacements = (global as any).window?.REPLACEMENTS;

    beforeEach(() => {
        (global as any).window = (global as any).window || {};
        delete (global as any).window.REPLACEMENTS;
    });

    afterEach(() => {
        if ((global as any).window) {
            (global as any).window.REPLACEMENTS = originalReplacements;
        }
    });

    test('returns the original word when window.REPLACEMENTS is undefined', () => {
        const input = 'Hello World';
        const output = replaceString(input);
        expect(output).toBe(input);
    });

    test('replaces a single occurrence based on REPLACEMENTS map', () => {
        (global as any).window.REPLACEMENTS = { Hello: 'Hi' };
        const output = replaceString('Hello World');
        expect(output).toBe('Hi World');
    });

    test('replaces multiple occurrences of the same key', () => {
        (global as any).window.REPLACEMENTS = { foo: 'bar' };
        const output = replaceString('foo foo baz foo');
        expect(output).toBe('bar bar baz bar');
    });

    test('applies all entries in REPLACEMENTS (sequential split/join)', () => {
        (global as any).window.REPLACEMENTS = { a: 'A', A: 'X' };
        // Order is Object.entries insertion order, so first 'a'->'A', then 'A'->'X'
        const output = replaceString('aAaa');
        expect(output).toBe('XXXX');
    });

    test('supports empty string replacements (deletion)', () => {
        (global as any).window.REPLACEMENTS = { remove: '' };
        const output = replaceString('please remove this');
        expect(output).toBe('please  this');
    });

    test('handles overlapping keys by iteration order', () => {
        (global as any).window.REPLACEMENTS = { ab: 'X', b: 'Y' };
        // First replaces 'ab' -> 'X', leaving no 'b' from that sequence, then replace standalone 'b' -> 'Y'
        const output = replaceString('zab+b');
        expect(output).toBe('zX+Y');
    });

    test('works with special regex characters since split/join is literal', () => {
        (global as any).window.REPLACEMENTS = { '.': 'DOT', '*': 'STAR', '[]': 'BRACKETS' };
        const output = replaceString('a.*b[]c.');
        expect(output).toBe('aDOTSTARbBRACKETScDOT');
    });
});
