import { DeepPartial, GlobalMediaCMS, MediaCMSConfig } from '../../types';

export function playlistsConfig(settings?: DeepPartial<GlobalMediaCMS['features']['playlists']>) {
    const ret: MediaCMSConfig['playlists'] = { mediaTypes: [] };

    if (Array.isArray(settings?.mediaTypes)) {
        for (const mtype of settings.mediaTypes) {
            if (mtype === 'audio' || mtype === 'video') {
                ret.mediaTypes.push(mtype);
            }
        }
    }

    if (ret.mediaTypes.length === 0) {
        ret.mediaTypes = ['audio', 'video'];
    }

    return ret;
}
