import { BrowserCache } from '../../../src/static/js/utils/classes/BrowserCache';

// Mocks for helpers used by BrowserCache
jest.mock('../../../src/static/js/utils/helpers/', () => ({
    logErrorAndReturnError: jest.fn((args: any[]) => ({ error: true, args })),
    logWarningAndReturnError: jest.fn((args: any[]) => ({ warning: true, args })),
}));

const { logErrorAndReturnError } = jest.requireMock('../../../src/static/js/utils/helpers/');

describe('utils/classes', () => {
    describe('BrowserCache', () => {
        beforeEach(() => {
            localStorage.clear();
            jest.clearAllMocks();
        });

        test('Returns error when prefix is missing', () => {
            const cache = BrowserCache(undefined, 3600);
            expect(cache).toEqual(expect.objectContaining({ error: true }));
            expect(logErrorAndReturnError).toHaveBeenCalledWith(['Cache object prefix is required']);
        });

        test('Set and get returns stored primitive value before expiration', () => {
            const cache = BrowserCache('prefix', 3600);

            if (cache instanceof Error) {
                expect(cache instanceof Error).toBe(false);
                return;
            }

            expect(cache.set('foo', 'bar')).toBe(true);
            expect(cache.get('foo')).toBe('bar');

            // Ensure value serialized in localStorage with namespaced key
            const raw = localStorage.getItem('prefix[foo]') as string;
            const parsed = JSON.parse(raw);
            expect(parsed.value).toBe('bar');
            expect(typeof parsed.expire).toBe('number');
            expect(parsed.expire).toBeGreaterThan(Date.now());
        });

        test('Get returns null when expired', () => {
            const cache = BrowserCache('prefix', 1);

            if (cache instanceof Error) {
                expect(cache instanceof Error).toBe(false);
                return;
            }

            cache.set('exp', { a: 1 });

            jest.useFakeTimers();
            jest.advanceTimersByTime(1_000);

            expect(cache.get('exp')).toBeNull();

            jest.useRealTimers();
        });

        test('Clear removes only keys for its prefix', () => {
            const cacheA = BrowserCache('A', 3600);
            const cacheB = BrowserCache('B', 3600);

            if (cacheA instanceof Error) {
                expect(cacheA instanceof Error).toBe(false);
                return;
            }

            if (cacheB instanceof Error) {
                expect(cacheB instanceof Error).toBe(false);
                return;
            }

            cacheA.set('x', 1);
            cacheB.set('x', 2);

            expect(localStorage.getItem('A[x]')).toBeTruthy();
            expect(localStorage.getItem('B[x]')).toBeTruthy();

            cacheA.clear();

            expect(localStorage.getItem('A[x]')).toBeNull();
            expect(localStorage.getItem('B[x]')).toBeTruthy();

            cacheB.clear();

            expect(localStorage.getItem('A[x]')).toBeNull();
            expect(localStorage.getItem('B[x]')).toBeNull();
        });
    });
});
