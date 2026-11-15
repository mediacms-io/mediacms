import React, { createContext } from 'react';
import { config as mediacmsConfig } from '../settings/config.js';

export const memberConfig = mediacmsConfig(window.MediaCMS).member;
export const MemberContext = createContext(memberConfig);
export const MemberConsumer = MemberContext.Consumer;
