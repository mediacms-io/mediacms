import React, { createContext } from 'react';
import { config as mediacmsConfig } from '../settings/config.js';

export const ApiUrlContext = createContext(mediacmsConfig(window.MediaCMS).api);
export const ApiUrlConsumer = ApiUrlContext.Consumer;