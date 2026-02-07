import { MediaDurationInfo } from '../../../src/static/js/utils/classes/MediaDurationInfo';

describe('utils/classes', () => {
    describe('MediaDurationInfo', () => {
        test('Initializes via constructor when seconds is a positive integer (<= 59)', () => {
            const mdi = new MediaDurationInfo(42);
            expect(mdi.toString()).toBe('0:42');
            expect(mdi.ariaLabel()).toBe('42 seconds');
            expect(mdi.ISO8601()).toBe('P0Y0M0DT0H0M42S');
        });

        test('Formats minutes and zero-pads seconds; no hours prefix under 60 minutes', () => {
            const mdi = new MediaDurationInfo();
            mdi.update(5 * 60 + 7);
            expect(mdi.toString()).toBe('5:07');
            expect(mdi.ariaLabel()).toBe('5 minutes, 7 seconds');
            expect(mdi.ISO8601()).toBe('P0Y0M0DT0H5M7S');
        });

        test('Includes hours when duration >= 1 hour and zero-pads minutes when needed', () => {
            const mdi = new MediaDurationInfo();
            mdi.update(1 * 3600 + 2 * 60 + 3);
            expect(mdi.toString()).toBe('1:02:03');
            expect(mdi.ariaLabel()).toBe('1 hours, 2 minutes, 3 seconds');
            expect(mdi.ISO8601()).toBe('P0Y0M0DT1H2M3S');
        });

        test('Accumulates hours when days are present (e.g., 1 day + 2:03:04 => 26:03:04)', () => {
            const mdi = new MediaDurationInfo();
            const seconds = 1 * 86400 + 2 * 3600 + 3 * 60 + 4; // 1d 2:03:04 => 26:03:04
            mdi.update(seconds);
            expect(mdi.toString()).toBe('26:03:04');
            expect(mdi.ariaLabel()).toBe('26 hours, 3 minutes, 4 seconds');
            expect(mdi.ISO8601()).toBe('P0Y0M0DT26H3M4S');
        });

        test('Large durations: multiple days correctly mapped into hours', () => {
            const mdi = new MediaDurationInfo();
            const seconds = 3 * 86400 + 10 * 3600 + 15 * 60 + 9; // 3d 10:15:09 => 82:15:09
            mdi.update(seconds);
            expect(mdi.toString()).toBe('82:15:09');
            expect(mdi.ariaLabel()).toBe('82 hours, 15 minutes, 9 seconds');
            expect(mdi.ISO8601()).toBe('P0Y0M0DT82H15M9S');
        });

        test('Caching: toString and ariaLabel recompute only after update()', () => {
            const mdi = new MediaDurationInfo(59);
            const firstToString = mdi.toString();
            const firstAria = mdi.ariaLabel();
            expect(firstToString).toBe('0:59');
            expect(firstAria).toBe('59 seconds');

            // Call again to hit cached path
            expect(mdi.toString()).toBe(firstToString);
            expect(mdi.ariaLabel()).toBe(firstAria);

            // Update and ensure cache invalidates
            mdi.update(60);
            expect(mdi.toString()).toBe('1:00');
            expect(mdi.ariaLabel()).toBe('1 minutes');
        });

        test('Ignores invalid (non-positive integer or zero) updates, retaining previous value', () => {
            const mdi = new MediaDurationInfo(10);
            expect(mdi.toString()).toBe('0:10');

            mdi.update(1.23);
            expect(mdi.toString()).toBe('0:10');

            mdi.update(-5);
            expect(mdi.toString()).toBe('0:10');

            mdi.update('x');
            expect(mdi.toString()).toBe('0:10');
        });

        test('Boundary conditions around a minute and an hour', () => {
            const mdi = new MediaDurationInfo();

            mdi.update(59);
            expect(mdi.toString()).toBe('0:59');

            mdi.update(60);
            expect(mdi.toString()).toBe('1:00');

            mdi.update(3599);
            expect(mdi.toString()).toBe('59:59');

            mdi.update(3600);
            expect(mdi.toString()).toBe('1:00:00');
        });

        // @todo: Revisit this behavior
        test('Constructs without initial seconds', () => {
            const mdi = new MediaDurationInfo();
            expect(typeof mdi.toString()).toBe('function');
            expect(mdi.ariaLabel()).toBe('');
            expect(mdi.ISO8601()).toBe('P0Y0M0DTundefinedHundefinedMundefinedS');
        });
    });
});
