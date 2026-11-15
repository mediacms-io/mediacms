import React, { createContext } from 'react';
import { config as mediacmsConfig } from '../settings/config.js';

const notifications = mediacmsConfig(window.MediaCMS).notifications.messages;

export const textsConfig = {
  notifications,
};

export const TextsContext = createContext(textsConfig);

export const TextsConsumer = TextsContext.Consumer;
