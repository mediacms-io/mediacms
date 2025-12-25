import { translateString } from '../../../src/static/js/utils/helpers/translate';

declare global {
    interface Window {
        TRANSLATION?: Record<string, string>;
    }
}

describe('js/utils/helpers', () => {
    describe('translate', () => {
        const originalReplacements = window.TRANSLATION;

        beforeEach(() => {
            delete window.TRANSLATION;
        });

        afterEach(() => {
            window.TRANSLATION = originalReplacements;
        });

        test('Returns the same word when window.TRANSLATION is undefined', () => {
            delete window.TRANSLATION;
            expect(translateString('Hello')).toBe('Hello');
            expect(translateString('NonExistingKey')).toBe('NonExistingKey');
            expect(translateString('')).toBe('');
        });

        test('Returns mapped value when key exists in window.TRANSLATION', () => {
            window.TRANSLATION = { Hello: 'Γεια', World: 'Κόσμος' };
            expect(translateString('Hello')).toBe('Γεια');
            expect(translateString('World')).toBe('Κόσμος');
        });

        test('Falls back to original word when key is missing in Twindow.RANSLATION', () => {
            window.TRANSLATION = { Hello: 'Γεια' };
            expect(translateString('MissingKey')).toBe('MissingKey');
            expect(translateString('AnotherMissing')).toBe('AnotherMissing');
        });

        test('Supports empty string keys distinctly from missing keys', () => {
            window.TRANSLATION = { '': '(empty)' };
            expect(translateString('')).toBe('(empty)');
            expect(translateString(' ')).toBe(' ');
        });

        test('Returns value as-is even if it is an empty string or falsy in the dictionary', () => {
            window.TRANSLATION = { Empty: '', Zero: '0', False: 'false' };
            expect(translateString('Empty')).toBe('');
            expect(translateString('Zero')).toBe('0');
            expect(translateString('False')).toBe('false');
        });
    });
});
