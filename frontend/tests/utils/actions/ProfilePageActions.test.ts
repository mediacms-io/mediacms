import { ProfilePageActions } from '../../../src/static/js/utils/actions';
import dispatcher from '../../../src/static/js/utils/dispatcher';

// Mock the dispatcher module used by ProfilePageActions
jest.mock('../../../src/static/js/utils/dispatcher', () => ({ dispatch: jest.fn() }));

describe('utils/actions', () => {
    describe('ProfilePageActions', () => {
        const dispatch = dispatcher.dispatch;

        beforeEach(() => {
            (dispatcher.dispatch as jest.Mock).mockClear();
        });

        it('Should dispatch LOAD_AUTHOR_DATA ', () => {
            ProfilePageActions.load_author_data();
            expect(dispatch).toHaveBeenCalledTimes(1);
            expect(dispatch).toHaveBeenCalledWith({ type: 'LOAD_AUTHOR_DATA' });
        });

        it('Should dispatch REMOVE_PROFILE ', () => {
            ProfilePageActions.remove_profile();
            expect(dispatch).toHaveBeenCalledTimes(1);
            expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_PROFILE' });
        });
    });
});
