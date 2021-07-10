let NOTIFICATIONS = null;

export function init(settings) {
  NOTIFICATIONS = {
    messages: {
      addToLiked: 'Added to liked media',
      removeFromLiked: 'Removed from liked media',
      addToDisliked: 'Added to disliked media',
      removeFromDisliked: 'Removed from disliked media',
    },
  };

  let k, g;

  if (void 0 !== settings) {
    for (k in NOTIFICATIONS) {
      if (void 0 !== settings[k]) {
        if ('messages' === k) {
          for (g in NOTIFICATIONS[k]) {
            if ('string' === typeof settings[k][g]) {
              NOTIFICATIONS[k][g] = settings[k][g];
            }
          }
        }
      }
    }
  }
}

export function settings() {
  return NOTIFICATIONS;
}
