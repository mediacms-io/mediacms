import { createContext } from 'react';
import { config as mediacmsConfig } from '../settings/config';

export const SiteContext = createContext(mediacmsConfig(window.MediaCMS).site);
export const SiteConsumer = SiteContext.Consumer;

export default SiteContext;
