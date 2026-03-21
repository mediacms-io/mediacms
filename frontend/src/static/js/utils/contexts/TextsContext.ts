import { createContext } from 'react';
import { config as mediacmsConfig } from '../settings/config';

const notifications = mediacmsConfig(window.MediaCMS).notifications.messages;

const texts = { notifications };

export const TextsContext = createContext(texts);

export const TextsConsumer = TextsContext.Consumer;
