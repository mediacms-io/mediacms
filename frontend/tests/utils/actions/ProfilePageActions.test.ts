import Dispatcher from '../../../src/static/js/utils/dispatcher';
import * as ProfilePageActions from '../../../src/static/js/utils/actions/ProfilePageActions';

describe('utils/actions', () => {
    describe('ProfilePageActions', () => {
        const received: any[] = [];
        let token: string;

        beforeAll(() => {
            token = (Dispatcher as any).register((payload: any) => received.push(payload));
        });

        afterAll(() => {
            (Dispatcher as any).unregister(token);
        });

        beforeEach(() => {
            received.length = 0;
        });

        test.each([
            ['load_author_data', [], { type: 'LOAD_AUTHOR_DATA' }],
            ['remove_profile', [], { type: 'REMOVE_PROFILE' }],
        ] as [string, any[], any][])('%s dispatches the expected payload', (name, args, expected) => {
            (ProfilePageActions as any)[name](...args);
            expect(received).toStrictEqual([expected]);
        });

    });
});
