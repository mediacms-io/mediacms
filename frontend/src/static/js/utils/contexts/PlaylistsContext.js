import React, { createContext } from 'react';
import { config as mediacmsConfig } from '../settings/config.js';

export const PlaylistsContext = createContext(mediacmsConfig(window.MediaCMS).playlists);
