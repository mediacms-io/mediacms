import axios from 'axios';
import { installMediaCMSGlobal } from '../../_support/mediacmsGlobal';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

installMediaCMSGlobal({ api: { migrations: '/migrations' } });
const migrations = require('../../../src/static/js/utils/api/migrations');

const base = 'https://example.com/api/v1/migrations';

describe('utils/api', () => {
    describe('migrations', () => {
        const postConfig = { headers: { 'X-CSRFToken': 'tok%en' } };

        beforeAll(() => {
            document.cookie = 'csrftoken=' + encodeURIComponent('tok%en');
        });

        afterAll(() => {
            document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        });

        beforeEach(() => {
            jest.clearAllMocks();
            mockedAxios.get.mockResolvedValue({ data: 'g' });
            mockedAxios.post.mockResolvedValue({ data: 'p' });
            mockedAxios.put.mockResolvedValue({ data: 'u' });
            mockedAxios.delete.mockResolvedValue({ data: 'd' });
        });

        test.each([
            ['listMigrations', [], [base + '/']],
            ['getMigration', [3], [base + '/3/']],
            ['getServerTime', [], [base + '/server_time/']],
            ['listLtiPlatforms', [], [base + '/lti_platforms/']],
            ['getProgress', [3], [base + '/3/progress/']],
            ['getRecords', [3, { page: 2 }], [base + '/3/records/', { params: { page: 2 } }]],
            ['getRecords', [3], [base + '/3/records/', { params: {} }]],
        ] as [string, any[], any[]][])('%s issues GET', async (name, args, expected) => {
            await expect(migrations[name](...args)).resolves.toStrictEqual({ data: 'g' });
            expect(mockedAxios.get).toHaveBeenCalledWith(...expected);
        });

        test.each([
            ['createMigration', [{ a: 1 }], [base + '/', { a: 1 }]],
            ['checkConnection', [{ a: 1 }], [base + '/check_connection/', { a: 1 }]],
            ['checkSavedConnection', [3, { x: 1 }], [base + '/3/check_connection/', { options: { x: 1 } }]],
            ['checkSavedConnection', [3], [base + '/3/check_connection/', { options: {} }]],
            ['controlMigration', [3, 'start'], [base + '/3/start/', {}]],
            ['listSourceCategories', [{ a: 1 }], [base + '/source_categories/', { a: 1 }]],
            ['listSavedSourceCategories', [3], [base + '/3/source_categories/', {}]],
            ['listSourceRoles', [{ a: 1 }], [base + '/source_roles/', { a: 1 }]],
            ['listSavedSourceRoles', [3], [base + '/3/source_roles/', {}]],
        ] as [string, any[], any[]][])('%s issues POST with CSRF header', async (name, args, expected) => {
            await expect(migrations[name](...args)).resolves.toStrictEqual({ data: 'p' });
            expect(mockedAxios.post).toHaveBeenCalledWith(...expected, postConfig);
        });

        test('updateMigration issues PUT with CSRF header', async () => {
            await migrations.updateMigration(3, { b: 2 });
            expect(mockedAxios.put).toHaveBeenCalledWith(base + '/3/', { b: 2 }, postConfig);
        });

        test('deleteMigration issues DELETE with CSRF header', async () => {
            await migrations.deleteMigration(3);
            expect(mockedAxios.delete).toHaveBeenCalledWith(base + '/3/', postConfig);
        });
    });
});
