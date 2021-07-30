import React, { createContext } from 'react';
import { config as mediacmsConfig } from '../settings/config.js';

export const MemberContext = createContext(mediacmsConfig(window.MediaCMS).member);
export const MemberConsumer = MemberContext.Consumer;
