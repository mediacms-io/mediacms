import React, { createContext } from 'react';
import { config as mediacmsConfig } from '../settings/config.js';

export const LinksContext = createContext(mediacmsConfig(window.MediaCMS).url);
export const LinksConsumer = LinksContext.Consumer;
