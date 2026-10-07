import React, { createContext } from 'react';
import { config as mediacmsConfig } from '../settings/config.js';

export const apiUrlConfig = mediacmsConfig(window.MediaCMS).api;
export const ApiUrlContext = createContext(apiUrlConfig);
export const ApiUrlConsumer = ApiUrlContext.Consumer;