import { dispatcher } from '../dispatcher';

export function toggleLoop() {
    dispatcher.dispatch({ type: 'TOGGLE_LOOP' });
}

export function toggleShuffle() {
    dispatcher.dispatch({ type: 'TOGGLE_SHUFFLE' });
}

export function toggleSave() {
    dispatcher.dispatch({ type: 'TOGGLE_SAVE' });
}
