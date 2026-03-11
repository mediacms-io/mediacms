import { createContext } from 'react';
import { config as mediacmsConfig } from '../settings/config';

export const ShareOptionsContext = createContext(mediacmsConfig(window.MediaCMS).media.share.options);
