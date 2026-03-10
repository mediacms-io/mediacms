import EventEmitter from 'events';
import { dispatcher } from '../dispatcher';

// type ClassProperties<C> = {
//     [Key in keyof C as C[Key] extends Function ? never : Key]: C[Key];
// };

type ClassMethods<C> = {
    [Key in keyof C as C[Key] extends Function ? Key : never]: C[Key];
};

// @todo: Check this again
export function exportStore<TStore extends EventEmitter, THandler extends keyof ClassMethods<TStore>>(
    store: TStore,
    handler: THandler
) {
    const method = store[handler] as Function;
    const callback: (payload: unknown) => void = method.bind(store);
    dispatcher.register(callback);
    return store;
}

// @todo: Remove older vesion.
// export function exportStore_OLD(store, handler) {
//     const callback = store[handler].bind(store);
//     dispatcher.register(callback);
//     return store;
// }
