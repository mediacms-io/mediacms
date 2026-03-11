import { createContext } from 'react';
import { config as mediacmsConfig } from '../settings/config';

export const ApiUrlContext = createContext(mediacmsConfig(window.MediaCMS).api);
export const ApiUrlConsumer = ApiUrlContext.Consumer;
