import { createContext } from 'react';
import { config as mediacmsConfig } from '../settings/config';

export const LinksContext = createContext(mediacmsConfig(window.MediaCMS).url);
export const LinksConsumer = LinksContext.Consumer;
