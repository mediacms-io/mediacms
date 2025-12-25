import { init, settings } from '../../../src/static/js/utils/settings/taxonomies';

const taxonomiesConfig = (sett?: any) => {
    init(sett);
    return settings();
};

describe('utils-settings/taxonomies', () => {
    test('Should return defaults when settings is undefined', () => {
        const res = taxonomiesConfig();
        expect(res).toStrictEqual({
            tags: { enabled: false, title: 'Tags' },
            categories: { enabled: false, title: 'Categories' },
        });
    });

    test('Should enable a taxonomy when enabled is true', () => {
        const res = taxonomiesConfig({ tags: { enabled: true } });
        expect(res.tags).toStrictEqual({ enabled: true, title: 'Tags' });
    });

    test('Should keep taxonomy disabled when enabled is true', () => {
        const res = taxonomiesConfig({ categories: { enabled: true } });
        expect(res.categories).toStrictEqual({ enabled: true, title: 'Categories' });
    });

    test('Should default to enabled=true when enabled is omitted but key exists', () => {
        const res = taxonomiesConfig({ tags: {} });
        expect(res.tags).toStrictEqual({ enabled: true, title: 'Tags' });
    });

    test('Should trim title when provided', () => {
        const res = taxonomiesConfig({ tags: { title: '  My Tags  ' } });
        expect(res.tags).toStrictEqual({ enabled: true, title: 'My Tags' });
    });

    test('Should ignore unknown taxonomy keys', () => {
        const input = {
            unknownKey: { enabled: true, title: 'X' },
            tags: { enabled: true, title: 'Tagz' },
        };
        const res = taxonomiesConfig(input);
        expect(res).toStrictEqual({
            tags: { enabled: true, title: 'Tagz' },
            categories: { enabled: false, title: 'Categories' },
        });
    });

    test('Should not change title when title is undefined', () => {
        const res = taxonomiesConfig({ categories: { enabled: true, title: undefined } });
        expect(res.categories).toStrictEqual({ enabled: true, title: 'Categories' });
    });
});
