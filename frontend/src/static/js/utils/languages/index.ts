import { el, en, hi, cs } from './translations/';
import { BrowserCache } from '../classes/';
import { config as mediacmsConfig } from '../settings/config.js';

const siteId = mediacmsConfig(window.MediaCMS).site.id;

// @ts-ignore
const browserCache = new BrowserCache('MediaCMS[' + siteId + '][language]');

export const labels = {
  el: 'Greek',
  en: 'English',
  hi: 'Hindi',
  cs: 'Czech',
} as { [key: string]: string };

// In display order.
export const translations: { [key: string]: { [key: string]: string } } = {
  en,
  hi,
  el,
  cs,
};

export const enabled: string[] = Object.keys(translations);

export const selected = browserCache.get('code') || 'en';
