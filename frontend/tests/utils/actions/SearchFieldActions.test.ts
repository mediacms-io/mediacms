import Dispatcher from '../../../src/static/js/utils/dispatcher';
import * as SearchFieldActions from '../../../src/static/js/utils/actions/SearchFieldActions';

describe('utils/actions', () => {
    describe('SearchFieldActions', () => {
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
            ['requestPredictions', ['cats'], { type: 'REQUEST_PREDICTIONS', query: 'cats' }],
        ] as [string, any[], any][])('%s dispatches the expected payload', (name, args, expected) => {
            (SearchFieldActions as any)[name](...args);
            expect(received).toStrictEqual([expected]);
        });

    });
});
