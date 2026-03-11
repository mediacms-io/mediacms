import { DeepPartial, GlobalMediaCMS, MediaCMSConfig } from '../../types';

export function mediaConfig(
    item?: DeepPartial<GlobalMediaCMS['features']['mediaItem']>,
    shareOptions?: DeepPartial<GlobalMediaCMS['features']['media']['shareOptions']>
) {
    const ret: MediaCMSConfig['media'] = {
        item: {
            displayAuthor: item?.hideAuthor === true ? false : true,
            displayViews: item?.hideViews === true ? false : true,
            displayPublishDate: item?.hideDate === true ? false : true,
        },
        share: { options: [] },
    };

    if (shareOptions) {
        const validShareOptions = ['embed', 'email']; // @todo: Check this

        for (const option of shareOptions) {
            if (!option) {
                continue;
            }

            const opt = option.trim();

            if (validShareOptions.includes(opt)) {
                ret.share.options.push(opt);
            }
        }
    }

    return ret;
}
