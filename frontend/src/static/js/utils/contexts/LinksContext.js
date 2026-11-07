import React, { createContext } from 'react';
import { config as mediacmsConfig } from '../settings/config.js';

export const linksConfig = mediacmsConfig(window.MediaCMS).url;
export const LinksContext = createContext(linksConfig);
export const LinksConsumer = LinksContext.Consumer;
