import React, { createContext } from 'react';
import { config as mediacmsConfig } from '../settings/config.js';

export const ShareOptionsContext = createContext(mediacmsConfig(window.MediaCMS).media.share.options);

