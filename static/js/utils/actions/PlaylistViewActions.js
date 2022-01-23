import Dispatcher from '../dispatcher.js';

export function toggleLoop() {
  Dispatcher.dispatch({
    type: 'TOGGLE_LOOP',
  });
}

export function toggleShuffle() {
  Dispatcher.dispatch({
    type: 'TOGGLE_SHUFFLE',
  });
}

export function toggleSave() {
  Dispatcher.dispatch({
    type: 'TOGGLE_SAVE',
  });
}
