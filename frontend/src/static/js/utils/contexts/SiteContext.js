import React, { createContext } from 'react';
import { config as mediacmsConfig } from '../settings/config.js';

export const siteConfig = mediacmsConfig(window.MediaCMS).site;
export const SiteContext = createContext(siteConfig);
export const SiteConsumer = SiteContext.Consumer;

export default SiteContext;
