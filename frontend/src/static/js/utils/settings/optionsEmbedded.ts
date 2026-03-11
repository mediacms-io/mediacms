import { DeepPartial, GlobalMediaCMS, MediaCMSConfig } from '../../types';

export function optionsEmbeddedConfig(settings?: DeepPartial<GlobalMediaCMS['features']['embeddedVideo']>) {
    const ret: MediaCMSConfig['options']['embedded'] = {
        video: {
            dimensions: {
                width: 560,
                widthUnit: 'px',
                height: 315,
                heightUnit: 'px',
            },
        },
    };

    if (!settings?.initialDimensions) {
        return ret;
    }

    const {
        height,
        width,
        // heightUnit,  // @note: It doesn't used
        // widthUnit    // @note: It doesn't used
    } = settings.initialDimensions;

    if ('number' === typeof width && !Number.isNaN(width)) {
        ret.video.dimensions.width = width;
    }

    if ('number' === typeof height && !Number.isNaN(height)) {
        ret.video.dimensions.height = height;
    }

    // @note: It doesn't used
    // if (widthUnit?.trim() === 'percent') {
    //     settings.initialDimensions.widthUnit = 'percent';
    // }

    // @note: It doesn't used
    // if (heightUnit?.trim() === 'percent') {
    //     settings.initialDimensions.heightUnit = 'percent';
    // }

    return ret;
}
