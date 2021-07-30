import React, { createContext } from 'react';
import { config as mediacmsConfig } from '../settings/config.js';

export const SidebarContext = createContext(mediacmsConfig(window.MediaCMS).sidebar);
export const SidebarConsumer = SidebarContext.Consumer;