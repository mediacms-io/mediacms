import { imageExtension } from '../../../../../src/static/js/utils/helpers/imageExtension';

/**
 * Behaviors covered:
 * 1. Returns the extension for a typical filename with a single dot.
 * 2. Returns the last segment after the final dot for filenames with multiple dots.
 * 3. Returns the entire string when there is no dot in the filename (documents current behavior).
 * 4. Returns the segment after the leading dot for hidden files (e.g., .gitignore).
 * 5. Returns undefined for falsy or empty input values.
 * 6. Extracts the extension from a full URL path ending with an extension.
 * 7. Preserves letter casing of the extension.
 * 8. Returns an empty string when the filename ends with a trailing dot.
 */

describe('imageExtension', () => {
    test('returns the extension for a typical filename', () => {
        expect(imageExtension('photo.png')).toBe('png');
        expect(imageExtension('document.pdf')).toBe('pdf');
    });

    test('returns the last segment for filenames with multiple dots', () => {
        expect(imageExtension('archive.tar.gz')).toBe('gz');
        expect(imageExtension('backup.2024.12.31.zip')).toBe('zip');
    });

    test('returns the entire string when there is no dot in the filename (documenting current behavior)', () => {
        expect(imageExtension('file')).toBe('file');
        expect(imageExtension('README')).toBe('README');
    });

    test('handles hidden files that start with a dot', () => {
        expect(imageExtension('.gitignore')).toBe('gitignore');
        expect(imageExtension('.env.local')).toBe('local');
    });

    test('returns undefined for falsy or empty inputs', () => {
        expect(imageExtension('')).toBeUndefined();
        expect(imageExtension(undefined as unknown as string)).toBeUndefined();
        expect(imageExtension(null as unknown as string)).toBeUndefined();
    });

    test('extracts the extension from URL-like paths', () => {
        expect(imageExtension('https://example.com/images/avatar.jpeg')).toBe('jpeg');
        expect(imageExtension('/static/assets/icons/favicon.ico')).toBe('ico');
    });

    test('preserves case of the extension', () => {
        expect(imageExtension('UPPER.CASE.JPG')).toBe('JPG');
        expect(imageExtension('Mixed.Extension.PnG')).toBe('PnG');
    });

    test('returns empty string when the filename ends with a trailing dot', () => {
        expect(imageExtension('weird.')).toBe('');
    });
});
