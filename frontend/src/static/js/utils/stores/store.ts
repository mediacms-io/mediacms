import { createStore, applyMiddleware, combineReducers } from 'redux';
import thunk, { ThunkMiddleware } from 'redux-thunk';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // Use localStorage for persistence
import searchReducer from './reducers/search';
import profileReducer from './reducers/profile';
import { PlaylistViewActionTypes, ProfileActionTypes, SearchActionTypes } from './types';
import playlistViewReducer from './reducers/playlistView';

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['playlistView'],
};

// Combine Reducers
const rootReducer = combineReducers({
  search: searchReducer,
  profile: profileReducer,
  playlistView: playlistViewReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export type RootState = ReturnType<typeof rootReducer>;

const store = createStore(
  persistedReducer,
  applyMiddleware(thunk as ThunkMiddleware<RootState, SearchActionTypes | ProfileActionTypes | PlaylistViewActionTypes>)
);

const persistor = persistStore(store);

export type AppDispatch = typeof store.dispatch;

export { store, persistor };
