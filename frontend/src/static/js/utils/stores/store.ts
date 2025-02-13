import { createStore, applyMiddleware, combineReducers } from 'redux';
import thunk, { ThunkMiddleware } from 'redux-thunk';
import searchReducer from './reducers/search';
import { SearchActionTypes } from './types';

const rootReducer = combineReducers({
  search: searchReducer,
});
export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof rootReducer>;

const store = createStore(rootReducer, applyMiddleware(thunk as ThunkMiddleware<RootState, SearchActionTypes>));

export default store;
