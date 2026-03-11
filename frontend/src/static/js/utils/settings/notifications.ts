import { DeepPartial, GlobalMediaCMS, MediaCMSConfig } from '../../types';

export function notificationsConfig(settings?: DeepPartial<GlobalMediaCMS['contents']['notifications']>) {
    const ret: MediaCMSConfig['notifications'] = {
        messages: {
            addToLiked: 'Added to liked media',
            removeFromLiked: 'Removed from liked media',
            addToDisliked: 'Added to disliked media',
            removeFromDisliked: 'Removed from disliked media',
        },
    };

    if (!settings?.messages) {
        return ret;
    }

    const entries = Object.entries(settings.messages) as [keyof typeof settings.messages, string][];

    for (const [key, value] of entries) {
        const message = value?.trim();
        if (message) {
            ret.messages[key] = message;
        }
    }

    return ret;
}
