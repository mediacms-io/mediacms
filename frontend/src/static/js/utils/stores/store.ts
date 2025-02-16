import { createStore, applyMiddleware, combineReducers } from 'redux';
import thunk, { ThunkMiddleware } from 'redux-thunk';
import searchReducer from './reducers/search';
import { ProfileActionTypes, SearchActionTypes } from './types';
import profileReducer from './reducers/profile';

const rootReducer = combineReducers({
  search: searchReducer,
  profile: profileReducer,
});
export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof rootReducer>;

const store = createStore(
  rootReducer,
  applyMiddleware(thunk as ThunkMiddleware<RootState, SearchActionTypes | ProfileActionTypes>)
);

export default store;
