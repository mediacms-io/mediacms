// Mock the dispatcher module used by exportStore
jest.mock('../../../src/static/js/utils/dispatcher', () => ({ register: jest.fn() }));

import exportStore from '../../../src/static/js/utils/helpers/exportStore';

// Re-import the mocked dispatcher for assertions
import * as dispatcher from '../../../src/static/js/utils/dispatcher';

describe('js/utils/helpers', () => {
    describe('exportStore', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('Registers store handler with dispatcher and binds context', () => {
            const ctx: { value: number; inc?: () => void } = { value: 0 };
            const handlerName = 'inc';
            const handler = function (this: typeof ctx) {
                this.value += 1;
            };
            ctx[handlerName] = handler as any;

            const result = exportStore(ctx, handlerName);

            // returns the same store instance
            expect(result).toBe(ctx);

            // Ensure dispatcher.register was called once with a bound function
            expect((dispatcher as any).register).toHaveBeenCalledTimes(1);
            const registeredFn = (dispatcher as any).register.mock.calls[0][0] as Function;
            expect(typeof registeredFn).toBe('function');

            // Verify the registered function is bound to the store context
            registeredFn();
            expect(ctx.value).toBe(1);
        });

        test('Throws if handler name does not exist on store', () => {
            const store: any = {};
            // Accessing store[handler] would be undefined; calling .bind on undefined would throw
            expect(() => exportStore(store, 'missing')).toThrow();
        });
    });
});
