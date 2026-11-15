import Dispatcher from '../../../src/static/js/utils/dispatcher';
import * as PageActions from '../../../src/static/js/utils/actions/PageActions';

describe('utils/actions', () => {
    describe('PageActions', () => {
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
            ['initPage', ['home'], { type: 'INIT_PAGE', page: 'home' }],
            ['toggleMediaAutoPlay', [], { type: 'TOGGLE_AUTO_PLAY' }],
            ['addNotification', ['Hello', 'n1'], { type: 'ADD_NOTIFICATION', notification: 'Hello', notificationId: 'n1' }],
        ] as [string, any[], any][])('%s dispatches the expected payload', (name, args, expected) => {
            (PageActions as any)[name](...args);
            expect(received).toStrictEqual([expected]);
        });

    });
});
