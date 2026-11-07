import React, { createContext } from 'react';
import { config as mediacmsConfig } from '../settings/config.js';

export const shareOptionsConfig = mediacmsConfig(window.MediaCMS).media.share.options;
export const ShareOptionsContext = createContext(shareOptionsConfig);

