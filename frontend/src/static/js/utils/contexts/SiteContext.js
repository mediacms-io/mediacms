import React, { createContext } from 'react';
import { config as mediacmsConfig } from '../settings/config.js';

export const SiteContext = createContext(mediacmsConfig(window.MediaCMS).site);
export const SiteConsumer = SiteContext.Consumer;

export default SiteContext;
