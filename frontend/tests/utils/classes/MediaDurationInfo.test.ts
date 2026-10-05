import { MediaDurationInfo } from '../../../src/static/js/utils/classes/MediaDurationInfo';

describe('utils/classes', () => {
    describe('MediaDurationInfo', () => {
        test('Assigns a unique read-only id per instance', () => {
            const a: any = new MediaDurationInfo(1);
            const b: any = new MediaDurationInfo(1);
            expect(a.id).toMatch(/^MediaDurationInfo_\d+$/);
            expect(a.id).not.toBe(b.id);
            expect(Object.getOwnPropertyDescriptor(a, 'id')?.writable).toBe(false);
        });

        test.each([
            [0, '0:00', '', 'P0Y0M0DT0H0M0S'],
            [5, '0:05', '5 seconds', 'P0Y0M0DT0H0M5S'],
            [65, '1:05', '1 minutes, 5 seconds', 'P0Y0M0DT0H1M5S'],
            [600, '10:00', '10 minutes', 'P0Y0M0DT0H10M0S'],
            [3725, '1:02:05', '1 hours, 2 minutes, 5 seconds', 'P0Y0M0DT1H2M5S'],
            [3600 * 12 + 30 * 60 + 15, '12:30:15', '12 hours, 30 minutes, 15 seconds', 'P0Y0M0DT12H30M15S'],
            [86400 + 3661, '25:01:01', '25 hours, 1 minutes, 1 seconds', 'P0Y0M0DT25H1M1S'],
        ])('Formats %i seconds', (seconds, str, aria, iso) => {
            const info = new MediaDurationInfo(seconds);
            expect(info.toString()).toBe(str);
            expect(info.ariaLabel()).toBe(aria);
            expect(info.ISO8601()).toBe(iso);
        });

        test('Update recalculates cached string and aria label', () => {
            const info = new MediaDurationInfo(5);
            expect(info.toString()).toBe('0:05');
            expect(info.ariaLabel()).toBe('5 seconds');

            info.update(125);

            expect(info.toString()).toBe('2:05');
            expect(info.ariaLabel()).toBe('2 minutes, 5 seconds');
        });

        test('Repeated calls return the cached values', () => {
            const info = new MediaDurationInfo(61);
            expect(info.toString()).toBe(info.toString());
            expect(info.ariaLabel()).toBe(info.ariaLabel());
        });
    });
});
