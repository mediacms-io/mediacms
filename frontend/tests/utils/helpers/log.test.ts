import { warn, error } from '../../../src/static/js/utils/helpers/log';

describe('js/utils/helpers', () => {
    describe('log', () => {
        beforeEach(() => {
            // Setup console mocks - replaces global console methods with jest mocks
            globalThis.console.warn = jest.fn();
            globalThis.console.error = jest.fn();

            jest.clearAllMocks();
        });

        afterEach(() => {
            // Restore original console methods
            jest.restoreAllMocks();
        });

        test('Warn proxies arguments to console.warn preserving order and count', () => {
            warn('a', 'b', 'c');
            expect(console.warn).toHaveBeenCalledTimes(1);
            expect(console.warn).toHaveBeenCalledWith('a', 'b', 'c');
        });

        test('Error proxies arguments to console.error preserving order and count', () => {
            error('x', 'y');
            expect(console.error).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledWith('x', 'y');
        });

        test('Warn supports zero arguments', () => {
            warn();
            expect(console.warn).toHaveBeenCalledTimes(1);
            expect((console.warn as jest.Mock).mock.calls[0].length).toBe(0);
        });

        test('Error supports zero arguments', () => {
            error();
            expect(console.error).toHaveBeenCalledTimes(1);
            expect((console.error as jest.Mock).mock.calls[0].length).toBe(0);
        });

        test('Warn does not call console.error and error does not call console.warn', () => {
            warn('only-warn');
            expect(console.warn).toHaveBeenCalledTimes(1);
            expect(console.error).not.toHaveBeenCalled();

            jest.clearAllMocks();

            error('only-error');
            expect(console.error).toHaveBeenCalledTimes(1);
            expect(console.warn).not.toHaveBeenCalled();
        });
    });
});
