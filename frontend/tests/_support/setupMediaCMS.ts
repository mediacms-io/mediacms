import { installMediaCMSGlobal } from './mediacmsGlobal';

if (undefined === (window as any).MediaCMS) {
    installMediaCMSGlobal();
}
