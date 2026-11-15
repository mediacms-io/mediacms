import '../../_support/setupMediaCMS';

jest.mock('../../../src/static/js/utils/helpers/requests', () => ({
    getRequest: jest.fn(),
    postRequest: jest.fn(),
    putRequest: jest.fn(),
    deleteRequest: jest.fn(),
}));

function loadStore(search = '?m=abc&pl=PL1') {
    window.history.replaceState(null, '', '/view' + search);
    let store: any;
    let actions: any;
    let mediaActions: any;
    jest.isolateModules(() => {
        store = require('../../../src/static/js/utils/stores/PlaylistViewStore').default;
        actions = require('../../../src/static/js/utils/actions/PlaylistViewActions');
        mediaActions = require('../../../src/static/js/utils/actions/MediaPageActions');
    });
    mediaActions.loadMediaData();
    return { store, actions };
}

describe('utils/stores', () => {
    describe('PlaylistViewStore', () => {
        beforeEach(() => {
            localStorage.clear();
            (window as any).MediaCMS.mediaId = 'abc';
        });

        afterAll(() => {
            delete (window as any).MediaCMS.mediaId;
            window.history.replaceState(null, '', '/');
        });

        test('Defaults loop on, shuffle off and not saved', () => {
            const { store } = loadStore();
            expect(store.get('enabled-loop')).toBe(true);
            expect(store.get('saved-playlist')).toBe(false);
            expect(store.get('logged-in-user-playlist')).toBe(false);
            expect(store.get('unknown')).toBeNull();
        });

        test('Shuffle default is read first when queried before loop', () => {
            const { store } = loadStore();
            expect(store.get('enabled-shuffle')).toBe(false);
        });

        test('TOGGLE_LOOP flips and persists per playlist', () => {
            const { store, actions } = loadStore();
            const listener = jest.fn();
            store.on('loop-repeat-updated', listener);

            actions.toggleLoop();

            expect(store.get('enabled-loop')).toBe(false);
            expect(localStorage.getItem('mediacms-test[loopPlaylist[PL1]]')).toContain('"value":false');
            expect(listener).toHaveBeenCalledTimes(1);
        });

        test('TOGGLE_SHUFFLE flips and persists per playlist', () => {
            const { store, actions } = loadStore();
            const listener = jest.fn();
            store.on('shuffle-updated', listener);

            actions.toggleShuffle();
            expect(store.get('enabled-shuffle')).toBe(true);
            expect(localStorage.getItem('mediacms-test[shufflePlaylist[PL1]]')).toContain('"value":true');
            expect(listener).toHaveBeenCalledTimes(1);
        });

        test('Restores cached loop and shuffle values', () => {
            const { BrowserCache } = require('../../../src/static/js/utils/classes/BrowserCache');
            const cache = BrowserCache('mediacms-test', 60);
            cache.set('loopPlaylist[PL1]', false);
            cache.set('shufflePlaylist[PL1]', true);

            const { store: loopStore } = loadStore();
            expect(loopStore.get('enabled-loop')).toBe(false);

            const { store: shuffleStore } = loadStore();
            expect(shuffleStore.get('enabled-shuffle')).toBe(true);
        });

        test('TOGGLE_SAVE flips saved state', () => {
            const { store, actions } = loadStore();
            const listener = jest.fn();
            store.on('saved-updated', listener);
            actions.toggleSave();
            expect(store.get('saved-playlist')).toBe(true);
            actions.toggleSave();
            expect(store.get('saved-playlist')).toBe(false);
            expect(listener).toHaveBeenCalledTimes(2);
        });
    });
});
