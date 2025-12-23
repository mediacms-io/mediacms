import { translateString } from '../../../../../src/static/js/utils/helpers/translate';

// The code reads from global window.TRANSLATION; we will stub it per test and restore afterwards

describe('utils/helpers/translate.translateString', () => {
    const originalReplacements = (global as any).window?.TRANSLATION;

    beforeEach(() => {
        (global as any).window = (global as any).window || {};
        delete (global as any).window.TRANSLATION;
    });

    afterEach(() => {
        if ((global as any).window) {
            (global as any).window.TRANSLATION = originalReplacements;
        }
    });

    test('returns the same word when TRANSLATION is undefined', () => {
        // Ensure no translation table exists
        // allow deletion for test environment
        delete (global as any).window.TRANSLATION;
        expect(translateString('Hello')).toBe('Hello');
        expect(translateString('NonExistingKey')).toBe('NonExistingKey');
        expect(translateString('')).toBe('');
    });

    test('returns mapped value when key exists in TRANSLATION', () => {
        (global as any).window.TRANSLATION = { Hello: 'Γεια', World: 'Κόσμος' };
        expect(translateString('Hello')).toBe('Γεια');
        expect(translateString('World')).toBe('Κόσμος');
    });

    test('falls back to original word when key is missing in TRANSLATION', () => {
        (global as any).window.TRANSLATION = { Hello: 'Γεια' };
        expect(translateString('MissingKey')).toBe('MissingKey');
        expect(translateString('AnotherMissing')).toBe('AnotherMissing');
    });

    test('supports empty string keys distinctly from missing keys', () => {
        (global as any).window.TRANSLATION = { '': '(empty)' };
        expect(translateString('')).toBe('(empty)');
        expect(translateString(' ')).toBe(' ');
    });

    test('returns value as-is even if it is an empty string or falsy in the dictionary', () => {
        (global as any).window.TRANSLATION = { Empty: '', Zero: '0', False: 'false' };
        expect(translateString('Empty')).toBe('');
        expect(translateString('Zero')).toBe('0');
        expect(translateString('False')).toBe('false');
    });
});
