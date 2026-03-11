import { createContext } from 'react';
import { config as mediacmsConfig } from '../settings/config';

export const SidebarContext = createContext(mediacmsConfig(window.MediaCMS).sidebar);
export const SidebarConsumer = SidebarContext.Consumer;
