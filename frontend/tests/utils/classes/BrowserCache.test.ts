import { BrowserCache } from '../../../src/static/js/utils/classes/BrowserCache';

describe('utils/classes', () => {
    describe('BrowserCache', () => {
        beforeEach(() => {
            localStorage.clear();
            jest.restoreAllMocks();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('Returns an error when prefix is missing', () => {
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const result = BrowserCache('', 10);
            expect(result).toBeInstanceOf(Error);
            expect((result as Error).message).toBe('Cache object prefix is required');
            expect(errorSpy).toHaveBeenCalled();
        });

        test('Exposes prefix and expiration seconds', () => {
            const cache = BrowserCache('pfx', 120) as any;
            expect(cache.prefix).toBe('pfx');
            expect(cache.seconds).toBe(120);
        });

        test('Falls back to one hour when expiration is not a number', () => {
            const cache = BrowserCache('pfx', 'abc') as any;
            expect(cache.seconds).toBe(3600);
        });

        test('Stores JSON with expiration under prefixed key and reads it back', () => {
            jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
            const cache = BrowserCache('pfx', 60) as any;

            expect(cache.set('k', { a: 1 })).toBe(true);

            const raw = JSON.parse(localStorage.getItem('pfx[k]') as string);
            expect(raw).toStrictEqual({ value: { a: 1 }, expire: new Date('2024-01-01T00:01:00Z').getTime() });
            expect(cache.get('k')).toStrictEqual({ a: 1 });
        });

        test('Uses per-call expiration when provided', () => {
            jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
            const cache = BrowserCache('pfx', 60) as any;
            cache.set('k', 'v', 5);
            jest.setSystemTime(new Date('2024-01-01T00:00:06Z'));
            expect(cache.get('k')).toBeNull();
        });

        test('Returns null for expired, missing and malformed entries', () => {
            jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
            const cache = BrowserCache('pfx', 60) as any;
            cache.set('k', 'v');
            jest.setSystemTime(new Date('2024-01-01T00:02:00Z'));
            expect(cache.get('k')).toBeNull();
            expect(cache.get('missing')).toBeNull();

            localStorage.setItem('pfx[noexpire]', JSON.stringify({ value: 'x' }));
            expect(cache.get('noexpire')).toBeNull();
        });

        test('Returns a warning error when localStorage.setItem throws', () => {
            const cache = BrowserCache('pfx', 60) as any;
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('quota');
            });

            const result = cache.set('k', 'v');

            expect(result).toBeInstanceOf(Error);
            expect(warnSpy).toHaveBeenCalled();
        });

        test('Clear removes only keys with the cache prefix', () => {
            const cache = BrowserCache('pfx', 60) as any;
            cache.set('a', 1);
            cache.set('b', 2);
            localStorage.setItem('other[a]', 'keep');

            expect(cache.clear()).toBe(true);

            expect(localStorage.getItem('pfx[a]')).toBeNull();
            expect(localStorage.getItem('pfx[b]')).toBeNull();
            expect(localStorage.getItem('other[a]')).toBe('keep');
        });

        test('Clear succeeds when storage is empty', () => {
            const cache = BrowserCache('pfx', 60) as any;
            expect(cache.clear()).toBe(true);
        });
    });
});
