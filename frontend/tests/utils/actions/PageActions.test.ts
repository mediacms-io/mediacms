import * as PageActions from '../../../src/static/js/utils/actions/PageActions';
import dispatcher from '../../../src/static/js/utils/dispatcher';

// Mock the dispatcher module used by PageActions
jest.mock('../../../src/static/js/utils/dispatcher', () => ({ dispatch: jest.fn() }));

describe('utils/actions', () => {
    describe('PageActions', () => {
        const dispatch = dispatcher.dispatch;

        beforeEach(() => {
            (dispatcher.dispatch as jest.Mock).mockClear();
        });

        describe('initPage', () => {
            it('Should dispatch INIT_PAGE with provided page string', () => {
                PageActions.initPage('home');
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'INIT_PAGE', page: 'home' });
            });

            // @todo: Revisit this behavior
            it('Should dispatch INIT_PAGE with empty string', () => {
                PageActions.initPage('');
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'INIT_PAGE', page: '' });
            });
        });

        describe('toggleMediaAutoPlay', () => {
            it('Should dispatch TOGGLE_AUTO_PLAY action', () => {
                PageActions.toggleMediaAutoPlay();
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_AUTO_PLAY' });
            });
        });

        describe('addNotification', () => {
            it('Should dispatch ADD_NOTIFICATION with message and id', () => {
                const notification = 'Saved!';
                const notificationId = 'notif-1';
                PageActions.addNotification(notification, notificationId);
                expect(dispatch).toHaveBeenCalledWith({ type: 'ADD_NOTIFICATION', notification, notificationId });
            });

            // @todo: Revisit this behavior
            it('Should dispatch ADD_NOTIFICATION with empty notification message', () => {
                const notification = '';
                const notificationId = 'id-empty';
                PageActions.addNotification(notification, notificationId);
                expect(dispatch).toHaveBeenCalledWith({ type: 'ADD_NOTIFICATION', notification, notificationId });
            });
        });
    });
});
