import { formatInnerLink } from '../../../src/static/js/utils/helpers/formatInnerLink';

describe('js/utils/helpers', () => {
    describe('formatInnerLink', () => {
        test('Returns the same absolute URL unchanged', () => {
            const url = 'https://example.com/path?x=1#hash';
            const base = 'https://base.example.org';
            expect(formatInnerLink(url, base)).toBe(url);
        });

        test('Constructs absolute URL from relative path with leading slash', () => {
            const url = '/images/picture.png';
            const base = 'https://media.example.com';
            expect(formatInnerLink(url, base)).toBe('https://media.example.com/images/picture.png');
        });

        test('Constructs absolute URL from relative path without leading slash', () => {
            const url = 'assets/file.txt';
            const base = 'https://cdn.example.com';
            expect(formatInnerLink(url, base)).toBe('https://cdn.example.com/assets/file.txt');
        });
    });
});
