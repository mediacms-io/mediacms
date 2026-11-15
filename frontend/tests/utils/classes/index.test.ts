import * as classes from '../../../src/static/js/utils/classes';

describe('utils/classes', () => {
    describe('index', () => {
        test('Re-exports all classes', () => {
            expect(typeof classes.BrowserCache).toBe('function');
            expect(typeof classes.MediaDurationInfo).toBe('function');
            expect(typeof classes.UpNextLoaderView).toBe('function');
        });
    });
});
