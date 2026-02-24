import { csrfToken } from '../../../src/static/js/utils/helpers/csrfToken';

const setupDocumentCookie = () => {
    if (typeof document === 'undefined') {
        globalThis.document = { cookie: '' } as unknown as Document;
    }
};

const setDocumentCookie = (value: string) => {
    if (typeof document !== 'undefined') {
        Object.defineProperty(document, 'cookie', { value, writable: true, configurable: true });
    }
};

describe('js/utils/helpers', () => {
    describe('csrfToken', () => {
        const originalCookie = document.cookie;

        beforeAll(() => {
            // Initialize document environment
            setupDocumentCookie();
        });

        afterEach(() => {
            // Restore original cookie string
            setDocumentCookie(originalCookie);
        });

        test('Returns null when document.cookie is empty', () => {
            setDocumentCookie('');
            expect(csrfToken()).toBeNull();
        });

        test('Returns null when csrftoken is not present', () => {
            setDocumentCookie('sessionid=abc; theme=dark');
            expect(csrfToken()).toBeNull();
        });

        test('Finds and decodes the csrftoken cookie value', () => {
            const token = encodeURIComponent('a b+c%20');
            setDocumentCookie(`sessionid=abc; csrftoken=${token}; theme=dark`);
            expect(csrfToken()).toBe('a b+c%20');
        });

        test('Ignores leading spaces and matches exact prefix csrftoken=', () => {
            setDocumentCookie('  sessionid=xyz;   csrftoken=secure123; other=value');
            expect(csrfToken()).toBe('secure123');
        });

        test('Stops scanning once csrftoken is found', () => {
            // Ensure csrftoken occurs before other long tail cookies
            setDocumentCookie('csrftoken=first; a=1; b=2; c=3; d=4; e=5');
            expect(csrfToken()).toBe('first');
        });
    });
});
