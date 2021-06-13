let EMBEDDED = null;

export function init(embeddedVideo) {
  EMBEDDED = {
    video: {
      dimensions: {
        width: 560,
        widthUnit: 'px', // Valid values: 'px', 'percent'
        height: 315,
        heightUnit: 'px', // Valid values: 'px', 'percent'
      },
    },
  };

  if (void 0 !== embeddedVideo) {
    if (void 0 !== embeddedVideo.initialDimensions) {
      if (!isNaN(embeddedVideo.initialDimensions.width)) {
        EMBEDDED.video.dimensions.width = embeddedVideo.initialDimensions.width;
      }

      if ('string' === typeof embeddedVideo.initialDimensions.widthUnit) {
        if ('percent' === embeddedVideo.initialDimensions.widthUnit) {
          embeddedVideo.initialDimensions.widthUnit = 'percent';
        }
      }

      if (!isNaN(embeddedVideo.initialDimensions.height)) {
        EMBEDDED.video.dimensions.height = embeddedVideo.initialDimensions.height;
      }

      if ('string' === typeof embeddedVideo.initialDimensions.heightUnit) {
        if ('percent' === embeddedVideo.initialDimensions.heightUnit) {
          embeddedVideo.initialDimensions.heightUnit = 'percent';
        }
      }
    }
  }
}

export function settings() {
  return EMBEDDED;
}
