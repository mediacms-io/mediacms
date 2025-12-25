import { replaceString } from '../../../src/static/js/utils/helpers/replacementStrings';

declare global {
    interface Window {
        REPLACEMENTS?: Record<string, string>;
    }
}

describe('js/utils/helpers', () => {
    describe('replacementStrings', () => {
        describe('replaceString', () => {
            const originalReplacements = window.REPLACEMENTS;

            beforeEach(() => {
                delete window.REPLACEMENTS;
            });

            afterEach(() => {
                window.REPLACEMENTS = originalReplacements;
            });

            test('Returns the original word when window.REPLACEMENTS is undefined', () => {
                delete window.REPLACEMENTS;
                const input = 'Hello World';
                const output = replaceString(input);
                expect(output).toBe(input);
            });

            test('Replaces a single occurrence based on window.REPLACEMENTS map', () => {
                window.REPLACEMENTS = { Hello: 'Hi' };
                const output = replaceString('Hello World');
                expect(output).toBe('Hi World');
            });

            test('Replaces multiple occurrences of the same key', () => {
                window.REPLACEMENTS = { foo: 'bar' };
                const output = replaceString('foo foo baz foo');
                expect(output).toBe('bar bar baz bar');
            });

            test('Applies all entries in window.REPLACEMENTS (sequential split/join)', () => {
                window.REPLACEMENTS = { a: 'A', A: 'X' };
                // First replaces 'a'->'A' and then 'A'->'X'
                const output = replaceString('aAaa');
                expect(output).toBe('XXXX');
            });

            test('Supports empty string replacements (deletion)', () => {
                window.REPLACEMENTS = { remove: '' };
                const output = replaceString('please remove this');
                expect(output).toBe('please  this');
            });

            test('Handles overlapping keys by iteration order', () => {
                window.REPLACEMENTS = { ab: 'X', b: 'Y' };
                // First replaces 'ab' -> 'X', leaving no 'b' from that sequence, then replace standalone 'b' -> 'Y'
                const output = replaceString('zab+b');
                expect(output).toBe('zX+Y');
            });

            test('Works with special regex characters since split/join is literal', () => {
                window.REPLACEMENTS = { '.': 'DOT', '*': 'STAR', '[]': 'BRACKETS' };
                const output = replaceString('a.*b[]c.');
                expect(output).toBe('aDOTSTARbBRACKETScDOT');
            });
        });
    });
});
