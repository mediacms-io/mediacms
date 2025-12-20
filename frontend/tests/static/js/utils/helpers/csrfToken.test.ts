import { csrfToken } from '../../../../../src/static/js/utils/helpers/csrfToken';

// Ensure a document/window environment for cookie-based tests
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof document === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.document = { cookie: '' } as unknown as Document;
}

describe('utils/helpers/csrfToken.csrfToken', () => {
    const originalCookie = document.cookie;

    afterEach(() => {
        // restore original cookie string
        Object.defineProperty(document, 'cookie', {
            value: originalCookie,
            writable: true,
            configurable: true,
        });
    });

    test('returns null when document.cookie is empty', () => {
        Object.defineProperty(document, 'cookie', { value: '', writable: true, configurable: true });
        expect(csrfToken()).toBeNull();
    });

    test('returns null when csrftoken is not present', () => {
        Object.defineProperty(document, 'cookie', {
            value: 'sessionid=abc; theme=dark',
            writable: true,
            configurable: true,
        });
        expect(csrfToken()).toBeNull();
    });

    test('finds and decodes the csrftoken cookie value', () => {
        const token = encodeURIComponent('a b+c%20');
        Object.defineProperty(document, 'cookie', {
            value: `sessionid=abc; csrftoken=${token}; theme=dark`,
            writable: true,
            configurable: true,
        });
        expect(csrfToken()).toBe('a b+c%20');
    });

    test('ignores leading spaces and matches exact prefix csrftoken=', () => {
        Object.defineProperty(document, 'cookie', {
            value: '  sessionid=xyz;   csrftoken=secure123; other=value',
            writable: true,
            configurable: true,
        });
        expect(csrfToken()).toBe('secure123');
    });

    test('stops scanning once csrftoken is found', () => {
        // Ensure csrftoken occurs before other long tail cookies
        Object.defineProperty(document, 'cookie', {
            value: 'csrftoken=first; a=1; b=2; c=3; d=4; e=5',
            writable: true,
            configurable: true,
        });
        expect(csrfToken()).toBe('first');
    });
});
