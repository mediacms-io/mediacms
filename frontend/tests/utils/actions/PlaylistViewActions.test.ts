import Dispatcher from '../../../src/static/js/utils/dispatcher';
import * as PlaylistViewActions from '../../../src/static/js/utils/actions/PlaylistViewActions';

describe('utils/actions', () => {
    describe('PlaylistViewActions', () => {
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
            ['toggleLoop', [], { type: 'TOGGLE_LOOP' }],
            ['toggleShuffle', [], { type: 'TOGGLE_SHUFFLE' }],
            ['toggleSave', [], { type: 'TOGGLE_SAVE' }],
        ] as [string, any[], any][])('%s dispatches the expected payload', (name, args, expected) => {
            (PlaylistViewActions as any)[name](...args);
            expect(received).toStrictEqual([expected]);
        });

    });
});
