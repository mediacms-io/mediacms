import { warn, error } from '../../../../../src/static/js/utils/helpers/log';

/**
 * Minimal behavior coverage for simple console proxy helpers:
 * 1. warn forwards arguments to console.warn preserving order and count.
 * 2. error forwards arguments to console.error preserving order and count.
 * 3. warn supports zero arguments (still calls console.warn).
 * 4. error supports zero arguments (still calls console.error).
 * 5. warn does not call console.error and error does not call console.warn.
 */

describe('log helpers (minimal)', () => {
    const originalWarn = console.warn;
    const originalError = console.error;

    beforeEach(() => {
        console.warn = jest.fn();
        console.error = jest.fn();
        jest.clearAllMocks();
    });

    afterEach(() => {
        console.warn = originalWarn;
        console.error = originalError;
    });

    test('warn proxies arguments to console.warn preserving order and count', () => {
        warn('a', 'b', 'c');
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith('a', 'b', 'c');
    });

    test('error proxies arguments to console.error preserving order and count', () => {
        error('x', 'y');
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith('x', 'y');
    });

    test('warn supports zero arguments', () => {
        warn();
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect((console.warn as jest.Mock).mock.calls[0].length).toBe(0);
    });

    test('error supports zero arguments', () => {
        error();
        expect(console.error).toHaveBeenCalledTimes(1);
        expect((console.error as jest.Mock).mock.calls[0].length).toBe(0);
    });

    test('warn does not call console.error and error does not call console.warn', () => {
        warn('only-warn');
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.error).not.toHaveBeenCalled();

        jest.clearAllMocks();

        error('only-error');
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.warn).not.toHaveBeenCalled();
    });
});
