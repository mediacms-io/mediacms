import { dispatcher } from '../dispatcher';

export function load_author_data() {
    dispatcher.dispatch({ type: 'LOAD_AUTHOR_DATA' });
}

export function remove_profile() {
    dispatcher.dispatch({ type: 'REMOVE_PROFILE' });
}
