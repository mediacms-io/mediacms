import { PlaylistViewActions } from '../../../src/static/js/utils/actions';
import dispatcher from '../../../src/static/js/utils/dispatcher';

// Mock the dispatcher module used by PlaylistViewActions
jest.mock('../../../src/static/js/utils/dispatcher', () => ({ dispatch: jest.fn() }));

describe('utils/actions', () => {
    describe('PlaylistViewActions', () => {
        const dispatch = dispatcher.dispatch;

        beforeEach(() => {
            (dispatcher.dispatch as jest.Mock).mockClear();
        });

        describe('toggleLoop', () => {
            it('Should dispatch TOGGLE_LOOP action', () => {
                PlaylistViewActions.toggleLoop();
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_LOOP' });
            });
        });

        describe('toggleShuffle', () => {
            it('Should dispatch TOGGLE_SHUFFLE action', () => {
                PlaylistViewActions.toggleShuffle();
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_SHUFFLE' });
            });
        });

        describe('toggleSave', () => {
            it('Should dispatch TOGGLE_SAVE action', () => {
                PlaylistViewActions.toggleSave();
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_SAVE' });
            });
        });
    });
});
