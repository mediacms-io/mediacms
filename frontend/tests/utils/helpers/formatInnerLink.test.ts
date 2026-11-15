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

        test('Does not produce a double slash when the base URL ends with a slash', () => {
            expect(formatInnerLink('/images/picture.png', 'https://media.example.com/')).toBe(
                'https://media.example.com/images/picture.png'
            );
            expect(formatInnerLink('assets/file.txt', 'https://cdn.example.com/')).toBe(
                'https://cdn.example.com/assets/file.txt'
            );
        });

        test('Keeps a base URL path prefix when joining', () => {
            expect(formatInnerLink('/media/1', 'https://example.com/sub/')).toBe('https://example.com/sub/media/1');
        });
    });
});
