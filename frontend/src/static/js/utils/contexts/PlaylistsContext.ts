import { createContext } from 'react';
import { config as mediacmsConfig } from '../settings/config';

export const PlaylistsContext = createContext(mediacmsConfig(window.MediaCMS).playlists);
