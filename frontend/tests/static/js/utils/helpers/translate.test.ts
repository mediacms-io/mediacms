import { translateString } from '../../../../../src/static/js/utils/helpers/translate';

// The code reads from global window.TRANSLATION; we will stub it per test and restore afterwards.

describe('utils/helpers/translate.translateString', () => {
    // Ensure a window-like global exists for tests running in node environment
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof window === 'undefined') global.window = {} as unknown as Window & typeof global;

    const originalTranslation = (window as Window & { TRANSLATION?: Record<string, string> }).TRANSLATION;

    afterEach(() => {
        // Restore to original to avoid cross-test pollution
        (window as Window & { TRANSLATION?: Record<string, string> }).TRANSLATION = originalTranslation;
        jest.restoreAllMocks();
    });

    test('returns the same word when TRANSLATION is undefined', () => {
        // Ensure no translation table exists
        // allow deletion for test environment
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        delete window.TRANSLATION;
        expect(translateString('Hello')).toBe('Hello');
        expect(translateString('NonExistingKey')).toBe('NonExistingKey');
        expect(translateString('')).toBe('');
    });

    test('returns mapped value when key exists in TRANSLATION', () => {
        window.TRANSLATION = { Hello: 'Γεια', World: 'Κόσμος' };
        expect(translateString('Hello')).toBe('Γεια');
        expect(translateString('World')).toBe('Κόσμος');
    });

    test('falls back to original word when key is missing in TRANSLATION', () => {
        window.TRANSLATION = { Hello: 'Γεια' };
        expect(translateString('MissingKey')).toBe('MissingKey');
        expect(translateString('AnotherMissing')).toBe('AnotherMissing');
    });

    test('supports empty string keys distinctly from missing keys', () => {
        window.TRANSLATION = { '': '(empty)' };
        expect(translateString('')).toBe('(empty)');
        expect(translateString(' ')).toBe(' ');
    });

    test('returns value as-is even if it is an empty string or falsy in the dictionary', () => {
        window.TRANSLATION = { Empty: '', Zero: '0', False: 'false' };
        expect(translateString('Empty')).toBe('');
        expect(translateString('Zero')).toBe('0');
        expect(translateString('False')).toBe('false');
    });
});
