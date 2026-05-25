import { SearchFieldActions } from '../../../src/static/js/utils/actions';
import dispatcher from '../../../src/static/js/utils/dispatcher';

// Mock the dispatcher module used by SearchFieldActions
jest.mock('../../../src/static/js/utils/dispatcher', () => ({ dispatch: jest.fn() }));

describe('utils/actions', () => {
    describe('SearchFieldActions', () => {
        const dispatch = dispatcher.dispatch;

        beforeEach(() => {
            (dispatcher.dispatch as jest.Mock).mockClear();
        });

        describe('requestPredictions', () => {
            it('Should dispatch REQUEST_PREDICTIONS with provided query strings', () => {
                SearchFieldActions.requestPredictions('cats');
                SearchFieldActions.requestPredictions('');
                expect(dispatch).toHaveBeenCalledTimes(2);
                expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'REQUEST_PREDICTIONS', query: 'cats' });
                expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'REQUEST_PREDICTIONS', query: '' });
            });
        });
    });
});
